type Suit = 'm' | 'p' | 's' | 'z';
type TileType = 'number' | 'honor';
type Player = 0 | 1 | 2 | 3;

let __tileSeq = 0;
class Tile {
    id: number;
    suit: Suit;
    number: number;
    type: TileType;
    unicode: string;

    constructor(suit: Suit, number: number, type: TileType = 'number') {
        this.id = __tileSeq++; // 一意IDを付与
        this.suit = suit;
        this.number = number;
        this.type = type;
        this.unicode = this.getUnicode();
    }

    getUnicode(): string {
        const tiles: Readonly<Record<Suit, readonly string[]>> = {
            m: ['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'] as const,
            p: ['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🀟', '🀠', '🀡'] as const,
            s: ['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗', '🀘'] as const,
            z: ['🀀', '🀁', '🀂', '🀃', '🀆', '🀅', '🀄'] as const
        };
        const idx = this.number - 1;
        if (this.suit === 'z') {
            if (idx < 0 || idx >= tiles.z.length) {
                throw new Error(`Invalid honor number: ${this.number}`);
            }
            // non-undefined by bounds check
            return tiles.z[idx]!;
        }
        if (idx < 0 || idx >= tiles[this.suit].length) {
            throw new Error(`Invalid number for suit ${this.suit}: ${this.number}`);
        }
        // non-undefined by bounds check
        return tiles[this.suit][idx]!;
    }

    toString(): string {
        const names = {
            'm': '萬子',
            'p': '筒子', 
            's': '索子',
            'z': '字牌'
        };
        
        if (this.suit === 'z') {
            const honors = ['東', '南', '西', '北', '白', '發', '中'];
            const zihaiString = honors[this.number - 1];
            
            if (!zihaiString) {
                throw new Error(`Invalid honor tile number: ${this.number}`);
            }

            return zihaiString;
        }
        
        return `${this.number}${names[this.suit]}`;
    }

    equals(other: Tile): boolean {
        return this.suit === other.suit && this.number === other.number;
    }
}


export type CalcYakuResult = { yaku: string[]; han: number; yakuman: boolean };
export type CalcYakuFn = (tiles: Tile[]) => CalcYakuResult;

type HitRect = { x: number; y: number; w: number; h: number; player: Player };

class MahjongRenderer {
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
            ];

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

export class MahjongGame {
    calcYaku: CalcYakuFn;
    yakuList?: Record<string, { han?: number; yakuman?: boolean }>;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    renderer: MahjongRenderer;
    tiles: Tile[];
    playerHands: [Tile[], Tile[], Tile[], Tile[]];
    discardPiles: [Tile[], Tile[], Tile[], Tile[]];
    currentPlayer: Player;
    selectedTile: Tile | null;
    wall: Tile[];
    wallIndex: number;
    hitMap: Map<number, HitRect>;
    debugPreloadedYaku: boolean;

    /**
     * 依存注入で役判定を受け取る（将来テストもしやすくする）
     */
    constructor(opts: { calcYaku: CalcYakuFn; yakuList: Record<string, { han?: number; yakuman?: boolean }> }) {
        this.calcYaku = opts.calcYaku;
        this.yakuList = opts.yakuList;


        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
        if (!canvas) throw new Error('canvas #game-canvas not found');
        this.canvas = canvas;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('CanvasRenderingContext2D not available');
        this.ctx = ctx;

        // Rendererを初期化（描画とヒットマップ管理を委譲）
        this.renderer = new MahjongRenderer(this.canvas);

        this.tiles = [];
        this.playerHands = [[], [], [], []];
        this.discardPiles = [[], [], [], []];
        this.currentPlayer = 0 as Player;
        this.selectedTile = null;
        this.wall = [];
        this.wallIndex = 0;

        // ヒットマップ: { id: { x, y, w, h, player } }
        this.hitMap = new Map();

        // デバッグ用: 役揃いスタートを有効化するか
        this.debugPreloadedYaku = true;
        
        this.initGame();
        this.setupEventListeners();
    }

    initGame(): void {
        // 先にキャンバスと状態をクリア
        this.renderer.clear();
        this.discardPiles = [[], [], [], []];

        this.createAllTiles();
        this.shuffleWall();

        if (this.debugPreloadedYaku) {
            this.setupPreloadedYakuHands();
        } else {
            this.dealInitialHands();
        }

        // 再描画
        this.draw();

        // 初期残り枚数表示の同期
        const remainEl = document.getElementById('remaining-tiles');
        if (remainEl) remainEl.textContent = String(this.wall.length - this.wallIndex);
    }

    createAllTiles(): void {
        this.wall = [];
        
        (['m', 'p', 's'] as Suit[]).forEach((suit: Suit) => {
            for (let num = 1; num <= 9; num++) {
                for (let i = 0; i < 4; i++) {
                    this.wall.push(new Tile(suit, num));
                }
            }
        });
        
        for (let num = 1; num <= 7; num++) {
            for (let i = 0; i < 4; i++) {
                this.wall.push(new Tile('z' as Suit, num));
            }
        }
    }

