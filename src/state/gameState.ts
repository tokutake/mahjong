import { Tile, type Suit } from '../domain/tile';
import { InputMapper } from '../ui/inputMapper';
export type Player = 0 | 1 | 2 | 3;

export type HitRect = { x: number; y: number; w: number; h: number; player: Player };

import { DebugPreloadedHands } from '../debug/DebugPreloadedHands';
import { Wall } from '../domain/wall';
type DomainTile = import('../domain/tile').Tile;
type DomainSuit = import('../domain/tile').Suit;

export class GameState {
  // rendering/ports provide actual drawing; state is pure-ish with minimal side effects
  playerHands: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []];
  discardPiles: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []];

  // スコア
  scores: [number, number, number, number] = [25000, 25000, 25000, 25000];

  // 山と王牌
  wall: Wall = new Wall();

  // 場進行
  roundWind: 0 | 1 | 2 | 3 = 0; // 東南西北(0..3)
  dealer: Player = 0; // 親の座席
  honba = 0; // 本場
  kyoutaku = 0; // 供託（リーチ棒などを簡易カウント）
  currentPlayer: Player = 0;
  selectedTile: Tile | null = null;

  // 入力
  hitMap: Map<number, HitRect> = new Map();
  private inputMapper = new InputMapper();

  // デバッグ
  debugPreloadedYaku = true;

  newGame(): void {
    // 局開始初期化（場は維持）
    this.playerHands = [[], [], [], []];
    this.discardPiles = [[], [], [], []];
    // スコアは半荘継続想定のため維持（東場/南場を跨いでも保持）
    // 必要なら場がリセットされる別APIで初期化する
    this.wall = new Wall();
    this.currentPlayer = this.dealer;
    this.selectedTile = null;
    this.hitMap = new Map();

    if (this.debugPreloadedYaku) {
      // Adapt state to DebugPreloadedHands expected domain types
      const adapter = {
        get playerHands() { return thisRef.playerHands as unknown as [DomainTile[], DomainTile[], DomainTile[], DomainTile[]]; },
        set playerHands(v: [DomainTile[], DomainTile[], DomainTile[], DomainTile[]]) { thisRef.playerHands = v as unknown as [Tile[], Tile[], Tile[], Tile[]]; },
        drawTile: () => this.wall.drawTile() as unknown as DomainTile | null,
        sortHand: (p: Player) => this.sortHand(p),
        get currentPlayer() { return thisRef.currentPlayer; },
        set currentPlayer(v: Player) { thisRef.currentPlayer = v; },
        get dealer() { return thisRef.dealer; }
      };
      const thisRef = this;
      DebugPreloadedHands.applyToState(adapter as unknown as {
        playerHands: [DomainTile[], DomainTile[], DomainTile[], DomainTile[]];
        drawTile: () => DomainTile | null;
        sortHand: (p: Player) => void;
        currentPlayer: Player;
        dealer: Player;
      });
    } else {
      this.dealInitialHandsStrict();
    }
    return;
  }


  // 厳密配牌: 親14・子13。配算法自体は4-4-4-1に拘らず枚数結果を保証
  private dealInitialHandsStrict(): void {
    // 子に13枚、親に13枚配った後、親が最初のツモで14にする
    for (let p: Player = 0 as Player; p < 4; p = ((p + 1) % 4) as Player) {
      this.playerHands[p] = [];
      const base = 13;
      for (let i = 0; i < base; i++) {
        const t = this.wall.drawTile();
        if (t) this.playerHands[p].push(t);
      }
      this.sortHand(p);
    }
    // 親最初のツモ（14枚目）
    const first = this.wall.drawTile();
    if (first) {
      this.playerHands[this.dealer].push(first);
      this.sortHand(this.dealer);
    }
    this.currentPlayer = this.dealer;
  }


  drawTile(): Tile | null {
    return this.wall.drawTile();
  }

  sortHand(player: Player): void {
    this.playerHands[player].sort((a, b) => {
      if (a.suit !== b.suit) {
        const suitOrder: Record<Suit, number> = { m: 1, p: 2, s: 3, z: 4 };
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.number - b.number;
    });
  }

  getHandWithFixedDraw(player: Player): Tile[] {
    const hand = this.playerHands[player];
    if (player !== 0) return hand;
    if (hand.length <= 13) return hand;
    const sorted13 = hand.slice(0, 13).slice().sort((a, b) => {
      if (a.suit !== b.suit) {
        const suitOrder: Record<Suit, number> = { m: 1, p: 2, s: 3, z: 4 };
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.number - b.number;
    });
    const drawn = hand[hand.length - 1];
    if (!drawn) return hand;
    return [...sorted13, drawn];
  }

  // Rendererから同期される
  setHitRegions(hitMap: Map<number, HitRect>, priorityIds: number[]): void {
    this.hitMap = hitMap;
    this.inputMapper.setHitRegions(hitMap);
    this.inputMapper.setPriority(priorityIds);
  }

  pickTileId(x: number, y: number, forPlayer: Player): number | null {
    return this.inputMapper.pick(x, y, (id) => {
      const r = this.hitMap.get(id);
      if (!r) return false;
      if (r.player !== forPlayer) return false;
      return this.playerHands[forPlayer].length === 14;
    });
  }

  listActiveDora(): Tile[] {
    return this.wall.listActiveDora();
  }

  isExhaustiveDraw(): boolean {
    return this.wall.isExhaustiveDraw();
  }

  getDoraIndicators(): Tile[] {
    return this.wall.getDoraIndicators();
  }

  getWallRemainingCount(): number {
    return this.wall.getRemainingCount();
  }

  getWallIndex(): number {
    return this.wall.getWallIndex();
  }

  getTotalWallLength(): number {
    return this.wall.getTotalWallLength();
  }
}

export type { Player as PlayerType };
