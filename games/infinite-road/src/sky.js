// Sky, sun, time of day and weather (plan 4.4, stage M).
//
// One small shader dome: a horizon to zenith gradient, a sun (or moon) disc
// with a glow, and stars at night. The horizon colour is the fog colour, so
// terrain fading into the fog meets the sky without a seam.
//
// Every switch here only changes uniforms, light colours and fog numbers.
// The fog type, the light set and the materials stay the same, so changing
// the time of day or the weather never recompiles a shader (a visible
// hitch). The headlight exists in every preset; by day its intensity is 0.

import * as THREE from 'three';

const DEG = Math.PI / 180;

// Sun elevation and azimuth in degrees (azimuth 0 is down -Z, the way the
// road starts, 90 is +X). Colours are sRGB hex.
export const TIMES = {
  morning: {
    label: 'Morning',
    sun: { elevation: 13, azimuth: 60, color: 0xffd9a8, intensity: 1.0 },
    zenith: 0x5a8ccc,
    horizon: 0xe9d6bf,
    hemiSky: 0xc4d6ec,
    hemiGround: 0x6b6a4c,
    hemiIntensity: 0.72,
    disc: 1,
    stars: 0,
    headlights: 0,
  },
  noon: {
    label: 'Noon',
    sun: { elevation: 62, azimuth: 150, color: 0xfff3dc, intensity: 1.05 },
    zenith: 0x4f86c6,
    horizon: 0xa9c6dc,
    hemiSky: 0xbcd8f0,
    hemiGround: 0x5e7a46,
    hemiIntensity: 0.85,
    disc: 1,
    stars: 0,
    headlights: 0,
  },
  sunset: {
    label: 'Sunset',
    sun: { elevation: 4, azimuth: -55, color: 0xff9c5a, intensity: 0.95 },
    zenith: 0x36406f,
    horizon: 0xe8946a,
    hemiSky: 0xdba08a,
    hemiGround: 0x4a3c34,
    hemiIntensity: 0.6,
    disc: 1,
    stars: 0,
    headlights: 0.5,
  },
  night: {
    // The "sun" is the moon: a cold, weak key light high in the sky.
    label: 'Night',
    sun: { elevation: 38, azimuth: 120, color: 0x9fb4ff, intensity: 0.32 },
    zenith: 0x03060f,
    horizon: 0x111a2c,
    hemiSky: 0x2c3a5c,
    hemiGround: 0x0b0d12,
    hemiIntensity: 0.42,
    disc: 0.55,
    stars: 1,
    headlights: 1,
  },
};

export const TIME_ORDER = ['morning', 'noon', 'sunset', 'night'];

// Rain greys the sky, hides the sun, dims the key light and halves how far
// you can see (plan stage M done test 4).
const RAIN = {
  overcast: 0x6f7780,
  overcastNight: 0x10141b,
  mix: 0.72,
  sunScale: 0.3,
  hemiScale: 0.85,
  fogScale: 0.5,
  fogNearScale: 0.25,
};

const VERTEX = /* glsl */`
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
    // Keep the dome on the far plane whatever its radius.
    gl_Position.z = gl_Position.w * 0.99999;
  }
`;

