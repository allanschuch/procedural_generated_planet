"use strict";

class Planet {
    constructor() {
        this.noise = new Noise();
        this.noiseTypeMap = ["octavePerlin", "octaveRandom", "octaveVoronoiPeak", "octaveVoronoiValley"];
        
        this.data = {
            resolution: 100,
            divisions: 100,
            radius: 1.0,
            rotationSpeed: 10,
            noiseType: 0,
            noiseFrequency: 1.0,
            noiseAmplitude: 0.2,
            numberOfNoiseOctaves: 1,
            noisePersistence: 0.5,
            waterAltitude: 0.35,
            sandAltitude: 0.365,
            grassAltitude: 0.55,
            rockAltitude: 0.7,
            waterColor: [0.0, 0.0, 1.0, 1.0],
            sandColor: [0.76, 0.7, 0.5, 1.0],
            grassColor: [0.0, 1.0, 0.0, 1.0],
            rockColor: [0.5, 0.5, 0.5, 1.0],
            snowColor: [1.0, 1.0, 1.0, 1.0]
        };

        this.uniforms = {};
        this.planetArrays = null;
        this.planetMinAltitude = this.data.radius - this.data.noiseAmplitude;
        this.planetMaxAltitude = this.data.radius + this.data.noiseAmplitude;
    }

    static get vs() {
        return `#version 300 es
        in vec4 a_position;
        in vec3 a_normal;

        uniform mat4 u_matrix;

        out vec3 v_normal;
        out float v_height;

        void main() {
            gl_Position = u_matrix * a_position;
            v_normal = a_normal;
            v_height = length(a_position.xyz);
        }
        `;
    }

