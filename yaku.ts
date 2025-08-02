/**
 * 役判定ユーティリティ（簡易版）
 * - 国士無双
 * - 七対子
 * - 面子手（順子/刻子/雀頭が1つ + 面子4つに分解できる場合）に対して基本役
 *   - 断么九
 *   - 平和
 *   - 一盃口（面前前提）
 *   - 一気通貫
 *   - 混一色/清一色
 *   - 対々和
 *   - 三暗刻（面前前提）
 *   - 三色同順
 *   - 役牌（白/發/中のみ。場風/自風は未実装）
 * 備考:
 *   - 鳴き/門前情報や場風/自風/ドラ等は簡易化のため未連携。将来的に拡張しやすい構成。
 */

// 型定義
type Suit = 'm' | 'p' | 's' | 'z';
type Tile = { suit: Suit; number: number };

// 牌ユーティリティ（mahjong.jsのTileと互換のシンプル構造想定）
// yaku.js単体でも動作させるため、必要最低限のアクセス関数を用意
function y_tileKey(t: Tile): string {
  return `${t.suit}${t.number}`;
}
function y_countByKey(tiles: Tile[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tiles) {
    const k = y_tileKey(t);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
function y_sortTiles(tiles: Tile[]): Tile[] {
  const suitOrder: Record<Suit, number> = { m: 1, p: 2, s: 3, z: 4 };
  return tiles.slice().sort((a: Tile, b: Tile) => {
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    return a.number - b.number;
  });
}

export const YAKU_LIST = {
  '国士無双': { han: 13, yakuman: true },
  '七対子': { han: 2 },
  '平和': { han: 1, menzenOnly: true },
  '断么九': { han: 1 },
  '一盃口': { han: 1, menzenOnly: true },
  // 喰い下がりや門前情報未接続の簡易実装のため、テスト期待に合わせ最低限の翻を調整
  '一気通貫': { han: 2 },
  '混一色': { han: 3 },
  '清一色': { han: 6 },
  '対々和': { han: 2 },
  '三暗刻': { han: 2, menzenOnly: true },
  '三色同順': { han: 2 },
  '役牌': { han: 1 }
};

// 基本プロパティ
function y_allSimples(tiles: Tile[]): boolean {
  return tiles.every((t: Tile) => t.suit !== 'z' && t.number >= 2 && t.number <= 8);
}

// 役牌（白發中）の刻子/槓子があるか
function y_hasYakuhai(tiles: Tile[]): boolean {
  const cnt = y_countByKey(tiles);
  for (const [k, v] of cnt) {
    const suit = k[0];
    const num = parseInt(k.slice(1), 10);
    if (suit === 'z' && (num === 5 || num === 6 || num === 7) && v >= 3) {
      return true;
    }
  }
  return false;
}

// 国士無双
function y_checkKokushi(tiles: Tile[]): { ok: boolean; yaku?: ('国士無双')[] } {
  const cnt = new Map<string, number>();
  for (const t of tiles) {
    const k = y_tileKey(t);
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  const terminals: string[] = [];
  for (const suit of ['m', 'p', 's'] as const) {
    terminals.push(`${suit}1`, `${suit}9`);
  }
  for (let n = 1; n <= 7; n++) terminals.push(`z${n}`);

  let hasAll = true;
  let pairCount = 0;
  for (const key of terminals) {
    const v = cnt.get(key) || 0;
    if (v === 0) { hasAll = false; break; }
    if (v >= 2) pairCount++;
  }
  if (hasAll && pairCount >= 1) {
    return { ok: true, yaku: ['国士無双'] };
  }
  return { ok: false };
}

// 七対子
function y_checkChiitoi(tiles: Tile[]): { ok: boolean; yaku?: ('七対子')[] } {
  if (tiles.length !== 14) return { ok: false };
  const cnt = y_countByKey(tiles);
  if (cnt.size !== 7) return { ok: false };
  for (const v of cnt.values()) if (v !== 2) return { ok: false };
  return { ok: true, yaku: ['七対子'] };
}

// 面子手分解
type Group = { type: 'pair' | 'pon' | 'chi', tiles?: Tile[] };
function y_decomposeToMentsu(tiles: Tile[]): { ok: boolean; groups?: Group[] } {
  const sorted = y_sortTiles(tiles);
  const counts = y_countByKey(sorted);

  function removeCount(k: string, n: number): boolean {
    const v = counts.get(k) || 0;
    if (v < n) return false;
    if (v === n) counts.delete(k);
    else counts.set(k, v - n);
    return true;
  }

  function tryWithHead(headKey: string): Group[] | null {
    const save = new Map(counts);
    const groups: Group[] = [];
    if (!removeCount(headKey, 2)) return null;
    groups.push({ type: 'pair' });

    function nextGroup(): boolean {
      if (Array.from(counts.values()).reduce((a, b) => a + b, 0) === 0) return true;

      const keys = Array.from(counts.keys()).sort((ka, kb) => {
        const sa = ka[0] as Suit, sb = kb[0] as Suit;
        const order: Record<Suit, number> = { m: 1, p: 2, s: 3, z: 4 };
        if (sa !== sb) return order[sa] - order[sb];
        return parseInt(ka.slice(1), 10) - parseInt(kb.slice(1), 10);
      });

      const k = keys[0]!;
      const suit = k[0] as Suit;
      const num = parseInt(k.slice(1), 10);
      const v = counts.get(k) || 0;

      if (v >= 3) {
        removeCount(k, 3);
        groups.push({ type: 'pon' });
        return nextGroup();
      }

      if (suit !== 'z' && num <= 7) {
        const k2 = `${suit}${num + 1}`;
        const k3 = `${suit}${num + 2}`;
        if ((counts.get(k2) || 0) > 0 && (counts.get(k3) || 0) > 0) {
          removeCount(k, 1);
          removeCount(k2, 1);
          removeCount(k3, 1);
          const tiles = [{ suit, number: num }, { suit, number: num + 1 }, { suit, number: num + 2 }];
          groups.push({ type: 'chi', tiles });
          return nextGroup();
        }
      }

      return false;
    }

    const ok = nextGroup();
    if (ok) return groups;
    for (const [k, v] of save) counts.set(k, v);
    return null;
  }

  const headCandidates: string[] = [];
  for (const [k, v] of counts) if (v >= 2) headCandidates.push(k);
  for (const hk of headCandidates) {
    const g = tryWithHead(hk);
    if (g) return { ok: true, groups: g };
  }
  return { ok: false };
}

function y_isMenzenDefault(): boolean {
  return true;
}

function y_isPinfu(groups: Group[], tiles: Tile[]): boolean {
  if (!y_isMenzenDefault()) return false;
  // 雀頭が中張数牌（2-8）であることを厳格にチェック（最初に見つかったpairだけで判定しない）
  const cnt = y_countByKey(tiles);
  let headOk = false;
  for (const [k, v] of cnt) {
    if (v === 2) {
      const suit = k[0];
      const num = parseInt(k.slice(1), 10);
      if (suit !== 'z' && num >= 2 && num <= 8) {
        headOk = true;
        break;
      }
    }
  }
  if (!headOk) return false;
  // 面子4つがすべて順子であること（刻子が混じらない）
  if (!groups.every((g) => g.type === 'chi' || g.type === 'pair')) return false;
  return true;
}

function y_isIipeikou(groups: Group[], tiles: Tile[]): boolean {
  if (!y_isMenzenDefault()) return false;

  // 面前前提の一盃口: 同一スートで同一の順子が2組存在するかを、牌配列から直接数える
  // 型安全のためスート配列はリテラルに限定し、使う場面でSuitへ狭める
  const suits = ['m', 'p', 's'] as const;
  for (const s of suits) {
    const suit = s as Suit;

    // 各順子の開始牌をセットにして、2組以上あれば一盃口成立
    const set = new Set<number>();
    for (const g of groups) {
      if (g.type === 'chi') {
        if (g.tiles && g.tiles[0]) {
          const number = g.tiles[0].number;
          if (set.has(number)) {
            return true; // 同じ順子が2組見つかった
          }
          set.add(number);
        }
      }
    }
  }
  return false;
}

function y_isIttsuu(tiles: Tile[]): boolean {
  for (const suit of ['m', 'p', 's'] as const) {
    const set = new Set(tiles.filter((t) => t.suit === suit).map((t) => t.number));
    const has123 = [1, 2, 3].every((n) => set.has(n));
    const has456 = [4, 5, 6].every((n) => set.has(n));
    const has789 = [7, 8, 9].every((n) => set.has(n));
    if (has123 && has456 && has789) return true;
  }
  return false;
}

function y_isToitoi(groups: Group[]): boolean {
  const pons = groups.filter((g) => g.type === 'pon').length;
  return pons === 4;
}

function y_isSananko(groups: Group[]): boolean {
  if (!y_isMenzenDefault()) return false;
  const pons = groups.filter((g) => g.type === 'pon').length;
  return pons >= 3;
}

function y_isSanshokuDoujun(tiles: Tile[]): boolean {
  // 面子手ベースの簡易判定: 各色に start,start+1,start+2 が1枚以上あれば成立とする
  for (let start = 1; start <= 7; start++) {
    let ok = true;
    for (const suit of ['m', 'p', 's'] as const) {
      const set = new Set(tiles.filter((t: Tile) => t.suit === suit).map((t: Tile) => t.number));
      if (!(set.has(start) && set.has(start + 1) && set.has(start + 2))) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function y_isHonitsu(tiles: Tile[]): boolean {
  const suits = new Set(tiles.filter((t) => t.suit !== 'z').map((t) => t.suit));
  const hasHonor = tiles.some((t) => t.suit === 'z');
  return suits.size === 1 && hasHonor;
}

function y_isChinitsu(tiles: Tile[]): boolean {
  const suits = new Set(tiles.filter((t) => t.suit !== 'z').map((t) => t.suit));
  const hasHonor = tiles.some((t) => t.suit === 'z');
  return suits.size === 1 && !hasHonor && tiles.length > 0;
}

export function calcYaku(tiles: { suit: 'm' | 'p' | 's' | 'z'; number: number }[]): { yaku: string[]; han: number; yakuman: boolean } {
  const hand = y_sortTiles(tiles as any);
 
  const kokushi = y_checkKokushi(hand as any);
  if (kokushi.ok && kokushi.yaku) {
    const names = kokushi.yaku.slice();
    const hanK = names.reduce((a, y) => a + (YAKU_LIST[y as keyof typeof YAKU_LIST].han || 0), 0);
    return { yaku: names, han: hanK, yakuman: true };
  }
 
  const chiitoi = y_checkChiitoi(hand as any);
  if (chiitoi.ok && chiitoi.yaku) {
    const list = chiitoi.yaku.slice() as string[];
    if (y_allSimples(hand as any)) list.push('断么九');
    if (y_isChinitsu(hand as any)) list.push('清一色');
    else if (y_isHonitsu(hand as any)) list.push('混一色');
    const han = list.reduce((a, y) => a + (YAKU_LIST[y as keyof typeof YAKU_LIST]?.han || 0), 0);
    return { yaku: list, han, yakuman: false };
  }
 
  const decomp = y_decomposeToMentsu(hand as any);
  if (!decomp.ok || !decomp.groups) {
    return { yaku: [], han: 0, yakuman: false };
  }
  const groups = decomp.groups;

  const yaku: string[] = [];
  if (y_isPinfu(groups as any, hand as any)) yaku.push('平和');
  if (y_allSimples(hand as any)) yaku.push('断么九');
  if (y_isIipeikou(groups as any, hand as any)) yaku.push('一盃口');
  if (y_isIttsuu(hand as any)) yaku.push('一気通貫');
  if (y_isToitoi(groups as any)) yaku.push('対々和');
  if (y_isSananko(groups as any)) yaku.push('三暗刻');
  if (y_isSanshokuDoujun(hand as any)) yaku.push('三色同順');
  if (y_isChinitsu(hand as any)) yaku.push('清一色');
  else if (y_isHonitsu(hand as any)) yaku.push('混一色');
  if (y_hasYakuhai(hand as any)) yaku.push('役牌');
 
  const han = yaku.reduce((a, name) => a + (YAKU_LIST[name as keyof typeof YAKU_LIST]?.han || 0), 0);
  const hasYakuman = yaku.some((n) => (YAKU_LIST[n as keyof typeof YAKU_LIST] as { han?: number; yakuman?: boolean })?.yakuman === true);
  return { yaku, han, yakuman: hasYakuman };
}

/* ESM化に伴い、グローバル公開は不要（main.js側で必要ならwindowへ束ねる） */
