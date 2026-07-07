class Player {
    constructor(camera, domElement, world, mode = 'pc') {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        this.mode = mode; // 'pc' または 'mobile'

        // 🏃‍♂️ 移動スピードと物理演算の準備
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveKeys = { forward: false, backward: false, left: false, right: false, jump: false };

        // 🕹️ スマホ用：タッチ位置を記憶する変数
        this.touchStart = { x: 0, y: 0 };
        this.touchMove = { x: 0, y: 0 };
        this.isTouching = false;

        // 初期位置（地面より少し上）
        this.camera.position.set(16, 12, 16);

        if (this.mode === 'pc') {
            // =============================================================
            // 💻 PCモード：マウスとキーボードの設定
            // =============================================================
            this.controls = new THREE.PointerLockControls(this.camera, this.domElement);
            
            // 画面をクリックしたらマウスをロックしてゲーム開始
            this.domElement.addEventListener('click', () => {
                this.controls.lock();
            });

            // キーボードを押したとき
            window.addEventListener('keydown', (e) => this.onKeyDown(e));
            // キーボードを離したとき
            window.addEventListener('keyup', (e) => this.onKeyUp(e));

        } else if (this.mode === 'mobile') {
            // =============================================================
            // 📱 スマホモード：画面タッチの設定
            // =============================================================
            console.log("📱 Playerクラス：スマホ操作モードで起動しました！");
            
            // スマホではマウスロックは使わないので、初期の向きを固定
            this.camera.rotation.set(0, 0, 0);

            // 画面のどこかを指で触った瞬間（視点移動・移動の開始）
            window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
            // 指をズルズル動かしている最中
            window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            // 指を離した瞬間
            window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        }
    }

    // --- 💻 PC用キーボード処理 ---
    onKeyDown(e) {
        if (!this.controls.isLocked) return;
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': this.moveKeys.forward = true; break;
            case 'KeyS': case 'ArrowDown': this.moveKeys.backward = true; break;
            case 'KeyA': case 'ArrowLeft': this.moveKeys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.moveKeys.right = true; break;
            case 'Space': if (this.camera.position.y <= 12) this.velocity.y = 5; break; // 簡易ジャンプ
        }
    }

    onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': this.moveKeys.forward = false; break;
            case 'KeyS': case 'ArrowDown': this.moveKeys.backward = false; break;
            case 'KeyA': case 'ArrowLeft': this.moveKeys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.moveKeys.right = false; break;
        }
    }

    // --- 📱 スマホ用タッチ処理 ---
    onTouchStart(e) {
        this.isTouching = true;
        const touch = e.touches[0];
        
        // タッチが始まった画面のXY座標を覚える
        this.touchStart.x = touch.clientX;
        this.touchStart.y = touch.clientY;

        // 画面の左半分を触っていたら「移動ジョイスティック」として扱う
        if (touch.clientX < window.innerWidth / 2) {
            // 移動をリセット
            this.moveKeys.forward = false;
            this.moveKeys.backward = false;
        }
    }

    onTouchMove(e) {
        if (!this.isTouching) return;
        const touch = e.touches[0];

        // スタート位置からどれくらい指が動いたかを計算
        const diffX = touch.clientX - this.touchStart.x;
        const diffY = touch.clientY - this.touchStart.y;

        if (this.touchStart.x < window.innerWidth / 2) {
            // 👈 画面の左側：移動（簡易的に、指を上にスライドしたら前進、下にスライドしたら後退）
            if (diffY < -30) { this.moveKeys.forward = true; this.moveKeys.backward = false; }
            else if (diffY > 30) { this.moveKeys.backward = true; this.moveKeys.forward = false; }
            else { this.moveKeys.forward = false; this.moveKeys.backward = false; }
        } else {
            // 👉 画面の右側：カメラの視点移動（グリグリ見回す）
            this.camera.rotation.y -= diffX * 0.005;
            this.camera.rotation.x -= diffY * 0.005;
            // 真上や真下を向きすぎないように制限
            this.camera.rotation.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, this.camera.rotation.x));
            
            // 次の計算のために位置を更新
            this.touchStart.x = touch.clientX;
            this.touchStart.y = touch.clientY;
        }
    }

    onTouchEnd(e) {
        this.isTouching = false;
        // 指を離したら移動をすべてストップ
        this.moveKeys.forward = false;
        this.moveKeys.backward = false;
        this.moveKeys.left = false;
        this.moveKeys.right = false;
    }

    // --- 🔄 毎フレーム動く位置更新（PC・スマホ共通） ---
    update() {
        const speed = 0.1; // 歩く速度

        // 前後左右の移動ベクトルを計算
        this.direction.z = Number(this.moveKeys.forward) - Number(this.moveKeys.backward);
        this.direction.x = Number(this.moveKeys.right) - Number(this.moveKeys.left);
        this.direction.normalize();

        // カメラの向きに合わせて進む方向を決める
        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);
        camDirection.y = 0; // 上下には飛ばないように固定
        camDirection.normalize();

        // 前後移動
        if (this.moveKeys.forward) this.camera.position.addScaledVector(camDirection, speed);
        if (this.moveKeys.backward) this.camera.position.addScaledVector(camDirection, -speed);

        // 簡易的な重力演算（地面 Y=10 より下に落ちないようにする）
        if (this.camera.position.y > 10.5) {
            this.velocity.y -= 0.2; // 重力
        } else {
            this.velocity.y = 0;
            this.camera.position.y = 10.5; // 地面に固定
        }
        this.camera.position.y += this.velocity.y * 0.05;
    }
}