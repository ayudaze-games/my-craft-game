class Player {
    constructor(camera, domElement, world, mode = 'pc') {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        this.mode = mode;

        // 🏃‍♂️ 移動スピードと物理演算（y軸の速度でジャンプを制御します）
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveKeys = { forward: false, backward: false, left: false, right: false, jump: false };

        // 重力定数とジャンプ力
        this.gravity = 0.25; 
        this.jumpStrength = 4.5;
        this.floorY = 10.5; // 地面の高さ

        // 🕹️ スマホ用変数
        this.joystickActive = false;
        this.joystickStart = { x: 0, y: 0 };
        this.mobileRotation = { x: 0, y: 0 }; 
        this.lookStart = { x: 0, y: 0 };
        this.isLooking = false;

        // 初期位置の設定
        this.camera.position.set(16, this.floorY, 16);

        this.knob = document.getElementById('mobile-joystick-knob');
        this.base = document.getElementById('mobile-joystick-base');
        this.jumpBtn = document.getElementById('mobile-jump-btn');

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
            this.camera.rotation.order = 'YXZ';

            window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
            window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

            // 🦘 スマホのJUMPボタンを触った瞬間の処理を登録！
            if (this.jumpBtn) {
                this.jumpBtn.addEventListener('touchstart', (e) => {
                    e.stopPropagation(); // 視点移動がバグるのを防ぐ
                    this.triggerJump();
                }, { passive: false });
            }
        }
    }

    // --- ジャンプの共通スイッチ ---
    triggerJump() {
        // 地面にぴったりついている時だけジャンプできる（空中ジャンプ禁止）
        if (this.camera.position.y <= this.floorY + 0.01) {
            this.velocity.y = this.jumpStrength; // 上向きの力をドカンと与える！
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
            case 'Space': this.triggerJump(); break; // 🦘 Spaceキーでジャンプ発動！
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

            // ジャンプボタンそのものを触っている場合は、視点移動や移動ジョイスティックの判定をスキップ
            if (e.target === this.jumpBtn) return;

            if (touch.clientX < window.innerWidth / 2 && !this.joystickActive) {
                this.joystickActive = true;
                this.joystickTouchId = touch.identifier;
                this.joystickStart.x = touch.clientX;
                this.joystickStart.y = touch.clientY;
            } 
            else if (touch.clientX >= window.innerWidth / 2 && !this.isLooking) {
                this.isLooking = true;
                this.lookTouchId = touch.identifier;
                this.lookStart.x = touch.clientX;
                this.lookStart.y = touch.clientY;
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
                let moveX = distX;
                let moveY = distY;

                if (distance > maxRadius) {
                    moveX = (distX / distance) * maxRadius;
                    moveY = (distY / distance) * maxRadius;
                }

                if (this.knob) this.knob.style.transform = `translate(${moveX}px, ${moveY}px)`;

                this.moveKeys.forward = moveY < -15;
                this.moveKeys.backward = moveY > 15;
                this.moveKeys.left = moveX < -15;
                this.moveKeys.right = moveX > 15;
            }

            if (this.isLooking && touch.identifier === this.lookTouchId) {
                const diffX = touch.clientX - this.lookStart.x;
                const diffY = touch.clientY - this.lookStart.y;

                this.mobileRotation.y -= diffX * 0.003;
                this.mobileRotation.x -= diffY * 0.003;
                this.mobileRotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.mobileRotation.x));

                this.camera.rotation.x = this.mobileRotation.x;
                this.camera.rotation.y = this.mobileRotation.y;

                this.lookStart.x = touch.clientX;
                this.lookStart.y = touch.clientY;
            }
        }
    }

    onTouchEnd(e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            if (this.joystickActive && touch.identifier === this.joystickTouchId) {
                this.joystickActive = false;
                this.moveKeys.forward = false;
                this.moveKeys.backward = false;
                this.moveKeys.left = false;
                this.moveKeys.right = false;
                if (this.knob) this.knob.style.transform = 'translate(0px, 0px)';
            }

            if (this.isLooking && touch.identifier === this.lookTouchId) {
                this.isLooking = false;
            }
        }
    }

    // --- 🔄 毎フレーム動く位置・物理演算更新 ---
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

        // 🍏 【リアル重力シミュレーション】
        // 常に下向きに引っ張る力を加え続ける
        this.velocity.y -= this.gravity; 
        this.camera.position.y += this.velocity.y * 0.1; // 速度に合わせて実際にキャラを上下させる

        // 地面（floorY）に着地したときのストッパー
        if (this.camera.position.y <= this.floorY) {
            this.velocity.y = 0; // 落下速度をリセット
            this.camera.position.y = this.floorY; // 地面に固定
        }
    }
}