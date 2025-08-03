import { InputMapper, type HitRect, type Player } from './inputMapper';
import { MahjongRenderer, type CalcYakuResult } from './renderer';
import { Tile } from '../domain/tile';
import type { YakuList } from '../domain/yaku';
import {
  applyAction,
  canDiscard,
  getHandWithFixedDraw,
  initGame,
  remainingTiles,
  type GameState,
} from '../core/MahjongEngine';

export type CalcYakuFn = (tiles: Tile[]) => CalcYakuResult;

export class GamePresenter {
  private canvas: HTMLCanvasElement;
  private renderer: MahjongRenderer;
  private inputMapper: InputMapper;
  private state: GameState;
  private calcYaku: CalcYakuFn;
  private yakuList?: YakuList;
  private aiTimer: number | null = null;

  constructor(opts: { calcYaku: CalcYakuFn; yakuList: YakuList; debugPreloadedYaku?: boolean }) {
    this.calcYaku = opts.calcYaku;
    this.yakuList = opts.yakuList;

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('canvas #game-canvas not found');
    this.canvas = canvas;

    this.renderer = new MahjongRenderer(this.canvas);
    this.inputMapper = new InputMapper();

    this.state = initGame(opts.debugPreloadedYaku ?? true);

    this.setupEventListeners();
    this.render();

    // schedule AI if needed
    this.maybeScheduleAi();
  }

  private setState(next: GameState): void {
    this.state = next;
    this.render();
    this.maybeScheduleAi();
  }

  private render(): void {
    this.renderer.clear();

    // hands
    this.renderer.drawPlayerHand(0 as Player, getHandWithFixedDraw(this.state, 0 as Player), 60 + 47, 650);
    this.renderer.drawPlayerHand(1 as Player, this.state.playerHands.get(1 as Player), 50, 50, true);
    this.renderer.drawPlayerHand(2 as Player, this.state.playerHands.get(2 as Player), 60 + 47, 100);
    this.renderer.drawPlayerHand(3 as Player, this.state.playerHands.get(3 as Player), 1100, 50, true);

    // discards/info
    this.renderer.drawDiscardPiles(this.state.discardPiles);
    this.renderer.drawInfo(this.state.wall.getTotalWallLength(), this.state.wall.getWallIndex(), this.state.currentPlayer);

    // yaku
    const hand = this.state.playerHands.get(0 as Player);
    if (hand && hand.length === 14) {
      const result: CalcYakuResult = this.calcYaku ? this.calcYaku(hand) : { yaku: [], han: 0, yakuman: false };
      this.renderer.drawYaku(result, this.yakuList);
    }

    // input mapper hit regions
    this.inputMapper.setHitRegions(this.renderer.hitMap);
    const handIds = getHandWithFixedDraw(this.state, 0 as Player).map(t => t.id);
    this.inputMapper.setPriority(handIds.slice().reverse());

    // DOM texts
    const remainEl = document.getElementById('remaining-tiles');
    if (remainEl) remainEl.textContent = String(remainingTiles(this.state));
    const curEl = document.getElementById('current-player');
    if (curEl) curEl.textContent = (['東', '南', '西', '北'] as const)[this.state.currentPlayer];
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('click', e => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const clickedId = this.inputMapper.pick(x, y, id => {
        const r = this.renderer.hitMap.get(id);
        if (!r) return false;
        if (r.player !== 0) return false;
        return canDiscard(this.state, 0 as Player);
      });
      if (clickedId != null) {
        this.handleTileIdClick(clickedId);
      }
    });

    const newGameBtn = document.getElementById('new-game');
    newGameBtn?.addEventListener('click', () => {
      if (this.aiTimer != null) {
        window.clearTimeout(this.aiTimer);
        this.aiTimer = null;
      }
      // re-init
      const next = initGame(true);
      this.setState(next);
    });
  }

  private handleTileIdClick(clickedId: number): void {
    if (!canDiscard(this.state, 0 as Player)) return;

    const hand0 = this.state.playerHands.get(0 as Player);
    const realIndex = hand0.findIndex(t => t.id === clickedId);
    if (realIndex < 0) return;

    const next = applyAction(this.state, { type: 'Discard', player: 0 as Player, tileIndex: realIndex });
    this.setState(next);
  }

  private maybeScheduleAi(): void {
    if (this.state.currentPlayer !== (0 as Player)) {
      if (this.aiTimer != null) {
        window.clearTimeout(this.aiTimer);
      }
      this.aiTimer = window.setTimeout(() => {
        const next = applyAction(this.state, { type: 'AiStep' });
        this.setState(next);
        // After AI step, if player 0's turn, draw one tile automatically (to mimic previous behavior)
        if (next.currentPlayer === (0 as Player)) {
          const afterDraw = applyAction(next, { type: 'DrawSelf', player: 0 as Player });
          this.setState(afterDraw);
        }
      }, 100);
    }
  }
}
