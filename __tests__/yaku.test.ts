import { describe, it, expect } from "@jest/globals";
import { calcYaku } from "../yaku";

/**
 * 前提（ユーザー合意）
 * - 優先: 1) 役の基本判定
 * - 赤ドラ/裏ドラ: あり（ただし、このテストでは役そのものの有無/翻のみを確認し、ドラ加点は未使用）
 * - 喰い下がり: あり（ただし yaku.ts の現実装は門前前提/鳴き情報なしのため、門前ケースを中心に検証）
 * - 役なしドラのみの和了: 不可（ただし現実装の calcYaku は役/翻のみを返す関数）
 *
 * yaku.ts の仕様（現時点の実装から読み取り）
 * - 門前のみを前提にした役（平和/一盃口/三暗刻）は menzenOnly フラグを持つが、実装上は「常に門前扱い」のロジック
 * - 役牌は白(5z)/發(6z)/中(7z)のみ対応（場風/自風なし）
 * - ドラや和了形情報（ツモ/ロン/待ち形/符等）は未考慮
 *
 * よって本テストは「14枚の門前手」を渡した時の役配列と翻数が期待通りかを基本確認する。
 */

// 牌のヘルパー（簡潔化）
type Suit = "m" | "p" | "s" | "z";
type Tile = { suit: Suit; number: number };
const M = (n: number): Tile => ({ suit: "m", number: n });
const P = (n: number): Tile => ({ suit: "p", number: n });
const S = (n: number): Tile => ({ suit: "s", number: n });
const Z = (n: number): Tile => ({ suit: "z", number: n }); // 1東 2南 3西 4北 5白 6發 7中（実装に合わせて役牌は 5/6/7）

function expectHasYaku(result: ReturnType<typeof calcYaku>, name: string) {
  expect(result.yaku).toContain(name);
}
function expectNoYakuman(result: ReturnType<typeof calcYaku>) {
  expect(result.yakuman).toBe(false);
}

describe("calcYaku - 基本役の判定（門前想定）", () => {
  it("平和のみ（メンツ4つ全て順子 + 雀頭は2〜8の数牌）", () => {
    // 手牌: 萬子 123 456 789 / 筒子 234 / 雀頭 筒子5-5 （14枚）
    const hand = [
      M(1), M(2), M(3),
      M(4), M(5), M(6),
      M(6), M(7), M(8),
      P(2), P(3), P(4),
      P(5), P(5),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "平和");
    expectNoYakuman(r);
    // 平和1翻のみの想定（実装: 断么九は含まれない手なので han=1）
    expect(r.han).toBe(1);
  });

  it("断么九のみ（么九牌を含まない門前面子手）", () => {
    // 手牌: 索子 234 345 456 / 筒子 234 / 雀頭 索子5-5
    const hand = [
      S(2), S(3), S(4),
      S(3), S(4), S(5),
      S(4), S(5), S(6),
      P(2), P(3), P(4),
      S(5), S(5),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "断么九");
    expectNoYakuman(r);
    expect(r.han).toBe(1);
  });

  it("一盃口（同一順子2組）", () => {
    // 手牌: 萬子 123 123 / 筒子 456 / 索子 456 / 雀頭 筒子8-8
    const hand = [
      M(1), M(2), M(3),
      M(1), M(2), M(3),
      P(4), P(5), P(6),
      S(4), S(5), S(6),
      P(8), P(8),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "一盃口");
    expectNoYakuman(r);
    // 実装の一盃口は「順子が2組以上」で成立しており、上記は4組あるため満たす
    expect(r.han).toBeGreaterThanOrEqual(1);
  });

  it("一気通貫（同一色で123/456/789が揃う）", () => {
    // 手牌: 筒子 123 456 789 / 萬子 234 / 雀頭 萬子2-2
    const hand = [
      P(1), P(2), P(3),
      P(4), P(5), P(6),
      P(7), P(8), P(9),
      M(2), M(3), M(4),
      M(2), M(2),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "一気通貫");
    expectNoYakuman(r);
    // 実装では喰い下がり未対応だが、ここでは門前前提なので2翻
    expect(r.han).toBeGreaterThanOrEqual(2);
  });

  it("対々和（面子4つが全て刻子）", () => {
    // 手牌: 萬子 111 / 筒子 999 / 索子 333 / 役牌 中中中 / 雀頭 萬子2-2
    const hand = [
      M(1), M(1), M(1),
      P(9), P(9), P(9),
      S(3), S(3), S(3),
      Z(7), Z(7), Z(7),
      M(2), M(2),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "対々和");
    expectNoYakuman(r);
    expect(r.han).toBeGreaterThanOrEqual(2);
  });

  it("三暗刻（暗刻3つ相当）", () => {
    // 手牌: 萬子 111 / 筒子 777 / 索子 444 / 順子 P 2-3-4 / 雀頭 萬子9-9
    const hand = [
      M(1), M(1), M(1),
      P(7), P(7), P(7),
      S(4), S(4), S(4),
      P(2), P(3), P(4),
      M(9), M(9),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "三暗刻");
    expectNoYakuman(r);
    expect(r.han).toBeGreaterThanOrEqual(2);
  });

  it("三色同順（萬筒索で同じ数字並びの順子が揃う）", () => {
    // 手牌: 萬子 345 / 筒子 345 / 索子 345 / 萬子 678 / 雀頭 筒子2-2
    const hand = [
      M(3), M(4), M(5),
      P(3), P(4), P(5),
      S(3), S(4), S(5),
      M(6), M(7), M(8),
      P(2), P(2),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "三色同順");
    expectNoYakuman(r);
    expect(r.han).toBeGreaterThanOrEqual(2);
  });

  it("混一色（数牌1種 + 字牌を含む）", () => {
    // 手牌: 筒子 234 345 456 / 役牌 中中中 / 雀頭 筒子8-8
    const hand = [
      P(2), P(3), P(4),
      P(3), P(4), P(5),
      P(4), P(5), P(6),
      Z(7), Z(7), Z(7),
      P(8), P(8),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "混一色");
    expectNoYakuman(r);
    expect(r.han).toBeGreaterThanOrEqual(3);
  });

  it("清一色（同一色のみ、字牌を含まない）", () => {
    // 手牌: 索子 123 345 678 / 789 / 雀頭 5-5（全て索子）
    const hand = [
      S(1), S(2), S(3),
      S(3), S(4), S(5),
      S(6), S(7), S(8),
      S(7), S(8), S(9),
      S(5), S(5),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "清一色");
    expectNoYakuman(r);
    expect(r.han).toBeGreaterThanOrEqual(6);
  });

  it("役牌（白/發/中の刻子がある）", () => {
    // 手牌: 白白白 + 他は順子・雀頭で14枚
    const hand = [
      Z(5), Z(5), Z(5), // 白
      M(2), M(3), M(4),
      P(3), P(4), P(5),
      S(6), S(7), S(8),
      M(7), M(7),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "役牌");
    expectNoYakuman(r);
    expect(r.han).toBeGreaterThanOrEqual(1);
  });

  it("複合（平和 + 断么九）", () => {
    // 手牌: 萬子 234 345 456 / 筒子 456 / 雀頭 筒子6-6
    // すべて順子 + 雀頭は2〜8、么九牌なし
    const hand = [
      M(2), M(3), M(4),
      M(3), M(4), M(5),
      M(4), M(5), M(6),
      P(4), P(5), P(6),
      P(6), P(6),
    ];
    const r = calcYaku(hand);
    expectHasYaku(r, "平和");
    expectHasYaku(r, "断么九");
    expectNoYakuman(r);
    expect(r.han).toBeGreaterThanOrEqual(2);
  });
});

