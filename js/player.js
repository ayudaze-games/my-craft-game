class Player {
    constructor(camera, domElement, world, controlMode = 'pc') {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        this.controlMode = controlMode; // 'pc' または 'mobile'

        // 🧍 プレイヤーの「本当の頭の位置」をここで管理（これがストッパーになります！）
        this.position = new THREE.Vector3(16, 12, 16);

        // 物理演算用のパラメータ
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 4.0;
        this.jumpForce = 7.0;
        this.gravity = 18.0;
        this.isGrounded = false;
        this.playerHeight = 1.6;

        // キーボードの状態管理
        this.keys = {};

        // 三人称視点（F5）用の設定
        this.viewMode = 0; // 0: 一人称, 1: 三人称（後ろ）
        this.thirdPersonDistance = 3.5;
        this.cameraRotation = new THREE.Vector2(0, 0); // X: 左右(Y軸回転), Y: 上下(X軸回転)

        // 🧱 手元にある設置用ブロックの種類
        this.currentBlockType = 'stone';

        // 👁️ レイキャスター
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(0, 0); // 画面中央

        if (this.controlMode === 'pc') {
            this.setupPCControls();
        } else {
            this.setupMobileControls();
        }

        // キーボードの共通イベント（F5での視点変更など）
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF5' || e.key === 'F5') {
                e.preventDefault();
                this.toggleViewMode();
            }
        });

        // カメラの初期同期
        this.syncCamera();
    }

    // 💻 PC用の操作セットアップ
    setupPCControls() {
        this.controls = new THREE.PointerLockControls(this.camera, this.domElement);

        this.domElement.addEventListener('click', () => {
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        });

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // 数字キー 1〜5 で置くブロックの種類を切り替える
            if (e.code === 'Digit1') { this.currentBlockType = 'grass'; console.log("選択: 草ブロック"); }
            if (e.code === 'Digit2') { this.currentBlockType = 'dirt'; console.log("選択: 土ブロック"); }
            if (e.code === 'Digit3') { this.currentBlockType = 'stone'; console.log("選択: 石ブロック"); }
            if (e.code === 'Digit4') { this.currentBlockType = 'log'; console.log("選択: 原木"); }
            if (e.code === 'Digit5') { this.currentBlockType = 'leaves'; console.log("選択: 葉っぱ"); }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // 🧱 PCでのブロックの破壊・設置
        window.addEventListener('mousedown', (e) => {
            if (!this.controls.isLocked) return;

            if (e.button === 0) {
                this.performBlockAction('destroy');
            } else if (e.button === 2) {
                this.performBlockAction('place');
            }
        });
    }

    // 📱 スマホ用の操作セットアップ
    setupMobileControls() {
        this.touchStartY = 0;
        this.touchStartX = 0;

        // 画面ドラッグによる視点移動
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                if (touch.clientX < 180 && touch.clientY > window.innerHeight - 180) return;
                if (touch.clientX > window.innerWidth - 150 && touch.clientY > window.innerHeight - 250) return;

                if (this.touchStartX !== 0 && this.touchStartY !== 0) {
                    const deltaX = touch.clientX - this.touchStartX;
                    const deltaY = touch.clientY - this.touchStartY;

                    this.cameraRotation.x -= deltaX * 0.005;
                    this.cameraRotation.y -= deltaY * 0.005;
                    this.cameraRotation.y = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.cameraRotation.y));
                }

                this.touchStartX = touch.clientX;
                this.touchStartY = touch.clientY;
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            this.touchStartX = 0;
            this.touchStartY = 0;
        });

        // スマホの画面タップで破壊
        let touchTimer;
        window.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            if (touch.clientX < 180 && touch.clientY > window.innerHeight - 180) return;
            if (touch.clientX > window.innerWidth - 150 && touch.clientY > window.innerHeight - 250) return;

            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;

            touchTimer = setTimeout(() => {
                this.performBlockAction('destroy');
            }, 250);
        });

        window.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
        });

        this.setupMobileUI();
    }

    // スマホ用UIイベント
    setupMobileUI() {
        const joystickBase = document.getElementById('mobile-joystick-base');
        const joystickKnob = document.getElementById('mobile-joystick-knob');
        const jumpBtn = document.getElementById('mobile-jump-btn');
        const viewBtn = document.getElementById('mobile-view-btn');
        const buildBtn = document.getElementById('mobile-build-btn');

        this.moveJoystick = { x: 0, y: 0 };

        if (joystickBase) {
            joystickBase.addEventListener('touchstart', (e) => { e.preventDefault(); });
            joystickBase.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = joystickBase.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                let dx = touch.clientX - centerX;
                let dy = touch.clientY - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxDist = 35;

                if (dist > maxDist) {
                    dx = (dx / dist) * maxDist;
                    dy = (dy / dist) * maxDist;
                }

                joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
                this.moveJoystick.x = dx / maxDist;
                this.moveJoystick.y = -dy / maxDist;
            });

            joystickBase.addEventListener('touchend', (e) => {
                joystickKnob.style.transform = `translate(0px, 0px)`;
                this.moveJoystick.x = 0;
                this.moveJoystick.y = 0;
            });
        }

        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.isGrounded) {
                    this.velocity.y = this.jumpForce;
                }
            });
        }

        if (viewBtn) {
            viewBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.toggleViewMode();
            });
        }

        if (buildBtn) {
            buildBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.performBlockAction('place');
            });
        }
    }

    // 🧱 ブロックを「破壊」または「設置」する
    performBlockAction(action) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.world.blocks);

        if (intersects.length > 0 && intersects[0].distance < 4.5) {
            const hitBlock = intersects[0].object;

            if (action === 'destroy') {
                this.world.removeBlock(hitBlock);
                console.log("ブロックを破壊しました！");
            } else if (action === 'place') {
                const faceNormal = intersects[0].face.normal;
                const currentPos = hitBlock.position;

                const targetX = Math.round(currentPos.x + faceNormal.x);
                const targetY = Math.round(currentPos.y + faceNormal.y);
                const targetZ = Math.round(currentPos.z + faceNormal.z);

                const playerFootX = Math.round(this.position.x);
                const playerFootY = Math.round(this.position.y - this.playerHeight);
                const playerFootZ = Math.round(this.position.z);

                if (targetX === playerFootX && targetZ === playerFootZ && 
                    (targetY === playerFootY || targetY === playerFootY + 1)) {
                    console.log("自分が立っている場所には置けません！");
                    return;
                }

                this.world.createBlock(targetX, targetY, targetZ, false, this.currentBlockType);
                console.log(`ブロックを設置しました: ${this.currentBlockType}`);
            }
        }
    }

    // 👁️ 三人称視点と一人称視点のモードを切り替える
    toggleViewMode() {
        this.viewMode = this.viewMode === 0 ? 1 : 0;
        console.log(`視点を切り替えました: ${this.viewMode === 0 ? '一人称' : '三人称'}`);

        const crosshair = document.getElementById('crosshair');
        if (this.viewMode === 0) {
            if (crosshair) crosshair.style.display = 'block';
        } else {
            if (crosshair) crosshair.style.display = 'none';
        }
    }

    update() {
        if (this.controlMode === 'pc') {
            this.updatePC();
        } else {
            this.updateMobile();
        }
        
        // 🚀 移動後にカメラの位置を「正しく」配置（一人称/三人称のカメラ同期）
        this.syncCamera();
    }

    // 💻 PCモードの移動＆衝突判定
    updatePC() {
        if (!this.controls.isLocked) return;

        this.direction.z = Number(this.keys['KeyW']) - Number(this.keys['KeyS']);
        this.direction.x = Number(this.keys['KeyD']) - Number(this.keys['KeyA']);
        this.direction.normalize();

        const moveVector = new THREE.Vector3();
        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);
        camDirection.y = 0;
        camDirection.normalize();

        const camSide = new THREE.Vector3(-camDirection.z, 0, camDirection.x);

        if (this.keys['KeyW']) moveVector.add(camDirection);
        if (this.keys['KeyS']) moveVector.sub(camDirection);
        if (this.keys['KeyD']) moveVector.add(camSide);
        if (this.keys['KeyA']) moveVector.sub(camSide);

        moveVector.normalize().multiplyScalar(this.speed * 0.016);

        this.velocity.y -= this.gravity * 0.016;

        // 【ストッパー】カメラではなく「this.position」を基準に計算します
        const nextPos = this.position.clone().add(moveVector);
        nextPos.y += this.velocity.y * 0.016;

        let feetY = nextPos.y - this.playerHeight;
        let blockBelow = this.world.getBlock(nextPos.x, feetY, nextPos.z);

        if (blockBelow && this.velocity.y <= 0) {
            this.position.y = Math.floor(feetY) + 1 + this.playerHeight;
            this.velocity.y = 0;
            this.isGrounded = true;

            if (this.keys['Space']) {
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
            }
        } else {
            this.position.y += this.velocity.y * 0.016;
            this.isGrounded = false;
        }

        const testHeight = this.position.y - this.playerHeight + 0.5;
        const blockInFront = this.world.getBlock(nextPos.x, testHeight, nextPos.z);
        if (!blockInFront) {
            this.position.x = nextPos.x;
            this.position.z = nextPos.z;
        }
    }

    // 📱 スマホモードの移動＆衝突判定
    updateMobile() {
        const moveVector = new THREE.Vector3();
        
        // スマホ用の回転適用
        const targetRotation = new THREE.Euler(this.cameraRotation.y, this.cameraRotation.x, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(targetRotation);

        const camDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        camDirection.y = 0;
        camDirection.normalize();

        const camSide = new THREE.Vector3(-camDirection.z, 0, camDirection.x);

        moveVector.addScaledVector(camDirection, this.moveJoystick.y);
        moveVector.addScaledVector(camSide, this.moveJoystick.x);
        moveVector.normalize().multiplyScalar(this.speed * 0.016);

        this.velocity.y -= this.gravity * 0.016;

        // 【ストッパー】カメラではなく「this.position」を基準に計算します
        const nextPos = this.position.clone().add(moveVector);
        nextPos.y += this.velocity.y * 0.016;

        let feetY = nextPos.y - this.playerHeight;
        let blockBelow = this.world.getBlock(nextPos.x, feetY, nextPos.z);

        if (blockBelow && this.velocity.y <= 0) {
            this.position.y = Math.floor(feetY) + 1 + this.playerHeight;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.position.y += this.velocity.y * 0.016;
            this.isGrounded = false;
        }

        const testHeight = this.position.y - this.playerHeight + 0.5;
        const blockInFront = this.world.getBlock(nextPos.x, testHeight, nextPos.z);
        if (!blockInFront) {
            this.position.x = nextPos.x;
            this.position.z = nextPos.z;
        }
    }

    // 🔒 カメラを「本当の位置」に同期させる、超大事なストッパー関数！
    syncCamera() {
        // まずカメラを「本来の一人称（頭の位置）」にピタッと置く
        this.camera.position.copy(this.position);

        if (this.viewMode === 1) {
            // 三人称モードなら、そこから「1回だけ」後ろにカメラを引く！
            const backDirection = new THREE.Vector3(0, 0, 1);
            backDirection.applyQuaternion(this.camera.quaternion);
            backDirection.y = 0.2; // 少し見下ろす
            backDirection.normalize();

            const cameraOffset = backDirection.multiplyScalar(this.thirdPersonDistance);
            this.camera.position.add(cameraOffset);
        }
    }
}