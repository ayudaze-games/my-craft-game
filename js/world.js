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

        // 💡 ドット絵がボヤけないようにする魔法の設定（クッキリ表示）
        [textureGrassTop, textureGrassSide, textureDirt, textureStone].forEach(tex => {
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

        // ブロックの形（共通の1x1x1のサイコロ型）
        this.geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    // ブロックを新しく生み出す関数
    createBlock(x, y, z, isGrass, type = 'grass') {
        let mat;
        if (type === 'stone') {
            mat = this.stoneMaterial;
        } else if (type === 'dirt') {
            mat = this.dirtMaterial;
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

    // 1つのチャンク（16×16のエリア）にデコボコした山を作る
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
}