class Player {
    constructor(camera, domElement, world, controlMode = 'pc') {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        this.controlMode = controlMode; // 'pc' または 'mobile'

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

        // 🧱 手元にある設置用ブロックの種類 ('grass', 'dirt', 'stone', 'log', 'leaves')
        this.currentBlockType = 'stone';

        // 👁️ レイキャスター（視線の先にあるブロックを検知するビーム）
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(0, 0); // 画面中央

        // 初期位置
        this.camera.position.set(16, 12, 16);

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

        // 🧱 PCでのブロックの破壊(左クリック)・設置(右クリック)
        window.addEventListener('mousedown', (e) => {
            if (!this.controls.isLocked) return;

            if (e.button === 0) {
                // 左クリック：破壊
                this.performBlockAction('destroy');
            } else if (e.button === 2) {
                // 右クリック：設置
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
                // ジョイスティック付近のタッチは視点移動から除外する
                if (touch.clientX < 180 && touch.clientY > window.innerHeight - 180) return;
                // 右下のジャンプ/設置ボタン付近も除外
                if (touch.clientX > window.innerWidth - 150 && touch.clientY > window.innerHeight - 250) return;

                if (this.touchStartX !== 0 && this.touchStartY !== 0) {
                    const deltaX = touch.clientX - this.touchStartX;
                    const deltaY = touch.clientY - this.touchStartY;

                    this.cameraRotation.x -= deltaX * 0.005;
                    this.cameraRotation.y -= deltaY * 0.005;
                    // 上下の視点制限（真上・真下を向けないようにする）
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

        // 🧱 スマホの画面「長押し」または「タップ」で破壊する
        let touchTimer;
        window.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            // UIボタンの上でのタッチは無視
            if (touch.clientX < 180 && touch.clientY > window.innerHeight - 180) return;
            if (touch.clientX > window.innerWidth - 150 && touch.clientY > window.innerHeight - 250) return;

            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;

            // タップして0.25秒押し続けたら破壊を実行
            touchTimer = setTimeout(() => {
                this.performBlockAction('destroy');
            }, 250);
        });

        window.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
        });

        // ジョイスティックとボタンの挙動設定
        this.setupMobileUI();
    }

    // スマホ用バーチャルパッド＆ジャンプ＆設置ボタンのイベント接続
    setupMobileUI() {
        const joystickBase = document.getElementById('mobile-joystick-base');
        const joystickKnob = document.getElementById('mobile-joystick-knob');
        const jumpBtn = document.getElementById('mobile-jump-btn');
        const viewBtn = document.getElementById('mobile-view-btn');
        const buildBtn = document.getElementById('mobile-build-btn'); // 後でindex.htmlに追加します！

        this.moveJoystick = { x: 0, y: 0 };

        if (joystickBase) {
            joystickBase.addEventListener('touchstart', (e) => {
                e.preventDefault();
            });

            joystickBase.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = joystickBase.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                let dx = touch.clientX - centerX;
                let dy = touch.clientY - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxDist = 35; // ツマミの最大可動範囲

                if (dist > maxDist) {
                    dx = (dx / dist) * maxDist;
                    dy = (dy / dist) * maxDist;
                }

                joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
                this.moveJoystick.x = dx / maxDist;
                this.moveJoystick.y = -dy / maxDist; // Three.jsのZ軸方向と合わせるために反転
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

        // スマホ用：視点切り替えボタン
        if (viewBtn) {
            viewBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.toggleViewMode();
            });
        }

