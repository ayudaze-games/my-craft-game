// =================================================================
// 🎮 ゲームを新しく開始・初期化する関数
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

    // 背景を青空の色にする
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

    // 🧱 3. 世界（World）を生成！
    if (!window.worldInstance && typeof World !== 'undefined') {
        window.worldInstance = new World(window.scene);
    }

    // 👁️ 【重要！】画面に設定項目（#render-distance-select）があれば、その数値を反映する
    const distanceSelect = document.getElementById('render-distance-select');
    if (distanceSelect && window.worldInstance) {
        window.worldInstance.setRenderDistance(distanceSelect.value);
    } else if (window.worldInstance) {
        window.worldInstance.setRenderDistance(1); // なければ標準で「1」
    }

    // 初期チャンク生成
    if (window.worldInstance) {
        window.worldInstance.updateChunks(16, 16);
    }

    // 操作モード（pc または mobile）をプレイヤーに渡す！
    const controlMode = window.isMobileMode ? 'mobile' : 'pc';
    if (!window.playerInstance && typeof Player !== 'undefined') {
        window.playerInstance = new Player(window.camera, window.renderer.domElement, window.worldInstance, controlMode);
    }

    window.lastChunkX = Math.floor(window.camera.position.x / 16);
    window.lastChunkZ = Math.floor(window.camera.position.z / 16);

    // 🚀 ループスタート！
    tick();
};

// =================================================================
// 🔄 4. 毎フレーム動くループ処理
// =================================================================
function tick() {
    if (window.playerInstance) {
        window.playerInstance.update();

        if (window.worldInstance) {
            const currentChunkX = Math.floor(window.camera.position.x / 16);
            const currentChunkZ = Math.floor(window.camera.position.z / 16);

            if (currentChunkX !== window.lastChunkX || currentChunkZ !== window.lastChunkZ) {
                window.worldInstance.updateChunks(window.camera.position.x, window.camera.position.z);
                window.lastChunkX = currentChunkX;
                window.lastChunkZ = currentChunkZ;
                console.log("🗺️ 新しいチャンクを読み込みました");
            }
        }

        if (window.gameMode === 'multi' && typeof sendPositionToServer === 'function') {
            sendPositionToServer(window.camera.position.x, window.camera.position.y, window.camera.position.z, window.camera.rotation.y);
        }
    }

    window.renderer.render(window.scene, window.camera);
    requestAnimationFrame(tick);
}