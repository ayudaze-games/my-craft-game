class World {
    constructor(scene) {
        this.scene = scene;
        this.blocks = [];
        this.chunkSize = 16;
        this.renderDistance = 2; // 周辺2チャンクを描画
        this.loadedChunks = new Set();

        // =================================================================
        // 🎨 1. 画像の読み込みとマイクラ風クッキリ設定
        // =================================================================
        const textureLoader = new THREE.TextureLoader();

        const textureGrassTop = textureLoader.load('img/grass_top.png');
        const textureGrassSide = textureLoader.load('img/grass_side.png');
        const textureDirt = textureLoader.load('img/dirt.png');
        const textureStone = textureLoader.load('img/stone.png');

        // 🪵 【新機能！】木と葉っぱのテクスチャをロード
        const textureOakTop = textureLoader.load('img/oak_top.png');     // 原木の切り口（断面）
        const textureOakSide = textureLoader.load('img/oak_side.png');   // 原木の樹皮（側面）
        const textureLeafTop = textureLoader.load('img/leaf_top.png');   // 葉っぱ

        // 💡 ドット絵がボヤけないようにする魔法の設定（クッキリ表示）
        const allTextures = [
            textureGrassTop, textureGrassSide, textureDirt, textureStone,
            textureOakTop, textureOakSide, textureLeafTop
        ];

        allTextures.forEach(tex => {
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
        });

        // =================================================================
        // 📦 2. 各ブロックのマテリアル（見た目）作成
        // =================================================================
        // ① 草ブロック（サイコロの面ごとに画像を貼り分けます）
        // Three.jsの並び順：[右, 左, 上, 下, 前, 後]
        this.grassMaterials = [
            new THREE.MeshStandardMaterial({ map: textureGrassSide }), // 右
            new THREE.MeshStandardMaterial({ map: textureGrassSide }), // 左
            new THREE.MeshStandardMaterial({ map: textureGrassTop }),  // 上（緑の草）
            new THREE.MeshStandardMaterial({ map: textureDirt }),      // 下（茶色の土）
            new THREE.MeshStandardMaterial({ map: textureGrassSide }), // 前
            new THREE.MeshStandardMaterial({ map: textureGrassSide })  // 後
        ];

        // ② 土ブロック（全面が土）
        this.dirtMaterial = new THREE.MeshStandardMaterial({ map: textureDirt });

        // ③ 石ブロック（全面が石）
        this.stoneMaterial = new THREE.MeshStandardMaterial({ map: textureStone });

        // 🪵 ④ 原木ブロック（切り口と側面をリアルに貼り分け！）
        this.logMaterials = [
            new THREE.MeshStandardMaterial({ map: textureOakSide }), // 右
            new THREE.MeshStandardMaterial({ map: textureOakSide }), // 左
            new THREE.MeshStandardMaterial({ map: textureOakTop }),  // 上（切り口）
            new THREE.MeshStandardMaterial({ map: textureOakTop }),  // 下（切り口）
            new THREE.MeshStandardMaterial({ map: textureOakSide }), // 前
            new THREE.MeshStandardMaterial({ map: textureOakSide })  // 後
        ];

        // 🍃 ⑤ 葉っぱブロック（透過させてマイクラらしく隙間が見えるように！）
        this.leavesMaterial = new THREE.MeshStandardMaterial({ 
            map: textureLeafTop,
            transparent: true,  // 画像の透明・半透明部分を有効にする！
            alphaTest: 0.5,     // 隙間から背景が綺麗に抜けて見えるようにする設定
            side: THREE.DoubleSide // 葉っぱの内側からも描画する
        });

        // ブロックの形（共通の1x1x1のサイコロ型）
        this.geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    // 🔄 描画距離を外から変更するための関数（前回のスマホ対策を引き継ぎ）
    setRenderDistance(distance) {
        this.renderDistance = parseInt(distance);
        console.log(`👁️ 描画距離が ${this.renderDistance} に変更されました`);
        
        if (window.playerInstance) {
            this.updateChunks(window.camera.position.x, window.camera.position.z);
        }
    }

    // 🧱 指定したXYZ座標にブロックがあるか調べる関数
    getBlock(x, y, z) {
        return this.blocks.find(block => 
            Math.floor(block.position.x) === Math.floor(x) &&
            Math.floor(block.position.y) === Math.floor(y) &&
            Math.floor(block.position.z) === Math.floor(z)
        );
    }

    // ブロックを新しく生み出す関数（種類を追加！）
    createBlock(x, y, z, isGrass, type = 'grass') {
        let mat;
        if (type === 'stone') {
            mat = this.stoneMaterial;
        } else if (type === 'dirt') {
            mat = this.dirtMaterial;
        } else if (type === 'log') {
            mat = this.logMaterials;   // 🪵 原木（貼り分け版）
        } else if (type === 'leaves') {
            mat = this.leavesMaterial; // 🍃 葉っぱ（透過版）
        } else {
            mat = this.grassMaterials;
        }

        const mesh = new THREE.Mesh(this.geometry, mat);
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
        this.blocks.push(mesh);
        return mesh;
    }

    // ブロックを破壊する関数
    removeBlock(mesh) {
        this.scene.remove(mesh);
        const index = this.blocks.indexOf(mesh);
        if (index > -1) {
            this.blocks.splice(index, 1);
        }
    }

    // プレイヤーの周りの地形を自動生成する関数（山を作るアルゴリズム）
    updateChunks(playerX, playerZ) {
        const currentChunkX = Math.floor(playerX / this.chunkSize);
        const currentChunkZ = Math.floor(playerZ / this.chunkSize);

        for (let x = currentChunkX - this.renderDistance; x <= currentChunkX + this.renderDistance; x++) {
            for (let z = currentChunkZ - this.renderDistance; z <= currentChunkZ + this.renderDistance; z++) {
                const chunkKey = `${x},${z}`;
                if (!this.loadedChunks.has(chunkKey)) {
                    this.generateChunk(x, z);
                    this.loadedChunks.add(chunkKey);
                }
            }
        }
    }

    // 1つのチャンク（16×16のエリア）にデコボコした山と【木】を作る
    generateChunk(chunkX, chunkZ) {
        const startX = chunkX * this.chunkSize;
        const startZ = chunkZ * this.chunkSize;

        for (let x = 0; x < this.chunkSize; x++) {
            for (let z = 0; z < this.chunkSize; z++) {
                const worldX = startX + x;
                const worldZ = startZ + z;

                // 🏔️ サイン・コサインを使ってなだらかな山を作る数式
                const height = Math.floor(
                    Math.sin(worldX * 0.1) * Math.cos(worldZ * 0.1) * 4 + 
                    Math.sin(worldX * 0.05) * 4 + 8
                );

                // 表面から地中深くまでブロックを積み上げる
                for (let y = 0; y <= height; y++) {
                    if (y === height) {
                        // 1層目（一番表面）：草ブロック
                        this.createBlock(worldX, y, worldZ, true, 'grass');

                        // 🌲 【新機能：木を生やす！】
                        // 端っこすぎて葉っぱが削れるのを防ぐため、チャンクの内側に生やします。
                        // 確率2%で木を生成します。
                        if (x > 1 && x < this.chunkSize - 2 && z > 1 && z < this.chunkSize - 2) {
                            if (Math.random() < 0.02) { 
                                this.generateTree(worldX, height + 1, worldZ);
                            }
                        }
                    } else if (y >= height - 5) {
                        // 2層目〜6層目（表面のすぐ下5マス分）：土ブロック
                        this.createBlock(worldX, y, worldZ, false, 'dirt');
                    } else {
                        // 7層目より深い場所：石ブロック
                        this.createBlock(worldX, y, worldZ, false, 'stone');
                    }
                }
            }
        }
    }

    // 🌲 木を1本生成するアルゴリズム
    generateTree(worldX, worldY, worldZ) {
        // 木の高さをランダム（4〜5ブロック）にする
        const treeHeight = 4 + Math.floor(Math.random() * 2);

        // 1. 🪵 幹（原木）を積み上げる
        for (let i = 0; i < treeHeight; i++) {
            this.createBlock(worldX, worldY + i, worldZ, false, 'log');
        }

        // 2. 🍃 葉っぱを周りにモコモコと配置
        const leavesStartY = worldY + treeHeight - 2; // 幹の少し下から葉っぱを開始
        const leavesEndY = worldY + treeHeight + 1;   // 幹のてっぺんの1マス上まで

        for (let ly = leavesStartY; ly <= leavesEndY; ly++) {
            const relativeY = ly - (worldY + treeHeight);
            
            // 上にいくほど小さくなるように半径を調整
            let radius = 2; // 下の方は最大5x5（半径2）
            if (relativeY >= 0) radius = 1; // てっぺんは3x3（半径1）
            if (relativeY > 0) radius = 0;  // 最上部は1マスだけ

            for (let lx = -radius; lx <= radius; lx++) {
                for (let lz = -radius; lz <= radius; lz++) {
                    // カドをたまにランダムに削って自然な丸みを出す
                    if (Math.abs(lx) === radius && Math.abs(lz) === radius && radius > 0) {
                        if (Math.random() > 0.6) continue;
                    }

                    // 幹がある中心部分は上を除いてブロックを置かない（負荷軽減）
                    if (lx === 0 && lz === 0 && ly < worldY + treeHeight) {
                        continue;
                    }

                    this.createBlock(worldX + lx, ly, worldZ + lz, false, 'leaves');
                }
            }
        }
    }
}