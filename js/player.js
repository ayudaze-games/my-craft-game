class Player {
    constructor(camera, domElement, world, mode) {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        this.mode = mode;

        // 🛠️ 初期位置：山に埋まらないように高さ「30」の空中に設定！
        this.camera.position.set(16, 30, 16);

        // 物理演算用
        this.keys = { w: false, a: false, s: false, d: false, ' ': false };
        this.moveSpeed = 0.12;
        this.velocity = new THREE.Vector3();

        this.GRAVITY = 0.012;
        this.JUMP_FORCE = 0.22;
        this.PLAYER_HEIGHT = 1.8;
        this.PLAYER_RADIUS = 0.3;
        this.isGrounded = false;

        // レイキャスト（破壊・設置用）
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2(0, 0);

        // 🎒 インベントリシステム
        this.inventory = ['grass', 'stone'];
        this.currentSlot = 0;

        // モバイル操作用
        this.touchLook = { touchId: null, startX: 0, startY: 0 };
        this.rotX = 0;
        this.rotY = 0;
        this.joystick = { active: false, touchId: null, startX: 0, startY: 0, moveX: 0, moveY: 0 };

        this.initInventoryUi();

        if (this.mode === 'pc') {
            this.controls = new THREE.PointerLockControls(this.camera, this.domElement);
            this.domElement.addEventListener('click', () => this.controls.lock());
            this.initPcEvents();
        } else {
            this.initMobileEvents();
        }
    }

    initInventoryUi() {
        const slots = document.querySelectorAll('.slot');
        slots.forEach(slot => {
            const handleSwitch = (e) => {
                e.stopPropagation();
                const idx = parseInt(slot.getAttribute('data-index'));
                this.changeSlot(idx);
            };
            slot.addEventListener('click', handleSwitch);
            slot.addEventListener('touchstart', handleSwitch, { passive: false });
        });
    }

    changeSlot(index) {
        this.currentSlot = index;
        document.querySelectorAll('.slot').forEach((slot, i) => {
            if (i === index) slot.classList.add('active');
            else slot.classList.remove('active');
        });
    }

    initPcEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.key === '1') this.changeSlot(0);
            if (e.key === '2') this.changeSlot(1);
            const key = e.key === ' ' ? ' ' : e.key.toLowerCase();
            if (key in this.keys) this.keys[key] = true;
        });
        window.addEventListener('keyup', (e) => {
            const key = e.key === ' ' ? ' ' : e.key.toLowerCase();
            if (key in this.keys) this.keys[key] = false;
        });
        window.addEventListener('mousedown', (e) => {
            if (!this.controls.isLocked) return;
            this.executeAction(e.button === 0 ? 'destroy' : 'place');
        });
    }

    initMobileEvents() {
        const joyZone = document.getElementById('joystick-zone');
        const joyStick = document.getElementById('joystick-stick');

        joyZone.addEventListener('touchstart', (e) => {
            const touch = e.changedTouches[0];
            this.joystick.active = true;
            this.joystick.touchId = touch.identifier;
            this.joystick.startX = touch.clientX;
            this.joystick.startY = touch.clientY;
        });

        window.addEventListener('touchmove', (e) => {
            if (!this.joystick.active) return;
            for (let touch of e.changedTouches) {
                if (touch.identifier === this.joystick.touchId) {
                    let dx = touch.clientX - this.joystick.startX;
                    let dy = touch.clientY - this.joystick.startY;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 40) { dx = (dx / dist) * 40; dy = (dy / dist) * 40; }
                    joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
                    this.joystick.moveX = dx / 40;
                    this.joystick.moveY = dy / 40;
                }
            }
        });

        window.addEventListener('touchend', (e) => {
            for (let touch of e.changedTouches) {
                if (touch.identifier === this.joystick.touchId) {
                    this.joystick.active = false;
                    this.joystick.moveX = 0; this.joystick.moveY = 0;
                    joyStick.style.transform = 'translate(0px, 0px)';
                }
            }
        });

        this.domElement.addEventListener('touchstart', (e) => {
            for (let touch of e.changedTouches) {
                if (touch.clientY < window.innerHeight - 120) {
                    if (this.touchLook.touchId === null) {
                        this.touchLook.touchId = touch.identifier;
                        this.touchLook.startX = touch.clientX;
                        this.touchLook.startY = touch.clientY;
                    }
                }
            }
        });

        this.domElement.addEventListener('touchmove', (e) => {
            if (this.touchLook.touchId === null) return;
            for (let touch of e.changedTouches) {
                if (touch.identifier === this.touchLook.touchId) {
                    const dx = touch.clientX - this.touchLook.startX;
                    const dy = touch.clientY - this.touchLook.startY;
                    this.rotY -= dx * 0.005;
                    this.rotX -= dy * 0.005;
                    this.rotX = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, this.rotX));
                    this.camera.rotation.order = "YXZ";
                    this.camera.rotation.set(this.rotX, this.rotY, 0);
                    this.touchLook.startX = touch.clientX;
                    this.touchLook.startY = touch.clientY;
                }
            }
        });

        this.domElement.addEventListener('touchend', (e) => {
            for (let touch of e.changedTouches) {
                if (touch.identifier === this.touchLook.touchId) this.touchLook.touchId = null;
            }
        });

        document.getElementById('btn-destroy').addEventListener('touchstart', (e) => { e.preventDefault(); this.executeAction('destroy'); });
        document.getElementById('btn-place').addEventListener('touchstart', (e) => { e.preventDefault(); this.executeAction('place'); });
        document.getElementById('btn-jump').addEventListener('touchstart', (e) => { e.preventDefault(); if (this.isGrounded) this.velocity.y = this.JUMP_FORCE; });
    }

    executeAction(actionType) {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.world.blocks);
        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit.distance > 5) return;
            if (actionType === 'destroy') {
                this.world.removeBlock(hit.object);
            } else {
                const normal = hit.face.normal;
                const targetPos = hit.object.position.clone().add(normal);
                const blockType = this.inventory[this.currentSlot];
                this.world.createBlock(targetPos.x, targetPos.y, targetPos.z, (normal.y === 1), blockType);
            }
        }
    }

    checkCollision(x, y, z) {
        const px = Math.floor(x + 0.5);
        const py = Math.floor(y + 0.5);
        const pz = Math.floor(z + 0.5);
        for (let i = 0; i < this.world.blocks.length; i++) {
            const b = this.world.blocks[i].position;
            if (Math.floor(b.x + 0.5) === px && Math.floor(b.y + 0.5) === py && Math.floor(b.z + 0.5) === pz) return true;
        }
        return false;
    }

    update() {
        if (!this.isGrounded) this.velocity.y -= this.GRAVITY;

        if (this.mode === 'pc' && this.isGrounded && this.keys[' ']) {
            this.velocity.y = this.JUMP_FORCE;
            this.isGrounded = false;
        } 

        const moveVector = new THREE.Vector3();
        if (this.mode === 'pc') {
            if (this.keys.w) moveVector.z -= this.moveSpeed;
            if (this.keys.s) moveVector.z += this.moveSpeed;
            if (this.keys.a) moveVector.x -= this.moveSpeed;
            if (this.keys.d) moveVector.x += this.moveSpeed;
        } else {
            moveVector.x = this.joystick.moveX * this.moveSpeed;
            moveVector.z = this.joystick.moveY * this.moveSpeed;
        }

        const camQuaternion = this.camera.quaternion.clone();
        camQuaternion.x = 0; camQuaternion.z = 0; camQuaternion.normalize();
        moveVector.applyQuaternion(camQuaternion);

        // X軸衝突判定
        this.camera.position.x += moveVector.x;
        if (
            this.checkCollision(this.camera.position.x + this.PLAYER_RADIUS, this.camera.position.y - 0.5, this.camera.position.z) ||
            this.checkCollision(this.camera.position.x - this.PLAYER_RADIUS, this.camera.position.y - 0.5, this.camera.position.z) ||
            this.checkCollision(this.camera.position.x + this.PLAYER_RADIUS, this.camera.position.y - 1.2, this.camera.position.z) ||
            this.checkCollision(this.camera.position.x - this.PLAYER_RADIUS, this.camera.position.y - 1.2, this.camera.position.z)
        ) {
            this.camera.position.x -= moveVector.x;
        }

        // Z軸衝突判定
        this.camera.position.z += moveVector.z;
        if (
            this.checkCollision(this.camera.position.x, this.camera.position.y - 0.5, this.camera.position.z + this.PLAYER_RADIUS) ||
            this.checkCollision(this.camera.position.x, this.camera.position.y - 0.5, this.camera.position.z - this.PLAYER_RADIUS) ||
            this.checkCollision(this.camera.position.x, this.camera.position.y - 1.2, this.camera.position.z + this.PLAYER_RADIUS) ||
            this.checkCollision(this.camera.position.x, this.camera.position.y - 1.2, this.camera.position.z - this.PLAYER_RADIUS)
        ) {
            this.camera.position.z -= moveVector.z;
        }

        this.camera.position.y += this.velocity.y;
        if (this.velocity.y > 0 && this.checkCollision(this.camera.position.x, this.camera.position.y + 0.1, this.camera.position.z)) {
            this.velocity.y = 0;
        }

        const playerX = Math.floor(this.camera.position.x + 0.5);
        const playerZ = Math.floor(this.camera.position.z + 0.5);
        const feetY = this.camera.position.y - this.PLAYER_HEIGHT;

        let blockBelowY = -1;
        for (let i = 0; i < this.world.blocks.length; i++) {
            const b = this.world.blocks[i].position;
            if (Math.floor(b.x + 0.5) === playerX && Math.floor(b.z + 0.5) === playerZ) {
                if (b.y <= feetY + 0.35 && b.y > blockBelowY) blockBelowY = b.y;
            }
        }

        if (blockBelowY !== -1 && feetY <= blockBelowY + 0.5) {
            this.camera.position.y = blockBelowY + 0.5 + this.PLAYER_HEIGHT;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }

        if (this.camera.position.y < -10) { this.camera.position.set(16, 30, 16); this.velocity.y = 0; }
    }
}