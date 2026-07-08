// =================================================================
// 🎮 ゲームを新しく開始・初期化する関数（メニューのボタンから呼ばれます）
// =================================================================
window.initGame = function() {
    // 📦 1. 3Dの世界（シーン、カメラ、レンダラー）の基本セットアップ
    if (!window.scene) window.scene = new THREE.Scene();
    if (!window.camera) window.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    if (!window.renderer) {
        window.renderer = new THREE.WebGLRenderer();
        window.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(window.renderer.domElement);
    }

    // 背景をマイクラ風の綺麗な青空の色にする
    window.renderer.setClearColor(0x78a7ff, 1);

    // ☀️ 2. 太陽の光（ライト）を追加
    if (!window.hasLight) {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        window.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(10, 20, 10);
        window.scene.add(directionalLight);
        window.hasLight = true;
    }

    // 🧱 3. 世界（World）とプレイヤー（Player）を生成！
    if (!window.worldInstance && typeof World !== 'undefined') {
        window.worldInstance = new World(window.scene);
    }

    // 初期起動時に、スポーン地点（16, 16）の周りのチャンクを最初にガチッと生成しておく
    if (window.worldInstance) {
        window.worldInstance.updateChunks(16, 16);
    }

    // 👁️ メニューで選ばれた操作モード（pc または mobile）をプレイヤーに渡す！
    const controlMode = window.isMobileMode ? 'mobile' : 'pc';
    if (!window.playerInstance && typeof Player !== 'undefined') {
        window.playerInstance = new Player(window.camera, window.renderer.domElement, window.worldInstance, controlMode);
    }

    // 前回のチャンク位置を記憶する変数（暴走防止用）
    window.lastChunkX = Math.floor(window.camera.position.x / 16);
    window.lastChunkZ = Math.floor(window.camera.position.z / 16);

    // 🚀 ループをスタート！
    tick();
};

// =================================================================
// 🔄 4. 毎フレーム動くループ処理
// =================================================================
function tick() {
    if (window.playerInstance) {
        // 🏃‍♂️ プレイヤーの移動、物理演算、ジャンプを最優先で滑らかに動かす！
        window.playerInstance.update();

        // 🛠️ 【暴走バグ修正！】毎フレーム生成するのをやめ、別のチャンクにまたいだ瞬間だけ更新する
        if (window.worldInstance) {
            const currentChunkX = Math.floor(window.camera.position.x / 16);
            const currentChunkZ = Math.floor(window.camera.position.z / 16);

            // プレイヤーが16マス動いて、新しいチャンクの境界を越えた時だけ土地をロード
            if (currentChunkX !== window.lastChunkX || currentChunkZ !== window.lastChunkZ) {
                window.worldInstance.updateChunks(window.camera.position.x, window.camera.position.z);
                window.lastChunkX = currentChunkX;
                window.lastChunkZ = currentChunkZ;
                console.log("🗺️ 新しいチャンクを読み込みました");
            }
        }

        // 🌐 【通信報告】「マルチプレイ」モードの時だけ、サーバーに座標を送る！
        if (window.gameMode === 'multi' && typeof sendPositionToServer === 'function') {
            sendPositionToServer(window.camera.position.x, window.camera.position.y, window.camera.position.z, window.camera.rotation.y);
        }
    }

    // 画面を描画
    window.renderer.render(window.scene, window.camera);
    requestAnimationFrame(tick);
}