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

  // 山と王牌
  wall: Tile[] = [];
  wallIndex = 0; // = liveWallStart + drawsConsumed
  deadWall: Tile[] = []; // 王牌14枚（ツモ切れ防止のため常に残す）
  doraIndicators: Tile[] = []; // 表ドラ指示牌（初期1、カンで増える）
  uraIndicators: Tile[] = []; // 裏ドラ指示牌（リーチ時のみ有効、可視化用に保持）

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
    this.wall = [];
    this.deadWall = [];
    this.doraIndicators = [];
    this.uraIndicators = [];
    this.wallIndex = 0;
    this.currentPlayer = this.dealer;
    this.selectedTile = null;
    this.hitMap = new Map();

    this.createAllTiles();
    this.shuffleWall();
    this.buildDeadWallAndIndicators(); // 王牌14枚＋ドラ表示

    if (this.debugPreloadedYaku) {
      this.setupPreloadedYakuHands();
    } else {
      this.dealInitialHandsStrict();
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

  // 王牌（deadWall）14枚を末尾から確保し、表ドラ/裏ドラの位置を決定
  private buildDeadWallAndIndicators(): void {
    // 末尾14枚を王牌とする
    const deadCount = 14;
    if (this.wall.length < deadCount) throw new Error('wall too small');
    this.deadWall = this.wall.splice(this.wall.length - deadCount, deadCount);

    // ドラ表示牌は王牌の4枚目（一般ルールの「手前から」表現に対応した簡易実装）
    // 配列末尾を王牌の「奥」とみなし、分かりやすく先頭から数える
    // ここでは deadWall[4] を表示牌とする（厳密な位置は将来の牌山モデルで調整）
    const indicatorIndex = 4;
    const uraIndex = indicatorIndex + 5; // 裏ドラは表示牌の5枚先（目安）
    const ind = this.deadWall[indicatorIndex];
    if (ind) this.doraIndicators = [ind];
    const ura = this.deadWall[uraIndex];
    if (ura) this.uraIndicators = [ura];
  }

  // 厳密配牌: 親14・子13。配算法自体は4-4-4-1に拘らず枚数結果を保証
  private dealInitialHandsStrict(): void {
    // 子に13枚、親に13枚配った後、親が最初のツモで14にする
    for (let p: Player = 0 as Player; p < 4; p = ((p + 1) % 4) as Player) {
      this.playerHands[p] = [];
      const base = 13;
      for (let i = 0; i < base; i++) {
        const t = this.drawTileStrict();
        if (t) this.playerHands[p].push(t);
      }
      this.sortHand(p);
    }
    // 親最初のツモ（14枚目）
    const first = this.drawTileStrict();
    if (first) {
      this.playerHands[this.dealer].push(first);
      this.sortHand(this.dealer);
    }
    this.currentPlayer = this.dealer;
  }

  setupPreloadedYakuHands(): void {
    this.playerHands = [[], [], [], []];
    for (let p: Player = 0 as Player; p < 4; p = ((p + 1) % 4) as Player) {
      this.playerHands[p] = [];
      for (let i = 0; i < 13; i++) {
        const t = this.drawTileStrict();
        if (t !== null) this.playerHands[p].push(t);
      }
      this.sortHand(p);
      if (p == (3 as Player)) break;
    }
    const firstDraw = this.drawTileStrict();
    if (firstDraw) {
      this.playerHands[this.dealer].push(firstDraw);
      this.sortHand(this.dealer);
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

    this.playerHands[this.dealer] = hand;
    this.sortHand(this.dealer);
    this.currentPlayer = this.dealer;
  }

  // 王牌14枚を残すため、live wallからのみツモ可能
  drawTileStrict(): Tile | null {
    const liveWallRemaining = this.wall.length - this.wallIndex;
    if (liveWallRemaining <= 0) return null;
    const tile = this.wall[this.wallIndex++];
    return tile ?? null;
  }

  // 後方互換（既存呼び出しがあるためラッパー）
  drawTile(): Tile | null {
    return this.drawTileStrict();
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

  // ドラ表示牌の次位牌を返す（数牌は9→1、字牌は東→南→西→北→東、白→發→中→白）
  getDoraFromIndicator(ind: Tile): Tile {
    const nextNumber = () => {
      if (ind.suit === 'z') {
        // 1-4: 風、5-7: 三元
        if (ind.number >= 1 && ind.number <= 4) return ((ind.number % 4) + 1);
        if (ind.number >= 5 && ind.number <= 7) return ((ind.number - 5 + 1) % 3) + 5;
        return ind.number;
      } else {
        return ind.number === 9 ? 1 : ind.number + 1;
      }
    };
    return new Tile(ind.suit, nextNumber(), ind.type);
  }

  // 現在有効な表ドラ一覧（カン未実装なので1枚のみだが配列対応）
  listActiveDora(): Tile[] {
    return this.doraIndicators.map((ind) => this.getDoraFromIndicator(ind));
  }

  // 流局（山切れ：王牌14枚を残してツモ不可になった）かどうか
  isExhaustiveDraw(): boolean {
    return (this.wall.length - this.wallIndex) <= 0;
  }
}

export type { Player as PlayerType };
