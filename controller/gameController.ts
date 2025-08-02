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
          const t = this.state.drawTile();
          if (t) {
            this.state.playerHands[0 as Player].push(t);
            this.state.sortHand(0 as Player);
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
          const t = this.state.drawTile();
          if (t) {
            this.state.playerHands[this.state.currentPlayer].push(t);
            this.state.sortHand(this.state.currentPlayer);
          }
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

    this.syncRender();
  }

  newGame(): void {
    this.state.newGame();
    this.state.currentPlayer = 0 as Player;
    // 人間は配牌時点で14枚（draw済）なので捨て待ちから開始
    this.enterPhase('HumanTurn_DiscardWait');
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
    }
    this.renderer.updateInfo(this.state.wall.length - this.state.wallIndex, this.state.currentPlayer);

    const ids = this.state.getHandWithFixedDraw(0 as Player).map(t => t.id).slice().reverse();
    this.renderer.setHitRegions(this.state.hitMap, ids);
  }
}
