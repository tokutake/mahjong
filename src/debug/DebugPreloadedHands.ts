import { Tile, type Suit } from '../domain/tile';
import type { Player } from '../ui/inputMapper';

// Debug-only helper to set preloaded Yaku hands
export class DebugPreloadedHands {
  // Apply to MahjongGame-like instance (has drawTile/sortHand/playerHands/currentPlayer/dealer)
  static applyToGame(game: {
    playerHands: [Tile[], Tile[], Tile[], Tile[]];
    drawTile: () => Tile | null;
    sortHand: (p: Player) => void;
    currentPlayer: Player;
    dealer?: Player; // optional, fallback to 0
  }): void {
    const dealer = (game.dealer ?? (0 as Player)) as Player;

    game.playerHands = [[], [], [], []];
    for (let p: Player = 0 as Player; p < 4; p = ((p + 1) % 4) as Player) {
      game.playerHands[p] = [];
      for (let i = 0; i < 13; i++) {
        const t = game.drawTile();
        if (t !== null) game.playerHands[p].push(t);
      }
      game.sortHand(p);
      if (p === (3 as Player)) break;
    }

    const firstDraw = game.drawTile();
    if (firstDraw) {
      game.playerHands[dealer].push(firstDraw);
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

    game.playerHands[dealer] = hand;
    game.sortHand(dealer);
    game.currentPlayer = dealer;
  }

  // Apply to GameState-like instance (uses drawTile and has dealer)
  static applyToState(state: {
    playerHands: [Tile[], Tile[], Tile[], Tile[]];
    drawTile: () => Tile | null;
    sortHand: (p: Player) => void;
    currentPlayer: Player;
    dealer: Player;
  }): void {
    const dealer = state.dealer;

    state.playerHands = [[], [], [], []];
    for (let p: Player = 0 as Player; p < 4; p = ((p + 1) % 4) as Player) {
      state.playerHands[p] = [];
      for (let i = 0; i < 13; i++) {
        const t = state.drawTile();
        if (t !== null) state.playerHands[p].push(t);
      }
      state.sortHand(p);
      if (p === (3 as Player)) break;
    }

    const firstDraw = state.drawTile();
    if (firstDraw) {
      state.playerHands[dealer].push(firstDraw);
      state.sortHand(dealer);
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

    state.playerHands[dealer] = hand;
    state.sortHand(dealer);
    state.currentPlayer = dealer;
  }
}
