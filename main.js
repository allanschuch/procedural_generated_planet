"use strict";

function main() {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return;
    twgl.setDefaults({attribPrefix: "a_"});

    const noiseGen = new Noise();

    const planet = new Planet(noiseGen);

    const planetProgramInfo = twgl.createProgramInfo(gl, [Planet.vs, Planet.fs]);
    let planetBufferInfo = null;
    let planetVAO = null;
    const planetNode = new Node();
    planetNode.localMatrix = m4.identity();

    const objects = [planetNode];
    const objectsToDraw = [planetNode.drawInfo];

    function updatePlanet() {
        planet.update();
        if (!planetBufferInfo) {
            planetBufferInfo = twgl.createBufferInfoFromArrays(gl, planet.arrays);
            planetVAO = twgl.createVAOFromBufferInfo(gl, planetProgramInfo, planetBufferInfo);
            planetNode.drawInfo.vertexArray = planetVAO;
            planetNode.drawInfo.programInfo = planetProgramInfo;
            planetNode.drawInfo.uniforms = planet.uniforms;
            planetNode.drawInfo.bufferInfo = planetBufferInfo;
        } else {
            twgl.setAttribInfoBufferFromArray(gl, planetBufferInfo.attribs.a_position, planet.arrays.position);
            twgl.setAttribInfoBufferFromArray(gl, planetBufferInfo.attribs.a_normal, planet.arrays.normal);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planetBufferInfo.indices);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(planet.arrays.indices), gl.STATIC_DRAW);
            planetBufferInfo.numElements = planet.arrays.indices.length;

            planetNode.drawInfo.uniforms = planet.uniforms;
        }
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
        
        objects.forEach(object => {
            if (object.drawInfo) {
                object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
            }
        });
        
        // Função recursiva simples para coletar desenháveis
        // function collectDrawables(node) {
        //     if (node.drawInfo) {
        //         // Injeta a matriz final no uniforme
        //         node.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, node.worldMatrix);
        //         objectsToDraw.push(node.drawInfo);
        //     }
        //     node.children.forEach(collectDrawables);
        // }

        twgl.drawObjectList(gl, objectsToDraw);

        requestAnimationFrame(drawScene);
    }
    requestAnimationFrame(drawScene);
}

main();