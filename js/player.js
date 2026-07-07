class Player {
    constructor(camera, domElement, world, mode = 'pc') {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        this.mode = mode;

        // 🏃‍♂️ 移動スピードと物理演算
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveKeys = { forward: false, backward: false, left: false, right: false };

        // 🕹️ スマホ用：ジョイスティック制御の変数
        this.joystickActive = false;
        this.joystickStart = { x: 0, y: 0 };
        
        // 👁️ スマホ用：終わっていたカメラ角度を救済する角度記憶変数
        this.mobileRotation = { x: 0, y: 0 }; 
        this.lookStart = { x: 0, y: 0 };
        this.isLooking = false;

        // 初期位置の設定
        this.camera.position.set(16, 12, 16);

        // ジョイスティックのHTML要素を取得しておく
        this.knob = document.getElementById('mobile-joystick-knob');
        this.base = document.getElementById('mobile-joystick-base');

        if (this.mode === 'pc') {
            // =============================================================
            // 💻 PCモード
            // =============================================================
            this.controls = new THREE.PointerLockControls(this.camera, this.domElement);
            this.domElement.addEventListener('click', () => { this.controls.lock(); });

            window.addEventListener('keydown', (e) => this.onKeyDown(e));
            window.addEventListener('keyup', (e) => this.onKeyUp(e));

        } else if (this.mode === 'mobile') {
            // =============================================================
            // 📱 スマホモード
            // =============================================================
            console.log("📱 Playerクラス：スマホ用ハイパー調整で起動しました！");
            
            // カメラの回転順序を「Y軸（横振り）を回してからX軸（縦振り）」に固定（これで天地がバグらなくなる！）
            this.camera.rotation.order = 'YXZ';

            // タッチイベントの登録
            window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
            window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        }
    }

    // --- 💻 PC用処理 ---
    onKeyDown(e) {
        if (!this.controls.isLocked) return;
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': this.moveKeys.forward = true; break;
            case 'KeyS': case 'ArrowDown': this.moveKeys.backward = true; break;
            case 'KeyA': case 'ArrowLeft': this.moveKeys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.moveKeys.right = true; break;
            case 'Space': if (this.camera.position.y <= 10.6) this.velocity.y = 5; break;
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

    // --- 📱 スマホ用処理 ---
    onTouchStart(e) {
        // マルチタッチ（2本指）対応のためにループで確認
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            // 👈 画面の左半分 ＆ ジョイスティックの周辺を触った場合
            if (touch.clientX < window.innerWidth / 2 && !this.joystickActive) {
                this.joystickActive = true;
                this.joystickTouchId = touch.identifier;
                // 触った中心点を記憶
                this.joystickStart.x = touch.clientX;
                this.joystickStart.y = touch.clientY;
            } 
            // 👉 画面の右半分を触った場合（視点移動）
            else if (touch.clientX >= window.innerWidth / 2 && !this.isLooking) {
                this.isLooking = true;
                this.lookTouchId = touch.identifier;
                this.lookStart.x = touch.clientX;
                this.lookStart.y = touch.clientY;
            }
        }
    }

    onTouchMove(e) {
        e.preventDefault(); // スマホ特有の「引っ張ってリロード」を封じる

        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];

            // 👈 左半分のジョイスティックが動いているとき
            if (this.joystickActive && touch.identifier === this.joystickTouchId) {
                // 中心からどれくらい指が離れたか
                const distX = touch.clientX - this.joystickStart.x;
                const distY = touch.clientY - this.joystickStart.y;
                const distance = Math.sqrt(distX * distX + distY * distY);

                // 最大 35ピクセル まで丸が動くように制限する
                const maxRadius = 35;
                let moveX = distX;
                let moveY = distY;

                if (distance > maxRadius) {
                    moveX = (distX / distance) * maxRadius;
                    moveY = (distY / distance) * maxRadius;
                }

                // ⚪ 内側の丸の見た目をニュルッと動かす！
                if (this.knob) {
                    this.knob.style.transform = `translate(${moveX}px, ${moveY}px)`;
                }

                // 🏃‍♂️ スティックの傾き具合で移動スイッチをON/OFF
                this.moveKeys.forward = moveY < -15;
                this.moveKeys.backward = moveY > 15;
                this.moveKeys.left = moveX < -15;
                this.moveKeys.right = moveX > 15;
            }

            // 👉 右半分の視点移動が動いているとき
            if (this.isLooking && touch.identifier === this.lookTouchId) {
                const diffX = touch.clientX - this.lookStart.x;
                const diffY = touch.clientY - this.lookStart.y;

                // 👁️ 【終わってたカメラ角度の救済】
                // 感度を「0.003」に極限まで落とし、少しずつ角度を変化させる
                this.mobileRotation.y -= diffX * 0.003; // 横振り
                this.mobileRotation.x -= diffY * 0.003; // 縦振り

                // 首がちぎれないように、真上・真下は90度手前でロック！
                this.mobileRotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.mobileRotation.x));

                // カメラに安全な角度をガチッと適用
                this.camera.rotation.x = this.mobileRotation.x;
                this.camera.rotation.y = this.mobileRotation.y;

                // 次のフレームのために今の指の位置をセット
                this.lookStart.x = touch.clientX;
                this.lookStart.y = touch.clientY;
            }
        }
    }

    onTouchEnd(e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            // ジョイスティックから指が離れたら
            if (this.joystickActive && touch.identifier === this.joystickTouchId) {
                this.joystickActive = false;
                this.moveKeys.forward = false;
                this.moveKeys.backward = false;
                this.moveKeys.left = false;
                this.moveKeys.right = false;
                // ⚪ 丸の位置を元のど真ん中に戻す！
                if (this.knob) this.knob.style.transform = 'translate(0px, 0px)';
            }

            // 視点移動から指が離れたら
            if (this.isLooking && touch.identifier === this.lookTouchId) {
                this.isLooking = false;
            }
        }
    }

    // --- 🔄 毎フレーム動く位置更新 ---
    update() {
        const speed = 0.08; // スマホでも扱いやすい快適な歩行スピードに調整

        // カメラの向いている「前」と「右」のベクトルを計算
        const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        
        // 空は飛ばないようにY軸をゼロにして、綺麗に地面を這うようにする
        forwardVec.y = 0; forwardVec.normalize();
        rightVec.y = 0;   rightVec.normalize();

        // ジョイスティックの入力に合わせて、向いている方向に進ませる！
        if (this.moveKeys.forward)  this.camera.position.addScaledVector(forwardVec, speed);
        if (this.moveKeys.backward) this.camera.position.addScaledVector(forwardVec, -speed);
        if (this.moveKeys.left)     this.camera.position.addScaledVector(rightVec, -speed);
        if (this.moveKeys.right)    this.camera.position.addScaledVector(rightVec, speed);

        // 簡易的な重力演算（地面 Y=10.5 より下に落ちない）
        if (this.camera.position.y > 10.5) {
            this.velocity.y -= 0.2;
        } else {
            this.velocity.y = 0;
            this.camera.position.y = 10.5;
        }
        this.camera.position.y += this.velocity.y * 0.05;
    }
}