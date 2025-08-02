export type Suit = 'm' | 'p' | 's' | 'z';
export type TileType = 'number' | 'honor';
export type Player = 0 | 1 | 2 | 3;

let __tileSeq_state = 0;
export class Tile {
  id: number;
  suit: Suit;
  number: number;
  type: TileType;
  unicode: string;

  constructor(suit: Suit, number: number, type: TileType = 'number') {
    this.id = __tileSeq_state++;
    this.suit = suit;
    this.number = number;
    this.type = type;
    this.unicode = this.getUnicode();
  }

  private getUnicode(): string {
    const tiles: Readonly<Record<Suit, readonly string[]>> = {
      m: ['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'] as const,
      p: ['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🀟', '🀠', '🀡'] as const,
      s: ['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗', '🀘'] as const,
      z: ['🀀', '🀁', '🀂', '🀃', '🀆', '🀅', '🀄'] as const
    };
    const idx = this.number - 1;
    if (this.suit === 'z') {
      if (idx < 0 || idx >= tiles.z.length) {
        throw new Error(`Invalid honor number: ${this.number}`);
      }
      return tiles.z[idx]!;
    }
    if (idx < 0 || idx >= tiles[this.suit].length) {
      throw new Error(`Invalid number for suit ${this.suit}: ${this.number}`);
    }
    return tiles[this.suit][idx]!;
  }

  equals(other: Tile): boolean {
    return this.suit === other.suit && this.number === other.number;
  }
}

export type HitRect = { x: number; y: number; w: number; h: number; player: Player };

class InputMapper {
  private regions: Map<number, HitRect> = new Map();
  private priority: number[] = [];

  setHitRegions(regions: Map<number, HitRect>): void {
    this.regions = new Map(regions);
  }

  setPriority(idsInOrder: number[]): void {
    this.priority = idsInOrder.slice();
  }

  pick(x: number, y: number, filter?: (id: number) => boolean): number | null {
    const ids = this.priority.length > 0 ? this.priority : Array.from(this.regions.keys());
    for (const id of ids) {
      const rect = this.regions.get(id);
      if (!rect) continue;
      if (filter && !filter(id)) continue;
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        return id;
      }
    }
    return null;
  }
}

export class GameState {
  // rendering/ports provide actual drawing; state is pure-ish with minimal side effects
  playerHands: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []];
  discardPiles: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []];
  wall: Tile[] = [];
  wallIndex = 0;
  currentPlayer: Player = 0;
  selectedTile: Tile | null = null;
  hitMap: Map<number, HitRect> = new Map();
  private inputMapper = new InputMapper();
  debugPreloadedYaku = true;

  newGame(): void {
    this.playerHands = [[], [], [], []];
    this.discardPiles = [[], [], [], []];
    this.wall = [];
    this.wallIndex = 0;
    this.currentPlayer = 0 as Player;
    this.selectedTile = null;
    this.hitMap = new Map();

    this.createAllTiles();
    this.shuffleWall();

    if (this.debugPreloadedYaku) {
      this.setupPreloadedYakuHands();
    } else {
      this.dealInitialHands();
    }
    return;
  }

  createAllTiles(): void {
    this.wall = [];
    (['m', 'p', 's'] as Suit[]).forEach((suit: Suit) => {
      for (let num = 1; num <= 9; num++) {
        for (let i = 0; i < 4; i++) {
          this.wall.push(new Tile(suit, num));
        }
      }
    });
    for (let num = 1; num <= 7; num++) {
      for (let i = 0; i < 4; i++) {
        this.wall.push(new Tile('z', num));
      }
    }
  }

  shuffleWall(): void {
    for (let i = this.wall.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.wall[i]!;
      this.wall[i] = this.wall[j]!;
      this.wall[j] = tmp;
    }
    this.wallIndex = 0;
  }

  dealInitialHands(): void {
    for (let p: Player = 0 as Player; p < 4; p = ((p + 1) % 4) as Player) {
      this.playerHands[p] = [];
      for (let i = 0; i < 13; i++) {
        const t = this.drawTile();
        if (t) this.playerHands[p].push(t);
      }
      this.sortHand(p);
    }
    const first = this.drawTile();
    if (first) {
      this.playerHands[0 as Player].push(first);
      this.sortHand(0 as Player);
    }
  }

  setupPreloadedYakuHands(): void {
    this.playerHands = [[], [], [], []];
    for (let p: Player = 0 as Player; p < 4; p = ((p + 1) % 4) as Player) {
      this.playerHands[p] = [];
      for (let i = 0; i < 13; i++) {
        const t = this.drawTile();
        if (t !== null) this.playerHands[p].push(t);
      }
      this.sortHand(p);
      if (p == (3 as Player)) break;
    }
    const firstDraw = this.drawTile();
    if (firstDraw) {
      this.playerHands[0 as Player].push(firstDraw);
      this.sortHand(0 as Player);
    }

    const hand: Tile[] = [];
    const pushN = (suit: Suit, number: number, count: number = 1) => {
      for (let i = 0; i < count; i++) hand.push(new Tile(suit, number));
    };
    pushN('s', 1); pushN('s', 2); pushN('s', 3);
    pushN('s', 4); pushN('s', 5); pushN('s', 6);
    pushN('s', 7); pushN('s', 8); pushN('s', 9);
    pushN('s', 2); pushN('s', 3); pushN('s', 4);
    pushN('s', 5, 2);

    this.playerHands[0 as Player] = hand;
    this.sortHand(0 as Player);
  }

  drawTile(): Tile | null {
    if (this.wallIndex < this.wall.length) {
      const tile = this.wall[this.wallIndex++];
      return tile ?? null;
    }
    return null;
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
}

export type { Player as PlayerType };
