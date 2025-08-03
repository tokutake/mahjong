import { Tile } from '../domain/tile';
import { Wall } from '../domain/wall';
import { PlayerHands } from '../domain/playerHands';
import type { Player } from '../ui/inputMapper';
import { DebugPreloadedHands } from '../debug/DebugPreloadedHands';

export type DiscardPiles = [Tile[], Tile[], Tile[], Tile[]];

export type GameState = {
  wall: Wall;
  playerHands: PlayerHands;
  discardPiles: DiscardPiles;
  currentPlayer: Player;
  debugPreloadedYaku: boolean;
};

export type InitAction = { type: 'Init'; debugPreloadedYaku?: boolean };
export type DiscardAction = { type: 'Discard'; player: Player; tileIndex: number };
export type DrawSelfAction = { type: 'DrawSelf'; player: Player };
export type NextPlayerAction = { type: 'NextPlayer' };
export type AiStepAction = { type: 'AiStep' };

export type Action = InitAction | DiscardAction | DrawSelfAction | NextPlayerAction | AiStepAction;

// Pure selectors/utilities
export function getHandWithFixedDraw(state: GameState, player: Player): Tile[] {
  const hand = state.playerHands.get(player);
  if (player !== (0 as Player)) return hand;
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

export function remainingTiles(state: GameState): number {
  return state.wall.getRemainingCount();
}

export function canDiscard(state: GameState, player: Player): boolean {
  if (state.currentPlayer !== player) return false;
  return state.playerHands.length(player) === 14;
}

// Engine core (pure-ish; uses domain objects but no DOM)
export function initGame(debugPreloadedYaku = true): GameState {
  const wall = new Wall();
  const playerHands = new PlayerHands();
  const discardPiles: DiscardPiles = [[], [], [], []];
  const currentPlayer = 0 as Player;

  const state: GameState = {
    wall,
    playerHands,
    discardPiles,
    currentPlayer,
    debugPreloadedYaku,
  };

  if (debugPreloadedYaku) {
    // Use existing helper to fill hands deterministically for debugging.
    // DebugPreloadedHands only provides applyToGame, so pass a Game-like shim.
    DebugPreloadedHands.applyToGame({
      playerHands,
      drawTile: () => wall.drawTile(),
      sortHand: (p: Player) => playerHands.sort(p),
      currentPlayer: state.currentPlayer,
      // dealer is optional; let it default to 0
    } as any);
    // ensure state.currentPlayer is aligned (applyToGame may change it on the passed object,
    // but since we passed a shim, reflect dealer=0 as starting player)
    state.currentPlayer = 0 as Player;
  } else {
    // deal initial hands
    for (let p: Player = 0 as Player; p < 4; p = ((p + 1) % 4) as Player) {
      playerHands.set(p, []);
      for (let i = 0; i < 13; i++) {
        const t = wall.drawTile();
        if (t !== null) playerHands.push(p, t);
      }
      playerHands.sort(p);
    }
    const firstDraw = wall.drawTile();
    if (firstDraw) {
      playerHands.push(0 as Player, firstDraw);
      playerHands.sort(0 as Player);
    }
  }

  return state;
}

export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'Init': {
      return initGame(action.debugPreloadedYaku ?? true);
    }
    case 'Discard': {
      if (state.currentPlayer !== action.player) return state;
      if (!canDiscard(state, action.player)) return state;

      const hand = state.playerHands.get(action.player);
      if (!hand || action.tileIndex < 0 || action.tileIndex >= hand.length) return state;

      const tile = state.playerHands.popAt(action.player, action.tileIndex);
      if (!tile) return state;
      state.discardPiles[action.player].push(tile);
      state.playerHands.sort(action.player);

      // move to next player
      state.currentPlayer = ((state.currentPlayer + 1) % 4) as Player;
      return state;
    }
    case 'DrawSelf': {
      if (state.currentPlayer !== action.player) return state;
      if (state.wall.getRemainingCount() <= 0) return state; // Exhaustive draw
      const t = state.wall.drawTile();
      if (t) {
        state.playerHands.push(action.player, t);
        state.playerHands.sort(action.player);
      }
      return state;
    }
    case 'NextPlayer': {
      state.currentPlayer = ((state.currentPlayer + 1) % 4) as Player;
      return state;
    }
    case 'AiStep': {
      // one simple AI step: draw then discard random one
      if (state.currentPlayer === (0 as Player)) return state;

      if (state.wall.getRemainingCount() <= 0) return state; // Exhaustive draw
      const drawn = state.wall.drawTile();
      if (drawn) {
        state.playerHands.push(state.currentPlayer, drawn);
        state.playerHands.sort(state.currentPlayer);
        const len = state.playerHands.length(state.currentPlayer);
        if (len > 0) {
          const idx = Math.floor(Math.random() * len);
          const handCur = state.playerHands.get(state.currentPlayer);
          const discardedTile = handCur[idx]!;
          state.playerHands.popAt(state.currentPlayer, idx);
          state.discardPiles[state.currentPlayer].push(discardedTile as Tile);
        }
      }
      state.currentPlayer = ((state.currentPlayer + 1) % 4) as Player;
      return state;
    }
    default:
      return state;
  }
}
