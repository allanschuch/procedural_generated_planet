"use strict";

function main() {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return;
    twgl.setDefaults({attribPrefix: "a_"});

    // PLANET CONFIG

    const planet = new Planet();

    const planetProgramInfo = twgl.createProgramInfo(gl, [Planet.vs, Planet.fs]);
    let planetBufferInfo = null;
    let planetVAO = null;
    const planetNode = new Node();
    planetNode.localMatrix = m4.identity();

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

    let objects = {
        planets: [planetNode],
        stones: [],
        trees: [],
        trunks: [],
        foliages: []
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
            const stoneColor = stoneAltitude > rockAltitude ? stone.data.stoneIceColor : stone.data.stoneNormalColor;
            stoneNode.drawInfo = {
                vertexArray: stoneVAO,       
                programInfo: stoneProgramInfo,
                bufferInfo: stoneBufferInfo,
                uniforms: {
                    u_color: stoneColor
                },
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

    function generateTree(treeNode, position){
        const treeAltitude = twgl.v3.length(position);
        const rockAltitude = planet.getAltitude(planet.data.rockAltitude);
        let foliageColor;
        if (treeAltitude > rockAltitude) {
            foliageColor = tree.data.foliageIceColor;
        } else {
            const randomIndex = Math.floor(Math.random() * 3)
            foliageColor = tree.data.foliageNormalColor[randomIndex];
        }

        const trunkNode = new Node();
        trunkNode.setParent(treeNode);
        trunkNode.drawInfo = {
            vertexArray: trunkVAO,
            programInfo: treeProgramInfo,
            bufferInfo: trunkBufferInfo,
            uniforms: {
                u_color: tree.data.trunkColor
            },
        };

        trunkNode.localMatrix = m4.identity();

        objects.trunks.push(trunkNode);

        const foliageNode = new Node();
        foliageNode.setParent(treeNode);
        foliageNode.drawInfo = {
            vertexArray: foliageVAO,
            programInfo: treeProgramInfo,
            bufferInfo: foliageBufferInfo,
            uniforms: {
                u_color: foliageColor
            },
        };

        foliageNode.localMatrix = m4.translation(0, tree.data.trunkHeight * 1.5, 0);

        objects.foliages.push(foliageNode);
    }
    

    function updateTreesPlacement() {
        objects.trees.forEach(tree => {
            tree.children.forEach(child => child.setParent(null));
            tree.setParent(null);
        });

        objects.trees = [];
        objects.trunks = [];
        objects.foliages = [];

        const planetNode = objects.planets[0];
        
        const treePositions = generateRandomPositions(tree.data.numberOf, 1000, tree.data.minDistanceBetweenObjects, planet.data.waterAltitude, 1.0);
        console.log(`Generated ${treePositions.length} trees.`);
        
        objects.trees = treePositions.map(position => {
            const treeNode = new Node();
            treeNode.setParent(planetNode);
            generateTree(treeNode, position);

            const normal = twgl.v3.normalize(position);
            const up = [0, 1, 0];
            let axis = twgl.v3.cross(up, normal);
            const axisLen = twgl.v3.length(axis);

            let rotationMatrix = m4.identity();

            if (axisLen > 1e-5) {
                axis = twgl.v3.normalize(axis);
                const dot = twgl.v3.dot(up, normal);
                const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
                rotationMatrix = m4.axisRotate(rotationMatrix, axis, angle);
            }

            // TRS
            const translationMatrix = m4.translation(
                position[0],
                position[1],
                position[2]
            );

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
        

    // function updateObjectsPlacement() {
    //     objects.stones.forEach(stone => stone.setParent(null));
    //     objects.stones = [];
    //     const planetNode = objects.planets[0];
        
    //     const stonePositions = generateRandomPositions(stone.data.numberOf, 1000, stone.data.minDistanceBetweenObjects, planet.data.waterAltitude, 1.0);
    //     console.log(`Generated ${stonePositions.length} stones.`);
        
    //     objects.stones = stonePositions.map(position => {
    //         const stoneNode = new Node();
    //         stoneNode.setParent(planetNode);
    //         stoneNode.drawInfo = {
    //             vertexArray: stoneVAO,       
    //             programInfo: stoneProgramInfo,
    //             bufferInfo: stoneBufferInfo,
    //             uniforms: {
    //                 u_color: stone.data.color
    //             },
    //         };

    //         const normal = twgl.v3.normalize(position);
    //         const look = m4.lookAt([0,0,0], normal, [0,1,0]);
    //         const rotationMatrix = m4.inverse(look);
    //         const translationMatrix = m4.translation(position[0], position[1], position[2]);
    //         let localMatrix = m4.multiply(translationMatrix, rotationMatrix);
    //         const scaleFactor = stone.getRandomScaleFactor() * stone.data.scale;
    //         localMatrix = m4.scale(localMatrix, scaleFactor, scaleFactor, scaleFactor);

    //         stoneNode.localMatrix = localMatrix;

    //          return stoneNode;
    //     });
    // }
            

    function updatePlanet() {
        planet.update();
        if (!planetBufferInfo) {
            planetBufferInfo = twgl.createBufferInfoFromArrays(gl, planet.planetArrays);
            planetVAO = twgl.createVAOFromBufferInfo(gl, planetProgramInfo, planetBufferInfo);
            planetNode.drawInfo.vertexArray = planetVAO;
            planetNode.drawInfo.programInfo = planetProgramInfo;
            planetNode.drawInfo.uniforms = planet.uniforms;
            planetNode.drawInfo.bufferInfo = planetBufferInfo;
        } else {
            twgl.setAttribInfoBufferFromArray(gl, planetBufferInfo.attribs.a_position, planet.planetArrays.position);
            twgl.setAttribInfoBufferFromArray(gl, planetBufferInfo.attribs.a_normal, planet.planetArrays.normal);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planetBufferInfo.indices);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(planet.planetArrays.indices), gl.STATIC_DRAW);
            planetBufferInfo.numElements = planet.planetArrays.indices.length;

            planetNode.drawInfo.uniforms = planet.uniforms;
        }
        updateObjectsPlacement();
    }
    
    updatePlanet();

    const cameraData = { radius: 7.5, fov: 45 };

    function setCameraMatrix() {
        const cameraRadius = cameraData.radius;
        const cameraPosition = [0, 0, cameraRadius];
        const target = [0, 0, 0];
        const up = [0, 1, 0];
        return m4.lookAt(cameraPosition, target, up);
    }

    function setProjectionMatrix() {
        const fov = cameraData.fov * Math.PI / 180;
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        return m4.perspective(fov, aspect, 0.1, 100);
    }

    webglLessonsUI.setupUI(document.querySelector("#ui-planet"), planet.data, [
        { type: "slider", key: "resolution", change: updatePlanet, min: 3, max: 300, precision: 0, name: "Resolution" },
        { type: "slider", key: "divisions", change: updatePlanet, min: 3, max: 300, precision: 0, name: "Divisions" },
        { type: "slider", key: "radius", change: updatePlanet, min: 0.5, max: 5.0, precision: 2, step: 0.1, name: "Radius" },
        { type: "slider", key: "rotatingSpeed", change: updatePlanet, min: 1, max: 200, precision: 0, name: "Rotating Speed" },
        { type: "slider", key: "noiseType", change: updatePlanet, min: 0, max: 3, precision: 0, step: 1, name: "Noise Type" },
        { type: "slider", key: "noiseFrequency", change: updatePlanet, min: 0.1, max: 10.0, precision: 2, step: 0.05, name: "Noise Frequency" },
        { type: "slider", key: "noiseAmplitude", change: updatePlanet, min: 0.01, max: 3.0, precision: 2, step: 0.01, name: "Noise Amplitude" },
        { type: "slider", key: "numberOfNoiseOctaves", change: updatePlanet, min: 1, max: 5, precision: 0, name: "Number of Noise Octaves" },
        { type: "slider", key: "noisePersistence", change: updatePlanet, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Noise Persistence" },
        { type: "slider", key: "waterAltitude", change: updatePlanet, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Water Altitude" },
        { type: "slider", key: "grassAltitude", change: updatePlanet, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Grass Altitude" },
        { type: "slider", key: "rockAltitude", change: updatePlanet, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Rock Altitude" },
    ]);

    webglLessonsUI.setupUI(document.querySelector("#ui-camera"), cameraData, [
        { type: "slider", key: "radius", change: drawScene, min: 2, max: 20, precision: 1, step: 0.1, name: "Camera Radius" },
        { type: "slider", key: "fov", change: drawScene, min: 10, max: 120, precision: 0, name: "Field of View" },
    ]);

    webglLessonsUI.setupUI(document.querySelector("#ui-stones"), stone.data, [
        { type: "slider", key: "tempScale", change: updateStoneScale, min: 0.1, max: 3.0, precision: 2, step: 0.01, name: "Stone Scale" },
        { type: "slider", key: "numberOf", change: updateStonesPlacement, min: 1, max: 500, precision: 0, name: "Number of Stones" },
        { type: "slider", key: "minDistanceBetweenObjects", change: updateStonesPlacement, min: 0.01, max: 1.0, precision: 2, step: 0.01, name: "Min Distance Between Stones" },
    ]);

    webglLessonsUI.setupUI(document.querySelector("#ui-trees"), tree.data, [
        { type: "slider", key: "tempScale", change: updateTreeScale, min: 0.1, max: 3.0, precision: 2, step: 0.01, name: "Tree Scale" },
        { type: "slider", key: "numberOf", change: updateTreesPlacement, min: 1, max: 300, precision: 0, name: "Number of Trees" },
        { type: "slider", key: "minDistanceBetweenObjects", change: updateTreesPlacement, min: 0.01, max: 2.0, precision: 2, step: 0.01, name: "Min Distance Between Trees" },
    ]);

    function updateObjects_u_matrixAndGetObjectsToDraw(viewProjectionMatrix) {
        const drawables = [];
        objects.planets.forEach(planet => {
            if (planet.drawInfo) {
                planet.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, planet.worldMatrix);
                drawables.push(planet.drawInfo);
            }
        });
        objects.stones.forEach(stone => {
            if (stone.drawInfo) {
                stone.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, stone.worldMatrix);
                drawables.push(stone.drawInfo);
            }
        });
        objects.trunks.forEach(trunk => {
            if (trunk.drawInfo) {
                trunk.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, trunk.worldMatrix);
                drawables.push(trunk.drawInfo);
            }
        });
        objects.foliages.forEach(foliage => {
            if (foliage.drawInfo) {
                foliage.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, foliage.worldMatrix);
                drawables.push(foliage.drawInfo);
            }
        });
        return drawables;
    }

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

        m4.yRotation(time * planet.data.rotatingSpeed * 0.02 || 0, planetNode.localMatrix);
        
        planetNode.updateWorldMatrix();
        
        const objectsToDraw = updateObjects_u_matrixAndGetObjectsToDraw(viewProjectionMatrix);
    
        twgl.drawObjectList(gl, objectsToDraw);

        requestAnimationFrame(drawScene);
    }
    requestAnimationFrame(drawScene);
}

main();