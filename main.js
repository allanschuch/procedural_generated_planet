"use strict";

// --- SHADERS ---
const vs = `#version 300 es
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

const fs = `#version 300 es
precision highp float;

in vec3 v_normal;
in float v_height;

out vec4 out_color;

uniform sampler2D u_texture;

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

function main() {
  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) return;

  twgl.setDefaults({attribPrefix: "a_"});

  // --- ESTRUTURA DE DADOS DO PLANETA ---
  // Aqui ficarão todos os controles da nossa geração procedural
  const planetSphereData = {
    // Parâmetros da Malha (Sessão 1)
    resolution: 100,    // Pontos verticais (perfil)
    divisions: 100,     // Pontos horizontais (fatias)
    radius: 1.0,        // Raio da esfera
    // Parâmetros de Animação
    rotatingSpeed: 50, // Velocidade de rotação
    // Parâmetros do Terreno
    noiseType: 0,
    noiseFrequency: 1.0,
    noiseAmplitude: 0.2,
    numberOfNoiseOctaves: 1,
    noisePersistence: 0.5,
    waterAltitude: 0.35,
    grassAltitude: 0.6,
    rockAltitude: 0.75
  };

  const noiseTypeMap = [
  "octavePerlin", 
  "octaveRandom",
  "octaveVoronoiPeak",
  "octaveVoronoiValley"
];

  const cameraData = {
    radius: 7.5,
    fov: 45,
  };

  const noise = new Noise();

  const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  // const texInfo = loadImageAndCreateTextureInfo("https://webgl2fundamentals.org/webgl/resources/uv-grid.png", render);

  let projectionMatrix;
  let bufferInfo;
  let vao;

  // --- FUNÇÃO LATHE (Gira o perfil para criar 3D) ---
  function lathePoints(points,
                       startAngle,   
                       endAngle,     
                       numDivisions, 
                       capStart,     
                       capEnd) {     
    const positions = [];
    // const texcoords = [];
    const normals = [];
    const indices = [];

    const vOffset = capStart ? 1 : 0;
    const pointsPerColumn = points.length + vOffset + (capEnd ? 1 : 0);
    const quadsDown = pointsPerColumn - 1;

    for (let division = 0; division <= numDivisions; ++division) {
      const u = division / numDivisions;
      const angle = lerp(startAngle, endAngle, u);
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

  // --- GERA PERFIL DA ESFERA ---
  function getSpherePoints(numPoints) {
      const points = [];
      for (let i = 0; i < numPoints; i++) {
          const t = i / (numPoints - 1);
          const angle = (Math.PI / 2) - (t * Math.PI); 
          const x = Math.cos(angle) * planetSphereData.radius;
          const y = Math.sin(angle) * planetSphereData.radius;
          points.push([x, y]);
      }
      return points;
  }

  function applyNoiseToSphere(positions, octaves = 1, frequency = 1.0, persistence = 0.5) { 
    for (let i = 0; i < positions.length; i = i + 3) {
      const position = [positions[i], positions[i + 1], positions[i + 2]];
      const normal = twgl.v3.normalize(position);
      const calculatedNoise = noise.calcNoise(
        noiseTypeMap[planetSphereData.noiseType],
        position[0],
        position[1],
        position[2],
        frequency,
        octaves,
        persistence
      );
      const newRadius = planetSphereData.radius + calculatedNoise * planetSphereData.noiseAmplitude;
      positions[i] = normal[0] * newRadius;
      positions[i + 1] = normal[1] * newRadius;
      positions[i + 2] = normal[2] * newRadius;
    }
    return positions;
  }

  // --- UPDATE: Usa planetSphereData ---
  function update() {
    // Acessando os parâmetros do nosso objeto organizado
    const curvePoints = getSpherePoints(planetSphereData.resolution);
    
    const arrays = lathePoints(
        curvePoints, 
        0, 
        Math.PI * 2, 
        planetSphereData.divisions, 
        true, 
        true
    );

    arrays.position = applyNoiseToSphere(arrays.position, planetSphereData.numberOfNoiseOctaves, planetSphereData.noiseFrequency, planetSphereData.noisePersistence);
    
    if (!bufferInfo) {
      bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
      vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);
    } else {
      twgl.setAttribInfoBufferFromArray(gl, bufferInfo.attribs.a_position, arrays.position);
      twgl.setAttribInfoBufferFromArray(gl, bufferInfo.attribs.a_texcoord, arrays.texcoord);
      twgl.setAttribInfoBufferFromArray(gl, bufferInfo.attribs.a_normal, arrays.normal);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferInfo.indices);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(arrays.indices), gl.STATIC_DRAW);
      bufferInfo.numElements = arrays.indices.length;
    }
    render();
  }

  function setCameraMatrix() {
    const fov = cameraData.fov * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    projectionMatrix = m4.perspective(fov, aspect, 0.1, 100);

    const cameraRadius = cameraData.radius;
    const cameraPosition = [0, 0, cameraRadius];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    return m4.lookAt(cameraPosition, target, up);
  }

  function lerpAltitude(a, b, t) {
    return a + (b - a) * t;
  }

  function getTerrainColorAltitude() {
    const maxAltitude = planetSphereData.radius + planetSphereData.noiseAmplitude;
    const minAltitude = planetSphereData.radius - planetSphereData.noiseAmplitude;
    const waterAltitude = lerpAltitude(minAltitude, maxAltitude, planetSphereData.waterAltitude);
    const grassAltitude = lerpAltitude(minAltitude, maxAltitude, planetSphereData.grassAltitude);
    const rockAltitude = lerpAltitude(minAltitude, maxAltitude, planetSphereData.rockAltitude);
    return {
      water: waterAltitude,
      grass: grassAltitude,
      rock: rockAltitude
    };
  }

  function render(time) {
    if(time) time *= 0.001;
    
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const cameraMatrix = setCameraMatrix();
    const viewMatrix = m4.inverse(cameraMatrix);
    const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    let currentWorldMatrix = m4.yRotation(time * planetSphereData.rotatingSpeed * 0.02 || 0);

    gl.useProgram(programInfo.program);
    gl.bindVertexArray(vao);

    const terrainColorAltitude = getTerrainColorAltitude();

    twgl.setUniforms(programInfo, {
      u_matrix: m4.multiply(viewProjectionMatrix, currentWorldMatrix),
      // u_texture: texInfo.texture,

      u_waterAltitude: terrainColorAltitude.water,
      u_grassAltitude: terrainColorAltitude.grass,
      u_rockAltitude: terrainColorAltitude.rock,

      u_colorWater: [0.0, 0.0, 1.0, 1.0],
      u_colorSand: [0.76, 0.7, 0.5, 1.0],
      u_colorGrass: [0.0, 1.0, 0.0, 1.0],
      u_colorRock: [0.5, 0.5, 0.5, 1.0],
      u_colorSnow: [1.0, 1.0, 1.0, 1.0]
    });

    twgl.drawBufferInfo(gl, bufferInfo);
    
    requestAnimationFrame(render);
  }

  // --- UI: Conectada ao planetSphereData ---
  webglLessonsUI.setupUI(document.querySelector("#ui-planet"), planetSphereData, [
    { type: "slider", key: "resolution", change: update, min: 5, max: 300, precision: 0, name: "Resolution" },
    { type: "slider", key: "divisions", change: update, min: 3, max: 300, precision: 0, name: "Divisions" },
    { type: "slider", key: "radius", change: update, min: 0.5, max: 5.0, precision: 2, step: 0.1, name: "Radius" },
    { type: "slider", key: "rotatingSpeed", change: update, min: 1, max: 200, precision: 0, name: "Rotating Speed" },
    { type: "slider", key: "noiseType", change: update, min: 0, max: 3, precision: 0, step: 1, name: "Noise Type" },
    { type: "slider", key: "noiseFrequency", change: update, min: 0.1, max: 10.0, precision: 2, step: 0.05, name: "Noise Frequency" },
    { type: "slider", key: "noiseAmplitude", change: update, min: 0.01, max: 3.0, precision: 2, step: 0.01, name: "Noise Amplitude" },
    { type: "slider", key: "numberOfNoiseOctaves", change: update, min: 1, max: 5, precision: 0, name: "Number of Noise Octaves" },
    { type: "slider", key: "noisePersistence", change: update, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Noise Persistence" },
    { type: "slider", key: "waterAltitude", change: update, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Water Altitude" },
    { type: "slider", key: "grassAltitude", change: update, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Grass Altitude" },
    { type: "slider", key: "rockAltitude", change: update, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Rock Altitude" },
  ]);

  webglLessonsUI.setupUI(document.querySelector("#ui-camera"), cameraData, [
    { type: "slider", key: "radius", change: update, min: 2, max: 20, precision: 1, step: 0.1, name: "Camera Radius" },
    { type: "slider", key: "fov", change: update, min: 10, max: 120, precision: 0, name: "Field of View" },
  ]);
  
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  update();
}

main();