    static get fs() {
        return `#version 300 es
        precision highp float;

        in vec3 v_normal;
        in float v_height;

        out vec4 out_color;

        uniform float u_waterAltitude;
        uniform float u_sandAltitude;
        uniform float u_grassAltitude;
        uniform float u_rockAltitude;

        uniform vec4 u_colorWater;
        uniform vec4 u_colorSand;
        uniform vec4 u_colorGrass;
        uniform vec4 u_colorRock;
        uniform vec4 u_colorSnow;

        void main() {
            if (v_height < u_waterAltitude) {
                out_color = u_colorWater;
            } 
            else if (v_height < u_sandAltitude) {
                out_color = u_colorSand;
            }
            else if (v_height < u_grassAltitude) {
                out_color = u_colorGrass;
            }
            else if (v_height < u_rockAltitude) {
                out_color = u_colorRock;
            }
            else {
                out_color = u_colorSnow;
            }
        }
        `;
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    getTerrainColorAltitude() {
        const waterAltitude = this.getAltitude(this.data.waterAltitude);
        const sandAltitude = waterAltitude + 0.015;
        const grassAltitude = this.getAltitude(this.data.grassAltitude);
        const rockAltitude = this.getAltitude(this.data.rockAltitude);
        return {
            water: waterAltitude,
            sand: sandAltitude,
            grass: grassAltitude,
            rock: rockAltitude
        };
    }

    updateMinMaxAltitude() {
        this.planetMinAltitude = this.data.radius - this.data.noiseAmplitude;
        this.planetMaxAltitude = this.data.radius + this.data.noiseAmplitude;
    }

    getAltitude(altitudeFactor) {
        return this.lerp(this.planetMinAltitude, this.planetMaxAltitude, altitudeFactor);
    }

    update() {
        // const curvePoints = this.getSpherePoints(this.data.resolution);
        this.updateMinMaxAltitude();

        this.planetArrays = twgl.primitives.createSphereVertices(this.data.radius, this.data.divisions, this.data.resolution);
        
        this.planetArrays.position = this.applyNoiseToSphere(this.planetArrays.position, this.data.numberOfNoiseOctaves, this.data.noiseFrequency, this.data.noisePersistence);

        this.updateUniforms();
    }

    updateUniforms() {
        const terrainColorAltitude = this.getTerrainColorAltitude();
        this.sandAltitude = terrainColorAltitude.sand;
        this.uniforms = {
            u_waterAltitude: terrainColorAltitude.water,
            u_sandAltitude: terrainColorAltitude.sand,
            u_grassAltitude: terrainColorAltitude.grass,
            u_rockAltitude: terrainColorAltitude.rock,
            u_colorWater: this.data.waterColor,
            u_colorSand: this.data.sandColor,
            u_colorGrass: this.data.grassColor,
            u_colorRock: this.data.rockColor,
            u_colorSnow: this.data.snowColor,
        };
    }

    // getSpherePoints(numPoints) {
    //     const points = [];
    //     for (let i = 0; i < numPoints; i++) {
    //         const t = i / (numPoints - 1);
    //         const angle = (Math.PI / 2) - (t * Math.PI); 
    //         const x = Math.cos(angle) * this.data.radius;
    //         const y = Math.sin(angle) * this.data.radius;
    //         points.push([x, y]);
    //     }
    //     return points;
    // }

    // lathePoints(points, startAngle, endAngle, numDivisions, capStart, capEnd) {     
    //     const positions = [];
    //     // const texcoords = [];
    //     const normals = [];
    //     const indices = [];

    //     const vOffset = capStart ? 1 : 0;
    //     const pointsPerColumn = points.length + vOffset + (capEnd ? 1 : 0);
    //     const quadsDown = pointsPerColumn - 1;

    //     for (let division = 0; division <= numDivisions; ++division) {
    //         const u = division / numDivisions;
    //         const angle = this.lerp(startAngle, endAngle, u);
    //         const mat = m4.yRotation(angle);

    //         if (capStart) {
    //             const p = [0, points[0][1], 0];
    //             const tp = m4.transformPoint(mat, p); 
    //             positions.push(tp[0], tp[1], tp[2]);
    //             // texcoords.push(u, 0);

    //             const normal = twgl.v3.normalize(tp);
    //             normals.push(normal[0], normal[1], normal[2]);
    //         }

    //         points.forEach((p, ndx) => {
    //             const tp = m4.transformPoint(mat, [...p, 0]);
    //             positions.push(tp[0], tp[1], tp[2]);
                
    //             // const v = (ndx + vOffset) / quadsDown;
    //             // texcoords.push(u, v);

    //             const normal = twgl.v3.normalize(tp);
    //             normals.push(normal[0], normal[1], normal[2]);
    //         });

    //         if (capEnd) {
    //             const p = [0, points[points.length - 1][1], 0];
    //             const tp = m4.transformPoint(mat, p);
    //             positions.push(tp[0], tp[1], tp[2]);
    //             // texcoords.push(u, 1);

    //             const normal = twgl.v3.normalize(tp);
    //             normals.push(normal[0], normal[1], normal[2]);
    //         }
    //     }

    //     for (let division = 0; division < numDivisions; ++division) {
    //         const column1Offset = division * pointsPerColumn;
    //         const column2Offset = column1Offset + pointsPerColumn;
    //         for (let quad = 0; quad < quadsDown; ++quad) {
    //             indices.push(column1Offset + quad, column1Offset + quad + 1, column2Offset + quad);
    //             indices.push(column1Offset + quad + 1, column2Offset + quad + 1, column2Offset + quad);
    //         }
    //     }

    //     return {
    //     position: positions,
    //     // texcoord: texcoords,
    //     normal: normals,
    //     indices: indices,
    //     };
    // }

    applyNoiseToSphere(positions, octaves = 1, frequency = 1.0, persistence = 0.5) {
        for (let i = 0; i < positions.length; i = i + 3) {
        const position = [positions[i], positions[i + 1], positions[i + 2]];
        const normal = twgl.v3.normalize(position);
        const calculatedNoise = this.noise.calcNoise(
            this.noiseTypeMap[this.data.noiseType],
            position[0],
            position[1],
            position[2],
            frequency,
            octaves,
            persistence
        );
        const newRadius = this.data.radius + calculatedNoise * this.data.noiseAmplitude;
        positions[i] = normal[0] * newRadius;
        positions[i + 1] = normal[1] * newRadius;
        positions[i + 2] = normal[2] * newRadius;
        }
        return positions;
    }
}

class PlanetObject {
    constructor() {
        this.data = {
            numberOf: 25,
            scale: 1.0,
            tempScale: 1.0,
            minScaleFactor: 0.5,
            maxScaleFactor: 2.0,
            minDistanceBetweenObjects: 1.4,
        };
    }

