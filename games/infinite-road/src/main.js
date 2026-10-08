// Infinite Road: stage M. A spline road through a streamed world.
//
// Boot order matters: settings decide the quality tier, the tier decides how
// much road exists, the road decides where the car starts. The loop then does
// input, physics, streaming (road, terrain, props), camera, effects, audio,
// HUD, sky, render, in that order.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { Road, SAMPLE_SPACING } from './road.js';
import { RoadRenderer, GROUND_DROP } from './roadmesh.js';
import { Terrain } from './terrain.js';
import { Props } from './props.js';
import { Vehicle, TUNE, MAX_SPEED } from './vehicle.js';
import { BlobShadow } from './shadow.js';
import { ChaseCamera } from './camera.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { Coins } from './coins.js';
import { Settings, TIERS, ROAD_AHEAD } from './quality.js';
import { Hud, SettingsPanel } from './hud.js';
import { Atmosphere, TIMES, TIME_ORDER } from './sky.js';
import { Rain, setRoadWet } from './weather.js';
import { Effects } from './effects.js';
import { Ghost } from './ghost.js';
import { patchOctreeQuery } from './physicsfix.js';

patchOctreeQuery();


// The car starts this many samples in, clear of the start of the road.
const START_SAMPLE = 12;

const params = new URLSearchParams(window.location.search);
const DEBUG = params.get('debug') === '1';
const METER = DEBUG || params.get('meter') === '1';
const QUALITY_OVERRIDE = params.get('quality');
const STRAIGHT_TRACK = params.get('track') === 'straight';
const CORNER_TRACK = params.get('track') === 'corners';

