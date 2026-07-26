class World {
    constructor(scene) {
        this.scene = scene;
        this.blocks = [];
        this.blockMap = new Map(); // 座標検索用 (x,y,z -> mesh)
        this.chunkSize = 16;
        this.renderDistance = 1; // 描画チャンク範囲

        // テクスチャローダー
        const textureLoader = new THREE.TextureLoader();
        
        // 🌊 水テクスチャの読み込み
        this.waterTexture = textureLoader.load('water.gif', (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
        });
        this.waterTexture.magFilter = THREE.NearestFilter;
        this.waterTexture.minFilter = THREE.NearestFilter;

        // 共通のキューブジオメトリ
        this.geometry = new THREE.BoxGeometry(1, 1, 1);

        // 各ブロックのマテリアル設定
        this.materials = {
            grass: new THREE.MeshLambertMaterial({ color: 0x5c801e }),
            dirt: new THREE.MeshLambertMaterial({ color: 0x866043 }),
            stone: new THREE.MeshLambertMaterial({ color: 0x808080 }),
            log: new THREE.MeshLambertMaterial({ color: 0x674d32 }),
            leaves: new THREE.MeshLambertMaterial({ color: 0x3a5213 }),
            
            // 💧 水マテリアル（半透明＆描画順最適化）
            water: new THREE.MeshLambertMaterial({
                map: this.waterTexture,
                transparent: true,
                opacity: 0.75,
                depthWrite: false
            })
        };

        // 初期ワールドの生成
        this.generateWorld();
    }

    // 🔑 座標からキーを作成
    getPosKey(x, y, z) {
        return `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    }

    // 🧱 ブロックの作成
    createBlock(x, y, z, isBedrock = false, type = 'grass') {
        const key = this.getPosKey(x, y, z);
        if (this.blockMap.has(key)) return;

        const material = this.materials[type] || this.materials.grass;
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.position.set(x, y, z);
        mesh.userData = { type: type, isBedrock: isBedrock };

        this.scene.add(mesh);
        this.blocks.push(mesh);
        this.blockMap.set(key, mesh);
        return mesh;
    }

    // 🔥 ブロックの削除
    removeBlock(mesh) {
        if (!mesh) return;
        const index = this.blocks.indexOf(mesh);
        if (index > -1) {
            this.blocks.splice(index, 1);
        }
        const key = this.getPosKey(mesh.position.x, mesh.position.y, mesh.position.z);
        this.blockMap.delete(key);
        this.scene.remove(mesh);
    }

    // 🔍 座標からブロックを取得
    getBlock(x, y, z) {
        const key = this.getPosKey(x, y, z);
        return this.blockMap.get(key);
    }

    // 🌲 木の生成
    createTree(x, y, z) {
        const trunkHeight = 4 + Math.floor(Math.random() * 2);
        
        // 幹（原木）の配置
        for (let i = 0; i < trunkHeight; i++) {
            this.createBlock(x, y + i, z, false, 'log');
        }

        // 葉っぱの配置
        const leafTop = y + trunkHeight;
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = -2; ly <= 1; ly++) {
                    if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && Math.random() > 0.5) continue;
                    const targetY = leafTop + ly;
                    if (!this.getBlock(x + lx, targetY, z + lz)) {
                        this.createBlock(x + lx, targetY, z + lz, false, 'leaves');
                    }
                }
            }
        }
    }

    // 🌎 ワールド生成
    generateWorld() {
        const size = 32;
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                // 地形（草・土・石）
                this.createBlock(x, 0, z, true, 'stone');
                this.createBlock(x, 1, z, false, 'dirt');
                this.createBlock(x, 2, z, false, 'dirt');
                this.createBlock(x, 3, z, false, 'grass');

                // 低い場所（川や池風に水を最初から配置）
                if (x > 10 && x < 15 && z > 5 && z < 25) {
                    this.removeBlock(this.getBlock(x, 3, z)); // 草を消して
                    this.createBlock(x, 3, z, false, 'water'); // 水を配置
                } else {
                    // 木のランダム生成
                    if (Math.random() < 0.02 && x > 2 && x < size - 3 && z > 2 && z < size - 3) {
                        this.createTree(x, 4, z);
                    }
                }
            }
        }
    }

    // 🔄 毎フレームの更新（水テクスチャをゆらゆら動かす）
    update() {
        if (this.waterTexture) {
            this.waterTexture.offset.x += 0.0008;
            this.waterTexture.offset.y += 0.0005;
        }
    }

    // 👁️ 描画距離の変更
    setRenderDistance(distance) {
        this.renderDistance = parseInt(distance);
        console.log(`描画距離を ${this.renderDistance} チャンクに変更しました`);
    }
}