    /**
     * デバッグ用：役が揃った状態の手牌をセットする
     * ここでは「清一色＋一気通貫＋平和候補（順子4＋中張頭）」の例を組む。
     * 手牌: 索子のみ 123, 456, 789 の順子3つ + 234 の順子 + 55 の頭 = 合計14枚
     * 実際: [1s,2s,3s, 4s,5s,6s, 7s,8s,9s, 2s,3s,4s, 5s,5s]
     */
    setupPreloadedYakuHands(): void {
        // まず通常の山と配牌を作ってから、プレイヤー0を上書きする
        this.playerHands = [[], [], [], []];
        for (let player: Player = 0 as Player; player < 4; player = (player + 1) as Player) {
            console.log('Setting up preloaded Yaku hands for debugging...');
            this.playerHands[player] = [];
            for (let i = 0; i < 13; i++) {
                const t = this.drawTile();
                if (t !== null) this.playerHands[player].push(t);
            }
            this.sortHand(player);

            if (player == 4 as Player) {
                break;
            }
        }

        // 東が最初にツモる分（14枚目）
        const firstDraw = this.drawTile();
        if (firstDraw) {
            this.playerHands[0 as Player].push(firstDraw);
            this.sortHand(0 as Player);
        }

        // プレイヤー0の手牌を上書き（壁から消費して不整合を避ける簡易実装として、ここでは直接差し替える）
        const hand: Tile[] = [];
        const pushN = (suit: Suit, number: number, count: number = 1) => {
            for (let i = 0; i < count; i++) hand.push(new Tile(suit, number));
        };
        // 123,456,789,234 + 55（全て索子）
        pushN('s', 1); pushN('s', 2); pushN('s', 3);
        pushN('s', 4); pushN('s', 5); pushN('s', 6);
        pushN('s', 7); pushN('s', 8); pushN('s', 9);
        pushN('s', 2); pushN('s', 3); pushN('s', 4);
        pushN('s', 5, 2);

        this.playerHands[0 as Player] = hand;
        this.sortHand(0 as Player);

        // ヒットマップは描画時に再構築されるためここでは不要
    }

    shuffleWall(): void {
        for (let i = this.wall.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp: Tile = this.wall[i]!;
            this.wall[i] = this.wall[j]!;
            this.wall[j] = temp;
        }
        this.wallIndex = 0;
    }

    dealInitialHands(): void {
        for (let player: Player = 0 as Player; player < 4; player = ((player + 1) % 4) as Player) {
            this.playerHands[player] = [];
            for (let i = 0; i < 13; i++) {
                const t = this.drawTile();
                if (t !== null) this.playerHands[player].push(t);
            }
            this.sortHand(player);
        }

        // 東家（プレイヤー0）が最初にツモって開始（14枚にしてから打牌可能にする）
        const firstDraw = this.drawTile();
        if (firstDraw) {
            this.playerHands[0 as Player].push(firstDraw);
            this.sortHand(0 as Player);
        }
    }

    drawTile(): Tile | null {
        if (this.wallIndex < this.wall.length) {
            const tile = this.wall[this.wallIndex++];
            return tile !== undefined ? tile : null;
        }
        return null;
    }

    sortHand(player: Player): void {
        this.playerHands[player].sort((a, b) => {
            if (a.suit !== b.suit) {
                const suitOrder = {'m': 1, 'p': 2, 's': 3, 'z': 4};
                return suitOrder[a.suit] - suitOrder[b.suit];
            }
            return a.number - b.number;
        });
    }

    // 手牌のうち、最後にツモった1枚を右端固定で表示するための描画用配列を返す
    getHandWithFixedDraw(player: Player): Tile[] {
        const hand = this.playerHands[player];
        if (player !== 0) return hand; // AIは従来通り
        if (hand.length <= 13) return hand;
        // 13枚をソート済み部分、最後の1枚をツモ牌として右端に固定
        const sorted13 = hand.slice(0, 13).slice().sort((a, b) => {
            if (a.suit !== b.suit) {
                const suitOrder = {'m': 1, 'p': 2, 's': 3, 'z': 4};
                return suitOrder[a.suit] - suitOrder[b.suit];
            }
            return a.number - b.number;
        });
        const drawn = hand[hand.length - 1];
        if (drawn === undefined) return hand; // 安全ガード
        // concat expects Tile (not possibly undefined)
        return [...sorted13, drawn];
    }

    draw(): void {
        this.renderer.clear();
        this.renderer.clear();

        // 牌1個分（幅45 + 間隔2 = 47px）右にずらす
        this.renderer.drawPlayerHand(0 as Player, this.getHandWithFixedDraw(0 as Player), 60 + 47, 650);
        this.renderer.drawPlayerHand(1 as Player, this.playerHands[1 as Player], 50, 50, true);
        this.renderer.drawPlayerHand(2 as Player, this.playerHands[2 as Player], 60 + 47, 100);
        this.renderer.drawPlayerHand(3 as Player, this.playerHands[3 as Player], 1100, 50, true);

        this.renderer.drawDiscardPiles(this.discardPiles);
        this.renderer.drawInfo(this.wall.length, this.wallIndex, this.currentPlayer);
        this.drawYakuInfo();
    }

