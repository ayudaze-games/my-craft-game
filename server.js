// 🌐 Node.jsの簡易サーバープログラム（server.js）
const http = require('http');

// プレイヤー全員の位置情報を記憶するリスト
let players = {};

const server = http.createServer((req, res) => {
    // ブラウザからのアクセスに「通信OKだよ」と返す設定（CORS対策）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 🔄 プレイヤーが自分の位置を送ってきた時の処理
    if (req.url === '/update' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // 送ってきたプレイヤーの情報を更新（ID、座標、回転）
                players[data.id] = {
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    ry: data.ry,
                    lastSeen: Date.now()
                };

                // ⏱️ 5秒以上通信が途絶えたプレイヤーを自動削除（退出処理）
                const now = Date.now();
                for (let id in players) {
                    if (now - players[id].lastSeen > 5000) {
                        delete players[id];
                    }
                }

                // 今部屋にいる全員のデータを送り返す
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(players));
            } catch (e) {
                res.writeHead(400);
                res.end('Bad Request');
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// ネット上のサーバーが指定するポート（なければ3000番）で待ち受け開始！
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 マイクラ風マルチサーバーがポート ${PORT} で起動しました！`);
});