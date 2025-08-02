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

export class GameController {
  private state: GameState;
  private renderer: RenderPorts;
  private calcYaku: CalcYakuFn;
  private yakuList: Record<string, { han?: number; yakuman?: boolean }>;

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
    this.syncRender();
  }

  sortMyHand(): void {
    this.state.sortHand(0 as Player);
    this.syncRender();
  }

  private onTileIdClick(clickedId: number): void {
    if (this.state.currentPlayer !== (0 as Player)) return;
    if (this.state.playerHands[0 as Player].length !== 14) return;
    const idx = this.state.playerHands[0 as Player].findIndex(t => t.id === clickedId);
    if (idx < 0) return;
    this.discardFromMyHand(idx);
  }

  private discardFromMyHand(tileIndex: number): void {
    if (this.state.currentPlayer !== (0 as Player)) return;
    const hand0 = this.state.playerHands[0 as Player];
    if (!hand0 || tileIndex < 0 || tileIndex >= hand0.length) return;
    const tile = hand0[tileIndex];
    if (!tile) return;
    hand0.splice(tileIndex, 1);
    this.state.discardPiles[0 as Player].push(tile);
    this.state.sortHand(0 as Player);

    this.nextPlayerTurn();
    this.syncRender();

    setTimeout(() => this.aiLoop(), 100);
  }

  private aiLoop(): void {
    if (this.state.currentPlayer === (0 as Player)) return;

    const drawn = this.state.drawTile();
    if (drawn) {
      this.state.playerHands[this.state.currentPlayer].push(drawn);
      this.state.sortHand(this.state.currentPlayer);

      const idx = Math.floor(Math.random() * this.state.playerHands[this.state.currentPlayer].length);
      const cur = this.state.playerHands[this.state.currentPlayer];
      if (cur.length > 0) {
        const discarded = cur[idx]!;
        cur.splice(idx, 1);
        this.state.discardPiles[this.state.currentPlayer].push(discarded);
      }
    }

    this.nextPlayerTurn();
    this.syncRender();

    if (this.state.currentPlayer !== (0 as Player)) {
      setTimeout(() => this.aiLoop(), 100);
    } else {
      const newTile = this.state.drawTile();
      if (newTile) {
        this.state.playerHands[0 as Player].push(newTile);
        this.syncRender();
      }
    }

    this.renderer.updateInfo(this.state.wall.length - this.state.wallIndex, this.state.currentPlayer);
  }

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
