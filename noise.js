"use strict";

class PerlinAlgorithm {
    constructor() {
        this.permutation = [151,160,137,91,90,15,
        131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
        190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
        88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
        77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
        102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
        135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
        5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
        223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
        129,22,39,253, 19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,
        251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
        49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
        138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];

        this.p = new Uint8Array(512);
        for (let i = 0; i < 256; i++) {
            this.p[i] = this.permutation[i];
            this.p[256 + i] = this.permutation[i];
        }
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }

    grad(hash, x, y, z) {
        switch(hash & 0xF) {
            case 0x0: return  x + y;
            case 0x1: return -x + y;
            case 0x2: return  x - y;
            case 0x3: return -x - y;
            case 0x4: return  x + z;
            case 0x5: return -x + z;
            case 0x6: return  x - z;
            case 0x7: return -x - z;
            case 0x8: return  y + z;
            case 0x9: return -y + z;
            case 0xA: return  y - z;
            case 0xB: return -y - z;
            case 0xC: return  y + x;
            case 0xD: return -y + z;
            case 0xE: return  y - x;
            case 0xF: return -y - z;
            default: return 0;
        }
    }

    perlin(x, y, z) {
        let xi = Math.floor(x) & 255;
        let yi = Math.floor(y) & 255;
        let zi = Math.floor(z) & 255;

        let xf = x - Math.floor(x);
        let yf = y - Math.floor(y);
        let zf = z - Math.floor(z);

        let u = this.fade(xf);
        let v = this.fade(yf);
        let w = this.fade(zf);

        let aaa = this.p[this.p[this.p[xi] + yi] + zi];
        let aba = this.p[this.p[this.p[xi] + yi + 1] + zi];
        let aab = this.p[this.p[this.p[xi] + yi] + zi + 1];
        let abb = this.p[this.p[this.p[xi] + yi + 1] + zi + 1];
        let baa = this.p[this.p[this.p[xi + 1] + yi] + zi];
        let bba = this.p[this.p[this.p[xi + 1] + yi + 1] + zi];
        let bab = this.p[this.p[this.p[xi + 1] + yi] + zi + 1];
        let bbb = this.p[this.p[this.p[xi + 1] + yi + 1] + zi + 1];

        let x1, x2, y1, y2;

        x1 = this.lerp(this.grad(aaa, xf, yf, zf),           this.grad(baa, xf - 1, yf, zf),           u);
        x2 = this.lerp(this.grad(aba, xf, yf - 1, zf),       this.grad(bba, xf - 1, yf - 1, zf),       u);
        y1 = this.lerp(x1, x2, v);

        x1 = this.lerp(this.grad(aab, xf, yf, zf - 1),       this.grad(bab, xf - 1, yf, zf - 1),       u);
        x2 = this.lerp(this.grad(abb, xf, yf - 1, zf - 1),   this.grad(bbb, xf - 1, yf - 1, zf - 1),   u);
        y2 = this.lerp(x1, x2, v);

        return this.lerp(y1, y2, w);
    }

    octavePerlin(x, y, z, octaves, frequency = 1, persistence) {
        let total = 0;
        let amplitude = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += this.perlin(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        return total / maxValue;
    }
}

class RandomAlgorithm {
    constructor() {
        this.table = [];
        for(let i = 0; i < 256; i++) {
            this.table.push( (Math.random() * 2) - 1 ); 
        }
    }

    random(x, y, z) {
        let index = Math.floor(Math.abs(x * 13 + y * 29 + z * 47)) % 256;
        return this.table[index];
    }

    octaveRandom(x, y, z, octaves, frequency = 1, persistence) {
        let total = 0;
        let amplitude = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += this.random(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        return total / maxValue;
    }   
}

class VoronoiAlgorithm {
    