    drawYakuInfo(): void {
        // プレイヤー0の手牌の役を右側に表示
        const hand = this.playerHands[0 as Player];
        if (!hand || hand.length !== 14) return;

        // ESM環境では yaku.js からの import を main.js 側で window に束ねているため参照できる
        const calc = this.calcYaku;
        const result: CalcYakuResult = calc ? calc(hand) : { yaku: [], han: 0, yakuman: false };
        this.renderer.drawYaku(result, this.yakuList);
    }

    setupEventListeners(): void {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.handleTileClick(x, y);
        });

        const newGameBtn = document.getElementById('new-game');
        newGameBtn?.addEventListener('click', () => {
            // まず状態をクリーンに初期化
            this.discardPiles = [[], [], [], []];
            this.playerHands = [[], [], [], []];
            this.currentPlayer = 0 as Player;
            this.wall = [];
            this.wallIndex = 0;

            // キャンバスを完全クリア
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // 残り牌・現在プレイヤー表示もリセット
            const remainEl = document.getElementById('remaining-tiles');
            if (remainEl) remainEl.textContent = '0';
            const curEl = document.getElementById('current-player');
            if (curEl) curEl.textContent = '東';

            // 再初期化
            this.initGame();
        });

        const sortBtn = document.getElementById('sort-hand');
        sortBtn?.addEventListener('click', () => {
            this.sortHand(0 as Player);
            this.draw();
        });
    }

    handleTileClick(x: number, y: number): void {
        if (this.currentPlayer !== 0) return;

        // 打牌は必ず14枚時のみ許可
        const hand = this.playerHands[0 as Player];
        if (!hand || hand.length !== 14) return;

        // ヒットマップから座標に一致する牌IDを逆引き
        let clickedId: number | null = null;
        for (const [id, rect] of this.renderer.hitMap.entries()) {
            if (rect.player !== 0) continue; // 自家のみ反応
            if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
                clickedId = id;
                break;
            }
        }
        if (clickedId == null) return;

        // 牌IDから実インデックスを求めて打牌
        const realIndex = this.playerHands[0 as Player].findIndex(t => t.id === clickedId);
        if (realIndex < 0) return;

        this.discardTile(realIndex);
    }

    discardTile(tileIndex: number): void {
        if (this.currentPlayer !== 0) return;
        
        const hand0 = this.playerHands[0 as Player];
        if (!hand0 || tileIndex < 0 || tileIndex >= hand0.length) return;
        const tile = hand0[tileIndex];
        if (tile === undefined) return; // ガード
        // splice returns removed items, but we already read tile so ignore return
        hand0.splice(tileIndex, 1);
        this.discardPiles[0 as Player].push(tile);

        // 打牌後に手牌（13枚）をソート
        this.sortHand(0);
        
        this.nextPlayer();
        this.draw();
        
        setTimeout(() => {
            this.aiTurn();
        }, 100);
    }

    nextPlayer(): void {
        this.currentPlayer = ((this.currentPlayer + 1) % 4) as Player;
        const curEl = document.getElementById('current-player');
        if (curEl) curEl.textContent = (['東', '南', '西', '北'] as const)[this.currentPlayer];
    }

    aiTurn(): void {
        if (this.currentPlayer === (0 as Player)) return;
        
        // 他家は必ずツモってから打牌（常に 13 -> ツモで14 -> 打牌で13）
        const drawnTile = this.drawTile();
        if (drawnTile) {
            this.playerHands[this.currentPlayer].push(drawnTile);
            this.sortHand(this.currentPlayer);

            // 打牌は14枚から1枚捨てる
            const randomIndex = Math.floor(Math.random() * this.playerHands[this.currentPlayer].length);
            const handCur = this.playerHands[this.currentPlayer];
            if (handCur.length > 0) {
                const discardedTile = handCur[randomIndex]!;
                handCur.splice(randomIndex, 1);
                this.discardPiles[this.currentPlayer].push(discardedTile as Tile);
            }
        }
        
        this.nextPlayer();
        this.draw();
        
        if (this.currentPlayer !== (0 as Player)) {
            setTimeout(() => {
                this.aiTurn();
            }, 100);
        } else {
            // 自分番でも同様に 13 -> ツモで14 を保証
        const newTile = this.drawTile();
        if (newTile) {
            // ツモ牌は右端固定のため、ソートせず末尾にpush
            this.playerHands[0 as Player].push(newTile);
            // 表示は getHandWithFixedDraw で右端固定される
            this.draw();
        }
        }
        
        const remainEl = document.getElementById('remaining-tiles');
        if (remainEl) remainEl.textContent = String(this.wall.length - this.wallIndex);
    }
}
