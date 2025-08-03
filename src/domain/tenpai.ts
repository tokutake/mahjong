
import { Tile, type Suit } from './tile';

// Helper function to check for Kokushi Musou (Thirteen Orphans)
function isKokushiMusou(hand: Tile[]): boolean {
  if (hand.length !== 14) return false;
  const terminalsAndHonors = new Set<string>();
  const requiredTiles = [
    'm1', 'm9', 'p1', 'p9', 's1', 's9', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'
  ];
  let pair = false;
  for (const tile of hand) {
    const tileId = `${tile.suit}${tile.number}`;
    if (terminalsAndHonors.has(tileId)) {
      if (pair) return false; // More than one pair
      pair = true;
    }
    terminalsAndHonors.add(tileId);
  }
  return terminalsAndHonors.size === 13 && pair;
}

// Helper function to check for Chiitoitsu (Seven Pairs)
function isChiitoitsu(hand: Tile[]): boolean {
  if (hand.length !== 14) return false;
  const counts = new Map<string, number>();
  for (const tile of hand) {
    const tileId = tile.toString();
    counts.set(tileId, (counts.get(tileId) || 0) + 1);
  }
  if (counts.size !== 7) return false;
  for (const count of counts.values()) {
    if (count !== 2) return false;
  }
  return true;
}

// Helper function to check for a standard 4 melds and 1 pair hand
function isStandardAgari(hand: Tile[]): boolean {
  if (hand.length !== 14) return false;

  const sortedHand = [...hand].sort(Tile.sort);

  // Recursive function to check for melds
  const checkMelds = (tiles: Tile[]): boolean => {
    if (tiles.length === 0) return true;

    const current = tiles[0];
    const remaining = tiles.slice(1);

    // Try to form a koutsu (triplet)
    const tripletIndices = remaining.reduce<number[]>((acc, t, i) => {
      if (t.equals(current)) acc.push(i);
      return acc;
    }, []);

    if (tripletIndices.length >= 2) {
      const nextTiles = remaining.filter((_, i) => i !== tripletIndices[0] && i !== tripletIndices[1]);
      if (checkMelds(nextTiles)) return true;
    }

    // Try to form a shuntsu (sequence)
    if (current.isNumber() && current.number <= 7) {
      const nextNum = new Tile(current.suit, current.number + 1);
      const thirdNum = new Tile(current.suit, current.number + 2);
      const nextIndex = remaining.findIndex(t => t.equals(nextNum));
      if (nextIndex !== -1) {
        const thirdIndex = remaining.findIndex((t, i) => i > nextIndex && t.equals(thirdNum));
        if (thirdIndex !== -1) {
          const nextTiles = remaining.filter((_, i) => i !== nextIndex && i !== thirdIndex);
          if (checkMelds(nextTiles)) return true;
        }
      }
    }

    return false;
  };

  // Find all unique pairs to test as the jantou (pair)
  const uniqueTiles = Array.from(new Set(sortedHand.map(t => t.toString()))).map(s => Tile.fromString(s));

  for (const tile of uniqueTiles) {
    const indices = sortedHand.reduce<number[]>((acc, t, i) => {
      if (t.equals(tile)) acc.push(i);
      return acc;
    }, []);

    if (indices.length >= 2) {
      const remainingHand = sortedHand.filter((_, i) => i !== indices[0] && i !== indices[1]);
      if (checkMelds(remainingHand)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if a 14-tile hand is a winning hand (agari).
 * @param hand A 14-tile hand.
 * @returns True if the hand is a winning hand.
 */
export function isAgari(hand: Tile[]): boolean {
  if (hand.length !== 14) return false;
  return isStandardAgari(hand) || isChiitoitsu(hand) || isKokushiMusou(hand);
}

/**
 * Checks if a 13-tile hand is in tenpai (one tile away from winning).
 * @param hand A 13-tile hand.
 * @returns An object with `isTenpai` boolean and a `waits` array of tiles that complete the hand.
 */
export function isTenpai(hand: Tile[]): { isTenpai: boolean; waits: Tile[] } {
  if (hand.length !== 13) {
    return { isTenpai: false, waits: [] };
  }

  const waits = new Set<string>();
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
    if (isAgari(potentialHand)) {
      waits.add(tile.toString());
    }
  }

  const waitingTiles = Array.from(waits).map(s => Tile.fromString(s));
  return {
    isTenpai: waitingTiles.length > 0,
    waits: waitingTiles,
  };
}
