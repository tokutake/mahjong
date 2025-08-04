import { Tile } from '../domain/tile';
import { Wall } from '../domain/wall';
import { PlayerHands } from '../domain/playerHands';
import type { Player } from '../ui/inputMapper';
import { isTenpai, canWin } from '../domain/tenpai';
import { calcYaku } from '../domain/yaku';
import { calcScore } from '../domain/score';

import { DebugPreloadedHands } from '../debug/DebugPreloadedHands';
export type DiscardPiles = [Tile[], Tile[], Tile[], Tile[]];

export type GameState = {
  wall: Wall;
  playerHands: PlayerHands;
  discardPiles: DiscardPiles;
  currentPlayer: Player;
  debugPreloadedYaku: boolean;
  round: number; // 0-3: E, 4-7: S
  honba: number; // number of dealer repeats
  kyotaku: number; // riichi sticks
  scores: number[]; // 各プレイヤーの点数 [東, 南, 西, 北]
};

export type InitAction = { type: 'Init'; debugPreloadedYaku?: boolean };
export type DiscardAction = { type: 'Discard'; player: Player; tileIndex: number };
export type DrawSelfAction = { type: 'DrawSelf'; player: Player };
export type TsumoAction = { type: 'Tsumo'; player: Player };
export type NextPlayerAction = { type: 'NextPlayer' };
export type AiStepAction = { type: 'AiStep' };
export type NextRoundAction = { type: 'NextRound' };

