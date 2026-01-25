"use strict";

function main() {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return;
    twgl.setDefaults({attribPrefix: "a_"});

    const planet = new Planet();
    const star = new Star();
    const stone = new Stone();
    const tree = new Tree();

    // SHADERS AND PROGRAMS

    const programOptions = {
        attribLocations: {
            'a_position': 0,
            'a_normal':   1,
            'a_texcoord': 2,
            'a_color':    3,
        },
    };

    const pickingVS = `#version 300 es
        in vec4 a_position;
        
        uniform mat4 u_worldMatrix;
        uniform mat4 u_viewProjectionMatrix;
        
        void main() {
            gl_Position = u_viewProjectionMatrix * u_worldMatrix * a_position;
        }
    `;

    const pickingFS = `#version 300 es
        precision highp float;
        
        uniform vec4 u_id;
        
        out vec4 outColor;
        
        void main() {
            outColor = u_id;
        }
    `;

    const shadowMapVS =
        `#version 300 es
        in vec4 a_position;
        uniform mat4 u_worldMatrix;
        uniform mat4 u_lightViewProjectionMatrix;
        void main() {
            gl_Position = u_lightViewProjectionMatrix * u_worldMatrix * a_position;
        }
        `;

    const shadowMapFS =
        `#version 300 es
        precision highp float;

        void main() {
        }
        `;
      
    const shadowMapConfig = createShadowMapFramebuffer();
    const pickingConfig = createPickingFramebuffer();
    const shadowMapProgramInfo = twgl.createProgramInfo(gl, [shadowMapVS, shadowMapFS], programOptions);
    const pickingProgramInfo = twgl.createProgramInfo(gl, [pickingVS, pickingFS]);
    const planetObjectProgramInfo = twgl.createProgramInfo(gl, [PlanetObject.VS, PlanetObject.FS], programOptions);
    const planetProgramInfo = twgl.createProgramInfo(gl, [Planet.VS, Planet.FS], programOptions);
    const starProgramInfo = twgl.createProgramInfo(gl, [Star.VS, Star.FS], programOptions);
    
    // PLANET AND STAR CONFIG
    
    let planetBufferInfo = null;
    let planetVAO = null;
    const planetNode = new Node();
    planetNode.localMatrix = m4.identity();

    let starBufferInfo = null;
    let starVAO = null;
    const starNode = new Node();
    starNode.localMatrix = m4.identity();

    const starOrbitNode = new Node();
    starOrbitNode.localMatrix = m4.identity();
    starNode.setParent(starOrbitNode);

    const systemNode = new Node();
    planetNode.setParent(systemNode);
    starOrbitNode.setParent(systemNode);

    // STONES CONFIG

    const stoneArrays = stone.getStoneArrays(planet.data.radius);
    let stoneBufferInfo = twgl.createBufferInfoFromArrays(gl, stoneArrays);
    let stoneVAO = twgl.createVAOFromBufferInfo(gl, planetObjectProgramInfo, stoneBufferInfo);

    // TREES CONFIG

    const foliageArrays = tree.getFoliageArrays(planet.data.radius);
    let foliageBufferInfo = twgl.createBufferInfoFromArrays(gl, foliageArrays);
    let foliageVAO = twgl.createVAOFromBufferInfo(gl, planetObjectProgramInfo, foliageBufferInfo);
    
    const trunkArrays = tree.getTrunkArrays(planet.data.radius);
    let trunkBufferInfo = twgl.createBufferInfoFromArrays(gl, trunkArrays);
    let trunkVAO = twgl.createVAOFromBufferInfo(gl, planetObjectProgramInfo, trunkBufferInfo);

    // OBJECTS

    let objects = {
        planets: [planetNode],
        stones: [],
        trees: [],
        trunks: [],
        foliageGroups: [],
        foliages: [],
        stars: [starNode],
        systems: [systemNode]
    }

    let pickableObjects = [];

    // HELPER FUNCTIONS

    function createShadowMapFramebuffer() {
        const depthTexture = gl.createTexture();
        const depthTextureSize = star.data.shadowMapTextureSize;
        gl.bindTexture(gl.TEXTURE_2D, depthTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,      // target
            0,                  // mip level
            gl.DEPTH_COMPONENT32F, // internal format
            depthTextureSize,   // width
            depthTextureSize,   // height
            0,                  // border
            gl.DEPTH_COMPONENT, // format
            gl.FLOAT,           // type
            null);              // data
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
 
        const depthFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,       // target
            gl.DEPTH_ATTACHMENT,  // attachment point
            gl.TEXTURE_2D,        // texture target
            depthTexture,         // texture
            0);                   // mip level
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { framebuffer: depthFramebuffer, texture: depthTexture };
    }

    function updateShadowMapSize() {
        const depthTextureSize = star.data.shadowMapTextureSize;
        gl.bindTexture(gl.TEXTURE_2D, shadowMapConfig.texture);
        gl.texImage2D(
            gl.TEXTURE_2D,      
            0,                  
            gl.DEPTH_COMPONENT32F,
            depthTextureSize,  
            depthTextureSize,   
            0,                 
            gl.DEPTH_COMPONENT, 
            gl.FLOAT,           
            null);
    }

    function createPickingFramebuffer() {
        // Create a texture to render to
        const targetTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // create a depth renderbuffer
        const depthBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        
        updatePickingFramebufferAttachmentSizes(gl.canvas.width, gl.canvas.height, depthBuffer, targetTexture);

        // Create and bind the framebuffer
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

        // attach the texture as the first color attachment
        const attachmentPoint = gl.COLOR_ATTACHMENT0;
        const level = 0;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level);

        // make a depth buffer and the same size as the targetTexture
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
        
        return { framebuffer: fb, targetTexture: targetTexture, depthBuffer: depthBuffer };
    }

    function updatePickingFramebufferAttachmentSizes(width, height, depthBuffer, targetTexture) {
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        // define size and format of level 0
        const level = 0;
        const internalFormat = gl.RGBA;
        const border = 0;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;
        const data = null;
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                        width, height, border,
                        format, type, data);
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    }

    function readPixelIdUnderTheMouse(){
            const pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
            const pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;
            const data = new Uint8Array(4);
            gl.readPixels(
                pixelX,            // x
                pixelY,            // y
                1,                 // width
                1,                 // height
                gl.RGBA,           // format
                gl.UNSIGNED_BYTE,  // type
                data);             // typed array to hold result
            const id = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);
            return id;
        }

    function getShadowMappingFOVAngleInRadians() {
        const lightWorldPosition = starNode.worldMatrix.slice(12, 15);
        const lightDistToPlanetCenter = twgl.v3.length(lightWorldPosition);
        const treeFoliageHeight = tree.data.foliageRadiusFactor * planet.data.radius * tree.data.scale * 2;
        const treeTrunkHeight = tree.data.trunkHeightFactor * planet.data.radius * tree.data.scale;
        const planetRadiusWithTrees = planet.data.radius + planet.data.noiseAmplitude + treeFoliageHeight + treeTrunkHeight;
        let shadowHalfFOV = Math.asin(planetRadiusWithTrees / lightDistToPlanetCenter);
        shadowHalfFOV *= 1.1;
        return shadowHalfFOV * 2;
    }

    function removeFromPickableObjectsList(startId, numberOfObjects = 1) {
        const index = startId - 1;
        pickableObjects.splice(index, numberOfObjects);
        updatePickableObjectsIDs(index);
    }

    function updatePickableObjectsIDs(indexStart = 0) {
        for (let i = indexStart; i < pickableObjects.length; i++) {
            const objectNode = pickableObjects[i];
            objectNode.id = i + 1;
            objectNode.drawInfo.uniforms.u_id = [
                ((objectNode.id >>  0) & 0xFF) / 0xFF,
                ((objectNode.id >>  8) & 0xFF) / 0xFF,
                ((objectNode.id >> 16) & 0xFF) / 0xFF,
                ((objectNode.id >> 24) & 0xFF) / 0xFF,
            ];
        }
    }

    function getRandomPositionOnPlanetSurface() {
        const randomIndex = Math.floor(Math.random() * (planet.planetArrays.position.length / 3));
        const position = [
            planet.planetArrays.position[randomIndex * 3],
            planet.planetArrays.position[randomIndex * 3 + 1],
            planet.planetArrays.position[randomIndex * 3 + 2],
        ];

        return position;
    }

    function generateRandomPositions(numberOfRandomPositions, maxTries, minDistanceBetweenObjects, minAltitudeFactor1 = 0.01, maxAltitudeFactor1 = 1.0, minAltitudeFactor2 = null, maxAltitudeFactor2 = null) {
        if (minAltitudeFactor2 === null) minAltitudeFactor2 = minAltitudeFactor1;
        if (maxAltitudeFactor2 === null) maxAltitudeFactor2 = maxAltitudeFactor1;

        const positions = [];
        const minAltitude1 = planet.getAltitude(minAltitudeFactor1);
        const maxAltitude1 = planet.getAltitude(maxAltitudeFactor1);
        const minAltitude2 = planet.getAltitude(minAltitudeFactor2);
        const maxAltitude2 = planet.getAltitude(maxAltitudeFactor2);

        let tries = 0;
        for (let i = 0; i < numberOfRandomPositions; ) {
            tries++;
            if (tries > maxTries) break;
            const position = getRandomPositionOnPlanetSurface();
            const positionAltitude = twgl.v3.length(position);
            if (positionAltitude > minAltitude1 && positionAltitude < maxAltitude1 ||
                positionAltitude > minAltitude2 && positionAltitude < maxAltitude2) {
                if (positions.every(existingPosition => {
                    const distance = twgl.v3.distance(existingPosition, position);
                    return distance >= minDistanceBetweenObjects * planet.data.radius * 0.25;
                })) {
                    positions.push(position);
                    i++;
                }
            }
        }
        return positions;
    }

    function getRotationMatrixFromUpToVector(targetVector, up = [0, 1, 0]) {
        const normalizedUp = twgl.v3.normalize(up);
        const normalizedTargetVector = twgl.v3.normalize(targetVector);
        const axisToRotate = twgl.v3.cross(normalizedUp, normalizedTargetVector);
        const axisLen = twgl.v3.length(axisToRotate);

        if (axisLen < 1e-5) {
            return m4.identity();
        }

        twgl.v3.normalize(axisToRotate, axisToRotate);

        const rotationInRadians = twgl.v3.dot(normalizedUp, normalizedTargetVector);
        const rotationAngle = Math.acos(Math.min(1, Math.max(-1, rotationInRadians)));

        return m4.axisRotate(m4.identity(), axisToRotate, rotationAngle);
    }

    function getAngleInRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    // CREATE OBJECTS FUNCTIONS

    function createFoliageGroup(foliageGroupNode, foliageColor, treeID) {
        for (let i = 0; i < 5; i++) {
            const foliageNode = new Node();
            foliageNode.setParent(foliageGroupNode);
            foliageNode.drawInfo = {
                vertexArray: foliageVAO,
                programInfo: planetObjectProgramInfo,
                bufferInfo: foliageBufferInfo,
                uniforms: {
                    u_color: foliageColor,
                    u_shininess: tree.data.shininess * star.data.generalShininessFactor,
                    u_id: [
                        ((treeID >>  0) & 0xFF) / 0xFF,
                        ((treeID >>  8) & 0xFF) / 0xFF,
                        ((treeID >> 16) & 0xFF) / 0xFF,
                        ((treeID >> 24) & 0xFF) / 0xFF,
                    ]
                }
            };

            const translateDist = tree.data.foliageRadiusFactor * planet.data.radius * 0.4;

            switch(i) {
                case 0:
                    foliageNode.localMatrix = m4.translation(translateDist, 0, 0);
                    break;
                case 1:
                    foliageNode.localMatrix = m4.translation(-translateDist, 0, 0);
                    break;
                case 2:
                    foliageNode.localMatrix = m4.translation(0, 0, translateDist);
                    break;
                case 3:
                    foliageNode.localMatrix = m4.translation(0, 0, -translateDist);
                    break;
                case 4:
                    foliageNode.localMatrix = m4.translation(0, translateDist * 1.5, 0);
                    break;
            }

            objects.foliages.push(foliageNode);
        }
    }

    function generateTree(treeNode, position, treeID){
        const treeAltitude = twgl.v3.length(position);
        const rockAltitude = planet.getAltitude(planet.data.rockAltitude);
        let foliageColor;
        if (treeAltitude > rockAltitude) {
            foliageColor = planet.data.snowColor;
        } else {
            const foliageColors = {
                0: tree.data.foliageNormalColor1,
                1: tree.data.foliageNormalColor2,
                2: tree.data.foliageNormalColor3
            }
            const randomIndex = Math.floor(Math.random() * 3)
            foliageColor = foliageColors[randomIndex];
        }

        const trunkNode = new Node();
        trunkNode.setParent(treeNode);
        trunkNode.drawInfo = {
            vertexArray: trunkVAO,
            programInfo: planetObjectProgramInfo,
            bufferInfo: trunkBufferInfo,
            uniforms: {
                u_color: tree.data.trunkColor,
                u_shininess: tree.data.shininess,
                u_id: [
                    ((treeID >>  0) & 0xFF) / 0xFF,
                    ((treeID >>  8) & 0xFF) / 0xFF,
                    ((treeID >> 16) & 0xFF) / 0xFF,
                    ((treeID >> 24) & 0xFF) / 0xFF,
                ]
            },
        };

        trunkNode.localMatrix = m4.identity();

        objects.trunks.push(trunkNode);

        const foliageGroupNode = new Node();
        foliageGroupNode.setParent(treeNode);
        createFoliageGroup(foliageGroupNode, foliageColor, treeID);

        foliageGroupNode.localMatrix = m4.translation(0, tree.data.trunkHeight * 1.5, 0);

        tree.data.originalFoliageLocalMatrix = m4.multiply(foliageGroupNode.localMatrix, m4.identity());

        objects.foliageGroups.push(foliageGroupNode);
    }

    // UPDATE OBJECTS FUNCTIONS

    function updateStoneScale(){
        const newScaleFactor = stone.data.tempScale;
        const previousScaleFactor = stone.data.scale;
        stone.data.scale = newScaleFactor;     
        const scaleRatio = newScaleFactor / previousScaleFactor;
        objects.stones.forEach(stoneNode => {
            stoneNode.localMatrix = m4.scale(stoneNode.localMatrix, scaleRatio, scaleRatio, scaleRatio);
        });
    }
    
    function updateTreeScale(){
        const newScaleFactor = tree.data.tempScale;
        const previousScaleFactor = tree.data.scale;
        tree.data.scale = newScaleFactor;     
        const scaleRatio = newScaleFactor / previousScaleFactor;
        objects.trees.forEach(treeNode => {
            treeNode.localMatrix = m4.scale(treeNode.localMatrix, scaleRatio, scaleRatio, scaleRatio);
        });
        updateStar();
    }

    function updateStonesPlacement() {
        if (objects.stones.length > 0) {
            removeFromPickableObjectsList(objects.stones[0].id, objects.stones.length);
            objects.stones.forEach(stone => stone.setParent(null));
            objects.stones = [];
        }
        
        const planetNode = objects.planets[0];
        
        const stonePositions = generateRandomPositions(stone.data.numberOf, 1000, stone.data.minDistanceBetweenObjects, planet.data.waterAltitude, 1.0);
        
        objects.stones = stonePositions.map(position => {
            const stoneNode = new Node();
            stoneNode.setParent(planetNode);
            const stoneAltitude = twgl.v3.length(position);
            const rockAltitude = planet.getAltitude(planet.data.rockAltitude);
            const stoneOnIce = stoneAltitude > rockAltitude;
            const stoneColor = stoneOnIce ? stone.data.stoneIceColor : stone.data.stoneNormalColor;
            pickableObjects.push(stoneNode);
            stoneNode.id = pickableObjects.length;
            stoneNode.drawInfo = {
                vertexArray: stoneVAO,       
                programInfo: planetObjectProgramInfo,
                bufferInfo: stoneBufferInfo,
                uniforms: {
                    u_color: stoneColor,
                    u_shininess: stoneOnIce ? stone.data.shininess : stone.data.shininess / 2,
                    u_id: [
                        ((stoneNode.id >>  0) & 0xFF) / 0xFF,
                        ((stoneNode.id >>  8) & 0xFF) / 0xFF,
                        ((stoneNode.id >> 16) & 0xFF) / 0xFF,
                        ((stoneNode.id >> 24) & 0xFF) / 0xFF,
                    ]
                }
            };

            const normal = twgl.v3.normalize(position);
            const look = m4.lookAt([0,0,0], normal, [0,1,0]);
            const rotationMatrix = m4.inverse(look);
            const translationMatrix = m4.translation(position[0], position[1], position[2]);
            let localMatrix = m4.multiply(translationMatrix, rotationMatrix);
            const scaleFactor = stone.getRandomScaleFactor() * stone.data.scale;
            localMatrix = m4.scale(localMatrix, scaleFactor, scaleFactor, scaleFactor);

            stoneNode.localMatrix = localMatrix;

            return stoneNode;
        });
    }

    function updateTreesPlacement() {
        if (objects.trees.length > 0) {
            removeFromPickableObjectsList(objects.trees[0].id, objects.trees.length);
            objects.trees.forEach(tree => {
                tree.children.forEach(child => {
                    child.children.forEach(grandChild => {
                        grandChild.setParent(null);
                    });
                    child.setParent(null);
                });
                tree.setParent(null);
            });

            objects.trees = [];
            objects.trunks = [];
            objects.foliages = [];
            objects.foliageGroups = [];
        }

        const planetNode = objects.planets[0];
        
        const treePositions = generateRandomPositions(tree.data.numberOf, 1000, tree.data.minDistanceBetweenObjects, planet.data.sandAltitude, planet.data.grassAltitude, planet.data.rockAltitude, 1.0);
        
        objects.trees = treePositions.map(position => {
            const treeNode = new Node();
            treeNode.setParent(planetNode);
            pickableObjects.push(treeNode);
            treeNode.id = pickableObjects.length;
            generateTree(treeNode, position, treeNode.id);

            const rotationMatrix = getRotationMatrixFromUpToVector(position, [0,1,0]);
            const translationMatrix = m4.translation(position[0], position[1], position[2]);
            let localMatrix = m4.multiply(translationMatrix, rotationMatrix);
            const scaleFactor = tree.data.scale;
            localMatrix = m4.scale(localMatrix, scaleFactor, scaleFactor, scaleFactor);

            treeNode.localMatrix = localMatrix;

            return treeNode;
        });
    }

    function updateObjectsPlacement() {
        updateStonesPlacement();
        updateTreesPlacement();
    } 
    
    function updateStar() {
        const starArrays = star.getStarArrays(planet.data.radius);
        if (!starBufferInfo) {
            starBufferInfo = twgl.createBufferInfoFromArrays(gl, starArrays);
            starVAO = twgl.createVAOFromBufferInfo(gl, starProgramInfo, starBufferInfo);
            starNode.drawInfo.vertexArray = starVAO;
            starNode.drawInfo.programInfo = starProgramInfo;
            starNode.drawInfo.bufferInfo = starBufferInfo;
        } else {
            twgl.setAttribInfoBufferFromArray(gl, starBufferInfo.attribs.a_position, starArrays.position);
            twgl.setAttribInfoBufferFromArray(gl, starBufferInfo.attribs.a_normal, starArrays.normal);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, starBufferInfo.indices);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(starArrays.indices), gl.STATIC_DRAW);
            starBufferInfo.numElements = starArrays.indices.length;
        }

        starNode.drawInfo.uniforms.u_color = star.data.color;

        const treeFoliageHeight = tree.data.foliageRadiusFactor * planet.data.radius * tree.data.scale * 2;
        const treeTrunkHeight = tree.data.trunkHeightFactor * planet.data.radius * tree.data.scale;
        const planetRadiusWithTrees = planet.data.radius + planet.data.noiseAmplitude + treeFoliageHeight + treeTrunkHeight;
        const distanceFromPlanet = star.data.distanceFromPlanetFactor * planet.data.radius + planetRadiusWithTrees;
        starNode.localMatrix = m4.identity();
        starNode.localMatrix = m4.translate(starNode.localMatrix, -distanceFromPlanet, 0, 0);
    }

    function updateNoisePersistence() {
        if (planet.data.numberOfNoiseOctaves > 1) updatePlanet();
    }

    function updatePlanet() {
        planet.update();
        if (!planetBufferInfo) {
            planetBufferInfo = twgl.createBufferInfoFromArrays(gl, planet.planetArrays);
            planetVAO = twgl.createVAOFromBufferInfo(gl, planetProgramInfo, planetBufferInfo);
            planetNode.drawInfo.vertexArray = planetVAO;
            planetNode.drawInfo.programInfo = planetProgramInfo;
            planetNode.drawInfo.bufferInfo = planetBufferInfo;
        } else {
            twgl.setAttribInfoBufferFromArray(gl, planetBufferInfo.attribs.a_position, planet.planetArrays.position);
            twgl.setAttribInfoBufferFromArray(gl, planetBufferInfo.attribs.a_normal, planet.planetArrays.normal);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planetBufferInfo.indices);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(planet.planetArrays.indices), gl.STATIC_DRAW);
            planetBufferInfo.numElements = planet.planetArrays.indices.length;
        }
        planetNode.drawInfo.uniforms = planet.uniforms;
        updateObjectsPlacement();
        updateStar();
    }

    function updateLight() {
        const shininessFactor = star.data.generalShininessFactor;
        objects.stones.forEach(stoneNode => 
            stoneNode.drawInfo.uniforms.u_shininess = stoneNode.drawInfo.uniforms.u_color === stone.data.stoneNormalColor ? 
            stone.data.shininess / shininessFactor : stone.data.shininess / 2 / shininessFactor);
        
        objects.trunks.forEach(trunkNode =>
            trunkNode.drawInfo.uniforms.u_shininess = tree.data.shininess / shininessFactor);
       
        objects.foliages.forEach(foliageNode => {
            foliageNode.drawInfo.uniforms.u_shininess = tree.data.shininess / shininessFactor
        });

        planetNode.drawInfo.uniforms.u_shininess = planet.data.shininess / shininessFactor;
    }

    // UPDATE COLOR FUNCTIONS

    function updateStoneColor() {
        objects.stones.forEach(stoneNode => {
            stoneNode.drawInfo.uniforms.u_color = stoneNode.drawInfo.uniforms.u_color === stone.data.stoneIceColor ?
            stone.data.tempStoneIceColor :
            stone.data.stoneNormalColor;
        });
        stone.data.stoneIceColor = stone.data.tempStoneIceColor;
    }

    function updateStarColor() {
        starNode.drawInfo.uniforms.u_color = star.data.color;
    }

    function updatePlanetColor() {
        planet.update();
        planetNode.drawInfo.uniforms = planet.uniforms;
    }

    function updatePlanetSnowColor() {
        objects.foliageGroups.forEach(foliageGroupNode => {
            foliageGroupNode.children.forEach(foliageNode => {
                if (foliageNode.drawInfo.uniforms.u_color === planet.data.snowColor) {
                    foliageNode.drawInfo.uniforms.u_color = planet.data.tempSnowColor;
                }
            });
        });
        planet.data.snowColor = planet.data.tempSnowColor;
        planet.update();
        planetNode.drawInfo.uniforms = planet.uniforms;
    }

    function updateTreeColor() {
        let randomIndex = 0;
        const foliageColors = {
            0: tree.data.foliageNormalColor1,
            1: tree.data.foliageNormalColor2,
            2: tree.data.foliageNormalColor3
        }
        objects.foliageGroups.forEach(foliageGroupNode => {
            randomIndex = Math.floor(Math.random() * 3)
            foliageGroupNode.children.forEach(foliageNode => {
                if (foliageNode.drawInfo.uniforms.u_color !== planet.data.snowColor) {
                    foliageNode.drawInfo.uniforms.u_color = foliageColors[randomIndex];
                }
            });
        });
    }
    
    // RENDER LOGIC
    
    updatePlanet();
    
    let lastTime = 0;
    let frameCount = 0;

    let mouseX = -1;
    let mouseY = -1;
    let oldPickNdx = -1;
    let oldPickColor = {stone: null, trunk: null, foliage: null};
    const redHighlight = [1, 0, 0, 1];
    const yellowHighlight = [1, 1, 0, 1];

    gl.canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    const cameraData = { zoom: 10, fov: 45, angle: 0, height: 0, nearPlane: 0.1, farPlane: 150};

    function setCameraMatrix() {
        const cameraRadius = 1/cameraData.zoom * 100;
        const angleInRadians = getAngleInRadians(cameraData.angle);
        const height = cameraData.height * planet.data.radius * 0.5;
        const x = Math.sin(angleInRadians) * cameraRadius;
        const z = Math.cos(angleInRadians) * cameraRadius;
        const cameraPosition = [x, height, z];
        const target = [0, 0, 0];
        const up = [0, 1, 0];
        return m4.lookAt(cameraPosition, target, up);
    }

    function setProjectionMatrix() {
        const fov = getAngleInRadians(cameraData.fov);
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        return m4.perspective(fov, aspect, cameraData.nearPlane, cameraData.farPlane);
    }

    function restoreOldPickedObjectColor() {
        const oldPickObject = pickableObjects[oldPickNdx];
        if (oldPickNdx >= 0 && oldPickObject) {
            const isTree = oldPickObject.children.length === 2;
            if (isTree){
                console.log('restoring tree color');
                const trunk = oldPickObject.children[0];
                const foliageGroup = oldPickObject.children[1];
                trunk.drawInfo.uniforms.u_color = oldPickColor.trunk;
                foliageGroup.children.forEach(foliage => {
                    foliage.drawInfo.uniforms.u_color = oldPickColor.foliage;
                });
            } else {
                oldPickObject.drawInfo.uniforms.u_color = oldPickColor.stone;
            }
            oldPickNdx = -1;
        }
    }

    function highlightPickedObject(objectID) {
        if (objectID > 0) {
            const pickNdx = objectID - 1;
            const pickObject = pickableObjects[pickNdx];
            if (pickObject) {
                const isTree = pickObject.children.length === 2;
                if (isTree){
                    const trunk = pickObject.children[0];
                    const foliageGroup = pickObject.children[1];
                    oldPickNdx = pickNdx;
                    oldPickColor.trunk = trunk.drawInfo.uniforms.u_color;
                    oldPickColor.foliage = foliageGroup.children[0].drawInfo.uniforms.u_color;
                    trunk.drawInfo.uniforms.u_color = (frameCount & 0x8) ? redHighlight : yellowHighlight;
                    foliageGroup.children.forEach(foliage => {
                        foliage.drawInfo.uniforms.u_color = (frameCount & 0x8) ? redHighlight : yellowHighlight;
                    });
                } else {
                    oldPickNdx = pickNdx;
                    oldPickColor.stone = pickObject.drawInfo.uniforms.u_color;
                    pickObject.drawInfo.uniforms.u_color = (frameCount & 0x8) ? redHighlight : yellowHighlight;
                }
            }
        }
    }

    function updateObjectsMatricesAndGetObjectsToDraw(viewProjectionMatrix, pass, cameraMatrix = null, shadowMapTextureMatrix = null) {
        const drawables = [];
        switch(pass) {
            case 'shadowMap':
                Object.keys(objects).filter(objectType => 
                    objectType !== 'stars').forEach(objectType => {
                        objects[objectType].forEach(object => {
                            if (!object.drawInfo.programInfo) return;
                            object.drawInfo.programInfo = shadowMapProgramInfo;
                            object.drawInfo.uniforms.u_worldMatrix = object.worldMatrix;
                            object.drawInfo.uniforms.u_lightViewProjectionMatrix = viewProjectionMatrix;
                            drawables.push(object.drawInfo);
                        });
                    });
                break;

            case 'scene':
                const lightWorldPosition = starNode.worldMatrix.slice(12, 15);
                const lightDirection = twgl.v3.normalize(twgl.v3.subtract([0,0,0], lightWorldPosition));
                const lightInnerLimitAngleCos = Math.cos(getAngleInRadians(star.data.lightLimitAngle));
                const lightOuterLimitAngleCos = Math.cos(getAngleInRadians(star.data.lightLimitAngle + 15));

                Object.keys(objects).forEach(objectType => {
                    objects[objectType].forEach(object => {
                        if (!object.drawInfo.programInfo) return;
                        object.drawInfo.programInfo = objectType === 'stars' ? starProgramInfo :
                            objectType === 'planets' ? planetProgramInfo :
                            planetObjectProgramInfo;
                        object.drawInfo.uniforms.u_worldMatrix = object.worldMatrix;
                        object.drawInfo.uniforms.u_viewProjectionMatrix = viewProjectionMatrix;
                        object.drawInfo.uniforms.u_inverseTransposedWorldMatrix = m4.transpose(m4.inverse(object.worldMatrix));
                        object.drawInfo.uniforms.u_lightDirection = lightDirection;
                        object.drawInfo.uniforms.u_lightInnerLimit = lightInnerLimitAngleCos;
                        object.drawInfo.uniforms.u_lightOuterLimit = lightOuterLimitAngleCos;
                        object.drawInfo.uniforms.u_lightWorldPosition = lightWorldPosition;
                        object.drawInfo.uniforms.u_viewWorldPosition = cameraMatrix.slice(12, 15);
                        object.drawInfo.uniforms.u_ambientLight = star.data.ambientLight;
                        object.drawInfo.uniforms.u_specularColor = star.data.color;
                        object.drawInfo.uniforms.u_diffuseColor = star.data.color;
                        object.drawInfo.uniforms.u_projectedTexture = shadowMapConfig.texture;
                        object.drawInfo.uniforms.u_textureMatrix = shadowMapTextureMatrix;
                        object.drawInfo.uniforms.u_bias = star.data.shadowMapBias;
                        drawables.push(object.drawInfo);
                    });
                });
                break;

            case 'picking':
                Object.keys(objects).forEach(objectType => {
                    objects[objectType].forEach(object => {
                        if (!object.drawInfo.programInfo) return;
                        if (objectType === 'stars' || objectType === 'planets') return;
                        object.drawInfo.programInfo = pickingProgramInfo;
                        object.drawInfo.uniforms.u_worldMatrix = object.worldMatrix;
                        object.drawInfo.uniforms.u_viewProjectionMatrix = viewProjectionMatrix;
                        drawables.push(object.drawInfo);
                    });
                });
                break;
        }

        return drawables;
    }

    function updateFoliageAnimation(deltaTime) {
        const speed = tree.data.windSpeed;
        const maxAngle = tree.data.foliageMaxSwingAngle;
        tree.data.foliageSwingAngle += deltaTime * speed * tree.data.foliageSwingDirection;
        if (tree.data.foliageSwingAngle > maxAngle) {
            tree.data.foliageSwingAngle = maxAngle;
            tree.data.foliageSwingDirection *= -1;
        } 

        if (tree.data.foliageSwingAngle < -maxAngle) {
            tree.data.foliageSwingAngle = -maxAngle;
            tree.data.foliageSwingDirection *= -1;
        }

        objects.foliageGroups.forEach((foliageGroup, index) => {
            const direction = (index % 2 === 0) ? 1 : -1;
            const swingAngle = tree.data.foliageSwingAngle * direction;
            foliageGroup.localMatrix = m4.multiply(tree.data.originalFoliageLocalMatrix, m4.identity());
            foliageGroup.localMatrix = m4.zRotate(foliageGroup.localMatrix, getAngleInRadians(swingAngle));
        });
    }

    function getDeltaTime(currentTime) {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        return deltaTime;
    }

    function drawScene(time) {
        time *= 0.001;
        ++frameCount;
        if (twgl.resizeCanvasToDisplaySize(gl.canvas)) {
            updatePickingFramebufferAttachmentSizes(gl.canvas.width, gl.canvas.height, pickingConfig.depthBuffer, pickingConfig.targetTexture);
        }
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        const deltaTime = getDeltaTime(time);

        updateFoliageAnimation(deltaTime);

        m4.yRotation(time * planet.data.rotationSpeed * 0.02 || 0, planetNode.localMatrix);
        m4.yRotation(time * star.data.orbitSpeed * -0.02 || 0, starOrbitNode.localMatrix);
        
        systemNode.updateWorldMatrix();

        // SHADOW MAP PASS

        const lightWorldPosition = starNode.worldMatrix.slice(12, 15);
        const lightWorldMatrix = m4.lookAt(lightWorldPosition, [0,0,0], [0,1,0]);
        const lightViewMatrix = m4.inverse(lightWorldMatrix);
        const lightProjectionMatrix = m4.perspective(getShadowMappingFOVAngleInRadians(), 1, cameraData.nearPlane, cameraData.farPlane);
        const lightViewProjectionMatrix = m4.multiply(lightProjectionMatrix, lightViewMatrix);

        let shadowMapTextureMatrix = m4.identity();
        shadowMapTextureMatrix = m4.translate(shadowMapTextureMatrix, 0.5, 0.5, 0.5);
        shadowMapTextureMatrix = m4.scale(shadowMapTextureMatrix, 0.5, 0.5, 0.5);
        shadowMapTextureMatrix = m4.multiply(shadowMapTextureMatrix, lightProjectionMatrix);
        shadowMapTextureMatrix = m4.multiply(shadowMapTextureMatrix, lightViewMatrix);

        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowMapConfig.framebuffer);
        gl.viewport(0, 0, star.data.shadowMapTextureSize, star.data.shadowMapTextureSize);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const objectsToDrawShadowMap = updateObjectsMatricesAndGetObjectsToDraw(lightViewProjectionMatrix, 'shadowMap');
        twgl.drawObjectList(gl, objectsToDrawShadowMap);
        
        // PICKING PASS
        
        const projectionMatrix = setProjectionMatrix();
        const cameraMatrix = setCameraMatrix();
        const viewMatrix = m4.inverse(cameraMatrix);
        const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

        gl.bindFramebuffer(gl.FRAMEBUFFER, pickingConfig.framebuffer);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const objectsToDrawPicking = updateObjectsMatricesAndGetObjectsToDraw(viewProjectionMatrix, 'picking', cameraMatrix);
        twgl.drawObjectList(gl, objectsToDrawPicking);

        // ------ Figure out what pixel is under the mouse and read it
        const objectID = readPixelIdUnderTheMouse();

        // restore the object's color
        restoreOldPickedObjectColor();

        // highlight object under mouse
        highlightPickedObject(objectID);

        // SCENE RENDER PASS

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


        const objectsToDraw = updateObjectsMatricesAndGetObjectsToDraw(viewProjectionMatrix, 'scene', cameraMatrix, shadowMapTextureMatrix);
    
        twgl.drawObjectList(gl, objectsToDraw);

        requestAnimationFrame(drawScene);
}

    setupUI(planet, cameraData, stone, tree, star, {
        updatePlanet,
        drawScene,
        updateNoisePersistence,
        updateStoneScale,
        updateStonesPlacement,
        updateTreeScale,
        updateTreesPlacement,
        updateStar,
        updateLight,
        updatePlanetColor,
        updatePlanetSnowColor,
        updateTreeColor,
        updateStoneColor,
        updateStarColor,
        updateShadowMapSize
    });

    requestAnimationFrame(drawScene);
}

main();