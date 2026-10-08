// Rain (plan 4.4.2, stage M): streaks around the camera and a wet road.
//
// The streaks are one LineSegments draw call. Each streak has a fixed random
// seed; the vertex shader moves it down (and a little with the wind) and
// wraps it inside a box that rides with the camera, so the CPU never touches
// a particle. Rain is a Medium and High feature; Low never shows it.

import * as THREE from 'three';

const BOX = new THREE.Vector3(70, 32, 70);
const FALL = new THREE.Vector3(1.6, -14, 0.8); // metres per second, with wind
const STREAK = 0.055; // seconds of fall per streak: its length

const VERTEX = /* glsl */`
  uniform float time;
  uniform vec3 centre;
  uniform vec3 box;
  uniform vec3 fall;
  uniform float streak;
  attribute vec3 seed;
  attribute float tail;
  varying float vFade;
  void main() {
    vec3 corner = centre - box * 0.5;
    vec3 head = corner + mod(seed * box + fall * time - corner, box);
    vec3 world = head - fall * streak * tail;
    vec4 view = viewMatrix * vec4(world, 1.0);
    float distance = length(view.xyz);
    vFade = (1.0 - smoothstep(18.0, 34.0, distance)) * smoothstep(0.6, 2.5, distance) * (1.0 - tail * 0.7);
    gl_Position = projectionMatrix * view;
  }
`;

const FRAGMENT = /* glsl */`
  uniform vec3 tint;
  uniform float opacity;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(tint, opacity * vFade);
  }
`;

export class Rain {
  constructor(scene, count) {
    this.scene = scene;
    this.count = count;
    const seeds = new Float32Array(count * 2 * 3);
    const tails = new Float32Array(count * 2);
    let a = 0x9e3779b9;
    const random = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < count; i += 1) {
      const x = random();
      const y = random();
      const z = random();
      for (let end = 0; end < 2; end += 1) {
        const at = (i * 2 + end) * 3;
        seeds[at] = x;
        seeds[at + 1] = y;
        seeds[at + 2] = z;
        tails[i * 2 + end] = end;
      }
    }
    const geometry = new THREE.BufferGeometry();
    // Position is unused by the shader but three wants one for the count.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
    geometry.setAttribute('tail', new THREE.BufferAttribute(tails, 1));

    this.uniforms = {
      time: { value: 0 },
      centre: { value: new THREE.Vector3() },
      box: { value: BOX },
      fall: { value: FALL },
      streak: { value: STREAK },
      tint: { value: new THREE.Color(0xc4cfdc) },
      opacity: { value: 0.42 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.LineSegments(geometry, material);
    this.mesh.name = 'rain';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  setVisible(visible, night) {
    this.mesh.visible = visible;
    this.uniforms.tint.value.set(night ? 0x5a6478 : 0xc4cfdc);
  }

  update(dt, cameraPosition) {
    if (!this.mesh.visible) return;
    // Wrap the clock well inside float precision.
    this.uniforms.time.value = (this.uniforms.time.value + dt) % 1000;
    this.uniforms.centre.value.copy(cameraPosition);
  }
}

// A wet road is darker and shiny: the road material is Phong from the
// start, dry with no specular, so wetting it only changes numbers.
export function setRoadWet(material, wet) {
  material.color.setScalar(wet ? 0.72 : 1);
  material.specular.setScalar(wet ? 0.45 : 0);
  material.shininess = wet ? 70 : 8;
}
