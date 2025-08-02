// ES Modules entry point

import { calcYaku, YAKU_LIST } from './yaku';
import { GameState } from './state/gameState';
import { GameController } from './controller/gameController';

// Controller/State 分離構成へ移行
window.addEventListener('load', () => {
  const state = new GameState();
  state.newGame();

  // Renderer のポート実装（既存 mahjong.ts の描画器を薄いアダプタで利用する）
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('canvas #game-canvas not found');

  // 既存の MahjongRenderer と InputMapper 相当は mahjong.ts 内にあるため、
  // ここでは最小限の描画アダプタを作る（当面は mahjong.ts の MahjongGame を使わず、描画ロジックのみ再利用するのが理想だが、
  // 現状は簡易にキャンバスへの直接描画をここで行う）
  // 簡易レンダラ
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CanvasRenderingContext2D not available');

  const hitMap = new Map<number, { x: number; y: number; w: number; h: number; player: 0 | 1 | 2 | 3 }>();

  const renderer = {
    draw(s: Readonly<GameState>) {
      // 既存 mahjong.ts の描画と同様の見た目を維持する簡易実装
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hitMap.clear();

      const drawPlayerHand = (player: 0 | 1 | 2 | 3, tiles: any[], x: number, y: number, vertical = false) => {
        const tileWidth = 45;
        const tileHeight = 60;
        tiles.forEach((tile: any, index: number) => {
          const tileX = vertical ? x : x + index * (tileWidth + 2);
          const tileY = vertical ? y + index * (tileHeight + 2) : y;

          ctx.fillStyle = player === 0 ? '#FFF8DC' : '#E0E0E0';
          ctx.fillRect(tileX, tileY, tileWidth, tileHeight);

          ctx.strokeStyle = '#8B4513';
          ctx.lineWidth = 2;
          ctx.strokeRect(tileX, tileY, tileWidth, tileHeight);

          if (player === 0) {
            ctx.fillStyle = '#000';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(tile.unicode, tileX + tileWidth / 2, tileY + tileHeight / 2 + 8);
          }

          hitMap.set(tile.id, { x: tileX, y: tileY, w: tileWidth, h: tileHeight, player });
        });
      };

      // 牌1個分ずらす
      drawPlayerHand(0, s.getHandWithFixedDraw(0 as any), 60 + 47, 650);
      drawPlayerHand(1, s.playerHands[1], 50, 50, true);
      drawPlayerHand(2, s.playerHands[2], 60 + 47, 100);
      drawPlayerHand(3, s.playerHands[3], 1100, 50, true);

      // 捨て牌
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const positions = [
        { x: centerX - 150, y: centerY + 100 },
        { x: centerX - 200, y: centerY - 100 },
        { x: centerX - 150, y: centerY - 200 },
        { x: centerX + 100, y: centerY - 100 }
      ] as const;
      [0,1,2,3].forEach((p) => {
        const pile = s.discardPiles[p] || [];
        pile.forEach((_, index) => {
          const pos = positions[p]!;
          const tileX = pos.x + (index % 6) * 25;
          const tileY = pos.y + Math.floor(index / 6) * 25;
          ctx.fillStyle = '#F0F0F0';
          ctx.fillRect(tileX, tileY, 20, 25);
          ctx.strokeStyle = '#666';
          ctx.strokeRect(tileX, tileY, 20, 25);
        });
      });

      // 情報
      ctx.fillStyle = '#000';
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`残り牌: ${s.wall.length - s.wallIndex}`, 20, 30);
      const playerNames = ['東（あなた）', '南', '西', '北'] as const;
      ctx.fillText(`現在のプレイヤー: ${playerNames[s.currentPlayer]}`, 20, 50);
    },
    drawYaku(result: { yaku: string[]; han: number; yakuman: boolean }) {
      ctx.fillStyle = '#000';
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';
      const baseX = 900;
      let y = 100;
      ctx.fillText('役判定', baseX, y);
      y += 22;
      if (!result || result.yaku.length === 0) {
        ctx.fillText('なし', baseX, y);
        return;
      }
      for (const name of result.yaku) {
        const han = (YAKU_LIST as any)?.[name]?.han ?? 0;
        const yakuman = (YAKU_LIST as any)?.[name]?.yakuman ? '（役満）' : '';
        ctx.fillText(`${name} ${yakuman || han + '翻'}`, baseX, y);
        y += 20;
      }
      ctx.fillText(`合計: ${result.yakuman ? '役満' : result.han + '翻'}`, baseX, y + 6);
    },
    bindCanvasClick(handler: (x: number, y: number) => void) {
      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        handler(x, y);
      });
    },
    updateInfo(remain: number, currentPlayer: number) {
      const remainEl = document.getElementById('remaining-tiles');
      if (remainEl) remainEl.textContent = String(remain);
      const curEl = document.getElementById('current-player');
      if (curEl) curEl.textContent = (['東', '南', '西', '北'] as const)[currentPlayer as 0|1|2|3];
    },
    setHitRegions(_hit: Map<number, any>, priority: number[]) {
      // state に同期
      state.setHitRegions(hitMap, priority);
    }
  };

  const controller = new GameController({
    state,
    renderer,
    calcYaku: calcYaku as any,
    yakuList: YAKU_LIST as any
  });

  // UI ボタン
  const newGameBtn = document.getElementById('new-game');
  newGameBtn?.addEventListener('click', () => controller.newGame());

  const sortBtn = document.getElementById('sort-hand');
  sortBtn?.addEventListener('click', () => controller.sortMyHand());
});
