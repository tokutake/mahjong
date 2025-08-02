/**
 * 簡易点数計算:
 * - 入力: 役判定結果 { yaku, han, yakuman }, 手牌14枚
 * - 仕様:
 *   - 一般的な日本麻雀に準拠（簡易）
 *   - 喰い下がりは未対応（全て門前前提として扱う）
 *   - 符計算は簡易: 七対子25符、平和ツモ20符、面子手は30符ベース（待ち/面子/字牌頭などは未反映）
 *   - ツモ/ロン両対応、親子別（親=dealer true/false）
 *   - 切り上げ満貫あり、数え役満あり（13翻以上は役満扱い）
 *   - ドラは加算（yakuリスト外のドラ名は "ドラ" として han 加算されている前提。ここでは han の値をそのまま使用）
 */

export type WinType = 'tsumo' | 'ron';

export type ScoreBreakdown = {
  basePoints: number;             // 基本点(符ベースの点) = 符 × 2^(2+翻)
  fu: number;                     // 符
  han: number;                    // 翻
  limit: 'none' | 'mangan' | 'haneman' | 'baiman' | 'sanbaiman' | 'yakuman';
  totalPoints: number;            // 得点（子/親、和了形に応じた合計入手点）
  payments: {                     // 支払い内訳
    ron?: number;                 // 放銃者支払い（ツモ時は undefined）
    tsumoChild?: number;          // 子からの支払い（親ツモ時は各家支払い額、子ツモ時は子からの支払い額）
    tsumoParent?: number;         // 親からの支払い（子ツモ時の親支払い額）
  };
};

export type CalcScoreInput = {
  tiles: { suit: 'm'|'p'|'s'|'z'; number: number }[]; // 手牌14枚（役判定の補助用。現状は符の簡易条件で参照）
  yakuResult: { yaku: string[]; han: number; yakuman: boolean };
  dealer: boolean;               // 親かどうか
  winType: WinType;              // ツモ/ロン
};

export function ceil100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

function limitByHan(han: number, yakuman: boolean): { limit: ScoreBreakdown['limit']; basePointCap: number } {
  if (yakuman || han >= 13) return { limit: 'yakuman', basePointCap: 8000 };
  if (han >= 11) return { limit: 'sanbaiman', basePointCap: 6000 };
  if (han >= 8) return { limit: 'baiman', basePointCap: 4000 };
  if (han >= 6) return { limit: 'haneman', basePointCap: 3000 };
  if (han >= 5) return { limit: 'mangan', basePointCap: 2000 };
  return { limit: 'none', basePointCap: Infinity };
}

// 簡易符計算
// - 七対子: 25符
// - 平和ツモ: 20符
// - それ以外: 30符固定
function calcFuSimple(tiles: CalcScoreInput['tiles'], yaku: string[]): number {
  if (yaku.includes('七対子')) return 25;
  if (yaku.includes('平和')) return 20;
  return 30;
}

export function calcScore(input: CalcScoreInput): ScoreBreakdown {
  const { tiles, yakuResult, dealer, winType } = input;
  const han = yakuResult.han;
  const yakuman = yakuResult.yakuman;

  // 符（簡易）
  const fuRaw = calcFuSimple(tiles, yakuResult.yaku);
  // 七対子以外は符の切り上げ（10の位切り上げ）。七対子25符はそのまま。
  const fu = yakuResult.yaku.includes('七対子') ? 25 : Math.max(20, Math.ceil(fuRaw / 10) * 10);

  // 上限判定（翻による）
  const { limit, basePointCap } = limitByHan(han, yakuman);

  // 基本点（符 × 2^(2+翻)）ただし上限あり
  const base = Math.min(fu * Math.pow(2, 2 + han), basePointCap);

  if (winType === 'ron') {
    if (dealer) {
      const pts = ceil100(base * 6);
      return {
        basePoints: base,
        fu,
        han,
        limit,
        totalPoints: pts,
        payments: { ron: pts }
      };
    } else {
      const pts = ceil100(base * 4);
      return {
        basePoints: base,
        fu,
        han,
        limit,
        totalPoints: pts,
        payments: { ron: pts }
      };
    }
  } else {
    // tsumo
    if (dealer) {
      // 親ツモ: 各家 ceil(base*2) を3人から。合計 ceil(base*6)
      const payEach = ceil100(base * 2);
      const total = payEach * 3;
      return {
        basePoints: base,
        fu,
        han,
        limit,
        totalPoints: total,
        payments: { tsumoChild: payEach }
      };
    } else {
      // 子ツモ: 親 ceil(base*2)、子 ceil(base*1)。表示便宜上個別に保持
      const payParent = ceil100(base * 2);
      const payChild = ceil100(base * 1);
      const total = payParent + payChild * 2;
      return {
        basePoints: base,
        fu,
        han,
        limit,
        totalPoints: total,
        payments: { tsumoParent: payParent, tsumoChild: payChild }
      };
    }
  }
}