const FRAGMENT = /* glsl */`
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float discAmount;
  uniform float glowAmount;
  uniform float starAmount;
  varying vec3 vDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float up = max(direction.y, 0.0);
    vec3 color = mix(horizon, zenith, pow(up, 0.5));

    float facing = max(dot(direction, sunDirection), 0.0);
    // Wide warm glow, then the disc itself.
    color += sunColor * glowAmount * (pow(facing, 6.0) * 0.35 + pow(facing, 64.0) * 0.5);
    float disc = smoothstep(0.9993, 0.9997, facing);
    color = mix(color, sunColor * 1.2 + 0.2, disc * discAmount);

    // Stars: sparse cells on a fine direction grid, only well above the
    // horizon haze.
    if (starAmount > 0.0) {
      vec3 cell = floor(direction * 340.0);
      float star = step(0.998, hash(cell));
      color += vec3(star * starAmount * smoothstep(0.05, 0.3, direction.y) * 0.9);
    }

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export class Atmosphere {
  // scene: the scene; lights: { hemi, sun, headlight }; renderer for the
  // clear colour.
  constructor(scene, renderer, lights) {
    this.scene = scene;
    this.renderer = renderer;
    this.hemi = lights.hemi;
    this.sun = lights.sun;
    this.headlight = lights.headlight;
    this.time = 'noon';
    this.raining = false;
    this.fogFar = 700;
    this.sunDirection = new THREE.Vector3(0, 1, 0);
    this.fogColor = new THREE.Color();
    this.scratch = new THREE.Color();
    this.overcast = new THREE.Color();

    this.uniforms = {
      zenith: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunDirection: { value: this.sunDirection },
      sunColor: { value: new THREE.Color() },
      discAmount: { value: 1 },
      glowAmount: { value: 1 },
      starAmount: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 12), material);
    this.dome.name = 'sky';
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // The fog type never changes; only its colour and range do.
    if (!scene.fog) scene.fog = new THREE.Fog(0xffffff, 100, 700);
    scene.background = null;
  }

  get preset() {
    return TIMES[this.time];
  }

  // Night or dusk: how strongly the headlights should shine (0..1).
  get headlightAmount() {
    return Math.max(this.preset.headlights, this.raining ? 0.5 : 0);
  }

  set(time, raining, fogFar) {
    if (TIMES[time]) this.time = time;
    this.raining = Boolean(raining);
    if (fogFar) this.fogFar = fogFar;
    this.apply();
  }

  apply() {
    const preset = this.preset;
    const rain = this.raining ? RAIN.mix : 0;
    const night = this.time === 'night';
    this.overcast.set(night ? RAIN.overcastNight : RAIN.overcast);

    const elevation = preset.sun.elevation * DEG;
    const azimuth = preset.sun.azimuth * DEG;
    this.sunDirection.set(
      Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      -Math.cos(azimuth) * Math.cos(elevation),
    );

    const u = this.uniforms;
    u.zenith.value.set(preset.zenith).lerp(this.overcast, rain);
    u.horizon.value.set(preset.horizon).lerp(this.overcast, rain);
    u.sunColor.value.set(preset.sun.color);
    u.discAmount.value = preset.disc * (1 - rain);
    u.glowAmount.value = 1 - rain * 0.85;
    u.starAmount.value = preset.stars * (1 - rain);

    this.fogColor.copy(u.horizon.value);
    this.scene.fog.color.copy(this.fogColor);
    const far = this.fogFar * (this.raining ? RAIN.fogScale : 1);
    this.scene.fog.far = far;
    this.scene.fog.near = far * (this.raining ? RAIN.fogNearScale : 0.22);
    this.renderer.setClearColor(this.fogColor);

    this.sun.color.set(preset.sun.color);
    this.sun.intensity = preset.sun.intensity * (this.raining ? RAIN.sunScale : 1);
    this.hemi.color.set(preset.hemiSky);
    this.hemi.groundColor.set(preset.hemiGround);
    this.hemi.intensity = preset.hemiIntensity * (this.raining ? RAIN.hemiScale : 1);
    if (this.raining) this.hemi.color.lerp(this.overcast, 0.4);

    if (this.headlight) this.headlight.intensity = this.headlightAmount * 180;
  }

  // The dome rides with the camera; the key light rides with the car so its
  // shadow box stays on it.
  update(cameraPosition, carPosition) {
    this.dome.position.copy(cameraPosition);
    this.sun.position.set(
      carPosition.x + this.sunDirection.x * 150,
      carPosition.y + this.sunDirection.y * 150,
      carPosition.z + this.sunDirection.z * 150,
    );
    this.sun.target.position.copy(carPosition);
    this.sun.target.updateMatrixWorld();
  }

  get fogVisibility() {
    return this.scene.fog.far;
  }
}
