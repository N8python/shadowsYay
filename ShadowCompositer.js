import {
    MeshBVH,
    MeshBVHVisualizer,
    MeshBVHUniformStruct,
    FloatVertexAttributeTexture,
    shaderStructs,
    shaderIntersectFunction,
    SAH
} from './three-mesh-bvh.js';
import * as THREE from 'https://cdn.skypack.dev/pin/three@v0.137.0-X5O2PK3x44y1WRry67Kr/mode=imports/optimized/three.js';
var ShadowCompositer = {

    uniforms: {

        'sceneDiffuse': { value: null },
        'sceneDepth': { value: null },
        'tDiffuse': { value: null },
        'projectionMatrixInv': { value: new THREE.Matrix4() },
        'viewMatrixInv': { value: new THREE.Matrix4() },
        'bvh': { value: new MeshBVHUniformStruct() },
        'cameraPos': { value: new THREE.Vector3() },
        'resolution': { value: new THREE.Vector2() },
        'lightPos': { value: new THREE.Vector3(30.0, 60.0, 30.0) },
        'time': { value: 0.0 },
        'radius': { value: 0.0 },
        'occlusionFalloff': { value: 0.0 },
        'lightStrength': { value: 0.0 }
    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
    precision highp isampler2D;
    precision highp usampler2D;
		uniform sampler2D sceneDiffuse;
        uniform sampler2D sceneDepth;
        uniform sampler2D tDiffuse;
        uniform float time;
        ${ shaderStructs }
        ${ shaderIntersectFunction }
        uniform mat4 projectionMatrixInv;
        uniform mat4 viewMatrixInv;
		varying vec2 vUv;
        uniform BVH bvh;
        uniform vec3 cameraPos;
        uniform vec2 resolution;
        uniform vec3 lightPos;
        uniform float radius;
        uniform float occlusionFalloff;
        uniform float lightStrength;
        vec3 WorldPosFromDepth(float depth, vec2 coord) {
            float z = depth * 2.0 - 1.0;
            vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
            vec4 viewSpacePosition = projectionMatrixInv * clipSpacePosition;
            // Perspective division
            viewSpacePosition /= viewSpacePosition.w;
            vec4 worldSpacePosition = viewMatrixInv * viewSpacePosition;
            return worldSpacePosition.xyz;
        }
        vec3 computeNormal(vec3 worldPos, vec2 vUv) {
			vec2 downUv = vUv + vec2(0.0, 1.0 / (resolution.y * 1.0));
			vec3 downPos = WorldPosFromDepth( texture2D(sceneDepth, downUv).x, downUv);
			vec2 rightUv = vUv + vec2(1.0 / (resolution.x * 1.0), 0.0);;
			vec3 rightPos = WorldPosFromDepth(texture2D(sceneDepth, rightUv).x, rightUv);
			vec2 upUv = vUv - vec2(0.0, 1.0 / (resolution.y * 0.01));
			vec3 upPos = WorldPosFromDepth(texture2D(sceneDepth, upUv).x, upUv);
			vec2 leftUv = vUv - vec2(1.0 / (resolution.x * 1.0), 0.0);;
			vec3 leftPos = WorldPosFromDepth(texture2D(sceneDepth, leftUv).x, leftUv);
			int hChoice;
			int vChoice;
			if (length(leftPos - worldPos) < length(rightPos - worldPos)) {
			  hChoice = 0;
			} else {
			  hChoice = 1;
			}
			if (length(upPos - worldPos) < length(downPos - worldPos)) {
			  vChoice = 0;
			} else {
			  vChoice = 1;
			}
			vec3 hVec;
			vec3 vVec;
			if (hChoice == 0 && vChoice == 0) {
			  hVec = leftPos - worldPos;
			  vVec = upPos - worldPos;
			} else if (hChoice == 0 && vChoice == 1) {
			  hVec = leftPos - worldPos;
			  vVec = worldPos - downPos;
			} else if (hChoice == 1 && vChoice == 1) {
			  hVec = rightPos - worldPos;
			  vVec = downPos - worldPos;
			} else if (hChoice == 1 && vChoice == 0) {
			  hVec = rightPos - worldPos;
			  vVec = worldPos - upPos;
			}
			return normalize(cross(hVec, vVec));
		  }
          float rand(vec2 n) { 
            return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
          }
          float linearize_depth(float d,float zNear,float zFar)
          {
              return zNear * zFar / (zFar + d * (zNear - zFar));
          }        
		void main() {
			vec4 texel = texture2D( sceneDiffuse, vUv );
            float shadow = texture2D( tDiffuse, vUv ).x;
            float depth = texture2D(sceneDepth, vUv).x;
            vec3 worldPos = WorldPosFromDepth(depth, vUv);
            vec3 normal = computeNormal(worldPos, vUv);
            gl_FragColor = texel;
            vec3 toLight = normalize(vec3(lightPos) - worldPos);
            float samplerRadius = shadow;
            const float directions = 16.0;
            const float quality = 6.0;
            float occlusion  = texture2D( tDiffuse, vUv ).x;
            float size = (radius * 1000.0) * mix(1.0, occlusion, occlusionFalloff)  * (1.0 - depth);
            const float pi = 3.14159;
            vec2 radius = size/resolution;
            float occluded = 0.0;
            float count = 0.0;
            for(float d =0.0; d < pi * 2.0; d+=(pi * 2.0) / directions) {
                for(float i = 1.0/quality; i<=1.0; i+=1.0/quality) {
                    occluded += texture2D(tDiffuse, vUv+vec2(cos(d), sin(d)) * radius * i).x < 1.0 ? 1.0 : 0.0;
                    count += 1.0;
                }
            }
            occluded /= count;
            gl_FragColor.xyz *=  (1.0 - lightStrength) + lightStrength *(1.0 - occluded)* max(dot(toLight, normal), 0.0);
            //gl_FragColor.xyz = vec3(1.0 - occluded);
		}`

};

export { ShadowCompositer };