export type Action = InitAction | DiscardAction | DrawSelfAction | TsumoAction | NextPlayerAction | AiStepAction | NextRoundAction;

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
    round: 0,
    honba: 0,
    kyotaku: 0,
    scores: [25000, 25000, 25000, 25000], // 初期点数25000点で各プレイヤーを初期化
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
      if (state.wall.getRemainingCount() <= 0) {
        return applyAction(state, { type: 'NextRound' });
      }
      const t = state.wall.drawTile();
      if (t) {
        state.playerHands.push(action.player, t);
        state.playerHands.sort(action.player);
      }
      return state;
    }
    case 'Tsumo': {
      // ツモ和了の処理
      const player = action.player;
      const hand = state.playerHands.get(player);
      if (!hand || hand.length !== 14) return state; // 14牌でなければ和了できない

      const winTile = hand[hand.length - 1]; // 最後の牌がツモ牌
      if (!winTile) return state;

      if (hand.length >= 14 && canWin(hand.slice(0, 13), winTile)) {
        // 和了成立
        // 役と点数を計算
        // hand is confirmed non-undefined and has at least 14 tiles here
        const yakuResult = calcYaku(hand);
        const score = calcScore({
          tiles: hand,
          yakuResult,
          dealer: player === (state.round % 4) as Player, // 親かどうか
          winType: 'tsumo',
        });
        if (!score) return state;

        // スコアを更新
        const points = score.totalPoints;
        const payments = score.payments ?? undefined;

        if (player === (state.round % 4) as Player) {
          // 親ツモ
          for (let i = 0; i < 4; i++) {
            if (i !== player) {
              state.scores[i]! -= Math.floor(points / 3);
            }
          }
          state.scores[player]! += points;
        } else {
          // 子ツモ
          const dealerPlayer = (state.round % 4) as Player;
          if (payments) {
            state.scores[dealerPlayer]! -= payments.tsumoParent ?? 0;
            for (let i = 0; i < 4; i++) {
              if (i !== player && i !== dealerPlayer) {
                state.scores[i]! -= payments.tsumoChild ?? 0;
              }
            }
          }
          state.scores[player]! += points;
        }

        // 次の局に移る
        return applyAction(state, { type: 'NextRound' });
      }
      return state;
    }
    case 'NextPlayer': {
      state.currentPlayer = ((state.currentPlayer + 1) % 4) as Player;
      return state;
    }
    case 'NextRound': {
      const dealer = (state.round % 4) as Player;
      const dealerHand = state.playerHands.get(dealer);
      const dealerTenpai = isTenpai(dealerHand);

      let nextRound = state.round;
      let nextHonba = state.honba;

      if (dealerTenpai) {
        nextHonba++;
      } else {
        nextRound++;
        nextHonba = 0;
      }

      const scores = state.scores;

      const newState = initGame(state.debugPreloadedYaku);
      newState.round = nextRound;
      newState.honba = nextHonba;
      newState.kyotaku = state.kyotaku;
      newState.scores = scores;

      return newState;
    }
    case 'AiStep': {
      // Minimal AI: draw, then discard a tile that does not worsen shanten if possible.
      // Tie-break: prefer discards that keep tenpai or increase simple uke (approx).
      if (state.currentPlayer === (0 as Player)) return state;

      if (state.wall.getRemainingCount() <= 0) {
        return applyAction(state, { type: 'NextRound' });
      }

      const drawn = state.wall.drawTile();
      if (drawn) {
        state.playerHands.push(state.currentPlayer, drawn);
        state.playerHands.sort(state.currentPlayer);

        const handCur = state.playerHands.get(state.currentPlayer);
        const len = handCur.length;

        // Safety check: AI should have 14 tiles after draw
        if (len === 14) {
          // Baseline: whether the 13-tile hand (remove the drawn) is in tenpai
          const base13 = handCur.slice(0, 13);
          const baseTenpai = isTenpai(base13);

          // Evaluate each discard candidate by index
          type Cand = { idx: number; keepTenpai: boolean; ukeScore: number };
          const candidates: Cand[] = [];
          for (let i = 0; i < len; i++) {
            // simulate discarding handCur[i]
            const after = handCur.slice();
            after.splice(i, 1); // 13 tiles after discard

            // If 13 tiles after discard are tenpai, it's good. Otherwise less preferred.
            const ten = isTenpai(after);

            // Simple uke approximation: count number of distinct waits
            const ukeScore = ten.isTenpai ? ten.waits.length : 0;

            candidates.push({
              idx: i,
              keepTenpai: ten.isTenpai || (!baseTenpai.isTenpai && !ten.isTenpai), // do not worsen: both not tenpai also ok
              ukeScore,
            });
          }

          // Filter: prefer not worsening from base state.
          let pool = candidates.filter(c => c.keepTenpai);

          // If base was tenpai, keep only those that remain tenpai
          if (baseTenpai.isTenpai) {
            pool = candidates.filter(c => {
              const after = handCur.slice();
              after.splice(c.idx, 1);
              return isTenpai(after).isTenpai;
            });
          }

          // If nothing satisfies keepTenpai policy, fall back to all candidates
          if (pool.length === 0) pool = candidates;

          // Prefer higher ukeScore
          let best = pool[0]!;
          for (let k = 1; k < pool.length; k++) {
            const c = pool[k]!;
            if (c.ukeScore > best.ukeScore) best = c;
          }

          // If multiple with same ukeScore, choose earliest occurrence of redundant honor/safe-ish tile heuristically.
          const bestUke = best.ukeScore;
          const ties = pool.filter(c => c.ukeScore === bestUke);

          let chosen = ties[0]!;
          if (ties.length > 1) {
            // crude heuristic: prefer discarding honors or isolated terminals
            const isHonor = (t: Tile) => t.suit === 'z';
            const isTerminal = (t: Tile) => (t.suit !== 'z' && (t.number === 1 || t.number === 9));
            const isolatedScore = (idx: number) => {
              const t = handCur[idx]!;
              let score = 0;
              if (isHonor(t)) score += 2;
              if (isTerminal(t)) score += 1;
              return score;
            };
            let bestIso = isolatedScore(ties[0]!.idx);
            chosen = ties[0]!;
            for (let k = 1; k < ties.length; k++) {
              const sc = isolatedScore(ties[k]!.idx);
              if (sc > bestIso) {
                bestIso = sc;
                chosen = ties[k]!;
              }
            }
          }

          const discardedTile = handCur[chosen.idx]!;
          state.playerHands.popAt(state.currentPlayer, chosen.idx);
          state.discardPiles[state.currentPlayer].push(discardedTile as Tile);
        } else if (len > 0) {
          // Fallback: if for any reason not 14, keep previous random behavior
          const idx = Math.floor(Math.random() * len);
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
