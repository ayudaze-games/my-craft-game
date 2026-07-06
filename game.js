// =================================================================
// 📦 1. 3Dの世界（シーン、カメラ、レンダラー）の基本セットアップ
// =================================================================
if (!window.scene) window.scene = new THREE.Scene();
if (!window.camera) window.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
if (!window.renderer) {
    window.renderer = new THREE.WebGLRenderer();
    window.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(window.renderer.domElement);
}

// 背景をマイクラ風の綺麗な青空の色にする
window.renderer.setClearColor(0x78a7ff, 1);

// =================================================================
// ☀️ 2. 太陽の光（ライト）を追加
// =================================================================
if (!window.hasLight) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    window.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 10);
    window.scene.add(directionalLight);
    window.hasLight = true;
}

// =================================================================
// 🧱 3. 世界（World）とプレイヤー（Player）を生成！
// =================================================================
if (!window.worldInstance && typeof World !== 'undefined') {
    window.worldInstance = new World(window.scene);
}

// 動いた位置に合わせてチャンクを更新
if (window.worldInstance) {
    window.worldInstance.updateChunks(16, 16);
}

// 👁️ 主導権をあなたのPlayerに返し、PC操作モードで起動！
if (!window.playerInstance && typeof Player !== 'undefined') {
    window.playerInstance = new Player(window.camera, window.renderer.domElement, window.worldInstance, 'pc');
}

// =================================================================
// 🔄 4. 毎フレーム動くループ処理
// =================================================================
function tick() {
    
    if (window.playerInstance) {
        // 🏃‍♂️ あなたが作ったキーボード移動（WASD）、ジャンプ、物理演算を動かす！
        window.playerInstance.update();

        // 動いた位置に合わせてチャンクを自動更新（ガレリア救済システム）
        if (window.worldInstance) {
            window.worldInstance.updateChunks(window.camera.position.x, window.camera.position.z);
        }

        // 🌐 【通信報告！】歩いた最新の座標をサーバーに送りつける
        if (typeof sendPositionToServer === 'function') {
            sendPositionToServer(window.camera.position.x, window.camera.position.y, window.camera.position.z, window.camera.rotation.y);
        }
    }

    // 画面を描画
    window.renderer.render(window.scene, window.camera);
    requestAnimationFrame(tick);
}

// 🚀 ループをスタート！
tick();