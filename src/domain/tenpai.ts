
import { Tile, type Suit } from './tile';
import { calcYaku } from './yaku';

/**
 * Checks if a 13-tile hand is in tenpai (one tile away from winning).
 * @param hand A 13-tile hand.
 * @returns An object with `isTenpai` boolean and a `waits` array of tiles that complete the hand.
 */

/**
 * Checks if a 13-tile hand can win with a given winning tile.
 * @param hand A 13-tile hand.
 * @param winTile The winning tile.
 * @returns True if the hand can win with the given tile, false otherwise.
 */
export function canWin(hand: Tile[], winTile: Tile): boolean {
  if (hand.length !== 13) {
    return false;
  }

  const potentialHand = [...hand, winTile];
  const result = calcYaku(potentialHand);
  return result.yaku.length > 0;
}
export function isTenpai(hand: Tile[]): { isTenpai: boolean; waits: Tile[] } {
  if (hand.length !== 13) {
    return { isTenpai: false, waits: [] };
  }

  const waits: Tile[] = [];
  const allTileTypes: Tile[] = [];

  // Generate all 34 unique tile types
  (['m', 'p', 's'] as Suit[]).forEach(suit => {
    for (let num = 1; num <= 9; num++) {
      allTileTypes.push(new Tile(suit, num));
    }
  });
  for (let num = 1; num <= 7; num++) {
    allTileTypes.push(new Tile('z', num));
  }

  for (const tile of allTileTypes) {
    const potentialHand = [...hand, tile];
    const result = calcYaku(potentialHand);
    if (result.yaku.length > 0) {
      waits.push(tile);
    }
  }

  return {
    isTenpai: waits.length > 0,
    waits: waits,
  };
}
