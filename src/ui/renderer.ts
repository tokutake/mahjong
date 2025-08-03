import type { Tile } from '../domain/tile';
import type { Player } from './inputMapper';
import { InputMapper } from './inputMapper';

export type CalcYakuResult = { yaku: string[]; han: number; yakuman: boolean };
export type HitRect = { x: number; y: number; w: number; h: number; player: Player };

export class MahjongRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hitMap: Map<number, HitRect> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('CanvasRenderingContext2D not available');
    this.ctx = ctx;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hitMap.clear();
  }

  drawPlayerHand(player: Player, tiles: Tile[], x: number, y: number, vertical: boolean = false): void {
    const tileWidth = 45;
    const tileHeight = 60;

    tiles.forEach((tile, index) => {
      const tileX = vertical ? x : x + index * (tileWidth + 2);
      const tileY = vertical ? y + index * (tileHeight + 2) : y;

      this.ctx.fillStyle = player === 0 ? '#FFF8DC' : '#E0E0E0';
      this.ctx.fillRect(tileX, tileY, tileWidth, tileHeight);

      this.ctx.strokeStyle = '#8B4513';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(tileX, tileY, tileWidth, tileHeight);

      if (player === 0) {
        this.ctx.fillStyle = '#000';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(tile.unicode, tileX + tileWidth / 2, tileY + tileHeight / 2 + 8);
      }

      this.hitMap.set(tile.id, { x: tileX, y: tileY, w: tileWidth, h: tileHeight, player });
    });
  }

  drawDiscardPiles(discardPiles: [Tile[], Tile[], Tile[], Tile[]]): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    const players: Player[] = [0, 1, 2, 3];
    players.forEach(player => {
      const pile = discardPiles[player] || [];
      const positions = [
        { x: centerX - 150, y: centerY + 100 },
        { x: centerX - 200, y: centerY - 100 },
        { x: centerX - 150, y: centerY - 200 },
        { x: centerX + 100, y: centerY - 100 }
      ] as const;

      pile.forEach((_, index) => {
        const pos = positions[player]!;
        const tileX = pos.x + (index % 6) * 25;
        const tileY = pos.y + Math.floor(index / 6) * 25;

        this.ctx.fillStyle = '#F0F0F0';
        this.ctx.fillRect(tileX, tileY, 20, 25);
        this.ctx.strokeStyle = '#666';
        this.ctx.strokeRect(tileX, tileY, 20, 25);
      });
    });
  }

  drawInfo(wallLen: number, wallIndex: number, currentPlayer: Player): void {
    this.ctx.fillStyle = '#000';
    this.ctx.font = '16px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`残り牌: ${wallLen - wallIndex}`, 20, 30);

    const playerNames = ['東（あなた）', '南', '西', '北'] as const;
    this.ctx.fillText(`現在のプレイヤー: ${playerNames[currentPlayer]}`, 20, 50);
  }

  drawYaku(result: CalcYakuResult, yakuList?: Record<string, { han?: number; yakuman?: boolean }>): void {
    this.ctx.fillStyle = '#000';
    this.ctx.font = '16px Arial';
    this.ctx.textAlign = 'left';
    const baseX = 900;
    let y = 100;
    this.ctx.fillText('役判定', baseX, y);
    y += 22;
    if (!result || result.yaku.length === 0) {
      this.ctx.fillText('なし', baseX, y);
      return;
    }
    for (const name of result.yaku) {
      const han = yakuList?.[name]?.han ?? 0;
      const yakuman = yakuList?.[name]?.yakuman ? '（役満）' : '';
      this.ctx.fillText(`${name} ${yakuman || han + '翻'}`, baseX, y);
      y += 20;
    }
    this.ctx.fillText(`合計: ${result.yakuman ? '役満' : result.han + '翻'}`, baseX, y + 6);
  }
}