describe("calcYaku - 特殊形（七対子/国士）", () => {
  it("七対子", () => {
    const hand = [
      M(2), M(2),
      M(4), M(4),
      P(3), P(3),
      P(7), P(7),
      S(1), S(1),
      S(5), S(5),
      Z(7), Z(7), // 中
    ];
    const r = calcYaku(hand);
    expect(r.yaku).toContain("七対子");
    // 七対子 + 断么九（2〜8のみ）ではないので断么九は含まれない
    expectNoYakuman(r);
    expect(r.han).toBeGreaterThanOrEqual(2);
  });

  it("国士無双（役満）", () => {
    // 1/9各色 + 字牌全種 + どれか1種が対子
    const hand = [
      M(1), M(9),
      P(1), P(9),
      S(1), S(9),
      Z(1), Z(2), Z(3), Z(4), Z(5), Z(6),
      Z(7), Z(7), // 中で対子
    ];
    const r = calcYaku(hand);
    expect(r.yakuman).toBe(true);
    expect(r.yaku).toContain("国士無双");
    // yakuman=true だが han は役満値(13)が設定される実装
    expect(r.han).toBeGreaterThanOrEqual(13);
  });
});

describe("calcYaku - 不成立例（面子手に分解できない/役が付かない）", () => {
  it("面子手に分解できない場合は yaku:[]/han:0", () => {
    // ランダムに14枚（意図的に崩す）
    const hand = [
      M(1), M(1), M(2),
      P(2), P(2), P(2),
      S(3), S(3),
      M(4), M(6),
      P(9),
      Z(1), Z(2), Z(3),
    ];
    const r = calcYaku(hand);
    expect(r.yakuman).toBe(false);
    expect(r.han).toBe(0);
    expect(r.yaku).toEqual([]);
  });

  it("役が1つも付かない面子手（例: 刻子/順子混在でピンフ・断么九等が立たない）", () => {
    // 面子手だが、么九含みや頭が字牌でピンフにならない等
    const hand = [
      M(1), M(1), M(1), // 刻子（1含む）
      P(2), P(3), P(4), // 順子
      S(3), S(4), S(5), // 順子
      Z(1), Z(1), Z(1), // 東の刻子（役牌ではない実装）
      M(9), M(9),       // 雀頭（9）
    ];
    const r = calcYaku(hand);
    // 実装では東は役牌対象外のため「役牌」は乗らない
    expect(r.han).toBe(0);
    expect(r.yaku).toEqual([]);
  });
});
