import type { CalcYakuFn } from '../mahjong';
import { GameState } from '../state/gameState';
import type { Player } from '../state/gameState';

export type RenderPorts = {
  draw(state: Readonly<GameState>): void;
  drawYaku(result: { yaku: string[]; han: number; yakuman: boolean }, yakuList?: Record<string, { han?: number; yakuman?: boolean }>): void;
  bindCanvasClick(handler: (x: number, y: number) => void): void;
  updateInfo(remain: number, currentPlayer: Player): void;
  setHitRegions(hitMap: Map<number, { x: number; y: number; w: number; h: number; player: Player }>, priority: number[]): void;
};

export type GamePhase =
  | 'Idle'
  | 'HumanTurn_Draw'
  | 'HumanTurn_DiscardWait'
  | 'AITurn_Draw'
  | 'AITurn_Discard'
  | 'GameOver';

export class GameController {
  private state: GameState;
  private renderer: RenderPorts;
  private calcYaku: CalcYakuFn;
  private yakuList: Record<string, { han?: number; yakuman?: boolean }>;
  // Humanのツモ後に和了可能な判定結果を保持（ボタン制御用）
  private pendingHumanTsumoWin: { yaku: string[]; han: number; yakuman: boolean } | null = null;
  // 簡易点数計算結果（和了可時のプレビュー用）
  private pendingHumanScore: import('../score').ScoreBreakdown | null = null;
  // ブラウザ向けに score モジュールを動的 import（Node の require は使わない）
  private loadScoreModule = async () => await import('../score');

  // ステートマシン定義
  private phase: GamePhase = 'Idle';

  private isHumanPhase(p: GamePhase): p is 'HumanTurn_Draw' | 'HumanTurn_DiscardWait' {
    return p === 'HumanTurn_Draw' || p === 'HumanTurn_DiscardWait';
  }

  // タイマー併存用（アクション遅延）
  private enableDelays = true;
  private timers = new Map<string, number>();

  private setTimer(key: string, ms: number, fn: () => void) {
    this.clearTimer(key);
    const id = window.setTimeout(() => {
      // フェーズ変化で無効化される可能性があるため、実行時に存在チェック
      if (this.timers.has(key)) {
        this.timers.delete(key);
        fn();
      }
    }, ms);
    this.timers.set(key, id);
  }

  private clearTimer(key: string) {
    const id = this.timers.get(key);
    if (id != null) {
      clearTimeout(id);
      this.timers.delete(key);
    }
  }

  private clearAllTimers() {
    for (const id of this.timers.values()) {
      clearTimeout(id);
    }
    this.timers.clear();
  }

  private enterPhase(next: GamePhase) {
    // フェーズ遷移時に既存タイマーをすべてクリア
    this.clearAllTimers();
    this.phase = next;

    // 遷移時エフェクト（必要に応じて遅延付与）
    switch (next) {
      case 'HumanTurn_Draw': {
        const perform = () => {
          // 王牌14枚を残して山切れなら流局へ
          if (this.state.isExhaustiveDraw()) {
            this.handleExhaustiveDraw();
            return;
          }
          const t = this.state.drawTile();
          if (t) {
            this.state.playerHands[0 as Player].push(t);
            this.state.sortHand(0 as Player);
          }
          // Humanのツモ直後に役判定（簡易: 門前想定）
          const res = this.calcYaku(this.state.playerHands[0 as Player] as unknown as any[]);
          // 表示用には通常のcalc（既存）を用いる。アガリ可否だけここで判定
          const isWinPossible = res && (res.han > 0 || res.yakuman);
          const winBtn = document.getElementById('win-button') as HTMLButtonElement | null;
          if (isWinPossible && winBtn) {
            this.pendingHumanTsumoWin = res;

            // ツモ前提の簡易点数プレビューを計算
            // 動的importは非同期なので、プレビューは syncRender で描く（ここでは保持のみ）
            this.pendingHumanScore = null;

            winBtn.style.display = 'inline-block';
          } else {
            this.pendingHumanTsumoWin = null;
            this.pendingHumanScore = null;
            if (winBtn) winBtn.style.display = 'none';
          }

          this.syncRender();
          this.renderer.updateInfo(this.state.wall.length - this.state.wallIndex, this.state.currentPlayer);
          // ツモ後は捨て待ちへ
          this.enterPhase('HumanTurn_DiscardWait');
        };
        if (this.enableDelays) this.setTimer('humanDraw', 150, perform);
        else perform();
        break;
      }
      case 'HumanTurn_DiscardWait': {
        // 入力待ち。レンダリングだけ
        this.syncRender();
        this.renderer.updateInfo(this.state.wall.length - this.state.wallIndex, this.state.currentPlayer);
        break;
      }
      case 'AITurn_Draw': {
        const perform = () => {
          if (this.state.currentPlayer === (0 as Player)) {
            // ガード：人手番になっていたら人間のツモへ
            this.enterPhase('HumanTurn_Draw');
            return;
          }
          if (this.state.isExhaustiveDraw()) {
            this.handleExhaustiveDraw();
            return;
          }
          const t = this.state.drawTile();
          if (t) {
            this.state.playerHands[this.state.currentPlayer].push(t);
            this.state.sortHand(this.state.currentPlayer);
          }

          // Human向けの pending はクリア（AI手番中はボタンを出さない）
          const winBtn = document.getElementById('win-button') as HTMLButtonElement | null;
          if (winBtn) winBtn.style.display = 'none';
          this.pendingHumanTsumoWin = null;

          this.syncRender();
          this.renderer.updateInfo(this.state.wall.length - this.state.wallIndex, this.state.currentPlayer);
          // 次は AI の捨て
          this.enterPhase('AITurn_Discard');
        };
        if (this.enableDelays) this.setTimer('aiDraw', 200, perform);
        else perform();
        break;
      }
      case 'AITurn_Discard': {
        const perform = () => {
          const cur = this.state.playerHands[this.state.currentPlayer];
          if (cur.length > 0) {
            const idx = Math.floor(Math.random() * cur.length);
            const discarded = cur[idx]!;
            cur.splice(idx, 1);
            this.state.discardPiles[this.state.currentPlayer].push(discarded);
          }
          // 次プレイヤーへ
          this.nextPlayerTurn();

          this.syncRender();
          this.renderer.updateInfo(this.state.wall.length - this.state.wallIndex, this.state.currentPlayer);

          if (this.state.currentPlayer === (0 as Player)) {
            this.enterPhase('HumanTurn_Draw');
          } else {
            this.enterPhase('AITurn_Draw');
          }
        };
        if (this.enableDelays) this.setTimer('aiDiscard', 250, perform);
        else perform();
        break;
      }
      case 'GameOver': {
        this.syncRender();
        break;
      }
      case 'Idle': {
        // noop
        break;
      }
    }
  }

