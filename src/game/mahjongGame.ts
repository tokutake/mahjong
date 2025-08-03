import { Tile } from '../domain/tile';
import type { Suit } from '../domain/tile';
import { Wall } from '../domain/wall';
import { InputMapper, type HitRect, type Player } from '../ui/inputMapper';
import { MahjongRenderer, type CalcYakuResult } from '../ui/renderer';
import { DebugPreloadedHands } from '../debug/DebugPreloadedHands';

export type CalcYakuFn = (tiles: Tile[]) => CalcYakuResult;

export class MahjongGame {
  calcYaku: CalcYakuFn;
  yakuList?: Record<string, { han?: number; yakuman?: boolean }>;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  renderer: MahjongRenderer;
  inputMapper: InputMapper;
  playerHands: [Tile[], Tile[], Tile[], Tile[]];
  discardPiles: [Tile[], Tile[], Tile[], Tile[]];
  currentPlayer: Player;
  selectedTile: Tile | null;
  wall: Wall;
  hitMap: Map<number, HitRect>;
  debugPreloadedYaku: boolean;

  constructor(opts: { calcYaku: CalcYakuFn; yakuList: Record<string, { han?: number; yakuman?: boolean }> }) {
    this.calcYaku = opts.calcYaku;
    this.yakuList = opts.yakuList;

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('canvas #game-canvas not found');
    this.canvas = canvas;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('CanvasRenderingContext2D not available');
    this.ctx = ctx;

    this.renderer = new MahjongRenderer(this.canvas);
    this.inputMapper = new InputMapper();

    this.playerHands = [[], [], [], []];
    this.discardPiles = [[], [], [], []];
    this.currentPlayer = 0 as Player;
    this.selectedTile = null;
    this.wall = new Wall();

    this.hitMap = new Map();
    this.debugPreloadedYaku = true;

    this.initGame();
    this.setupEventListeners();
  }

  initGame(): void {
    this.renderer.clear();
    this.discardPiles = [[], [], [], []];

    this.wall = new Wall();

    if (this.debugPreloadedYaku) {
      // Debug: use external helper so production bundle can tree-shake when DEV=false
      DebugPreloadedHands.applyToGame(this);
    } else {
      this.dealInitialHands();
    }

    this.draw();

    const remainEl = document.getElementById('remaining-tiles');
    if (remainEl) remainEl.textContent = String(this.wall.getRemainingCount());
  }


  dealInitialHands(): void {
    for (let player: Player = 0 as Player; player < 4; player = ((player + 1) % 4) as Player) {
      this.playerHands[player] = [];
      for (let i = 0; i < 13; i++) {
        const t = this.wall.drawTile();
        if (t !== null) this.playerHands[player].push(t);
      }
      this.sortHand(player);
    }

    const firstDraw = this.wall.drawTile();
    if (firstDraw) {
      this.playerHands[0 as Player].push(firstDraw);
      this.sortHand(0 as Player);
    }
  }

  drawTile(): Tile | null {
    return this.wall.drawTile();
  }

