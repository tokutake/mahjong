// ES Modules entry point

import { calcYaku, YAKU_LIST } from './yaku';
import { MahjongGame } from './mahjong';

// 依存注入でwindow依存を排除（MahjongGameへ渡す）
window.addEventListener('load', () => {
  const game = new MahjongGame({ calcYaku, yakuList: YAKU_LIST });
  // void game; // 将来のデバッグ用途で参照
});
