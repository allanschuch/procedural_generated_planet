"use strict";

function main() {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return;
    twgl.setDefaults({attribPrefix: "a_"});

    // PLANET AND STAR CONFIG

    const planet = new Planet();

    const planetProgramInfo = twgl.createProgramInfo(gl, [planet.getVS(), planet.getFS()]);
    let planetBufferInfo = null;
    let planetVAO = null;
    const planetNode = new Node();
    planetNode.localMatrix = m4.identity();

    const star = new Star();

    const starProgramInfo = twgl.createProgramInfo(gl, [star.getVS(), star.getFS()]);
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

    const stone = new Stone();

    const stoneProgramInfo = twgl.createProgramInfo(gl, [stone.getVS(), stone.getFS()]);
    const stoneArrays = stone.getStoneArrays(planet.data.radius);
    let stoneBufferInfo = twgl.createBufferInfoFromArrays(gl, stoneArrays);
    let stoneVAO = twgl.createVAOFromBufferInfo(gl, stoneProgramInfo, stoneBufferInfo);

    // TREES CONFIG

    const tree = new Tree();

    const treeProgramInfo = twgl.createProgramInfo(gl, [tree.getVS(), tree.getFS()]);

    const foliageArrays = tree.getFoliageArrays(planet.data.radius);
    let foliageBufferInfo = twgl.createBufferInfoFromArrays(gl, foliageArrays);
    let foliageVAO = twgl.createVAOFromBufferInfo(gl, treeProgramInfo, foliageBufferInfo);
    
    const trunkArrays = tree.getTrunkArrays(planet.data.radius);
    let trunkBufferInfo = twgl.createBufferInfoFromArrays(gl, trunkArrays);
    let trunkVAO = twgl.createVAOFromBufferInfo(gl, treeProgramInfo, trunkBufferInfo);

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

    function updateStonesPlacement() {
        objects.stones.forEach(stone => stone.setParent(null));
        objects.stones = [];
        
        const planetNode = objects.planets[0];
        
        const stonePositions = generateRandomPositions(stone.data.numberOf, 1000, stone.data.minDistanceBetweenObjects, planet.data.waterAltitude, 1.0);
        console.log(`Generated ${stonePositions.length} stones.`);
        
        objects.stones = stonePositions.map(position => {
            const stoneNode = new Node();
            stoneNode.setParent(planetNode);
            const stoneAltitude = twgl.v3.length(position);
            const rockAltitude = planet.getAltitude(planet.data.rockAltitude);
            const stoneOnIce = stoneAltitude > rockAltitude;
            const stoneColor = stoneOnIce ? stone.data.stoneIceColor : stone.data.stoneNormalColor;
            stoneNode.drawInfo = {
                vertexArray: stoneVAO,       
                programInfo: stoneProgramInfo,
                bufferInfo: stoneBufferInfo,
                uniforms: {
                    u_color: stoneColor,
                    u_shininess: stoneOnIce ? stone.data.shininess : stone.data.shininess / 2
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

    function createFoliageGroup(foliageGroupNode, foliageColor) {
        for (let i = 0; i < 5; i++) {
            const foliageNode = new Node();
            foliageNode.setParent(foliageGroupNode);
            foliageNode.drawInfo = {
                vertexArray: foliageVAO,
                programInfo: treeProgramInfo,
                bufferInfo: foliageBufferInfo,
                uniforms: {
                    u_color: foliageColor,
                    u_shininess: tree.data.shininess
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

    function generateTree(treeNode, position){
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
            programInfo: treeProgramInfo,
            bufferInfo: trunkBufferInfo,
            uniforms: {
                u_color: tree.data.trunkColor,
                u_shininess: tree.data.shininess
            },
        };

        trunkNode.localMatrix = m4.identity();

        objects.trunks.push(trunkNode);

        const foliageGroupNode = new Node();
        foliageGroupNode.setParent(treeNode);
        createFoliageGroup(foliageGroupNode, foliageColor);

        foliageGroupNode.localMatrix = m4.translation(0, tree.data.trunkHeight * 1.5, 0);

        tree.data.originalFoliageLocalMatrix = m4.multiply(foliageGroupNode.localMatrix, m4.identity());

        objects.foliageGroups.push(foliageGroupNode);
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

    function updateTreesPlacement() {
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

        const planetNode = objects.planets[0];
        
        const treePositions = generateRandomPositions(tree.data.numberOf, 1000, tree.data.minDistanceBetweenObjects, planet.data.sandAltitude, planet.data.grassAltitude, planet.data.rockAltitude, 1.0);
        console.log(`Generated ${treePositions.length} trees.`);
        
        objects.trees = treePositions.map(position => {
            const treeNode = new Node();
            treeNode.setParent(planetNode);
            generateTree(treeNode, position);

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

        const treeFoliageHeight = tree.data.foliageRadiusFactor * planet.data.radius * tree.data.scale;
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
       
        foliageNodes.forEach(foliageNode => {
            foliageNode.drawInfo.uniforms.u_shininess = tree.data.shininess / shininessFactor
        });

        planetNode.drawInfo.uniforms.u_shininess = planet.data.shininess / shininessFactor;
    }

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
    
    updatePlanet();

    const cameraData = { zoom: 10, fov: 45, angle: 0, height: 0};

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
        const fov = cameraData.fov * Math.PI / 180;
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        return m4.perspective(fov, aspect, 0.1, 150);
    }

    function getAngleInRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    function updateObjectsMatricesAndGetObjectsToDraw(viewProjectionMatrix) {
        const drawables = [];

        Object.keys(objects).forEach(objectType => {
            objects[objectType].forEach(object => {
                if (!object.drawInfo.programInfo) return;
                object.drawInfo.uniforms.u_worldMatrix = object.worldMatrix;
                object.drawInfo.uniforms.u_viewProjectionMatrix = viewProjectionMatrix;
                object.drawInfo.uniforms.u_inverseTransposedWorldMatrix = m4.transpose(m4.inverse(object.worldMatrix));
                const lightWorldPosition = starNode.worldMatrix.slice(12, 15);
                object.drawInfo.uniforms.u_lightWorldPosition = lightWorldPosition;
                object.drawInfo.uniforms.u_ambientLight = star.data.ambientLight;
                object.drawInfo.uniforms.u_specularColor = star.data.specularColor;
                object.drawInfo.uniforms.u_diffuseColor = star.data.color;
                drawables.push(object.drawInfo);
            });
        });
        
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

    let lastTime = 0;

    function drawScene(time) {
        time *= 0.001;
        twgl.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.enable(gl.DEPTH_TEST);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const projectionMatrix = setProjectionMatrix();
        const cameraMatrix = setCameraMatrix();
        const viewMatrix = m4.inverse(cameraMatrix);
        const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

        const deltaTime = time - lastTime;
        lastTime = time;

        updateFoliageAnimation(deltaTime);

        m4.yRotation(time * planet.data.rotationSpeed * 0.02 || 0, planetNode.localMatrix);
        m4.yRotation(time * star.data.orbitSpeed * -0.02 || 0, starOrbitNode.localMatrix);
        
        systemNode.updateWorldMatrix();
        
        const objectsToDraw = updateObjectsMatricesAndGetObjectsToDraw(viewProjectionMatrix);
    
        twgl.drawObjectList(gl, objectsToDraw);

        requestAnimationFrame(drawScene);
    }

    setupAllUI(planet, cameraData, stone, tree, star, {
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
        updateStarColor
    });

    requestAnimationFrame(drawScene);
}

main();