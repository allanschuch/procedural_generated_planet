"use strict";

class Planet {
    constructor(noiseGen) {
        this.noise = noiseGen;
        this.noiseTypeMap = ["octavePerlin", "octaveRandom", "octaveVoronoiPeak", "octaveVoronoiValley"];
        
        this.data = {
            resolution: 100,
            divisions: 100,
            radius: 1.0,
            noiseType: 0,
            noiseFrequency: 1.0,
            noiseAmplitude: 0.2,
            octaves: 1,
            persistence: 0.5,
            waterAltitude: 0.2,
            grassAltitude: 0.4,
            rockAltitude: 0.7,
            waterColor: [0.0, 0.0, 1.0, 1.0],
            sandColor: [0.76, 0.7, 0.5, 1.0],
            grassColor: [0.0, 1.0, 0.0, 1.0],
            rockColor: [0.5, 0.5, 0.5, 1.0],
            snowColor: [1.0, 1.0, 1.0, 1.0]
        };

        this.uniforms = {};
        this.arrays = null;
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
            else if (v_height < u_waterAltitude + 0.02) {
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
        const maxAltitude = this.data.radius + this.data.noiseAmplitude;
        const minAltitude = this.data.radius - this.data.noiseAmplitude;
        const waterAltitude = this.lerp(minAltitude, maxAltitude, this.data.waterAltitude);
        const grassAltitude = this.lerp(minAltitude, maxAltitude, this.data.grassAltitude);
        const rockAltitude = this.lerp(minAltitude, maxAltitude, this.data.rockAltitude);
        return {
            water: waterAltitude,
            grass: grassAltitude,
            rock: rockAltitude
        };
    }

    update() {
        const curvePoints = this.getSpherePoints(this.data.resolution);
        
        this.arrays = this.lathePoints(curvePoints, 0, Math.PI * 2, this.data.divisions);
        
        this.arrays.position = this.applyNoiseToSphere(this.arrays.position, this.data.octaves, this.data.noiseFrequency, this.data.persistence);

        this.updateUniforms();
    }

    updateUniforms() {
        const terrainColorAltitude = this.getTerrainColorAltitude();
        this.uniforms = {
            u_waterAltitude: terrainColorAltitude.water,
            u_grassAltitude: terrainColorAltitude.grass,
            u_rockAltitude: terrainColorAltitude.rock,
            u_colorWater: this.data.waterColor,
            u_colorSand: this.data.sandColor,
            u_colorGrass: this.data.grassColor,
            u_colorRock: this.data.rockColor,
            u_colorSnow: this.data.snowColor,
        };
    }

    getSpherePoints(numPoints) {
        const points = [];
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const angle = (Math.PI / 2) - (t * Math.PI); 
            const x = Math.cos(angle) * this.data.radius;
            const y = Math.sin(angle) * this.data.radius;
            points.push([x, y]);
        }
        return points;
    }

    lathePoints(points, startAngle, endAngle, numDivisions, capStart, capEnd) {     
        const positions = [];
        // const texcoords = [];
        const normals = [];
        const indices = [];

        const vOffset = capStart ? 1 : 0;
        const pointsPerColumn = points.length + vOffset + (capEnd ? 1 : 0);
        const quadsDown = pointsPerColumn - 1;

        for (let division = 0; division <= numDivisions; ++division) {
            const u = division / numDivisions;
            const angle = this.lerp(startAngle, endAngle, u);
            const mat = m4.yRotation(angle);

            if (capStart) {
                const p = [0, points[0][1], 0];
                const tp = m4.transformPoint(mat, p); 
                positions.push(tp[0], tp[1], tp[2]);
                // texcoords.push(u, 0);

                const normal = twgl.v3.normalize(tp);
                normals.push(normal[0], normal[1], normal[2]);
            }

            points.forEach((p, ndx) => {
                const tp = m4.transformPoint(mat, [...p, 0]);
                positions.push(tp[0], tp[1], tp[2]);
                
                // const v = (ndx + vOffset) / quadsDown;
                // texcoords.push(u, v);

                const normal = twgl.v3.normalize(tp);
                normals.push(normal[0], normal[1], normal[2]);
            });

            if (capEnd) {
                const p = [0, points[points.length - 1][1], 0];
                const tp = m4.transformPoint(mat, p);
                positions.push(tp[0], tp[1], tp[2]);
                // texcoords.push(u, 1);

                const normal = twgl.v3.normalize(tp);
                normals.push(normal[0], normal[1], normal[2]);
            }
        }

        for (let division = 0; division < numDivisions; ++division) {
            const column1Offset = division * pointsPerColumn;
            const column2Offset = column1Offset + pointsPerColumn;
            for (let quad = 0; quad < quadsDown; ++quad) {
                indices.push(column1Offset + quad, column1Offset + quad + 1, column2Offset + quad);
                indices.push(column1Offset + quad + 1, column2Offset + quad + 1, column2Offset + quad);
            }
        }

        return {
        position: positions,
        // texcoord: texcoords,
        normal: normals,
        indices: indices,
        };
    }

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