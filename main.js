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
            planetBufferInfo = twgl.createBufferInfoFromArrays(gl, planet.arrays);
            planetNode.drawInfo.uniforms = planet.uniforms;
            planetNode.drawInfo.bufferInfo = planetBufferInfo;
        }
    }
    
    updatePlanet();

    // webglLessonsUI.setupUI(document.querySelector("#ui-planet"), myPlanet.data, [
    //     { type: "slider", key: "resolution", change: updatePlanet, min: 10, max: 200, precision: 0 },
    //     { type: "slider", key: "divisions", change: updatePlanet, min: 10, max: 200, precision: 0 },
    //     { type: "slider", key: "radius", change: updatePlanet, min: 0.5, max: 5.0, precision: 2, step: 0.1 },
    //     { type: "slider", key: "noiseAmplitude", change: updatePlanet, min: 0.01, max: 3.0, precision: 2, step: 0.01 },
    //     // ... adicione os outros ...
    // ]);

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

        const rotationSpeed = 0.5;
        m4.yRotation(time * rotationSpeed, planetNode.localMatrix);

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