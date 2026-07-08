class Player {
    constructor(camera, domElement, world, mode = 'pc') {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        this.mode = mode;

        // 🏃‍♂️ 移動スピードと物理演算の準備
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveKeys = { forward: false, backward: false, left: false, right: false };

        // 🍏 物理演算パラメーター
        this.gravity = 0.3;        
        this.jumpStrength = 4.5;   
        this.floorY = 2.0;         
        this.playerHeight = 1.6;   // プレイヤーの目の高さ
        this.position = new THREE.Vector3(16, 25, 16); // 実際のプレイヤーの足元座標
        this.rotation = new THREE.Vector3(0, 0, 0);   // 体の向き（x:上下回転, y:左右回転）

        // 👁️ 【新機能】視点管理フラグ（'first' = 一人称, 'third' = 三人称）
        this.perspective = 'first';

        // 🎭 【新機能】三人称の時に自分を表示するための3Dモデル（頭）
        this.myMesh = null;
        this.createMyMesh();

        // 🕹️ スマホ用変数
        this.joystickActive = false;
        this.joystickStart = { x: 0, y: 0 };
        this.mobileRotation = { x: 0, y: 0 }; 
        this.lookStart = { x: 0, y: 0 };
        this.isLooking = false;

        // 初期スポーン位置の設定
        this.camera.position.copy(this.position).y += this.playerHeight;

        // HTML要素の取得
        this.knob = document.getElementById('mobile-joystick-knob');
        this.base = document.getElementById('mobile-joystick-base');
        this.jumpBtn = document.getElementById('mobile-jump-btn');
        this.viewBtn = document.getElementById('mobile-view-btn'); // スマホ用視点変更ボタン

        // 接地フラグ
        this.onGround = false;

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

            // 🦘 スマホJUMPボタン
            if (this.jumpBtn) {
                this.jumpBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault(); e.stopPropagation(); this.triggerJump();
                }, { passive: false });
            }

            // 👁️ スマホ視点変更ボタンのイベント登録
            if (this.viewBtn) {
                this.viewBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault(); e.stopPropagation(); this.togglePerspective();
                }, { passive: false });
            }
        }
    }

    // 🎭 自分の頭モデルを作る関数（三人称用 ＆ スキン対応）
    createMyMesh() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // アップロードされたスキンがあれば正面に貼る。なければピンク
        const defaultMaterials = [];
        for(let i=0; i<6; i++) {
            defaultMaterials.push(new THREE.MeshStandardMaterial({ color: 0xff00ff }));
        }

        this.myMesh = new THREE.Mesh(geometry, defaultMaterials);
        this.myMesh.visible = false; // 最初（一人称）は非表示
        window.scene.add(this.myMesh);

        // スキンがすでにセットされていたら即座に適用する
        this.updateMySkinMesh();
    }

    // 🎭 アップロードされた画像を自分の頭モデルに貼り付ける
    updateMySkinMesh() {
        if (window.mySkinData && this.myMesh) {
            const img = new Image();
            img.src = window.mySkinData;
            img.onload = () => {
                const texture = new THREE.Texture(img);
                texture.needsUpdate = true;
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                // 正面に画像を貼り付け
                this.myMesh.material[4] = new THREE.MeshStandardMaterial({ map: texture });
                this.myMesh.material[4].needsUpdate = true;
            };
        }
    }

    // 🔄 一人称と三人称を切り替える魔法の関数
    togglePerspective() {
        if (this.perspective === 'first') {
            this.perspective = 'third';
            this.myMesh.visible = true; // 三人称なら自分を表示！
            console.log("👁️ 三人称視点になりました！");
        } else {
            this.perspective = 'first';
            this.myMesh.visible = false; // 一人称なら自分を隠す！
            console.log("👁️ 一人称視点になりました！");
        }
    }

    // --- ジャンプの発動 ---
    triggerJump() {
        if (this.onGround) {
            this.velocity.y = this.jumpStrength;
            this.onGround = false; 
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
            case 'F5': // 💡 F5キーで視点切り替え！
                e.preventDefault();
                this.togglePerspective();
                break;
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
            if (e.target === this.jumpBtn || e.target === this.viewBtn) return;
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
                this.rotation.y -= diffX * 0.003; 
                this.rotation.x -= diffY * 0.003;
                this.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotation.x));
                
                this.camera.rotation.x = this.rotation.x; 
                this.camera.rotation.y = this.rotation.y;
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

    // --- 🔄 毎フレーム動く計算 ---
    update() {
        // 常に最新のスキン画像をチェック＆更新
        this.updateMySkinMesh();

        const speed = 0.08;
        
        // カメラの向きをベースにXZ平面の移動ベクトルを計算
        const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        forwardVec.y = 0; forwardVec.normalize();
        rightVec.y = 0;   rightVec.normalize();

        // キー入力に合わせて実際のプレイヤー位置(this.position)を動かす
        if (this.moveKeys.forward)  this.position.addScaledVector(forwardVec, speed);
        if (this.moveKeys.backward) this.position.addScaledVector(forwardVec, -speed);
        if (this.moveKeys.left)     this.position.addScaledVector(rightVec, -speed);
        if (this.moveKeys.right)    this.position.addScaledVector(rightVec, speed);

        // 重力と落下の計算
        this.velocity.y -= this.gravity; 
        this.position.y += this.velocity.y * 0.1;

        // ピンポイント足元当たり判定
        const playerX = Math.floor(this.position.x);
        const playerZ = Math.floor(this.position.z);
        let targetFloorY = this.floorY;

        if (this.world && typeof this.world.getBlock === 'function') {
            const startScanY = Math.min(20, Math.floor(this.position.y) + 1);
            for (let y = startScanY; y >= 0; y--) {
                const block = this.world.getBlock(playerX, y, playerZ);
                if (block && block.visible !== false) {
                    targetFloorY = y + 1.0;
                    break;
                }
            }
        }

        // 着地判定
        if (this.position.y <= targetFloorY) {
            this.position.y = targetFloorY;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        // 💻 PCモードの時はPointerLockControlsの回転を体の回転(this.rotation)に同期する
        if (this.mode === 'pc' && this.controls.isLocked) {
            this.rotation.y = this.camera.rotation.y;
            this.rotation.x = this.camera.rotation.x;
        }

        // 🎭 自分の頭モデルの位置と向きを同期する
        if (this.myMesh) {
            // 体の中心の高さ（目の高さより少し下）に配置
            this.myMesh.position.copy(this.position).y += (this.playerHeight / 2);
            this.myMesh.rotation.y = this.rotation.y; 
        }

        // 👁️ 【重要】視点モードによってカメラの座標を決定する！
        if (this.perspective === 'first') {
            // 一人称視点：カメラはプレイヤーの目の位置そのもの
            this.camera.position.copy(this.position).y += this.playerHeight;
        } else {
            // 三人称視点：プレイヤーの後ろ3マス、上1.5マスの位置にカメラを回り込ませる
            const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion);
            backward.y = 0; backward.normalize(); // 真後ろへのベクトル
            
            const targetCamPos = this.position.clone();
            targetCamPos.y += (this.playerHeight + 0.5); // 少し高い位置
            targetCamPos.addScaledVector(backward, 3.5);  // 後ろに3.5マス離す
            
            this.camera.position.copy(targetCamPos);
        }
    }
}