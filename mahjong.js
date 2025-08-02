let __tileSeq = 0;
class Tile {
    constructor(suit, number, type = 'number') {
        this.id = __tileSeq++; // 一意IDを付与
        this.suit = suit;
        this.number = number;
        this.type = type;
        this.unicode = this.getUnicode();
    }

    getUnicode() {
        const tiles = {
            'm': ['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'],
            'p': ['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🀟', '🀠', '🀡'],
            's': ['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗', '🀘'],
            'z': ['🀀', '🀁', '🀂', '🀃', '🀆', '🀅', '🀄']
        };
        
        if (this.suit === 'z') {
            return tiles[this.suit][this.number - 1];
        }
        return tiles[this.suit][this.number - 1];
    }

    toString() {
        const names = {
            'm': '萬子',
            'p': '筒子', 
            's': '索子',
            'z': '字牌'
        };
        
        if (this.suit === 'z') {
            const honors = ['東', '南', '西', '北', '白', '發', '中'];
            return honors[this.number - 1];
        }
        
        return `${this.number}${names[this.suit]}`;
    }

    equals(other) {
        return this.suit === other.suit && this.number === other.number;
    }
}


export class MahjongGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tiles = [];
        this.playerHands = [[], [], [], []];
        this.discardPiles = [[], [], [], []];
        this.currentPlayer = 0;
        this.selectedTile = null;
        this.wall = [];
        this.wallIndex = 0;

        // ヒットマップ: { id: { x, y, w, h, player } }
        this.hitMap = new Map();

        // デバッグ用: 役揃いスタートを有効化するか
        // true にすると、プレイヤー0は最初から14枚の和了形（例: 清一色＋一気通貫＋平和候補）で開始
        this.debugPreloadedYaku = true;
        
        this.initGame();
        this.setupEventListeners();
    }

    initGame() {
        // 先にキャンバスと状態をクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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

    createAllTiles() {
        this.wall = [];
        
        ['m', 'p', 's'].forEach(suit => {
            for (let num = 1; num <= 9; num++) {
                for (let i = 0; i < 4; i++) {
                    this.wall.push(new Tile(suit, num));
                }
            }
        });
        
        for (let num = 1; num <= 7; num++) {
            for (let i = 0; i < 4; i++) {
                this.wall.push(new Tile('z', num));
            }
        }
    }

    /**
     * デバッグ用：役が揃った状態の手牌をセットする
     * ここでは「清一色＋一気通貫＋平和候補（順子4＋中張頭）」の例を組む。
     * 手牌: 索子のみ 123, 456, 789 の順子3つ + 234 の順子 + 55 の頭 = 合計14枚
     * 実際: [1s,2s,3s, 4s,5s,6s, 7s,8s,9s, 2s,3s,4s, 5s,5s]
     */
    setupPreloadedYakuHands() {
        // まず通常の山と配牌を作ってから、プレイヤー0を上書きする
        this.playerHands = [[], [], [], []];
        for (let player = 0; player < 4; player++) {
            this.playerHands[player] = [];
            for (let i = 0; i < 13; i++) {
                this.playerHands[player].push(this.drawTile());
            }
            this.sortHand(player);
        }
        // 東が最初にツモる分
        const firstDraw = this.drawTile();
        if (firstDraw) {
            this.playerHands[0].push(firstDraw);
            this.sortHand(0);
        }

        // プレイヤー0の手牌を上書き（壁から消費して不整合を避ける簡易実装として、ここでは直接差し替える）
        const hand = [];
        const pushN = (suit, number, count = 1) => {
            for (let i = 0; i < count; i++) hand.push(new Tile(suit, number));
        };
        // 123,456,789,234 + 55（全て索子）
        pushN('s', 1); pushN('s', 2); pushN('s', 3);
        pushN('s', 4); pushN('s', 5); pushN('s', 6);
        pushN('s', 7); pushN('s', 8); pushN('s', 9);
        pushN('s', 2); pushN('s', 3); pushN('s', 4);
        pushN('s', 5, 2);

        this.playerHands[0] = hand;
        this.sortHand(0);

        // ヒットマップは描画時に再構築されるためここでは不要
    }

    shuffleWall() {
        for (let i = this.wall.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.wall[i], this.wall[j]] = [this.wall[j], this.wall[i]];
        }
        this.wallIndex = 0;
    }

    dealInitialHands() {
        for (let player = 0; player < 4; player++) {
            this.playerHands[player] = [];
            for (let i = 0; i < 13; i++) {
                this.playerHands[player].push(this.drawTile());
            }
            this.sortHand(player);
        }

        // 東家（プレイヤー0）が最初にツモって開始（14枚にしてから打牌可能にする）
        const firstDraw = this.drawTile();
        if (firstDraw) {
            this.playerHands[0].push(firstDraw);
            this.sortHand(0);
        }
    }

    drawTile() {
        if (this.wallIndex < this.wall.length) {
            return this.wall[this.wallIndex++];
        }
        return null;
    }

    sortHand(player) {
        this.playerHands[player].sort((a, b) => {
            if (a.suit !== b.suit) {
                const suitOrder = {'m': 1, 'p': 2, 's': 3, 'z': 4};
                return suitOrder[a.suit] - suitOrder[b.suit];
            }
            return a.number - b.number;
        });
    }

    // 手牌のうち、最後にツモった1枚を右端固定で表示するための描画用配列を返す
    getHandWithFixedDraw(player) {
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
        return sorted13.concat([drawn]);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // ヒットマップを再構築
        this.hitMap.clear();
        
        // 牌1個分（幅45 + 間隔2 = 47px）右にずらす
        this.drawPlayerHand(0, 60 + 47, 650);
        this.drawPlayerHand(1, 50, 50, true);
        this.drawPlayerHand(2, 60 + 47, 100);
        this.drawPlayerHand(3, 1100, 50, true);
        
        this.drawDiscardPiles();
        this.drawWallInfo();
        this.drawYakuInfo();
    }

    drawPlayerHand(player, x, y, vertical = false) {
        // 東家はツモ牌を右端固定表示
        const hand = (player === 0) ? this.getHandWithFixedDraw(player) : this.playerHands[player];
        const tileWidth = 45;
        const tileHeight = 60;
        
        hand.forEach((tile, index) => {
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
                this.ctx.fillText(tile.unicode, tileX + tileWidth/2, tileY + tileHeight/2 + 8);
            }

            // 自家/他家問わず、可視領域にある牌の当たり判定をヒットマップに登録
            // 今は自家のみクリック対象だが、将来的な拡張（鳴き選択など）に備えて全員分を登録
            this.hitMap.set(tile.id, { x: tileX, y: tileY, w: tileWidth, h: tileHeight, player });
        });
    }

    drawDiscardPiles() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 念のため、空配列でなければクリア（initGameのclearRectに加え保険として）
        if (!this.discardPiles || !Array.isArray(this.discardPiles)) {
            this.discardPiles = [[], [], [], []];
        }
        
        [0, 1, 2, 3].forEach(player => {
            const pile = this.discardPiles[player] || [];
            const positions = [
                {x: centerX - 150, y: centerY + 100},
                {x: centerX - 200, y: centerY - 100},
                {x: centerX - 150, y: centerY - 200},
                {x: centerX + 100, y: centerY - 100}
            ];
            
            pile.forEach((tile, index) => {
                const tileX = positions[player].x + (index % 6) * 25;
                const tileY = positions[player].y + Math.floor(index / 6) * 25;
                
                this.ctx.fillStyle = '#F0F0F0';
                this.ctx.fillRect(tileX, tileY, 20, 25);
                this.ctx.strokeStyle = '#666';
                this.ctx.strokeRect(tileX, tileY, 20, 25);
            });
        });
    }

    drawWallInfo() {
        this.ctx.fillStyle = '#000';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`残り牌: ${this.wall.length - this.wallIndex}`, 20, 30);
        
        const playerNames = ['東（あなた）', '南', '西', '北'];
        this.ctx.fillText(`現在のプレイヤー: ${playerNames[this.currentPlayer]}`, 20, 50);
    }

    drawYakuInfo() {
        // プレイヤー0の手牌の役を右側に表示
        const hand = this.playerHands[0];
        if (hand.length !== 14) return;

        // ESM環境では yaku.js からの import を main.js 側で window に束ねているため参照できる
        const result = window.calcYaku ? window.calcYaku(hand) : { yaku: [], han: 0, yakuman: false };
        this.ctx.fillStyle = '#000';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        const baseX = 900;
        let y = 100;
        this.ctx.fillText('役判定', baseX, y);
        y += 22;
        if (result.yaku.length === 0) {
            this.ctx.fillText('なし', baseX, y);
            y += 20;
        } else {
            for (const name of result.yaku) {
                const han = YAKU_LIST[name]?.han ?? 0;
                const yakuman = YAKU_LIST[name]?.yakuman ? '（役満）' : '';
                this.ctx.fillText(`${name} ${yakuman || han + '翻'}`, baseX, y);
                y += 20;
            }
            this.ctx.fillText(`合計: ${result.yakuman ? '役満' : result.han + '翻'}`, baseX, y + 6);
        }
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.handleTileClick(x, y);
        });

        document.getElementById('new-game').addEventListener('click', () => {
            // まず状態をクリーンに初期化
            this.discardPiles = [[], [], [], []];
            this.playerHands = [[], [], [], []];
            this.currentPlayer = 0;
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

        document.getElementById('sort-hand').addEventListener('click', () => {
            this.sortHand(0);
            this.draw();
        });
    }

    handleTileClick(x, y) {
        if (this.currentPlayer !== 0) return;

        // 打牌は必ず14枚時のみ許可
        const hand = this.playerHands[0];
        if (hand.length !== 14) return;

        // ヒットマップから座標に一致する牌IDを逆引き
        let clickedId = null;
        for (const [id, rect] of this.hitMap.entries()) {
            if (rect.player !== 0) continue; // 自家のみ反応
            if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
                clickedId = id;
                break;
            }
        }
        if (clickedId == null) return;

        // 牌IDから実インデックスを求めて打牌
        const realIndex = this.playerHands[0].findIndex(t => t.id === clickedId);
        if (realIndex === -1) return;

        this.discardTile(realIndex);
    }

    discardTile(tileIndex) {
        if (this.currentPlayer !== 0) return;
        
        const tile = this.playerHands[0][tileIndex];
        this.playerHands[0].splice(tileIndex, 1);
        this.discardPiles[0].push(tile);

        // 打牌後に手牌（13枚）をソート
        this.sortHand(0);
        
        this.nextPlayer();
        this.draw();
        
        setTimeout(() => {
            this.aiTurn();
        }, 100);
    }

    nextPlayer() {
        this.currentPlayer = (this.currentPlayer + 1) % 4;
        document.getElementById('current-player').textContent = 
            ['東', '南', '西', '北'][this.currentPlayer];
    }

    aiTurn() {
        if (this.currentPlayer === 0) return;
        
        // 他家は必ずツモってから打牌（常に 13 -> ツモで14 -> 打牌で13）
        const drawnTile = this.drawTile();
        if (drawnTile) {
            this.playerHands[this.currentPlayer].push(drawnTile);
            this.sortHand(this.currentPlayer);

            // 打牌は14枚から1枚捨てる
            const randomIndex = Math.floor(Math.random() * this.playerHands[this.currentPlayer].length);
            const discardedTile = this.playerHands[this.currentPlayer][randomIndex];
            this.playerHands[this.currentPlayer].splice(randomIndex, 1);
            this.discardPiles[this.currentPlayer].push(discardedTile);
        }
        
        this.nextPlayer();
        this.draw();
        
        if (this.currentPlayer !== 0) {
            setTimeout(() => {
                this.aiTurn();
            }, 100);
        } else {
            // 自分番でも同様に 13 -> ツモで14 を保証
            const newTile = this.drawTile();
            if (newTile) {
                // ツモ牌は右端固定のため、ソートせず末尾にpush
                this.playerHands[0].push(newTile);
                // 表示は getHandWithFixedDraw で右端固定される
                this.draw();
            }
        }
        
        document.getElementById('remaining-tiles').textContent = this.wall.length - this.wallIndex;
    }
}

/* 重複していたダミー定義を削除（ESM用の本定義は上部の1つのみ） */
