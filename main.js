// 🆔 自分だけのランダムなプレイヤーIDを作る（ページを開くたびに変わります）
const myId = 'player_' + Math.random().toString(36).substring(2, 9);

// 他のプレイヤーの3Dモデル（立方体）を管理するリスト
let otherPlayersMesh = {};

// 🌐 サーバーに自分の位置を送り、全員のデータを貰ってくる関数
async function sendPositionToServer(x, y, z, ry) {
    try {
        const response = await fetch('http://localhost:3000/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: myId, x: x, y: y, z: z, ry: ry })
        });

        if (response.ok) {
            const allPlayers = await response.json();
            // 貰ったデータをもとに、他のプレイヤーの画面表示を更新する
            updateOtherPlayers(allPlayers);
        }
    } catch (error) {
        // サーバーが起動していない時はエラーを無視してゲームを続行
    }
}

// 👥 他のプレイヤーを画面に出現・移動・削除する関数
function updateOtherPlayers(allPlayers) {
    for (let id in allPlayers) {
        if (id === myId) continue; // 自分のデータは飛ばす

        const pData = allPlayers[id];

        // まだ画面にいない新しいプレイヤーだったら、新しく3Dモデルを作る
        if (!otherPlayersMesh[id]) {
            // マイクラのキャラクターっぽい立方体（頭）を作る
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // 目立つピンク
            const mesh = new THREE.Mesh(geometry, material);
            
            scene.add(mesh);          // 画面（シーン）に追加
            otherPlayersMesh[id] = mesh; // リストに記憶
        }

        // すでに画面にいる（または今作った）プレイヤーの位置と向きを更新
        otherPlayersMesh[id].position.set(pData.x, pData.y, pData.z);
        otherPlayersMesh[id].rotation.y = pData.ry;
    }

    // サーバーのデータから消えた（切断された）プレイヤーを画面から消す
    for (let id in otherPlayersMesh) {
        if (!allPlayers[id]) {
            scene.remove(otherPlayersMesh[id]);
            delete otherPlayersMesh[id];
        }
    }
}