    // Função auxiliar para gerar um ponto pseudo-aleatório (offset) 
    // dentro da célula baseada nas coordenadas inteiras da célula.
    getFeaturePoint(xi, yi, zi) {
        // "Hashing" simples determinístico (shader style) para substituir o Random.value do Unity
        // Retorna um vetor 3D com valores entre 0.0 e 1.0
        let dotX = xi * 12.9898 + yi * 78.233 + zi * 37.719;
        let dotY = xi * 39.3467 + yi * 11.135 + zi * 83.155;
        let dotZ = xi * 73.156 + yi * 52.235 + zi * 9.151;
        
        // Mantém determinístico usando sin
        let rx = (Math.sin(dotX) * 43758.5453) % 1; 
        let ry = (Math.sin(dotY) * 43758.5453) % 1;
        let rz = (Math.sin(dotZ) * 43758.5453) % 1;
        
        // Garante positivo (0..1)
        return { 
            x: Math.abs(rx), 
            y: Math.abs(ry), 
            z: Math.abs(rz) 
        };
    }

    voronoi(x, y, z) {
        // Coordenadas da Célula Inteira (Lattice)
        let xi = Math.floor(x);
        let yi = Math.floor(y);
        let zi = Math.floor(z);

        // Coordenada fracionária (posição dentro da célula atual)
        let xf = x - xi;
        let yf = y - yi;
        let zf = z - zi;

        let minDist = 1.0; // F1: Distância mínima inicia no máximo possível (1.0)

        // Loop pelos vizinhos (3x3x3 grid)
        // Equivalente ao loop z, y, x offset do tutorial
        for (let zOffset = -1; zOffset <= 1; zOffset++) {
            for (let yOffset = -1; yOffset <= 1; yOffset++) {
                for (let xOffset = -1; xOffset <= 1; xOffset++) {
                    
                    // 1. Onde está o ponto "seed" deste vizinho?
                    let pointOffset = this.getFeaturePoint(xi + xOffset, yi + yOffset, zi + zOffset);
                    
                    // 2. Vetor do ponto atual (xf, yf, zf) até o ponto "seed" do vizinho
                    // Vector = NeighborCell + PointOffset - CurrentPosition
                    let vectorX = xOffset + pointOffset.x - xf;
                    let vectorY = yOffset + pointOffset.y - yf;
                    let vectorZ = zOffset + pointOffset.z - zf;

                    // 3. Distância Euclidiana
                    let dist = Math.sqrt(vectorX * vectorX + vectorY * vectorY + vectorZ * vectorZ);

                    // 4. Manter o menor (F1)
                    if (dist < minDist) {
                        minDist = dist;
                    }
                }
            }
        }
        
        // Retorna a distância para a borda da célula (0.0 a 1.0 aprox)
        // Inverter (1 - minDist) cria "crateras" ou "células", 
        // mas o padrão é retornar a distância bruta.
        return minDist;
    }

    octaveVoronoi(x, y, z, octaves, frequency = 1, persistence) {
        let total = 0;
        let amplitude = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += this.voronoi(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        return total / maxValue;
    }
}

class Noise {
    constructor() {
        this.perlinAlgorithm = new PerlinAlgorithm();
        this.randomAlgorithm = new RandomAlgorithm();
        this.voronoiAlgorithm = new VoronoiAlgorithm();
    }

    calcNoise(type, x, y, z, frequency = 1.0, octaves = 1, persistence = 0.5) {

        if (type === "perlin") {
            return this.perlinAlgorithm.perlin(frequency * x, frequency * y, frequency * z);
        } 
        else if (type === "random") {
            return this.randomAlgorithm.random(frequency * x, frequency * y, frequency * z);
        }
        else if (type === "voronoiPeak") {
            return 1 - this.voronoiAlgorithm.voronoi(frequency * x, frequency * y, frequency * z);
        }
        else if (type === "voronoiValley") {
            return this.voronoiAlgorithm.voronoi(frequency * x, frequency * y, frequency * z);
        }
        else if (type === "octavePerlin") {
            return this.perlinAlgorithm.octavePerlin(x, y, z, octaves, frequency, persistence);
        }
        else if (type === "octaveRandom") {
            return this.randomAlgorithm.octaveRandom(x, y, z, octaves, frequency, persistence);
        }
        else if (type === "octaveVoronoiPeak") {
            return 1 - this.voronoiAlgorithm.octaveVoronoi(x, y, z, octaves, frequency, persistence);
        }
        else if (type === "octaveVoronoiValley") {
            return this.voronoiAlgorithm.octaveVoronoi(x, y, z, octaves, frequency, persistence);
        }
        return 0; 
    }
}