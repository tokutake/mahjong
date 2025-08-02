import { describe, it, expect } from "@jest/globals";
// 実装に合わせて import パスを調整してください
// 例: 役判定の公開 API（仮）を使う
import * as Yaku from "../yaku";

describe("Yaku basic API shape", () => {
  it("公開関数が存在すること", () => {
    // ここではモジュール形状のスモークテストのみ
    expect(typeof Yaku).toBe("object");
  });
});

// 以降は実装が見え次第、具体的なテストに差し替える
// 役判定の I/O が未確定のため、最低限のスモークテストを配置して CI の足場を作る
