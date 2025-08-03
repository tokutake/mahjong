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
    return `${this.suit}${this.number}`;
  }

  equals(other: Tile): boolean {
    return this.suit === other.suit && this.number === other.number;
  }

  isNumber(): boolean {
    return this.type === 'number';
  }

  static sort(a: Tile, b: Tile): number {
    if (a.suit !== b.suit) {
      return a.suit.localeCompare(b.suit);
    }
    return a.number - b.number;
  }

  static fromString(str: string): Tile {
    const suitChar = str.charAt(0);
    const numberChar = str.charAt(1);

    let suit: Suit;
    let number: number;

    switch (suitChar) {
      case 'm':
        suit = 'm';
        break;
      case 'p':
        suit = 'p';
        break;
      case 's':
        suit = 's';
        break;
      case 'z':
        suit = 'z';
        break;
      default:
        throw new Error(`Invalid suit character: ${suitChar}`);
    }

    number = parseInt(numberChar, 10);

    if (isNaN(number)) {
      throw new Error(`Invalid number character: ${numberChar}`);
    }

    return new Tile(suit, number);
  }
}
