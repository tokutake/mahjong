export type Suit = 'm' | 'p' | 's' | 'z';
export type TileType = 'number' | 'honor';

let __tileSeq = 0;

export class Tile {
  id: number;
  suit: Suit;
  number: number;
  type: TileType;
  unicode: string;

  constructor(suit: Suit, number: number, type: TileType = 'number') {
    this.id = __tileSeq++; // 一意IDを付与
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

  toString(): string {
    const names = {
      m: '萬子',
      p: '筒子',
      s: '索子',
      z: '字牌'
    } as const;

    if (this.suit === 'z') {
      const honors = ['東', '南', '西', '北', '白', '發', '中'] as const;
      const zihaiString = honors[this.number - 1];
      if (!zihaiString) {
        throw new Error(`Invalid honor tile number: ${this.number}`);
      }
      return zihaiString;
    }

    return `${this.number}${names[this.suit]}`;
  }

  equals(other: Tile): boolean {
    return this.suit === other.suit && this.number === other.number;
  }
}
