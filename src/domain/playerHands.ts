import type { Tile } from './tile';
import type { Player } from '../ui/inputMapper';

export class PlayerHands {
  private hands: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []];

  get raw(): [Tile[], Tile[], Tile[], Tile[]] {
    return this.hands;
  }

  get(player: Player): Tile[] {
    return this.hands[player];
  }

  set(player: Player, tiles: Tile[]): void {
    this.hands[player] = tiles;
  }

  push(player: Player, tile: Tile): void {
    this.hands[player].push(tile);
  }

  popAt(player: Player, index: number): Tile | undefined {
    const h = this.hands[player];
    if (index < 0 || index >= h.length) return undefined;
    const [t] = h.splice(index, 1);
    return t;
  }

  findIndexById(player: Player, id: number): number {
    return this.hands[player].findIndex(t => t.id === id);
  }

  length(player: Player): number {
    return this.hands[player].length;
  }

  sort(player: Player): void {
    const hand = this.hands[player];
    hand.sort((a, b) => {
      if (a.suit !== b.suit) {
        const suitOrder = { m: 1, p: 2, s: 3, z: 4 } as const;
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.number - b.number;
    });
  }

  getHandWithFixedDraw(player: Player): Tile[] {
    const hand = this.hands[player];
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
}