  constructor(opts: {
    state: GameState;
    renderer: RenderPorts;
    calcYaku: CalcYakuFn;
    yakuList: Record<string, { han?: number; yakuman?: boolean }>;
  }) {
    this.state = opts.state;
    this.renderer = opts.renderer;
    this.calcYaku = opts.calcYaku;
    this.yakuList = opts.yakuList;

    this.renderer.bindCanvasClick((x, y) => {
      const id = this.state.pickTileId(x, y, 0 as Player);
      if (id != null) this.onTileIdClick(id);
    });

    // 「アガリ」ボタンのバインド
    const winBtn = document.getElementById('win-button') as HTMLButtonElement | null;
    if (winBtn) {
      winBtn.addEventListener('click', async () => {
        if (!this.pendingHumanTsumoWin) return;

        // 簡易: ツモ和了として点数計算（動的import）
        const { calcScore } = await this.loadScoreModule();
        const tiles = this.state.playerHands[0 as Player].map(t => ({ suit: t.suit, number: t.number }));
        const score = calcScore({
          tiles,
          yakuResult: this.pendingHumanTsumoWin,
          dealer: this.state.dealer === (0 as Player),
          winType: 'tsumo'
        });

        // 画面描画（役と点数の概要）
        this.syncRender();
        this.renderer.drawYaku(this.pendingHumanTsumoWin, this.yakuList);
        // 追加で点数概要も表示（キャンバス右側）
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          ctx.fillStyle = '#000';
          ctx.font = '16px Arial';
          let x = 900;
          let y = 220;
          ctx.fillText('点数', x, y);
          y += 22;
          ctx.fillText(`符: ${score.fu}符 / 翻: ${score.han}翻`, x, y); y += 20;
          ctx.fillText(`上限: ${score.limit === 'none' ? '—' : score.limit}`, x, y); y += 20;
          if (this.state.dealer === (0 as Player)) {
            // 親
            if (score.payments.tsumoChild != null) {
              ctx.fillText(`親ツモ: 子×3 = ${score.payments.tsumoChild}点 × 3`, x, y); y += 20;
            } else if (score.payments.ron != null) {
              ctx.fillText(`親ロン: ${score.payments.ron}点`, x, y); y += 20;
            }
          } else {
            // 子
            if (score.payments.tsumoParent != null && score.payments.tsumoChild != null) {
              ctx.fillText(`子ツモ: 親 ${score.payments.tsumoParent}点 / 子 ${score.payments.tsumoChild}点`, x, y); y += 20;
            } else if (score.payments.ron != null) {
              ctx.fillText(`子ロン: ${score.payments.ron}点`, x, y); y += 20;
            }
          }
        }

        this.enterPhase('GameOver');
        // ボタンを隠す
        if (winBtn) winBtn.style.display = 'none';
        this.pendingHumanTsumoWin = null;
        this.pendingHumanScore = null;
      });
    }

