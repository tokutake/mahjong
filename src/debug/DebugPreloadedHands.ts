import { Tile, type Suit } from '../domain/tile';
import type { Player } from '../ui/inputMapper';

// Debug-only helper to set preloaded Yaku hands
export class DebugPreloadedHands {
  // Apply to MahjongGame-like instance (has drawTile/sortHand/playerHands/currentPlayer/dealer)
  static applyToGame(game: {
    playerHands: { set: (p: Player, tiles: Tile[]) => void; push: (p: Player, t: Tile) => void; get: (p: Player) => Tile[]; sort: (p: Player) => void };
    drawTile: () => Tile | null;
    sortHand: (p: Player) => void;
    currentPlayer: Player;
    dealer?: Player; // optional, fallback to 0
  }): void {
    const dealer = (game.dealer ?? (0 as Player)) as Player;

    for (let p: Player = 0 as Player; p < 4; p = ((p + 1) % 4) as Player) {
      game.playerHands.set(p, []);
      for (let i = 0; i < 13; i++) {
        const t = game.drawTile();
        if (t !== null) game.playerHands.push(p, t);
      }
      game.sortHand(p);
      if (p === (3 as Player)) break;
    }

    const firstDraw = game.drawTile();
    if (firstDraw) {
      game.playerHands.push(dealer, firstDraw);
      game.sortHand(dealer);
    }

    // Preload a specific hand (same pattern used originally)
    const hand: Tile[] = [];
    const pushN = (suit: Suit, number: number, count: number = 1) => {
      for (let i = 0; i < count; i++) hand.push(new Tile(suit, number));
    };
    pushN('s', 1);
    pushN('s', 2);
    pushN('s', 3);
    pushN('s', 4);
    pushN('s', 5);
    pushN('s', 6);
    pushN('s', 7);
    pushN('s', 8);
    pushN('s', 9);
    pushN('s', 2);
    pushN('s', 3);
    pushN('s', 4);
    pushN('s', 5, 2);

    game.playerHands.set(dealer, hand);
    game.sortHand(dealer);
    game.currentPlayer = dealer;
  }
}
