# Procedural Planet Generator

This project was developed as an assignment for the **Computer Graphics** course in the **Computer Science** undergraduate program at **UFPEL** (Universidade Federal de Pelotas).

## About the Project

This is a WebGL2 application that generates a 3D procedural planet in real-time. Users can interact with a UI menu to customize the planet's generation and environment according to various parameters (such as noise amplitude, water/sand/rock altitudes, tree and stone density, colors, and the star's orbit speed).

Besides the procedural geometry generation, the project implements several core computer graphics concepts:
* **Lighting:** Spot lighting calculation using Lambertian reflectance and specular highlights.
* **Shadow Mapping:** Dynamic shadows projected by the orbiting star onto the planet and its objects.
* **Animations:** The star orbits the planet, the planet rotates, and the trees have a dynamic wind animation applied to their foliage.
* **Interaction (Mouse Picking):** Users can hover over objects (trees or stones) to highlight them and click to dynamically remove them from the scene.

## How to Run

This is a vanilla web application (HTML, CSS, JavaScript). You don't need to install Node.js, Webpack, or any complex build tools. 

However, to avoid standard browser security restrictions (CORS issues) with WebGL, it is highly recommended to serve the files through a local web server rather than just double-clicking the `index.html` file.

### Option 1: VS Code Live Server (Recommended)
1. Open the project folder in **Visual Studio Code**.
2. Install the **Live Server** extension.
3. Right-click the `index.html` file and select **"Open with Live Server"**.
4. Your default browser will open automatically with the project running.

### Option 2: Python Local Server
If you have Python installed on your machine, you can easily spin up a local server:
1. Open your terminal and navigate to the project folder.
2. Run the following command:
   ```bash
   python -m http.server