    getVS() {
        return `#version 300 es
        in vec4 a_position;
        in vec3 a_normal;

        uniform mat4 u_matrix;

        out vec3 v_normal;

        void main() {
            gl_Position = u_matrix * a_position;
            v_normal = a_normal;
        }
        `;
    }

    getFS() {
        return `#version 300 es
        precision highp float;

        in vec3 v_normal;

        out vec4 out_color;

        uniform vec4 u_color;

        void main() {
            out_color = u_color;
        }
        `;
    }

    getRandomScaleFactor() {
        return Math.random() * (this.data.maxScaleFactor - this.data.minScaleFactor) + this.data.minScaleFactor;
    }
}

class Stone extends PlanetObject {
    constructor() {        
        super();
        this.data = {
            ...this.data,
            numberOf: 175,
            stoneCubeSize: 0,
            stoneNormalColor: [0.5, 0.5, 0.6, 1.0], 
            stoneIceColor: [0.65, 0.95, 0.95, 1.0],
            minDistanceBetweenObjects: 0.2,
        };

    }

    getStoneCubeSize(planetRadius) {
        return  planetRadius * 0.025;
    }

    getStoneArrays(planetRadius) {
        const stoneCubeSize = this.getStoneCubeSize(planetRadius);
        let stoneArrays = twgl.primitives.createCubeVertices(stoneCubeSize);
        twgl.primitives.reorientVertices(stoneArrays, m4.translation(0, stoneCubeSize / 5, 0));
        return stoneArrays;
    }
}

class Tree extends PlanetObject {
    constructor() {
        super();
        this.data = {
            ...this.data,
            trunkHeightFactor: 0.10,
            trunkRadiusFactor: 0.0127,
            foliageRadiusFactor: 0.076,
            trunkHeight: 0.2,
            trunkRadius: 0.035,
            trunkColor: [0.55, 0.27, 0.07, 1.0],
            foliageNormalColor: [
            [0.2, 0.8, 0.2, 1.0], 
            [0.5, 0.9, 0.0, 1.0],
            [0.0, 0.5, 0.1, 1.0]
            ],
            foliageIceColor: [0.9, 1.0, 1.0, 1.0],
            foliageMaxSwingAngle: 15.0,
            foliageSwingAngleAcc: 0.0,
            foliageSwingDirection: 1,
            originalFoliageLocalMatrix: null,
            windSpeed: 30
        };
    }

    getTrunkArrays(planetRadius) {
        this.data.trunkRadius = this.data.trunkRadiusFactor * planetRadius;
        this.data.trunkHeight = this.data.trunkHeightFactor * planetRadius;
        let trunkArrays = twgl.primitives.createCylinderVertices(this.data.trunkRadius, this.data.trunkHeight, 12, 1);
        trunkArrays = twgl.primitives.reorientVertices(trunkArrays, m4.translation(0, this.data.trunkHeight / 2, 0));
        return trunkArrays;
    }

    getFoliageArrays(planetRadius) {
        const foliageRadius = this.data.foliageRadiusFactor * planetRadius;
        return twgl.primitives.createSphereVertices(foliageRadius, 6, 6);
    }
}