class Game {
  constructor() {
    this.settings = new Settings();
    if (QUALITY_OVERRIDE) {
      this.settings.quality = TIERS[QUALITY_OVERRIDE] ? QUALITY_OVERRIDE : 'auto';
      this.settings.resolved = TIERS[QUALITY_OVERRIDE] ? QUALITY_OVERRIDE : 'medium';
    }

    this.started = false;
    this.finished = false;
    this.distance = 0;
    this.elapsed = 0;
    this.lowFpsTime = 0;
    this.nudged = false;
    this.carReady = false;
    this.frameMs = 16.7;
    this.smoothedFrameMs = 16.7;
    // Worst frame since the perf run last asked (plan 4.10.1: no frame task
    // above 12 ms on a laptop). Interval is the gap between frames, work is
    // the time the loop itself took.
    this.frameStats = { intervalMax: 0, workMax: 0, workSum: 0, frames: 0 };
    this.roadIndex = 0;
    this.onRoad = true;
    this.rumble = 0;
    this.state = {};
    this.roadState = { onRoad: true, lateral: 0 };
    this.roadPoint = Road.makeScratch();
    this.surfaceScratch = Road.makeScratch();
    this.surfaceAt = (x, z) => this.surfaceHeight(x, z);
    // The car lab reads the drawn ground height through this.
    this.groundHeightAt = (x, z) => this.ground.heightAt(x, z);

    this.buildScene();
    this.buildWorld();
    this.buildUI();
    this.resetRun();

    this.settings.onChange((settings, reason) => this.onSettingsChange(reason));

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.sound.suspend();
      else this.sound.resume();
    });

    this.precompile();

    this.lastFrame = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  buildScene() {
    const tier = this.settings.tier;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffffff, this.settings.activeFogFar * 0.22, this.settings.activeFogFar);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 4000);

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.settings.resolved !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.settings.activePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = tier.shadows;
    if (tier.shadows) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    document.body.appendChild(this.renderer.domElement);

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    this.scene.add(this.hemiLight);

    this.sun = new THREE.DirectionalLight(0xfff3dc, 1.05);
    this.sun.position.set(60, 120, 40);
    if (tier.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 320;
      this.sun.shadow.camera.left = -60;
      this.sun.shadow.camera.right = 60;
      this.sun.shadow.camera.top = 60;
      this.sun.shadow.camera.bottom = -60;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.05;
      // three only updates the projection when asked.
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // carGroup carries the chassis transform; modelNode holds the visual
    // body, dropped to the ground inside the chassis.
    this.carGroup = new THREE.Group();
    this.carGroup.name = 'car';
    this.scene.add(this.carGroup);

    // One headlight beam for both lamps, always in the scene so the light
    // set (and so every lit shader) never changes; by day it is dark.
    this.headlight = new THREE.SpotLight(0xfff1d6, 0, 140, 0.5, 0.45, 1.0);
    this.headlight.position.set(0, 0.45, -1.9);
    this.headlight.target.position.set(0, -1.6, -40);
    this.carGroup.add(this.headlight);
    this.carGroup.add(this.headlight.target);

    this.atmosphere = new Atmosphere(this.scene, this.renderer, {
      hemi: this.hemiLight,
      sun: this.sun,
      headlight: this.headlight,
    });
    this.applyAtmosphere();
  }

  // Compile every shader the session can need now, behind the start
  // screen: rain and the ghost are hidden until needed, and showing a
  // never-drawn mesh
  // for the first time would compile its program mid-drive (a hitch).
  precompile() {
    const rainShown = this.rain.mesh.visible;
    const ghostShown = this.ghost.group.visible;
    this.rain.mesh.visible = true;
    this.ghost.group.visible = true;
    this.renderer.compile(this.scene, this.camera);
    this.rain.mesh.visible = rainShown;
    this.ghost.group.visible = ghostShown;
  }

  // Rain is a Medium and High feature (plan 4.4.2: off on Low).
  get raining() {
    return this.settings.weather === 'rain' && this.settings.tier.rain;
  }

  applyAtmosphere() {
    this.atmosphere.set(this.settings.time, this.raining, this.settings.activeFogFar);
    // The world is built after the sky: the first call comes before it.
    if (this.rain) {
      this.rain.setVisible(this.raining, this.settings.time === 'night');
      this.rain.mesh.geometry.setDrawRange(0, this.settings.tier.rainStreaks * 2);
      setRoadWet(this.roadRenderer.material, this.raining);
    }
    this.camera.far = Math.max(2000, this.settings.activeFogFar * 2);
    this.camera.updateProjectionMatrix();
  }

  buildWorld() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    // A dozen bodies, so the naive broadphase is cheap. It must test real
    // AABBs: cannon-es's SAP and bounding-sphere checks read body.position
    // and a radius cached when the shape was first added, and the pooled
    // road chunks sit at the origin with their vertices far away, so the
    // hull would never meet the road.
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.broadphase.useBoundingBoxes = true;
    // Only the car's hull ever touches the road or the ground: a little
    // friction so an overturned car scrapes to a stop, no bounce.
    this.world.defaultContactMaterial.friction = 0.35;
    this.world.defaultContactMaterial.restitution = 0;
    this.world.solver.iterations = 12;

    this.road = new Road({ seed: 20260401, width: 9, ahead: ROAD_AHEAD, straight: STRAIGHT_TRACK,
      corners: CORNER_TRACK });
    this.ground = new Terrain(this.scene, this.road, this.world, {
      seed: 20260401,
      tier: this.settings.tier,
    });
    this.roadRenderer = new RoadRenderer(this.scene, this.road, this.world, {
      width: this.road.width,
      viewDistance: this.settings.activeViewDistance,
      groundTint: (x, z) => this.ground.biomeAt(x, z),
    });
    this.props = new Props(this.scene, this.ground, this.road, { tier: this.settings.tier });
    this.rain = new Rain(this.scene, 4500);
    this.effects = new Effects(this.scene);
    this.ghost = new Ghost(this.scene, this.road);
    this.applyAtmosphere();

    this.vehicle = new Vehicle(this.world, TUNE);
    this.vehicle.setBodyNode(this.carGroup);
    this.shadow = new BlobShadow(this.scene);
    this.shadow.setEnabled(!this.settings.tier.shadows);

    this.coins = new Coins(this.scene, this.road);
    this.camera3p = new ChaseCamera(this.camera);
    this.sound = new Sound(this.settings);
    this.hud = new Hud(document);

    new GLTFLoader().load('models/race.glb', (gltf) => {
      const model = gltf.scene;
      // Set the shadow flags before reparenting: moving a node empties the
      // old parent's children list.
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = false;
        }
      });

      // Copy the list first: reparenting a node removes it from
      // model.children while we walk it.
      const wheels = [];
      for (const child of [...model.children]) {
        if (child.name.startsWith('wheel')) wheels.push(child);
        else this.vehicle.modelNode.add(child);
      }
      // Wheels are matched by name and placed from the physics wheels.
      this.vehicle.setWheelMeshes(wheels);
      this.ghost.setModel([this.vehicle.leanNode, ...this.vehicle.wheelNodes]);
      // The ghost is hidden until there is a best run: compile its shader
      // now, not on the first restart.
      this.precompile();
      this.carReady = true;
    }, undefined, (error) => {
      // The game still runs without the model: physics and road are enough.
      console.error('Car model failed to load: ' + (error && (error.stack || error.message) || error));
    });
  }

  buildUI() {
    this.input = new Input({
      onAction: (action) => this.onAction(action),
    });
    this.input.bindTouch(document.getElementById('touch-left'), 'left');
    this.input.bindTouch(document.getElementById('touch-right'), 'right');
    this.input.bindTouch(document.getElementById('touch-gas'), 'throttle');
    this.input.bindTouch(document.getElementById('touch-brake'), 'brake');
    this.input.bindTouch(document.getElementById('touch-handbrake'), 'handbrake');

    this.startOverlay = document.getElementById('start');
    this.startButton = document.getElementById('start-button');
    this.startButton.addEventListener('click', () => this.startRun());

    this.panel = new SettingsPanel(document, this.settings, TUNE, {
      onCamera: (mode) => {
        this.camera3p.setMode(mode);
        this.settings.setCamera(mode);
      },
      onTune: () => this.vehicle.applyTuning(),
      onClose: () => {
        if (!this.started) this.startOverlay.hidden = false;
      },
    });

    if (METER) {
      const meter = document.getElementById('meter');
      if (meter) meter.hidden = false;
    }
    if (DEBUG) {
      if (this.panel.tuning) this.panel.tuning.style.display = 'block';
      this.loadDebugPanel();
    }

    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch');
      const hint = document.getElementById('start-touch-hint');
      if (hint) hint.hidden = false;
    }
  }

  loadDebugPanel() {
    const script = document.createElement('script');
    script.src = 'vendor/tweakpane.min.js';
    script.onload = () => this.buildDebugPanel();
    script.onerror = () => console.warn('Developer panel failed to load');
    document.head.appendChild(script);
  }

  buildDebugPanel() {
    /* global Tweakpane */
    if (typeof Tweakpane === 'undefined') return;
    const pane = new Tweakpane.Pane({ title: 'Infinite Road' });

    const quality = pane.addFolder({ title: 'Quality' });
    quality.addInput(this.settings, 'quality', {
      options: { Auto: 'auto', Low: 'low', Medium: 'medium', High: 'high' },
    }).on('change', () => this.settings.setQuality(this.settings.quality));
    quality.addInput(this.settings, 'viewDistance', {
      min: 0, max: 2000, step: 100, label: 'view (m)',
    }).on('change', () => this.settings.setViewDistance(this.settings.viewDistance));

    const handling = pane.addFolder({ title: 'Handling' });
    for (const name of Object.keys(TUNE)) {
      handling.addInput(TUNE, name).on('change', () => this.vehicle.applyTuning());
    }
  }

  onSettingsChange(reason) {
    if (reason === 'quality' || reason === 'viewDistance') {
      this.renderer.setPixelRatio(this.settings.activePixelRatio);
      this.applyAtmosphere();
      this.roadRenderer.setViewDistance(this.settings.activeViewDistance);
      const tier = this.settings.tier;
      this.renderer.shadowMap.enabled = tier.shadows;
      this.sun.castShadow = tier.shadows;
      this.shadow.setEnabled(!tier.shadows);
      this.props.setTier(tier);
      this.ground.setTier(tier);
      const position = this.vehicle.chassis.position;
      this.ground.update(position.x, position.z, true);
      this.props.update(this.roadPoint.s);
    }
    if (reason === 'time' || reason === 'weather') this.applyAtmosphere();
    if (reason === 'camera') this.camera3p.setMode(this.settings.camera);
    if (reason === 'muted' || reason === 'volume') this.sound.applySettings();
  }

  onAction(action) {
    switch (action) {
      case 'confirm':
        if (!this.started) this.startRun();
        break;
      case 'restart':
        this.restart();
        break;
      case 'mute': {
        const muted = this.settings.toggleMute();
        this.hud.showToast(muted ? 'Sound off (M)' : 'Sound on (M)', 2);
        break;
      }
      case 'camera': {
        const mode = this.camera3p.setMode(this.settings.camera === 'chase' ? 'hood' : 'chase');
        this.settings.setCamera(mode);
        this.hud.showToast(mode === 'hood' ? 'Hood view (C)' : 'Chase view (C)', 2);
        break;
      }
      case 'settings':
        this.panel.toggle();
        break;
      case 'time': {
        const next = TIME_ORDER[(TIME_ORDER.indexOf(this.settings.time) + 1) % TIME_ORDER.length];
        this.settings.setTime(next);
        this.panel.sync();
        this.hud.showToast(TIMES[next].label + ' (T)', 2);
        break;
      }
      case 'weather': {
        const rain = this.settings.weather !== 'rain';
        this.settings.setWeather(rain ? 'rain' : 'clear');
        this.panel.sync();
        let text = rain ? 'Rain (Y)' : 'Clear sky (Y)';
        if (rain && !this.settings.tier.rain) text = 'Rain is off on Low quality';
        this.hud.showToast(text, 2);
        break;
      }
      default:
        break;
    }
  }

  startRun() {
    if (this.started) return;
    this.started = true;
    this.input.enabled = true;
    this.startOverlay.hidden = true;
    this.sound.start();
  }

  // Instant restart: the same road, the car back on the start line.
  restart() {
    if (!this.started) {
      this.startRun();
      return;
    }
    const begin = performance.now();
    this.resetRun();
    this.restartMs = performance.now() - begin;
    this.restarts += 1;
  }

  resetRun() {
    // The run that just ended may be the new best for the ghost.
    this.ghost.endRun(this.distance || 0);

    // Start a little way in, so the whole car is on real road.
    const startIndex = this.road.firstIndex + START_SAMPLE;
    this.road.update(startIndex * SAMPLE_SPACING, ROAD_AHEAD);
    const start = this.road.sample(startIndex);
    this.roadPoint = this.road.nearest(start.x, start.z, start.index, this.roadPoint);

    this.roadRenderer.update(this.roadPoint.s, this.settings.activeViewDistance);
    this.ground.update(start.x, start.z, true);
    this.props.update(this.roadPoint.s);
    this.vehicle.reset(this.roadPoint);
    this.coins.reset(this.roadPoint.s, this.road.width / 2);
    this.effects.clear();
    this.ghost.startRun(this.roadPoint.s);
    this.distance = 0;
    this.elapsed = 0;
    this.lowFpsTime = 0;
    this.roadIndex = start.index;
    this.restarts = this.restarts || 0;

    this.camera3p.setMode(this.settings.camera);
    this.camera3p.reset(this.vehicle, this.roadPoint);
    this.sound.update(0, {
      rpm: this.vehicle.rpm, throttle: 0, speedNorm: 0, slip: 0, airborne: false, offRoad: false,
    });
    this.hud.update(this.readState());
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.settings.activePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  readState() {
    return {
      distance: this.distance,
      score: this.coins.score,
      speedKmh: this.vehicle.speedKmh,
      rpm: this.vehicle.rpm,
      gear: this.vehicle.gear,
      reversing: this.vehicle.reversing,
    };
  }

  loop(now) {
    const begin = performance.now();
    requestAnimationFrame(this.loop);

    const raw = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const dt = Math.min(0.1, Math.max(0, raw));
    this.frameMs = raw * 1000;
    this.smoothedFrameMs += (this.frameMs - this.smoothedFrameMs) * 0.1;

    const input = this.input.update(dt);

    if (this.started) {
      this.elapsed += dt;
      this.step(dt, input);
    }

    // The sky rides with the camera, the key light and its shadow box with
    // the car.
    this.atmosphere.update(this.camera.position, this.vehicle.renderPosition);
    this.rain.update(dt, this.camera.position);
    this.renderer.render(this.scene, this.camera);

    this.hud.sampleFrame(this.frameMs);
    this.hud.tick(dt);
    if (this.started) this.updateMeter();

    const work = performance.now() - begin;
    const stats = this.frameStats;
    stats.intervalMax = Math.max(stats.intervalMax, this.frameMs);
    stats.workMax = Math.max(stats.workMax, work);
    stats.workSum += work;
    stats.frames += 1;
  }

  // Frame extremes since the last call, for scripts/perf.mjs.
  takeFrameStats() {
    const stats = this.frameStats;
    const out = {
      intervalMax: Number(stats.intervalMax.toFixed(2)),
      workMax: Number(stats.workMax.toFixed(2)),
      workAvg: Number((stats.workSum / Math.max(1, stats.frames)).toFixed(2)),
      frames: stats.frames,
    };
    stats.intervalMax = 0;
    stats.workMax = 0;
    stats.workSum = 0;
    stats.frames = 0;
    return out;
  }

  step(dt, input) {
    const vehicle = this.vehicle;

    // Where are we on the road?
    this.road.nearest(vehicle.chassis.position.x, vehicle.chassis.position.z, this.roadIndex, this.roadPoint);
    this.roadIndex = this.roadPoint.index;

    const halfWidth = this.road.width / 2;
    const offRoad = Math.abs(this.roadPoint.lateral) > halfWidth;
    this.onRoad = !offRoad;
    this.roadState.onRoad = this.onRoad;
    this.roadState.lateral = this.roadPoint.lateral;
    // Off-road rumble for the sound: silent at rest, full by 72 km/h.
    this.rumble = offRoad ? Math.min(1, vehicle.speed / 20) : 0;

    vehicle.step(dt, input, this.roadState);
    vehicle.sync(dt);

    this.distance += Math.hypot(
      vehicle.chassis.velocity.x,
      vehicle.chassis.velocity.y,
      vehicle.chassis.velocity.z,
    ) * dt / 1000;

    // A hard landing on the road kicks the camera. Off the road the camera
    // stays still: the grass and the gravel are heard, not shaken.
    if (!offRoad && vehicle.landing > 0.2) this.camera3p.addShake(vehicle.landing * 0.8);

    this.road.update(this.roadPoint.s, ROAD_AHEAD);
    this.roadRenderer.update(this.roadPoint.s, this.settings.activeViewDistance);
    this.ground.update(vehicle.chassis.position.x, vehicle.chassis.position.z);
    this.props.update(this.roadPoint.s);

    this.effects.update(dt, vehicle, offRoad,
      offRoad ? this.ground.biomeAt(vehicle.chassis.position.x, vehicle.chassis.position.z) : 0, this.raining);
    this.ghost.update(dt, vehicle, this.roadPoint);

    this.coins.update(dt, vehicle.chassis.position, this.roadPoint.s, halfWidth, (score) => {
      this.sound.blip(760 + Math.min(8, score % 8) * 60, 0.1);
    });

    const speedNorm = Math.min(1, vehicle.speed / MAX_SPEED);
    this.camera3p.update(dt, vehicle, this.roadPoint, speedNorm, this.surfaceAt);
    this.shadow.update(vehicle, this.surfaceAt, this.roadPoint, this.road.width / 2);

    this.sound.update(dt, {
      rpm: vehicle.rpm,
      throttle: input.throttle,
      speedNorm,
      slip: vehicle.slip,
      airborne: vehicle.airborne,
      offRoad,
      rumble: this.rumble,
      rain: this.raining,
    });


    this.hud.update(this.readState());
    this.updateTier();
    this.recoverIfFallen();
    this.recoverIfStuck(dt);
    this.recoverIfOverturned(dt);
  }

  // Auto tier: sample the first second of driving, then settle (plan 4.9.1).
  updateTier() {
    if (!this.settings.isAuto || this.elapsed < 1.4 || this.elapsed > 3) return;
    const fps = 1000 / Math.max(1, this.smoothedFrameMs);
    if (this.settings.resolveFromFps(fps)) {
      this.hud.showToast('Quality set to ' + this.settings.tier.label, 3);
    }
  }

  // Height of whatever the car or the camera would stand on at a world
  // point: the banked tarmac and verges near the road, the ground beyond.
  surfaceHeight(x, z) {
    const point = this.road.nearest(x, z, this.roadIndex, this.surfaceScratch);
    let height = this.ground.heightAt(x, z);
    const half = this.road.width / 2;
    const lateral = Math.abs(point.lateral);
    if (lateral < half + 7) {
      const sample = point.sample;
      const flat = Math.hypot(sample.tx, sample.tz) || 1;
      const along = ((x - sample.x) * sample.tx + (z - sample.z) * sample.tz) / flat;
      const centre = sample.y + along * sample.ty / flat;
      let surface = centre - point.lateral * Math.tan(sample.bank);
      if (lateral > half) {
        // Down the verge to the level ground drop.
        const edge = centre - Math.sign(point.lateral) * half * Math.tan(sample.bank);
        const t = (lateral - half) / 7;
        surface = edge + (centre - GROUND_DROP - edge) * t;
      }
      height = Math.max(height, surface);
    }
    return height;
  }

  // Put the car back where it is, on the tarmac, lined up with the road,
  // keeping its lane. Used by every in-place recovery.
  recoverInPlace(message) {
    const half = this.road.width / 2;
    const lane = Math.max(-half + 1.6, Math.min(half - 1.6, this.roadPoint.lateral));
    this.vehicle.reset(this.roadPoint, lane);
    // The car may have been out in a field: the physics patch moves with it.
    const position = this.vehicle.chassis.position;
    this.ground.update(position.x, position.z, true);
    this.camera3p.reset(this.vehicle, this.roadPoint);
    this.stuckTime = 0;
    this.overturnedTime = 0;
    if (message) this.hud.showToast(message, 2);
  }

  // Put the car back on the road if it falls off the world.
  recoverIfFallen() {
    const position = this.vehicle.chassis.position;
    const tooFar = Math.abs(this.roadPoint.lateral) > 200;
    if (position.y > this.roadPoint.height - 25 && !tooFar) return;
    this.fallResets = (this.fallResets || 0) + 1;
    this.recoverInPlace('Back on the road');
  }

  // Stopped off the road for a few seconds: lift the car back onto the
  // tarmac rather than leave the player pushing against a verge for ever.
  recoverIfStuck(dt) {
    this.stuckTime = (this.onRoad || this.vehicle.speed > 1.2) ? 0 : (this.stuckTime || 0) + dt;
    if (this.stuckTime < 3) return;
    this.recoverInPlace('Back on the road');
  }

  // On its roof or its side and nearly still: right it where it lies.
  recoverIfOverturned(dt) {
    const overturned = this.vehicle.uprightness < 0.5 && this.vehicle.speed < 4;
    this.overturnedTime = overturned ? (this.overturnedTime || 0) + dt : 0;
    if (this.overturnedTime < 1.5) return;
    this.recoverInPlace('Back on your wheels');
  }

  updateMeter() {
    if (!METER) return;
    const info = this.renderer.info;
    this.hud.setMeter([
      Math.round(1000 / Math.max(1, this.smoothedFrameMs)) + ' fps',
      (this.smoothedFrameMs).toFixed(1) + ' ms',
      this.settings.tier.label,
      info.render.calls + ' calls',
      Math.round(info.render.triangles / 1000) + 'k tris',
      info.memory.geometries + ' geo',
      info.memory.textures + ' tex',
      this.roadRenderer.chunkCount + ' chunks',
    ].join(' · '));

    // One time nudge when the frame rate stays low (plan 4.9.3).
    if (!this.nudged && this.settings.resolved === 'medium' && this.elapsed > 6) {
      this.lowFpsTime = this.smoothedFrameMs > 33 ? this.lowFpsTime + 1 / 60 : 0;
      if (this.lowFpsTime > 5) {
        this.nudged = true;
        this.hud.showToast('Running below 30 fps? Open settings (Esc) and pick Low.', 8);
      }
    }
  }

  // Inspection surface for the debug meter, the smoke test and perf runs.
  api() {
    const info = this.renderer.info;
    const vehicle = this.vehicle;
    return {
      started: this.started,
      carReady: this.carReady,
      fps: Math.round(1000 / Math.max(1, this.smoothedFrameMs)),
      frameMs: Number(this.smoothedFrameMs.toFixed(2)),
      speedKmh: Number(vehicle.speedKmh.toFixed(2)),
      carX: Number(vehicle.chassis.position.x.toFixed(2)),
      carY: Number(vehicle.chassis.position.y.toFixed(2)),
      carZ: Number(vehicle.chassis.position.z.toFixed(2)),
      velocity: Number(vehicle.chassis.velocity.length().toFixed(2)),
      wheelsOnGround: vehicle.vehicle.numWheelsOnGround,
      distance: Number(this.distance.toFixed(3)),
      score: this.coins.score,
      onRoad: this.onRoad,
      lateral: Number(this.roadPoint.lateral.toFixed(2)),
      heading: Number((vehicle.heading * 180 / Math.PI).toFixed(2)),
      roadHeading: Number((Math.atan2(this.roadPoint.tangentX, this.roadPoint.tangentZ) * 180 / Math.PI).toFixed(2)),
      curvature: Number(this.roadPoint.curvature.toFixed(5)),
      bank: Number((this.roadPoint.bank * 180 / Math.PI).toFixed(2)),
      rpm: Number(vehicle.rpm.toFixed(3)),
      gear: vehicle.gear,
      engineHz: Number(this.sound.engineHz.toFixed(2)),
      engineAudioReady: this.sound.ready,
      airborne: vehicle.airborne,
      slip: Number(vehicle.slip.toFixed(3)),
      rumble: Number(this.rumble.toFixed(3)),
      quality: this.settings.quality,
      tier: this.settings.tier.label,
      pixelRatio: this.renderer.getPixelRatio(),
      viewDistance: this.settings.activeViewDistance,
      cameraMode: this.camera3p.mode,
      chunks: this.roadRenderer.chunkCount,
      terrainTiles: this.ground.tileCount,
      props: this.props.instanceCount,
      terrainPending: this.ground.pending,
      terrainBuilt: this.ground.tilesBuilt,
      terrainMaxBuildMs: Number(this.ground.maxBuildMs.toFixed(2)),
      bodies: this.world.bodies.length,
      samples: this.road.samples.length,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs ? info.programs.length : 0,
      restartMs: this.restartMs || 0,
      restarts: this.restarts || 0,
      gamepad: this.input.hasGamepad,
      viewFov: Number(this.camera.fov.toFixed(2)),
      time: this.atmosphere.time,
      weather: this.settings.weather,
      raining: this.atmosphere.raining,
      rainVisible: this.rain.mesh.visible,
      skidMarks: this.effects.markCount,
      puffs: this.effects.live,
      ghostVisible: this.ghost.group.visible,
      ghostBest: Number(this.ghost.bestDistance.toFixed(3)),
      roadSpecular: Number(this.roadRenderer.material.specular.r.toFixed(2)),
      fogNear: Math.round(this.scene.fog.near),
      fogFar: Math.round(this.scene.fog.far),
      fogColor: this.scene.fog.color.getHexString(),
      headlight: Number(this.headlight.intensity.toFixed(2)),
    };
  }
}

// The smoke test and the perf run read the game state through window.game.
window.game = new Game();