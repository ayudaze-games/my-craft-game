// 🆔 自分だけのランダムなプレイヤーIDを作る
const myId = 'player_' + Math.random().toString(36).substring(2, 9);

// 他のプレイヤーの3Dモデル（頭）を管理するリスト
let otherPlayersMesh = {};

// 🖼️ 自分のスキン画像を一時的に保存する変数（初期値はなし）
window.mySkinData = null;

// 🌐 サーバーに自分の位置と【スキン画像】を送って、全員のデータを貰ってくる関数
async function sendPositionToServer(x, y, z, ry) {
    try {
        const response = await fetch('https://my-craft-game.onrender.com/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 💡 座標と一緒に自分のスキンデータ(画像)もサーバーに送信します！
            body: JSON.stringify({ id: myId, x: x, y: y, z: z, ry: ry, skin: window.mySkinData })
        });

        if (response.ok) {
            const allPlayers = await response.json();
            // 貰ったデータをもとに、他のプレイヤーの画面表示（と顔）を更新する
            updateOtherPlayers(allPlayers);
        }
    } catch (error) {
        // サーバーが起動していない時はエラーを無視してゲームを続行
    }
}

// 👥 他のプレイヤーを画面に出現・移動・削除、そして【顔の貼り付け】をする関数
function updateOtherPlayers(allPlayers) {
    for (let id in allPlayers) {
        if (id === myId) continue; // 自分のデータは飛ばす

        const pData = allPlayers[id];

        // まだ画面にいない新しいプレイヤーだったら、新しく頭モデルを作る
        if (!otherPlayersMesh[id]) {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            
            // 💡 最初は顔なし（ピンク）のマテリアルを6面分（右、左、上、下、前、後）用意する
            const defaultMaterials = [
                new THREE.MeshBasicMaterial({ color: 0xff00ff }), // 右
                new THREE.MeshBasicMaterial({ color: 0xff00ff }), // 左
                new THREE.MeshBasicMaterial({ color: 0xff00ff }), // 上
                new THREE.MeshBasicMaterial({ color: 0xff00ff }), // 下
                new THREE.MeshBasicMaterial({ color: 0xff00ff }), // 前（ここが顔になります）
                new THREE.MeshBasicMaterial({ color: 0xff00ff })  // 後
            ];
            
            const mesh = new THREE.Mesh(geometry, defaultMaterials);
            scene.add(mesh);          // 画面（シーン）に追加
            otherPlayersMesh[id] = mesh; // リストに記憶
            
            // このプレイヤーが使っているスキン画像を記録しておくプロパティ
            mesh.userData = { loadedSkin: null };
        }

        const mesh = otherPlayersMesh[id];

        // 相手の位置と体の向き（回転）をスムーズに動かす
        mesh.position.set(pData.x, pData.y, pData.z);
        mesh.rotation.y = pData.ry;

        // 🖼️ 【大注目！】相手がスキン画像を送ってきていて、まだそれを貼り付けていない場合
        if (pData.skin && mesh.userData.loadedSkin !== pData.skin) {
            mesh.userData.loadedSkin = pData.skin; // 読み込み済みにする

            // 文字列（Base64）になっている画像データをThree.jsのテクスチャに変換
            const img = new Image();
            img.src = pData.skin;
            img.onload = function() {
                const texture = new THREE.Texture(img);
                texture.needsUpdate = true;
                // ドット絵でもボヤけないようにする設定
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;

                // 💡 正面（マテリアルの4番目、インデックスで言うと4）に顔画像を貼り付ける！
                mesh.material[4] = new THREE.MeshStandardMaterial({ map: texture });
                mesh.material[4].needsUpdate = true;
            };
        }
    }

    // 🚪 サーバーから消えた（切断した）プレイヤーを画面から消す処理
    for (let id in otherPlayersMesh) {
        if (!allPlayers[id]) {
            scene.remove(otherPlayersMesh[id]);
            delete otherPlayersMesh[id];
        }
    }
}