    this.syncRender();
  }

  newGame(): void {
    this.state.newGame();
    // 親番に応じて開始フェーズを分岐
    if (this.state.currentPlayer === (0 as Player)) {
      // 親（あなた）が14枚のはず。配牌後は打牌待ち
      this.enterPhase('HumanTurn_DiscardWait');
    } else {
      // 他家が親の場合、AI のツモから開始
      this.enterPhase('AITurn_Draw');
    }
  }

  sortMyHand(): void {
    this.state.sortHand(0 as Player);
    this.syncRender();
  }

  private onTileIdClick(clickedId: number): void {
    if (this.phase !== 'HumanTurn_DiscardWait') return;
    if (this.state.currentPlayer !== (0 as Player)) return;
    if (this.state.playerHands[0 as Player].length !== 14) return;
    const idx = this.state.playerHands[0 as Player].findIndex(t => t.id === clickedId);
    if (idx < 0) return;
    this.discardFromMyHand(idx);
  }

  private discardFromMyHand(tileIndex: number): void {
    if (this.phase !== 'HumanTurn_DiscardWait') return;
    if (this.state.currentPlayer !== (0 as Player)) return;

    const hand0 = this.state.playerHands[0 as Player];
    if (!hand0 || tileIndex < 0 || tileIndex >= hand0.length) return;

    const tile = hand0[tileIndex];
    if (!tile) return;

    // Humanが打牌する場合は、アガリ中断
          const winBtn = document.getElementById('win-button') as HTMLButtonElement | null;
          if (winBtn) winBtn.style.display = 'none';
          this.pendingHumanTsumoWin = null;
          this.pendingHumanScore = null;

    // 捨て
    hand0.splice(tileIndex, 1);
    this.state.discardPiles[0 as Player].push(tile);
    this.state.sortHand(0 as Player);

    // 次プレイヤーへ
    this.nextPlayerTurn();

    // ステート遷移: AIのツモへ（enterPhase 経由で遅延併存）
    this.enterPhase('AITurn_Draw');
  }

  // 旧 step() は不要。GameOver判定は各 enterPhase 先頭で行うのも可だが、
  // 描画更新のたびにチェックされるため現状は省略（必要なら enterPhase 内に山尽きチェックを追加）。

  private nextPlayerTurn(): void {
    this.state.currentPlayer = ((this.state.currentPlayer + 1) % 4) as Player;
  }

  private syncRender(): void {
    this.renderer.draw(this.state);
    if (this.state.playerHands[0 as Player].length === 14) {
      // yaku.ts の calcYaku は構造互換の牌配列を受け取ればよい想定のため、型を明示的に合わせる
      const res = this.calcYaku(this.state.playerHands[0 as Player] as unknown as any[]);
      this.renderer.drawYaku(res, this.yakuList);

      // 点数プレビュー（アガリ可能時のみ）
      if (res && (res.han > 0 || res.yakuman)) {
        // 非同期 import をここで実行し、プレビュー描画
        (async () => {
          try {
            const { calcScore } = await this.loadScoreModule();
            const tiles = this.state.playerHands[0 as Player].map(t => ({ suit: t.suit, number: t.number }));
            const preview = calcScore({
              tiles,
              yakuResult: res,
              dealer: this.state.dealer === (0 as Player),
              winType: 'tsumo' // プレビューはツモ前提
            });
            const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx) {
              ctx.fillStyle = '#000';
              ctx.font = '14px Arial';
              let x = 900;
              let y = 250;
              ctx.fillText(`[プレビュー] 符:${preview.fu} / 翻:${preview.han} / ${preview.limit === 'none' ? '—' : preview.limit}`, x, y);
              y += 18;
              if (this.state.dealer === (0 as Player)) {
                if (preview.payments.tsumoChild != null) {
                  ctx.fillText(`親ツモ見込: 子×3 = ${preview.payments.tsumoChild}点`, x, y);
                }
              } else {
                if (preview.payments.tsumoParent != null && preview.payments.tsumoChild != null) {
                  ctx.fillText(`子ツモ見込: 親 ${preview.payments.tsumoParent} / 子 ${preview.payments.tsumoChild}`, x, y);
                }
              }
            }
          } catch {
            // no-op
          }
        })();
      }
    }
    this.renderer.updateInfo(this.state.wall.length - this.state.wallIndex, this.state.currentPlayer);
    // TODO: ドラ表示や場情報の描画は main.ts 側のrenderer拡張で行う

    const ids = this.state.getHandWithFixedDraw(0 as Player).map(t => t.id).slice().reverse();
    this.renderer.setHitRegions(this.state.hitMap, ids);
  }

  // 山切れ流局（不聴/聴牌処理は簡易: まだ未実装なので親流れ、本場加算の骨格のみ）
  private handleExhaustiveDraw(): void {
    // 簡易：親不変条件（親聴牌）は未判定のため、親流れとする
    // 厳密化タスクの一部として、聴牌判定と連荘条件を今後実装
    // ここでは局を終了させ、次局の準備だけ行う
    // 本場は+1（簡易仕様）
    this.state.honba += 1;

    // 親を移動（簡易: 常に移動。将来は親聴牌/和了で連荘）
    this.state.dealer = ((this.state.dealer + 1) % 4) as Player;

    // 次局開始
    this.newGame();
  }
}
