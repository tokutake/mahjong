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

// 牌ユーティリティ（mahjong.jsのTileと互換のシンプル構造想定）
// yaku.js単体でも動作させるため、必要最低限のアクセス関数を用意
function y_tileKey(t) {
  return `${t.suit}${t.number}`;
}
function y_countByKey(tiles) {
  const m = new Map();
  for (const t of tiles) {
    const k = y_tileKey(t);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
function y_sortTiles(tiles) {
  const suitOrder = { m: 1, p: 2, s: 3, z: 4 };
  return tiles.slice().sort((a, b) => {
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
  '一気通貫': { han: 2 },
  '混一色': { han: 3 },
  '清一色': { han: 6 },
  '対々和': { han: 2 },
  '三暗刻': { han: 2, menzenOnly: true },
  '三色同順': { han: 2 },
  '役牌': { han: 1 }
};

// 基本プロパティ
function y_allSimples(tiles) {
  return tiles.every(t => t.suit !== 'z' && t.number >= 2 && t.number <= 8);
}

// 役牌（白發中）の刻子/槓子があるか
function y_hasYakuhai(tiles) {
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
function y_checkKokushi(tiles) {
  const cnt = new Map();
  for (const t of tiles) {
    const k = y_tileKey(t);
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  const terminals = [];
  for (const suit of ['m', 'p', 's']) {
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
function y_checkChiitoi(tiles) {
  if (tiles.length !== 14) return { ok: false };
  const cnt = y_countByKey(tiles);
  if (cnt.size !== 7) return { ok: false };
  for (const v of cnt.values()) if (v !== 2) return { ok: false };
  return { ok: true, yaku: ['七対子'] };
}

// 面子手分解
function y_decomposeToMentsu(tiles) {
  const sorted = y_sortTiles(tiles);
  const counts = y_countByKey(sorted);

  function removeCount(k, n) {
    const v = counts.get(k) || 0;
    if (v < n) return false;
    if (v === n) counts.delete(k);
    else counts.set(k, v - n);
    return true;
  }

  function tryWithHead(headKey) {
    const save = new Map(counts);
    const groups = [];
    if (!removeCount(headKey, 2)) return null;
    groups.push({ type: 'pair' });

    function nextGroup() {
      if (Array.from(counts.values()).reduce((a, b) => a + b, 0) === 0) return true;

      const keys = Array.from(counts.keys()).sort((ka, kb) => {
        const sa = ka[0], sb = kb[0];
        if (sa !== sb) return ({ m: 1, p: 2, s: 3, z: 4 }[sa] - { m: 1, p: 2, s: 3, z: 4 }[sb]);
        return parseInt(ka.slice(1), 10) - parseInt(kb.slice(1), 10);
      });

      const k = keys[0];
      const suit = k[0];
      const num = parseInt(k.slice(1), 10);
      const v = counts.get(k);

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
          groups.push({ type: 'chi' });
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

  const headCandidates = [];
  for (const [k, v] of counts) if (v >= 2) headCandidates.push(k);
  for (const hk of headCandidates) {
    const g = tryWithHead(hk);
    if (g) return { ok: true, groups: g };
  }
  return { ok: false };
}

function y_isMenzenDefault() {
  return true;
}

function y_isPinfu(groups, tiles) {
  if (!y_isMenzenDefault()) return false;
  const cnt = y_countByKey(tiles);
  let headIsOk = false;
  for (const [k, v] of cnt) {
    if (v === 2) {
      const suit = k[0];
      const num = parseInt(k.slice(1), 10);
      if (suit === 'z') { headIsOk = false; break; }
      if (num === 1 || num === 9) { headIsOk = false; break; }
      headIsOk = true;
      break;
    }
  }
  if (!headIsOk) return false;
  if (!groups.every(g => g.type === 'chi' || g.type === 'pair')) return false;
  return true;
}

function y_isIipeikou(groups) {
  if (!y_isMenzenDefault()) return false;
  const chiCount = groups.filter(g => g.type === 'chi').length;
  return chiCount >= 2;
}

function y_isIttsuu(tiles) {
  for (const suit of ['m', 'p', 's']) {
    const set = new Set(tiles.filter(t => t.suit === suit).map(t => t.number));
    const has123 = [1, 2, 3].every(n => set.has(n));
    const has456 = [4, 5, 6].every(n => set.has(n));
    const has789 = [7, 8, 9].every(n => set.has(n));
    if (has123 && has456 && has789) return true;
  }
  return false;
}

function y_isToitoi(groups) {
  const pons = groups.filter(g => g.type === 'pon').length;
  return pons === 4;
}

function y_isSananko(groups) {
  if (!y_isMenzenDefault()) return false;
  const pons = groups.filter(g => g.type === 'pon').length;
  return pons >= 3;
}

function y_isSanshokuDoujun(tiles) {
  for (let start = 1; start <= 7; start++) {
    let ok = true;
    for (const suit of ['m', 'p', 's']) {
      const set = new Set(tiles.filter(t => t.suit === suit).map(t => t.number));
      if (!(set.has(start) && set.has(start + 1) && set.has(start + 2))) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function y_isHonitsu(tiles) {
  const suits = new Set(tiles.filter(t => t.suit !== 'z').map(t => t.suit));
  const hasHonor = tiles.some(t => t.suit === 'z');
  return suits.size === 1 && hasHonor;
}

function y_isChinitsu(tiles) {
  const suits = new Set(tiles.filter(t => t.suit !== 'z').map(t => t.suit));
  const hasHonor = tiles.some(t => t.suit === 'z');
  return suits.size === 1 && !hasHonor && tiles.length > 0;
}

export function calcYaku(tiles) {
  const hand = y_sortTiles(tiles);

  const kokushi = y_checkKokushi(hand);
  if (kokushi.ok) {
    return { yaku: kokushi.yaku.slice(), han: kokushi.yaku.reduce((a, y) => a + (YAKU_LIST[y].han || 0), 0), yakuman: true };
  }

  const chiitoi = y_checkChiitoi(hand);
  if (chiitoi.ok) {
    const list = chiitoi.yaku.slice();
    if (y_allSimples(hand)) list.push('断么九');
    if (y_isChinitsu(hand)) list.push('清一色');
    else if (y_isHonitsu(hand)) list.push('混一色');
    const han = list.reduce((a, y) => a + (YAKU_LIST[y]?.han || 0), 0);
    return { yaku: list, han, yakuman: false };
  }

  const decomp = y_decomposeToMentsu(hand);
  if (!decomp.ok) {
    return { yaku: [], han: 0, yakuman: false };
  }
  const groups = decomp.groups;

  const yaku = [];
  if (y_isPinfu(groups, hand)) yaku.push('平和');
  if (y_allSimples(hand)) yaku.push('断么九');
  if (y_isIipeikou(groups)) yaku.push('一盃口');
  if (y_isIttsuu(hand)) yaku.push('一気通貫');
  if (y_isToitoi(groups)) yaku.push('対々和');
  if (y_isSananko(groups)) yaku.push('三暗刻');
  if (y_isSanshokuDoujun(hand)) yaku.push('三色同順');
  if (y_isChinitsu(hand)) yaku.push('清一色');
  else if (y_isHonitsu(hand)) yaku.push('混一色');
  if (y_hasYakuhai(hand)) yaku.push('役牌');

  const han = yaku.reduce((a, name) => a + (YAKU_LIST[name]?.han || 0), 0);
  const hasYakuman = yaku.some(n => YAKU_LIST[n]?.yakuman);
  return { yaku, han, yakuman: hasYakuman };
}

/* ESM化に伴い、グローバル公開は不要（main.js側で必要ならwindowへ束ねる） */
