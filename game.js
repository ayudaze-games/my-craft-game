// メインのアニメーションループ
function animate() {
    requestAnimationFrame(animate);

    // 🌊 ワールドの更新（水のテクスチャを滑らかに動かす）
    if (window.worldInstance) {
        window.worldInstance.update();
    }

    // 🧍 プレイヤーの物理演算・移動更新
    if (window.playerInstance) {
        window.playerInstance.update();
    }

    // 🎨 レンダリング（画面描画）
    if (window.renderer && window.scene && window.camera) {
        window.renderer.render(window.scene, window.camera);
    }
}

// ゲームの初期化処理
function initGame() {
    // シーン・カメラ・レンダラーのセットアップ
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x78a7ff); // マイクラの青空
    window.scene = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    window.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);
    window.renderer = renderer;

    // ☀️ 環境光と太陽光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.5);
    sunLight.position.set(20, 40, 20);
    scene.add(sunLight);

    // 🌍 ワールドとプレイヤーの生成
    const world = new World(scene);
    window.worldInstance = world;

    const player = new Player(camera, renderer.domElement, world, window.isMobileMode ? 'mobile' : 'pc');
    window.playerInstance = player;

    // ループ開始
    animate();
}

window.initGame = initGame;

// 右クリックメニュー防止
window.addEventListener('contextmenu', (e) => {
    if (window.playerInstance && window.playerInstance.controlMode === 'pc') {
        e.preventDefault();
    }
});