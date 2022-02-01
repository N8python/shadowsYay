import * as THREE from 'https://cdn.skypack.dev/pin/three@v0.137.0-X5O2PK3x44y1WRry67Kr/mode=imports/optimized/three.js';

import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/ShaderPass.js';
import { FilmPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/FilmPass.js';
import { SMAAPass } from 'https://unpkg.com/three@0.137.0/examples/jsm/postprocessing/SMAAPass.js';
import { FXAAShader } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/shaders/FXAAShader.js';
import { GammaCorrectionShader } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/TransformControls.js';
import * as BufferGeometryUtils from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/utils/BufferGeometryUtils.js';
import {
    MeshBVH,
    MeshBVHVisualizer,
    MeshBVHUniformStruct,
    FloatVertexAttributeTexture,
    shaderStructs,
    shaderIntersectFunction,
    SAH
} from './three-mesh-bvh.js';
import { AssetManager } from './AssetManager.js';
import Stats from "./stats.js";
import { ShadowShader } from "./ShadowShader.js";
import { ShadowCompositer } from "./ShadowCompositer.js";
import { GUI } from './dat.gui.min.js';
async function main() {
    let rWidth = window.innerWidth * 0.99;
    let rHeight = window.innerHeight * 0.98;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, rWidth / rHeight, 0.1, 1000);
    camera.position.set(62.5, 75, 0);
    const renderer = new THREE.WebGLRenderer({
        //antialias: true,
        //logarithmicDepthBuffer: true
        // outputEncoding: THREE.sRGBEncoding,
    });

    const texLoader = new THREE.TextureLoader();
    const groundGeo = new THREE.BoxGeometry(100, 1, 100);
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(1.0, 1.0, 1.0),
        side: THREE.DoubleSide,
    });
    const bvhScene = new THREE.Object3D();
    /* const ground = new THREE.Mesh(groundGeo, mat);
     bvhScene.add(ground);
     const torus = new THREE.Mesh(new THREE.TorusKnotGeometry(4, 1.2, 1000, 60), mat);
     torus.position.y = 25;
     torus.position.x = -10;
     torus.position.z = -10;
     bvhScene.add(torus);
     const torus2 = new THREE.Mesh(new THREE.TorusKnotGeometry(4, 1.2, 1000, 60), mat);
     torus2.position.y = 25;
     torus2.position.x = 10;
     torus2.position.z = -10;
     bvhScene.add(torus2);
     const torus3 = new THREE.Mesh(new THREE.TorusKnotGeometry(4, 1.2, 1000, 60), mat);
     torus3.position.y = 25;
     torus3.position.x = 10;
     torus3.position.z = 10;
     bvhScene.add(torus3);
     const torus4 = new THREE.Mesh(new THREE.TorusKnotGeometry(4, 1.2, 1000, 60), mat);
     torus4.position.y = 25;
     torus4.position.x = -10;
     torus4.position.z = 10;
     bvhScene.add(torus4);*/
    const sponza = (await AssetManager.loadGLTFAsync("sponza.glb")).scene;
    sponza.scale.set(10, 10, 10)
    bvhScene.add(sponza);
    scene.add(bvhScene);
    let geometries = [];
    bvhScene.traverse(object => {
        const cloned = new THREE.Mesh(object.geometry, object.material);
        object.getWorldPosition(cloned.position);
        if (object.geometry && object.visible) {
            const cloned = object.geometry.clone();
            cloned.applyMatrix4(object.matrixWorld);
            for (const key in cloned.attributes) {
                if (key !== 'position') { cloned.deleteAttribute(key); }
            }
            geometries.push(cloned);
        }
    });
    const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries, false);
    mergedGeometry.boundsTree = new MeshBVH(mergedGeometry, { lazyGeneration: false, strategy: SAH });
    const collider = new THREE.Mesh(mergedGeometry);
    collider.material.wireframe = true;
    collider.material.opacity = 0.5;
    collider.material.transparent = true;
    collider.visible = false;
    collider.boundsTree = mergedGeometry.boundsTree;
    scene.add(collider);

    const visualizer = new MeshBVHVisualizer(collider, 20);
    visualizer.visible = false;
    visualizer.update();
    scene.add(visualizer);
    const skyTex = texLoader.load("clouds.jpeg");
    skyTex.wrapS = THREE.RepeatWrapping;
    skyTex.wrapT = THREE.RepeatWrapping;
    skyTex.repeat.set(4, 4);
    const skysphere = new THREE.SphereGeometry(500, 32, 32);
    const skymat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 1.0, 1.0), side: THREE.DoubleSide, map: skyTex, depthWrite: false });
    const skydome = new THREE.Mesh(skysphere, skymat);
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.5);
    sunLight.color.setRGB(1.0, 1.0, 1.0);
    sunLight.position.set(30, 60, 30);
    const d = 12.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 1000;
    //scene.add(sunLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);
    scene.add(skydome);
    //renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setSize(rWidth, rHeight);
    document.body.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    //controls.enableDamping = true;
    //controls.dampingFactor = 0.05;
    controls.target.set(0, 50, 0);
    const transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.addEventListener('dragging-changed', function(event) {

        controls.enabled = !event.value;

    });
    scene.add(transformControl);
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    const defaultTexture = new THREE.WebGLRenderTarget(rWidth, rHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter
    });
    defaultTexture.depthTexture = new THREE.DepthTexture(rWidth, rHeight, THREE.FloatType);
    const composer = new EffectComposer(renderer);
    const smaaPass = new SMAAPass(rWidth, rHeight);
    const shadowPass = new ShaderPass(ShadowShader);
    shadowPass.uniforms.bvh.value.updateFrom(collider.boundsTree);
    const shadowCompositePass = new ShaderPass(ShadowCompositer);
    composer.addPass(shadowPass);
    composer.addPass(shadowCompositePass);
    composer.addPass(new ShaderPass(GammaCorrectionShader));
    composer.addPass(smaaPass);
    const light = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 1.0, 1.0) }));
    light.position.y = 50;
    scene.add(light);
    transformControl.attach(light);
    const effectController = {
        radius: 3.2,
        occlusionFalloff: 1,
        lightStrength: 0.85
    };
    const gui = new GUI();
    gui.add(effectController, "radius", 0, 10, 0.025).name("Radius");
    gui.add(effectController, "occlusionFalloff", 0, 1, 0.001).name("Light Occlusion");
    gui.add(effectController, 'lightStrength', 0, 1, 0.001).name("Light Strength");

    function animate() {
        renderer.setRenderTarget(defaultTexture);
        renderer.clear();
        renderer.render(scene, camera);
        shadowPass.uniforms["sceneDiffuse"].value = defaultTexture.texture;
        shadowPass.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
        camera.updateMatrixWorld();
        shadowPass.uniforms["projectionMatrixInv"].value = camera.projectionMatrixInverse;
        shadowPass.uniforms["viewMatrixInv"].value = camera.matrixWorld;
        shadowPass.uniforms["cameraPos"].value = camera.position;
        shadowPass.uniforms['resolution'].value = new THREE.Vector2(rWidth, rHeight);
        shadowPass.uniforms['lightPos'].value = light.position.clone();
        shadowPass.uniforms['time'].value = performance.now() / 1000;
        shadowCompositePass.uniforms["sceneDiffuse"].value = defaultTexture.texture;
        shadowCompositePass.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
        camera.updateMatrixWorld();
        shadowCompositePass.uniforms["projectionMatrixInv"].value = camera.projectionMatrixInverse;
        shadowCompositePass.uniforms["viewMatrixInv"].value = camera.matrixWorld;
        shadowCompositePass.uniforms["cameraPos"].value = camera.position;
        shadowCompositePass.uniforms['resolution'].value = new THREE.Vector2(rWidth, rHeight);
        shadowCompositePass.uniforms['lightPos'].value = light.position.clone();
        shadowCompositePass.uniforms['time'].value = performance.now() / 1000;
        shadowCompositePass.uniforms['radius'].value = effectController.radius;
        shadowCompositePass.uniforms['occlusionFalloff'].value = effectController.occlusionFalloff;
        shadowCompositePass.uniforms['lightStrength'].value = effectController.lightStrength;
        composer.render();
        controls.update();
        renderer.domElement.style.width = window.innerWidth * 0.99 + "px";
        renderer.domElement.style.height = window.innerHeight * 0.98 + "px";
        stats.update();
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}
main();