        // スマホ用：ブロック設置ボタン（タップで見ている場所に設置）
        if (buildBtn) {
            buildBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.performBlockAction('place');
            });
        }
    }

    // 🧱 視線の先のブロックを「破壊」または「設置」する神ロジック
    performBlockAction(action) {
        // 画面の中央からまっすぐレイ（ビーム）を飛ばす
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // 世界にあるすべてのブロックをターゲットにする
        const intersects = this.raycaster.intersectObjects(this.world.blocks);

        // 4マス以内の距離にある一番手前のブロックだけを対象にする（マイクラの届く範囲）
        if (intersects.length > 0 && intersects[0].distance < 4.5) {
            const hitBlock = intersects[0].object;

            if (action === 'destroy') {
                // 🔥 破壊：ビームが当たったブロックを消し去る！
                this.world.removeBlock(hitBlock);
                console.log("ブロックを破壊しました！");

            } else if (action === 'place') {
                // 🏗️ 設置：当たった面の「外側」の座標を求めて、そこに新しいブロックを置く！
                const faceNormal = intersects[0].face.normal; // 当たった面の向き（上、下、左、右など）
                const currentPos = hitBlock.position;

                // 当たった面の方向に +1 マスズラした位置が、設置する座標！
                const targetX = Math.round(currentPos.x + faceNormal.x);
                const targetY = Math.round(currentPos.y + faceNormal.y);
                const targetZ = Math.round(currentPos.z + faceNormal.z);

                // そこにすでにプレイヤー自身が立っていないか簡易チェック（埋まり防止）
                const playerFootX = Math.round(this.camera.position.x);
                const playerFootY = Math.round(this.camera.position.y - this.playerHeight);
                const playerFootZ = Math.round(this.camera.position.z);

                if (targetX === playerFootX && targetZ === playerFootZ && 
                    (targetY === playerFootY || targetY === playerFootY + 1)) {
                    console.log("自分が立っている場所には置けません！");
                    return;
                }

                // ブロックを配置する！
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
            // 一人称なら十字カーソルを表示
            if (crosshair) crosshair.style.display = 'block';
        } else {
            // 三人称なら十字カーソルを非表示
            if (crosshair) crosshair.style.display = 'none';
        }
    }

    update() {
        if (this.controlMode === 'pc') {
            this.updatePC();
        } else {
            this.updateMobile();
        }
    }

    // 💻 PCモードの移動＆衝突判定
    updatePC() {
        if (!this.controls.isLocked) return;

        // キーボード入力による移動方向の計算
        this.direction.z = Number(this.keys['KeyW']) - Number(this.keys['KeyS']);
        this.direction.x = Number(this.keys['KeyD']) - Number(this.keys['KeyA']);
        this.direction.normalize();

        const moveVector = new THREE.Vector3();
        
        // 視点に関わらず、カメラの水平方向の向きに合わせて移動
        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);
        camDirection.y = 0;
        camDirection.normalize();

        const camSide = new THREE.Vector3(-camDirection.z, 0, camDirection.x);

        if (this.keys['KeyW']) moveVector.add(camDirection);
        if (this.keys['KeyS']) moveVector.sub(camDirection);
        if (this.keys['KeyD']) moveVector.add(camSide);
        if (this.keys['KeyA']) moveVector.sub(camSide);

        moveVector.normalize().multiplyScalar(this.speed * 0.016); // 1フレーム(約16ms)あたりの移動距離

        // 物理演算（重力と落下）
        this.velocity.y -= this.gravity * 0.016;

        // 次のフレームでの仮のプレイヤー位置
        const nextPos = this.camera.position.clone().add(moveVector);
        nextPos.y += this.velocity.y * 0.016;

        // 地面（ブロック）との衝突判定
        let feetY = nextPos.y - this.playerHeight;
        let blockBelow = this.world.getBlock(nextPos.x, feetY, nextPos.z);

        if (blockBelow && this.velocity.y <= 0) {
            this.camera.position.y = Math.floor(feetY) + 1 + this.playerHeight;
            this.velocity.y = 0;
            this.isGrounded = true;

            // ジャンプ処理
            if (this.keys['Space']) {
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
            }
        } else {
            this.camera.position.y += this.velocity.y * 0.016;
            this.isGrounded = false;
        }

        // 壁との衝突判定（簡易版：歩ける場所だけ移動）
        const testHeight = this.camera.position.y - this.playerHeight + 0.5;
        const blockInFront = this.world.getBlock(nextPos.x, testHeight, nextPos.z);
        if (!blockInFront) {
            this.camera.position.x = nextPos.x;
            this.camera.position.z = nextPos.z;
        }

        // 三人称視点(F5)のカメラ追従処理
        if (this.viewMode === 1) {
            this.applyThirdPersonCamera();
        }
    }

    // 📱 スマホモードの移動＆衝突判定
    updateMobile() {
        // ジョイスティック入力による移動ベクトルの計算
        const moveVector = new THREE.Vector3();
        
        // スマホではドラッグで変化した cameraRotation に基づいてカメラの向きを設定する
        const targetRotation = new THREE.Euler(this.cameraRotation.y, this.cameraRotation.x, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(targetRotation);

        const camDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        camDirection.y = 0;
        camDirection.normalize();

        const camSide = new THREE.Vector3(-camDirection.z, 0, camDirection.x);

        moveVector.addScaledVector(camDirection, this.moveJoystick.y);
        moveVector.addScaledVector(camSide, this.moveJoystick.x);
        moveVector.normalize().multiplyScalar(this.speed * 0.016);

        // 物理演算（重力と落下）
        this.velocity.y -= this.gravity * 0.016;

        // 次のフレームの仮位置
        const nextPos = this.camera.position.clone().add(moveVector);
        nextPos.y += this.velocity.y * 0.016;

        // 地面判定
        let feetY = nextPos.y - this.playerHeight;
        let blockBelow = this.world.getBlock(nextPos.x, feetY, nextPos.z);

        if (blockBelow && this.velocity.y <= 0) {
            this.camera.position.y = Math.floor(feetY) + 1 + this.playerHeight;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.camera.position.y += this.velocity.y * 0.016;
            this.isGrounded = false;
        }

        // 壁判定
        const testHeight = this.camera.position.y - this.playerHeight + 0.5;
        const blockInFront = this.world.getBlock(nextPos.x, testHeight, nextPos.z);
        if (!blockInFront) {
            this.camera.position.x = nextPos.x;
            this.camera.position.z = nextPos.z;
        }

        // 三人称視点(F5)のカメラ追従処理
        if (this.viewMode === 1) {
            this.applyThirdPersonCamera();
        }
    }

    // 三人称カメラの座標計算＆配置
    applyThirdPersonCamera() {
        const targetPos = this.camera.position.clone();
        
        // カメラの向いている方向の「真後ろ」にカメラを引く
        const backDirection = new THREE.Vector3(0, 0, 1);
        backDirection.applyQuaternion(this.camera.quaternion);
        backDirection.y = 0.2; // 少し斜め上から見下ろす感じにしてリアルにする
        backDirection.normalize();

        const cameraOffset = backDirection.multiplyScalar(this.thirdPersonDistance);
        this.camera.position.add(cameraOffset);
    }
}