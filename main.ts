// ES Modules entry point

import { calcYaku, YAKU_LIST } from './yaku.js';
import { MahjongGame } from './mahjong.js';

// Bootstrap
window.addEventListener('load', () => {
  // If MahjongGame expects no args, just instantiate.
  new MahjongGame();
});
