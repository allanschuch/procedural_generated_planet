"use strict";

function setupUI(planet, cameraData, stone, tree, star, callbacks) {
    
    const { 
        updatePlanet, 
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
    } = callbacks;

    webglLessonsUI.setupUI(document.querySelector("#ui-planet"), planet.data, [
        { type: "slider", key: "resolution", change: updatePlanet, min: 3, max: 200, precision: 0, name: "Resolution" },
        { type: "slider", key: "divisions", change: updatePlanet, min: 3, max: 200, precision: 0, name: "Divisions" },
        { type: "slider", key: "radius", change: updatePlanet, min: 0.5, max: 5.0, precision: 1, step: 0.1, name: "Radius" },
        { type: "slider", key: "rotationSpeed", min: 0, max: 100, precision: 0, name: "Rotation Speed" },
        
        { type: "option", key: "noiseType", change: updatePlanet, options: ["Perlin", "Random", "Voronoi Peak", "Voronoi Valley"], name: "Noise Type" },
        { type: "slider", key: "noiseFrequency", change: updatePlanet, min: 0.1, max: 10.0, precision: 2, step: 0.05, name: "Frequency" },
        { type: "slider", key: "noiseAmplitude", change: updatePlanet, min: 0.01, max: 3.0, precision: 2, step: 0.01, name: "Amplitude" },
        { type: "slider", key: "numberOfNoiseOctaves", change: updatePlanet, min: 1, max: 5, precision: 0, name: "Octaves" },
        { type: "slider", key: "noisePersistence", change: updateNoisePersistence || updatePlanet, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Persistence" },
        
        { type: "slider", key: "waterAltitude", change: updatePlanet, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Water Altitude" },
        { type: "slider", key: "grassAltitude", change: updatePlanet, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Grass Altitude" },
        { type: "slider", key: "rockAltitude", change: updatePlanet, min: 0.0, max: 1.0, precision: 2, step: 0.01, name: "Rock Altitude" },

        { type: "color", key: "waterColor", change: updatePlanetColor, name: "Water Color" },
        { type: "color", key: "sandColor", change: updatePlanetColor, name: "Sand Color" },
        { type: "color", key: "grassColor", change: updatePlanetColor, name: "Grass Color" },
        { type: "color", key: "rockColor", change: updatePlanetColor, name: "Rock Color" },
        { type: "color", key: "tempSnowColor", change: updatePlanetSnowColor, name: "Snow Color" },
    ]);

    webglLessonsUI.setupUI(document.querySelector("#ui-camera"), cameraData, [
        { type: "slider", key: "zoom", min: 1, max: 30, precision: 1, step: 0.1, name: "Zoom" },
        { type: "slider", key: "fov", min: 10, max: 120, precision: 0, name: "Field of View" },
        { type: "slider", key: "angle", min: -180, max: 180, precision: 0, name: "Angle" },
        { type: "slider", key: "height", min: -20, max: 20, precision: 1, step: 0.1, name: "Height" },
        { type: "slider", key: "nearPlane", min: 0.01, max: 1, precision: 2, step: 0.01, name: "Near Plane" },
        { type: "slider", key: "farPlane", min: 50, max: 200, precision: 0, step: 1, name: "Far Plane" },
    ]);

    webglLessonsUI.setupUI(document.querySelector("#ui-stones"), stone.data, [
        { type: "slider", key: "tempScale", change: updateStoneScale, min: 0.1, max: 3.0, precision: 2, step: 0.01, name: "Scale" },
        { type: "slider", key: "numberOf", change: updateStonesPlacement, min: 0, max: 500, precision: 0, name: "Count" },
        { type: "slider", key: "minDistanceBetweenObjects", change: updateStonesPlacement, min: 0.01, max: 1.0, precision: 2, step: 0.01, name: "Spacing" },
        { type: "color", key: "stoneNormalColor", change: updateStoneColor, name: "Color" },
        { type: "color", key: "tempStoneIceColor", change: updateStoneColor, name: "Ice Color" },
    ]);

    webglLessonsUI.setupUI(document.querySelector("#ui-trees"), tree.data, [
        { type: "slider", key: "tempScale", change: updateTreeScale, min: 0.1, max: 3.0, precision: 2, step: 0.01, name: "Scale" },
        { type: "slider", key: "numberOf", change: updateTreesPlacement, min: 0, max: 300, precision: 0, name: "Count" },
        { type: "slider", key: "minDistanceBetweenObjects", change: updateTreesPlacement, min: 0.01, max: 2.0, precision: 2, step: 0.01, name: "Spacing" },
        { type: "slider", key: "windSpeed", min: 0, max: 200, precision: 0, step: 1, name: "Wind Speed" },
        { type: "color", key: "foliageNormalColor1", change: updateTreeColor, name: "Foliage Color 1" },
        { type: "color", key: "foliageNormalColor2", change: updateTreeColor, name: "Foliage Color 2" },
        { type: "color", key: "foliageNormalColor3", change: updateTreeColor, name: "Foliage Color 3" },
    ]);

    webglLessonsUI.setupUI(document.querySelector("#ui-star"), star.data, [
        { type: "slider", key: "distanceFromPlanetFactor", change: updateStar, min: 0.1, max: 3.0, precision: 2, step: 0.1, name: "Distance" },
        { type: "slider", key: "orbitSpeed", min: 0, max: 100, precision: 0, name: "Orbit Speed" },
        { type: "slider", key: "generalShininessFactor", change: updateLight, min: 0.01, max: 3, precision: 2, step: 0.01, name: "Shininess Scale" },
        { type: "color", key: "color", change: updateStarColor, name: "Color" },
        { type: "slider", key: "lightLimitAngle", min: 0, max: 180, precision: 0, step: 1, name: "Light Angle" },
        { type: "slider", key: "shadowLightFOV", min: 11, max: 180, precision: 0, step: 1, name: "ShadowMap FOV" },
    ]);
}