  sortHand(player: Player): void {
    this.playerHands[player].sort((a, b) => {
      if (a.suit !== b.suit) {
        const suitOrder = { m: 1, p: 2, s: 3, z: 4 } as const;
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.number - b.number;
    });
  }

  getHandWithFixedDraw(player: Player): Tile[] {
    const hand = this.playerHands[player];
    if (player !== 0) return hand;
    if (hand.length <= 13) return hand;

    const sorted13 = hand
      .slice(0, 13)
      .slice()
      .sort((a, b) => {
        if (a.suit !== b.suit) {
          const suitOrder = { m: 1, p: 2, s: 3, z: 4 } as const;
          return suitOrder[a.suit] - suitOrder[b.suit];
        }
        return a.number - b.number;
      });
    const drawn = hand[hand.length - 1];
    if (drawn === undefined) return hand;
    return [...sorted13, drawn];
  }

  draw(): void {
    this.renderer.clear();
    this.renderer.clear();

    this.renderer.drawPlayerHand(0 as Player, this.getHandWithFixedDraw(0 as Player), 60 + 47, 650);
    this.renderer.drawPlayerHand(1 as Player, this.playerHands[1 as Player], 50, 50, true);
    this.renderer.drawPlayerHand(2 as Player, this.playerHands[2 as Player], 60 + 47, 100);
    this.renderer.drawPlayerHand(3 as Player, this.playerHands[3 as Player], 1100, 50, true);

    this.renderer.drawDiscardPiles(this.discardPiles);
    this.renderer.drawInfo(this.wall.getTotalWallLength(), this.wall.getWallIndex(), this.currentPlayer);
    this.drawYakuInfo();

    this.inputMapper.setHitRegions(this.renderer.hitMap);
    const handIds = this.getHandWithFixedDraw(0 as Player).map(t => t.id);
    this.inputMapper.setPriority(handIds.slice().reverse());
  }

  drawYakuInfo(): void {
    const hand = this.playerHands[0 as Player];
    if (!hand || hand.length !== 14) return;

    const calc = this.calcYaku;
    const result: CalcYakuResult = calc ? calc(hand) : { yaku: [], han: 0, yakuman: false };
    this.renderer.drawYaku(result, this.yakuList);
  }

  setupEventListeners(): void {
    this.canvas.addEventListener('click', e => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const clickedId = this.inputMapper.pick(x, y, id => {
        const r = this.renderer.hitMap.get(id);
        if (!r) return false;
        if (r.player !== 0) return false;
        return this.playerHands[0 as Player].length === 14;
      });
      if (clickedId != null) {
        this.handleTileIdClick(clickedId);
      }
    });

    const newGameBtn = document.getElementById('new-game');
    newGameBtn?.addEventListener('click', () => {
      this.discardPiles = [[], [], [], []];
      this.playerHands = [[], [], [], []];
      this.currentPlayer = 0 as Player;
      this.wall = new Wall();

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const remainEl = document.getElementById('remaining-tiles');
      if (remainEl) remainEl.textContent = '0';
      const curEl = document.getElementById('current-player');
      if (curEl) curEl.textContent = '東';

      this.initGame();
    });
  }

  handleTileIdClick(clickedId: number): void {
    if (this.currentPlayer !== 0) return;
    if (this.playerHands[0 as Player].length !== 14) return;

    const realIndex = this.playerHands[0 as Player].findIndex(t => t.id === clickedId);
    if (realIndex < 0) return;

    this.discardTile(realIndex);
  }

  discardTile(tileIndex: number): void {
    if (this.currentPlayer !== 0) return;

    const hand0 = this.playerHands[0 as Player];
    if (!hand0 || tileIndex < 0 || tileIndex >= hand0.length) return;
    const tile = hand0[tileIndex];
    if (tile === undefined) return;
    hand0.splice(tileIndex, 1);
    this.discardPiles[0 as Player].push(tile);

    this.sortHand(0);

    this.nextPlayer();
    this.draw();

    setTimeout(() => {
      this.aiTurn();
    }, 100);
  }

  nextPlayer(): void {
    this.currentPlayer = ((this.currentPlayer + 1) % 4) as Player;
    const curEl = document.getElementById('current-player');
    if (curEl) curEl.textContent = (['東', '南', '西', '北'] as const)[this.currentPlayer];
  }

  aiTurn(): void {
    if (this.currentPlayer === (0 as Player)) return;

    const drawnTile = this.wall.drawTile();
    if (drawnTile) {
      this.playerHands[this.currentPlayer].push(drawnTile);
      this.sortHand(this.currentPlayer);

      const randomIndex = Math.floor(Math.random() * this.playerHands[this.currentPlayer].length);
      const handCur = this.playerHands[this.currentPlayer];
      if (handCur.length > 0) {
        const discardedTile = handCur[randomIndex]!;
        handCur.splice(randomIndex, 1);
        this.discardPiles[this.currentPlayer].push(discardedTile as Tile);
      }
    }

    this.nextPlayer();
    this.draw();

    if (this.currentPlayer !== (0 as Player)) {
      setTimeout(() => {
        this.aiTurn();
      }, 100);
    } else {
      const newTile = this.wall.drawTile();
      if (newTile) {
        this.playerHands[0 as Player].push(newTile);
        this.draw();
      }
    }

    const remainEl = document.getElementById('remaining-tiles');
    if (remainEl) remainEl.textContent = String(this.wall.getRemainingCount());
  }
}
