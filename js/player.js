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

// 🍏 物理演算パラメーター（ここをお好みで調整！）
        this.gravity = 0.3;        // 👈 【重力】少し重くする（標準は 0.2 だったのを 0.3 に）
        this.jumpStrength = 4.5;   // 👈 【ジャンプ力】これくらいがマイクラ風の心地いい高さ！（6.0 から 4.5 へ）
        this.floorY = 10.5;
        this.playerHeight = 1.6; // プレイヤーの目の高さ（マイクラ基準）

        // 🕹️ スマホ用変数
        this.joystickActive = false;
        this.joystickStart = { x: 0, y: 0 };
        this.mobileRotation = { x: 0, y: 0 }; 
        this.lookStart = { x: 0, y: 0 };
        this.isLooking = false;

        // 初期スポーン位置（空中からスタート）
        this.camera.position.set(16, 15, 16);

        this.knob = document.getElementById('mobile-joystick-knob');
        this.base = document.getElementById('mobile-joystick-base');
        this.jumpBtn = document.getElementById('mobile-jump-btn');

        // 接地フラグ（地面に立っているか）
        this.onGround = false;

        if (this.mode === 'pc') {
            this.controls = new THREE.PointerLockControls(this.camera, this.domElement);
            this.domElement.addEventListener('click', () => { this.controls.lock(); });
            window.addEventListener('keydown', (e) => this.onKeyDown(e));
            window.addEventListener('keyup', (e) => this.onKeyUp(e));
        } else if (this.mode === 'mobile') {
            this.camera.rotation.order = 'YXZ';
            window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
            window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

            if (this.jumpBtn) {
                this.jumpBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.triggerJump();
                }, { passive: false });
            }
        }
    }

    // --- ジャンプの発動 ---
    triggerJump() {
        // 🧱 本物の地面に立っている時だけジャンプを許可！
        if (this.onGround) {
            this.velocity.y = this.jumpStrength;
            this.onGround = false; // ジャンプした瞬間は空中へ
            console.log("🦘 地面を蹴ってジャンプしました！");
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
            case 'Space': this.triggerJump(); break; 
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
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (e.target === this.jumpBtn) return;
            if (touch.clientX < window.innerWidth / 2 && !this.joystickActive) {
                this.joystickActive = true; this.joystickTouchId = touch.identifier;
                this.joystickStart.x = touch.clientX; this.joystickStart.y = touch.clientY;
            } else if (touch.clientX >= window.innerWidth / 2 && !this.isLooking) {
                this.isLooking = true; this.lookTouchId = touch.identifier;
                this.lookStart.x = touch.clientX; this.lookStart.y = touch.clientY;
            }
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            if (this.joystickActive && touch.identifier === this.joystickTouchId) {
                const distX = touch.clientX - this.joystickStart.x;
                const distY = touch.clientY - this.joystickStart.y;
                const distance = Math.sqrt(distX * distX + distY * distY);
                const maxRadius = 35;
                let moveX = distX; let moveY = distY;
                if (distance > maxRadius) {
                    moveX = (distX / distance) * maxRadius; moveY = (distY / distance) * maxRadius;
                }
                if (this.knob) this.knob.style.transform = `translate(${moveX}px, ${moveY}px)`;
                this.moveKeys.forward = moveY < -15; this.moveKeys.backward = moveY > 15;
                this.moveKeys.left = moveX < -15; this.moveKeys.right = moveX > 15;
            }
            if (this.isLooking && touch.identifier === this.lookTouchId) {
                const diffX = touch.clientX - this.lookStart.x;
                const diffY = touch.clientY - this.lookStart.y;
                this.mobileRotation.y -= diffX * 0.003; this.mobileRotation.x -= diffY * 0.003;
                this.mobileRotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.mobileRotation.x));
                this.camera.rotation.x = this.mobileRotation.x; this.camera.rotation.y = this.mobileRotation.y;
                this.lookStart.x = touch.clientX; this.lookStart.y = touch.clientY;
            }
        }
    }

    onTouchEnd(e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (this.joystickActive && touch.identifier === this.joystickTouchId) {
                this.joystickActive = false;
                this.moveKeys.forward = false; this.moveKeys.backward = false;
                this.moveKeys.left = false; this.moveKeys.right = false;
                if (this.knob) this.knob.style.transform = 'translate(0px, 0px)';
            }
            if (this.isLooking && touch.identifier === this.lookTouchId) { this.isLooking = false; }
        }
    }

    // --- 🔄 毎フレーム動く位置・当たり判定の計算 ---
    update() {
        const speed = 0.08;

        const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        forwardVec.y = 0; forwardVec.normalize();
        rightVec.y = 0;   rightVec.normalize();

        if (this.moveKeys.forward)  this.camera.position.addScaledVector(forwardVec, speed);
        if (this.moveKeys.backward) this.camera.position.addScaledVector(forwardVec, -speed);
        if (this.moveKeys.left)     this.camera.position.addScaledVector(rightVec, -speed);
        if (this.moveKeys.right)    this.camera.position.addScaledVector(rightVec, speed);

        // 🍏 1. 重力で落下させる
        this.velocity.y -= this.gravity; 
        this.camera.position.y += this.velocity.y * 0.1;

        // 🧱 2. 【本物の当たり判定システム！】
        // プレイヤーの今の足元の座標（整数）を計算する
        const playerX = Math.floor(this.camera.position.x);
        const playerZ = Math.floor(this.camera.position.z);
        
        // あなたの worldInstance から、足元にブロックが存在するかチェックする
        let targetFloorY = this.floorY; 
        if (this.world && typeof this.world.getBlock === 'function') {
            // 下方向のブロックを探す（簡易版：Y=10の初期地面）
            const block = this.world.getBlock(playerX, 10, playerZ);
            if (block && block.visible !== false) {
                targetFloorY = 11.0; // ブロックの上（高さ11）を着地地点にする
            }
        }

        // 🍏 3. 着地判定
        // プレイヤーの足元（カメラ位置 - 身長）が、地面より下に行こうとしたらガチッと止める
        if (this.camera.position.y - this.playerHeight <= targetFloorY) {
            this.camera.position.y = targetFloorY + this.playerHeight; // 地面の上に強制固定
            this.velocity.y = 0; // 落下の力をゼロにする
            this.onGround = true; // 「地面に立っている」状態にする（ジャンプ許可！）
        } else {
            this.onGround = false; // 空中にいる
        }
    }
}