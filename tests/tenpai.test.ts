
import { describe, it, expect } from "@jest/globals";
import { isTenpai } from "../src/domain/tenpai";
import { Tile } from "../src/domain/tile";

// Tile helpers for concise test cases
type Suit = "m" | "p" | "s" | "z";
const M = (n: number): Tile => new Tile("m", n);
const P = (n: number): Tile => new Tile("p", n);
const S = (n: number): Tile => new Tile("s", n);
const Z = (n: number): Tile => new Tile("z", n);


// suitとnumberだけを残す
function tilesToSimple(tiles: Tile[]) {
  return tiles.map(tile => { suit: tile.suit as Suit; n: tile.number });
}

function compareTiles(a: Tile, b: Tile): number {
  if (a.suit < b.suit) return -1;
  if (a.suit > b.suit) return 1;
  return a.number - b.number;
}

describe("isTenpai", () => {
  it("should detect a simple Ryanmen (two-sided) wait", () => {
    const hand = [
      M(1), M(2), M(3),
      P(4), P(5), P(6),
      S(7), S(8), S(9),
      Z(1), Z(1),
      M(4), M(5),
    ];
    const result = isTenpai(hand);
    expect(result.isTenpai).toBe(true);

    // suitとnumberだけを残す
    const waits = tilesToSimple(result.waits);
    const expectedWaits = tilesToSimple([M(3), M(6)]);
    expect(waits).toEqual(expect.arrayContaining(expectedWaits));
  });

  it("should detect a Kanchan (closed) wait", () => {
    const hand = [
      M(1), M(2), M(3),
      P(4), P(5), P(6),
      S(7), S(8), S(9),
      Z(1), Z(1),
      M(4), M(6),
    ];
    const result = isTenpai(hand);
    expect(result.isTenpai).toBe(true);
    const waits = tilesToSimple(result.waits);
    const expectedWaits = tilesToSimple([M(5)]);
    expect(waits).toEqual(expectedWaits);
  });

  it("should detect a Penchan (edge) wait", () => {
    const hand = [
      M(1), M(2), M(3),
      P(4), P(5), P(6),
      S(7), S(8), S(9),
      Z(1), Z(1),
      M(1), M(2),
    ];
    const result = isTenpai(hand);
    expect(result.isTenpai).toBe(true);
    const waits = tilesToSimple(result.waits);
    const expectedWaits = tilesToSimple([M(3)]);
    expect(waits).toEqual(expectedWaits);
  });

  it("should detect a Tanki (single) wait for the pair", () => {
    const hand = [
      M(1), M(2), M(3),
      P(4), P(5), P(6),
      S(7), S(8), S(9),
      S(7), S(8), S(9),
      M(5),
    ];
    const result = isTenpai(hand);
    expect(result.isTenpai).toBe(true);
    const waits = tilesToSimple(result.waits);
    const expectedWaits = tilesToSimple([M(5)]);
    expect(waits).toEqual(expectedWaits);
  });

  it("should detect a Shanpon (pair) wait", () => {
    const hand = [
      M(2), M(3), M(4),
      P(4), P(5), P(6),
      S(6), S(7), S(8),
      P(2), P(2),
      M(5), M(5),
    ];
    const result = isTenpai(hand);
    expect(result.isTenpai).toBe(true);
    const waits = tilesToSimple(result.waits);
    const expectedWaits = tilesToSimple([Z(1), M(5)]);
    expect(waits).toEqual(expectedWaits);
  });

  it("should detect tenpai for Chiitoitsu", () => {
    const hand = [
      M(1), M(1),
      M(9), M(9),
      P(2), P(2),
      P(8), P(8),
      S(3), S(3),
      S(7), S(7),
      Z(4),
    ];
    const result = isTenpai(hand);
    expect(result.isTenpai).toBe(true);
    const waits = tilesToSimple(result.waits);
    const expectedWaits = tilesToSimple([Z(4)]);
    expect(waits).toEqual(expectedWaits);
  });

  it("should detect tenpai for Kokushi Musou", () => {
    const hand = [
      M(1), M(9),
      P(1), P(9),
      S(1), S(9),
      Z(1), Z(2), Z(3), Z(4), Z(5), Z(6),
      Z(7),
    ];
    const result = isTenpai(hand);
    expect(result.isTenpai).toBe(true);
    const waits = tilesToSimple(result.waits);
    const expectedWaits = tilesToSimple([M(1), M(9), P(1), P(9), S(1), S(9), Z(1), Z(2), Z(3), Z(4), Z(5), Z(6), Z(7)]);
    expect(waits).toEqual(expectedWaits);
  });

  it("should return false for a non-tenpai hand", () => {
    const hand = [
      M(1), M(2), M(4),
      P(5), P(6), P(8),
      S(1), S(3), S(5),
      Z(1), Z(3), Z(5),
      M(7),
    ];
    const result = isTenpai(hand);
    expect(result.isTenpai).toBe(false);
    expect(result.waits).toEqual([]);
  });

  it("should return false for a hand with incorrect number of tiles", () => {
    const hand = [M(1), M(2)];
    const result = isTenpai(hand);
    expect(result.isTenpai).toBe(false);
    expect(result.waits).toEqual([]);
  });
});
