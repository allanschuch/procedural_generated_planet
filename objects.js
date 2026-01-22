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
            snowColor: [1.0, 1.0, 1.0, 1.0],
            tempSnowColor: [1.0, 1.0, 1.0, 1.0],
            shininess: 300.0,
        };

        this.uniforms = {};
        this.planetArrays = null;
        this.planetMinAltitude = this.data.radius - this.data.noiseAmplitude;
        this.planetMaxAltitude = this.data.radius + this.data.noiseAmplitude;
    }

    getVS() {
        return `#version 300 es
        in vec4 a_position;
        in vec3 a_normal;

        uniform mat4 u_worldMatrix;
        uniform mat4 u_viewProjectionMatrix;
        uniform mat4 u_inverseTransposedWorldMatrix;

        uniform vec3 u_lightWorldPosition;
        uniform vec3 u_viewWorldPosition;

        out vec3 v_normal;
        out float v_height;

        out vec3 v_surfaceToLight;
        out vec3 v_surfaceToView;

        void main() {
            // Multiply the position by the matrix.
            gl_Position = u_viewProjectionMatrix * u_worldMatrix * a_position;

            // orient the normals and pass to the fragment shader
            v_normal = mat3(u_inverseTransposedWorldMatrix) * a_normal;

            v_height = length(a_position.xyz);

            // compute the world position of the surface
            vec3 surfaceWorldPosition = (u_worldMatrix * a_position).xyz;
            
            // compute the vector of the surface to the light
            // and pass it to the fragment shader
            v_surfaceToLight = u_lightWorldPosition - surfaceWorldPosition;

            // compute the vector of the surface to the view/camera
            // and pass it to the fragment shader
            v_surfaceToView = u_viewWorldPosition - surfaceWorldPosition;
        }
        `;
    }

    getFS() {
        return `#version 300 es
        precision highp float;

        in vec3 v_normal;
        in float v_height;

        in vec3 v_surfaceToLight;
        in vec3 v_surfaceToView;

        uniform float u_ambientLight;
        uniform vec4 u_specularColor;
        uniform float u_shininess;
        
        uniform float u_waterAltitude;
        uniform float u_sandAltitude;
        uniform float u_grassAltitude;
        uniform float u_rockAltitude;
        
        uniform vec4 u_colorWater;
        uniform vec4 u_colorSand;
        uniform vec4 u_colorGrass;
        uniform vec4 u_colorRock;
        uniform vec4 u_colorSnow;
        
        out vec4 out_color;

        void main() {
            // because v_normal is a varying it's interpolated
            // so it will not be a unit vector. Normalizing it
            // will make it a unit vector again
            vec3 normal = normalize(v_normal);

            vec3 surfaceToLightDirection = normalize(v_surfaceToLight);
            vec3 surfaceToViewDirection = normalize(v_surfaceToView);
            vec3 halfVector = normalize(surfaceToLightDirection + surfaceToViewDirection);

            float diffuseLight = max(dot(normal, surfaceToLightDirection), 0.0);
            float specular = 0.0;
            if (diffuseLight > 0.0) {
                specular = pow(max(dot(normal, halfVector), 0.0), u_shininess);
            }

            // Lets multiply just the color portion (not the alpha)
            // by the light
             
            vec3 base_color = step(v_height, u_waterAltitude) * u_colorWater.rgb +
                        step(u_waterAltitude, v_height) * step(v_height, u_sandAltitude) * u_colorSand.rgb +
                        step(u_sandAltitude, v_height) * step(v_height, u_grassAltitude) * u_colorGrass.rgb +
                         step(u_grassAltitude, v_height) * step(v_height, u_rockAltitude) * u_colorRock.rgb +
                        step(u_rockAltitude, v_height) * u_colorSnow.rgb;

            vec3 ambient = base_color * u_ambientLight;
            vec3 diffuse = base_color * diffuseLight;
            vec3 specularLight = u_specularColor.rgb * specular;
            vec3 finalColor = ambient + diffuse + specularLight;

            finalColor = clamp(finalColor, 0.0, 1.0);

            out_color = vec4(finalColor, 1.0);
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
            u_shininess: this.data.shininess,
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
            shininess: 200.0,
        };
    }

    getVS() {
        return `#version 300 es
        in vec4 a_position;
        in vec3 a_normal;

        uniform mat4 u_worldMatrix;
        uniform mat4 u_viewProjectionMatrix;
        uniform mat4 u_inverseTransposedWorldMatrix;

        uniform vec3 u_lightWorldPosition;

        out vec3 v_normal;
        out float v_height;
        out vec3 v_surfaceToLight;

        void main() {
            // Multiply the position by the matrix.
            gl_Position = u_viewProjectionMatrix * u_worldMatrix * a_position;

            // orient the normals and pass to the fragment shader
            v_normal = mat3(u_inverseTransposedWorldMatrix) * a_normal;

            v_height = length(a_position.xyz);

            // compute the world position of the surface
            vec3 surfaceWorldPosition = (u_worldMatrix * a_position).xyz;
            
            // compute the vector of the surface to the light
            // and pass it to the fragment shader
            v_surfaceToLight = u_lightWorldPosition - surfaceWorldPosition;
        }
        `;
    }

    getFS() {
        return `#version 300 es
        precision highp float;

        in vec3 v_normal;
        in vec3 v_surfaceToLight;
        in float v_height;

        uniform float u_ambientLight;
        
        uniform vec4 u_color;
        
        out vec4 out_color;

        void main() {
            // because v_normal is a varying it's interpolated
            // so it will not be a unit vector. Normalizing it
            // will make it a unit vector again
            vec3 normal = normalize(v_normal);

            vec3 surfaceToLightDirection = normalize(v_surfaceToLight);

            float diffuseLight = max(dot(normal, surfaceToLightDirection), 0.0);
            float light = diffuseLight + u_ambientLight;

            out_color = u_color;

            out_color.rgb *= light;
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
            tempStoneIceColor: [0.65, 0.95, 0.95, 1.0],
            minDistanceBetweenObjects: 0.2,
            shininess: 100.0,
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
            foliageSwingAngle: 0.0,
            foliageSwingDirection: 1,
            originalFoliageLocalMatrix: null,
            windSpeed: 20
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

class Star {
    constructor() {
        this.data = {
            starRadiusFactor: 0.3,
            orbitSpeed: 5,
            distanceFromPlanetFactor: 1.5,
            lightIntensity: 1.0,
            color: [1.0, 1.0, 0.8, 1.0],
            specularColor: [1.0, 1.0, 1.0, 1.0],
            ambientLight: 0.3,
            generalShininessFactor: 1.0
        };
    }

    getVS() {
        return `#version 300 es
        in vec4 a_position;
        in vec3 a_normal;

        uniform mat4 u_worldMatrix;
        uniform mat4 u_viewProjectionMatrix;
        uniform mat4 u_inverseTransposedWorldMatrix;

        out vec3 v_normal;

        void main() {
            gl_Position = u_viewProjectionMatrix * u_worldMatrix * a_position;
            v_normal = a_normal * mat3(u_inverseTransposedWorldMatrix);
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

    getStarArrays(planetRadius, treefoliageRadiusFactor, treeTrunkHeightFactor, treeScale) {
        const starRadius = this.data.starRadiusFactor * planetRadius;
        return twgl.primitives.createSphereVertices(starRadius, 12, 12);
    }
}