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

    const StoneProgramInfo = twgl.createProgramInfo(gl, [Stone.vs, Stone.fs]);
    const stoneArrays = stone.getStoneArrays(planet.data.radius);
    let stoneBufferInfo = twgl.createBufferInfoFromArrays(gl, stoneArrays);
    let stoneVAO = twgl.createVAOFromBufferInfo(gl, StoneProgramInfo, stoneBufferInfo);

    // TREES CONFIG

    const tree = new Tree();
    const treeProgramInfo = twgl.createProgramInfo(gl, [Tree.vs, Tree.fs]);
    const trunkArrays = tree.getTrunkArrays(planet.data.radius);
    const foliageArrays = tree.getFoliageArrays(planet.data.radius);
    let trunkBufferInfo = twgl.createBufferInfoFromArrays(gl, trunkArrays);
    let foliageBufferInfo = twgl.createBufferInfoFromArrays(gl, foliageArrays);
    let trunkVAO = twgl.createVAOFromBufferInfo(gl, treeProgramInfo, trunkBufferInfo);
    let foliageVAO = twgl.createVAOFromBufferInfo(gl, treeProgramInfo, foliageBufferInfo);

    let objects = {
        planets: [planetNode],
        stones: [],
        trees: []
    }

    function updateStoneScale(){
        const newScaleFactor = stone.data.tempStoneScale;
        const previousScaleFactor = stone.data.stoneScale;
        stone.data.stoneScale = newScaleFactor;     
        const scaleRatio = newScaleFactor / previousScaleFactor;
        objects.stones.forEach(stoneNode => {
            stoneNode.localMatrix = m4.scale(stoneNode.localMatrix, scaleRatio, scaleRatio, scaleRatio);
        });
    }

    function updateTreeScale(){
        const newScaleFactor = tree.data.tempTreeScale;
        const previousScaleFactor = tree.data.treeScale;
        tree.data.treeScale = newScaleFactor;     
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

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function generateRandomPositions(maxTries, minDistanceBetweenStones, minAltitudeFactor = 0.01, maxAltitudeFactor = 1.0) {
        const positions = [];
        const planetMinRadius = planet.data.radius - planet.data.noiseAmplitude;
        const planetMaxRadius = planet.data.radius + planet.data.noiseAmplitude;
        const minAltitude = lerp(planetMinRadius, planetMaxRadius, minAltitudeFactor);
        const maxAltitude = lerp(planetMinRadius, planetMaxRadius, maxAltitudeFactor);
        let tries = 0;
        for (let i = 0; i < stone.data.numberOfStones; ) {
            tries++;
            if (tries > maxTries) break;
            const position = getRandomPositionOnPlanetSurface();
            const positionAltitude = twgl.v3.length(position);
            if (positionAltitude > minAltitude && positionAltitude < maxAltitude) {
                if (positions.every(existingPosition => {
                    const distance = twgl.v3.distance(existingPosition, position);
                    return distance >= minDistanceBetweenStones * planet.data.radius * 0.25;
                })) {
                    positions.push(position);
                    i++;
                }
            }
        }
        return positions;
    }

    function updateObjectsPlacement() {
        objects.stones.forEach(stone => stone.setParent(null));
        objects.stones = [];
        const planetNode = objects.planets[0];
        
        const stonePositions = generateRandomPositions(1000, stone.data.minDistanceBetweenStones, planet.data.waterAltitude, 1.0);
        console.log(`Generated ${stonePositions.length} stones.`);
        
        objects.stones = stonePositions.map(position => {
            const stoneNode = new Node();
            stoneNode.setParent(planetNode);
            stoneNode.drawInfo = {
                vertexArray: stoneVAO,       
                programInfo: StoneProgramInfo, 
                bufferInfo: stoneBufferInfo,
                uniforms: {
                    u_colorStone: stone.data.color
                },
            };

            const normal = twgl.v3.normalize(position);
            const look = m4.lookAt([0,0,0], normal, [0,1,0]);
            const rotationMatrix = m4.inverse(look);
            const translationMatrix = m4.translation(position[0], position[1], position[2]);
            let localMatrix = m4.multiply(translationMatrix, rotationMatrix);
            const scaleFactor = stone.getRandomScaleFactor() * stone.data.stoneScale;
            localMatrix = m4.scale(localMatrix, scaleFactor, scaleFactor, scaleFactor);

            stoneNode.localMatrix = localMatrix;

        return stoneNode;
        });
    }
            

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
    updateObjectsPlacement();

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
        { type: "slider", key: "tempStoneScale", change: updateStoneScale, min: 0.1, max: 3.0, precision: 2, step: 0.01, name: "Stone Scale" },
        { type: "slider", key: "numberOfStones", change: updateObjectsPlacement, min: 1, max: 500, precision: 0, name: "Number of Stones" },
        { type: "slider", key: "minDistanceBetweenStones", change: updateObjectsPlacement, min: 0.01, max: 1.0, precision: 2, step: 0.01, name: "Min Distance Between Stones" },
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