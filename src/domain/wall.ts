import { Tile, type Suit } from './tile';

export class Wall {
  private tiles: Tile[] = [];
  private drawIndex = 0;
  private deadWall: Tile[] = [];
  private doraIndicators: Tile[] = [];
  private uraIndicators: Tile[] = [];

  constructor() {
    this.initialize();
  }

  initialize(): void {
    this.tiles = [];
    this.drawIndex = 0;
    this.deadWall = [];
    this.doraIndicators = [];
    this.uraIndicators = [];
    this.createAllTiles();
    this.shuffle();
    this.buildDeadWallAndIndicators();
  }

  private createAllTiles(): void {
    this.tiles = [];
    
    (['m', 'p', 's'] as Suit[]).forEach((suit: Suit) => {
      for (let num = 1; num <= 9; num++) {
        for (let i = 0; i < 4; i++) {
          this.tiles.push(new Tile(suit, num));
        }
      }
    });

    for (let num = 1; num <= 7; num++) {
      for (let i = 0; i < 4; i++) {
        this.tiles.push(new Tile('z', num));
      }
    }
  }

  private shuffle(): void {
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.tiles[i]!;
      this.tiles[i] = this.tiles[j]!;
      this.tiles[j] = tmp;
    }
    this.drawIndex = 0;
  }

  private buildDeadWallAndIndicators(): void {
    const deadCount = 14;
    if (this.tiles.length < deadCount) throw new Error('wall too small');
    this.deadWall = this.tiles.splice(this.tiles.length - deadCount, deadCount);

    const indicatorIndex = 4;
    const uraIndex = indicatorIndex + 5;
    const ind = this.deadWall[indicatorIndex];
    if (ind) this.doraIndicators = [ind];
    const ura = this.deadWall[uraIndex];
    if (ura) this.uraIndicators = [ura];
  }

  drawTile(): Tile | null {
    const liveWallRemaining = this.tiles.length - this.drawIndex;
    if (liveWallRemaining <= 0) return null;
    const tile = this.tiles[this.drawIndex++];
    return tile ?? null;
  }

  getRemainingCount(): number {
    return this.tiles.length - this.drawIndex;
  }

  getTotalWallLength(): number {
    return this.tiles.length;
  }

  getWallIndex(): number {
    return this.drawIndex;
  }

  isExhaustiveDraw(): boolean {
    return this.getRemainingCount() <= 0;
  }

  getDoraIndicators(): Tile[] {
    return [...this.doraIndicators];
  }

  getUraIndicators(): Tile[] {
    return [...this.uraIndicators];
  }

  getDoraFromIndicator(ind: Tile): Tile {
    const nextNumber = () => {
      if (ind.suit === 'z') {
        if (ind.number >= 1 && ind.number <= 4) return ((ind.number % 4) + 1);
        if (ind.number >= 5 && ind.number <= 7) return ((ind.number - 5 + 1) % 3) + 5;
        return ind.number;
      } else {
        return ind.number === 9 ? 1 : ind.number + 1;
      }
    };
    return new Tile(ind.suit, nextNumber(), ind.type);
  }

  listActiveDora(): Tile[] {
    return this.doraIndicators.map((ind) => this.getDoraFromIndicator(ind));
  }

  getDeadWall(): Tile[] {
    return [...this.deadWall];
  }
}