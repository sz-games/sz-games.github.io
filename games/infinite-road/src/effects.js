// Skid marks, dust and tyre smoke (stage M).
//
// Both are fixed pools written in place: the skid marks are a ring buffer of
// quads in one mesh, the puffs a pool of points. Nothing is allocated while
// driving.

import * as THREE from 'three';

const MARKS = 900; // quads in the ring
const MARK_WIDTH = 0.24;
const MARK_STEP = 0.45; // metres of travel per quad
const MARK_LIFT = 0.025;

const PUFFS = 180;
const PUFF_LIFE = 1.3;
const DUST_RATE = 8; // puffs per second per rear wheel, at most
const DUST_ALPHA = 0.2;

function softDot() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Effects {
  constructor(scene) {
    // ---- skid marks
    this.markPositions = new Float32Array(MARKS * 4 * 3);
    const indices = new Uint16Array(MARKS * 6);
    for (let i = 0; i < MARKS; i += 1) {
      indices.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const markGeometry = new THREE.BufferGeometry();
    this.markAttribute = new THREE.BufferAttribute(this.markPositions, 3);
    this.markAttribute.setUsage(THREE.DynamicDrawUsage);
    markGeometry.setAttribute('position', this.markAttribute);
    markGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    markGeometry.setDrawRange(0, 0);
    this.marks = new THREE.Mesh(markGeometry, new THREE.MeshBasicMaterial({
      color: 0x161616,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
      // Flat decals need no back-to-front pass; without this three draws
      // transparent double-sided materials twice and rebuilds their shader
      // parameters every frame.
      forceSinglePass: true,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }));
    this.marks.name = 'skidmarks';
    this.marks.frustumCulled = false;
    this.marks.renderOrder = 2;
    scene.add(this.marks);
    this.markNext = 0;
    this.markCount = 0;
    // Last mark point per wheel (x, y, z, valid).
    this.trail = new Float32Array(4 * 4);
    this.across = new THREE.Vector3();
    this.along = new THREE.Vector3();
    this.normal = new THREE.Vector3();

    // ---- puffs
    this.puffPositions = new Float32Array(PUFFS * 3);
    this.puffColors = new Float32Array(PUFFS * 4);
    this.puffVelocity = new Float32Array(PUFFS * 3);
    this.puffAge = new Float32Array(PUFFS).fill(PUFF_LIFE);
    this.puffAlpha = new Float32Array(PUFFS);
    const puffGeometry = new THREE.BufferGeometry();
    this.puffPositionAttribute = new THREE.BufferAttribute(this.puffPositions, 3);
    this.puffPositionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.puffColorAttribute = new THREE.BufferAttribute(this.puffColors, 4);
    this.puffColorAttribute.setUsage(THREE.DynamicDrawUsage);
    puffGeometry.setAttribute('position', this.puffPositionAttribute);
    puffGeometry.setAttribute('color', this.puffColorAttribute);
    this.puffs = new THREE.Points(puffGeometry, new THREE.PointsMaterial({
      size: 2.6,
      map: softDot(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    }));
    this.puffs.name = 'puffs';
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = 3;
    scene.add(this.puffs);
    this.puffNext = 0;
    this.live = 0;
    this.emitCarry = 0;
    this.dustColor = new THREE.Color();
  }

  clear() {
    this.markNext = 0;
    this.markCount = 0;
    this.marks.geometry.setDrawRange(0, 0);
    this.trail.fill(0);
    this.puffAge.fill(PUFF_LIFE);
    this.puffColors.fill(0);
    this.puffColorAttribute.needsUpdate = true;
  }

  // vehicle: the game's Vehicle. offRoad: the car is on the verge or the
  // ground. dry: 0 green .. 1 dry country under the car. wet: rain.
  update(dt, vehicle, offRoad, dry, wet) {
    const wheels = vehicle.vehicle.wheelInfos;
    const speed = vehicle.speed;
    let marked = false;
    let emit = 0;

    for (let index = 0; index < 4; index += 1) {
      const info = wheels[index];
      const rear = index >= 2;
      const locked = rear && vehicle.handbrakeOn;
      const skidding = info.isInContact && speed > 3 && !offRoad
        && (info.sliding || locked || (vehicle.slip > 0.6));
      const at = index * 4;
      if (!skidding) {
        this.trail[at + 3] = 0;
      } else {
        const hit = info.raycastResult.hitPointWorld;
        const n = info.raycastResult.hitNormalWorld;
        const x = hit.x + n.x * MARK_LIFT;
        const y = hit.y + n.y * MARK_LIFT;
        const z = hit.z + n.z * MARK_LIFT;
        if (this.trail[at + 3] === 0) {
          this.trail[at] = x;
          this.trail[at + 1] = y;
          this.trail[at + 2] = z;
          this.trail[at + 3] = 1;
        } else {
          const dx = x - this.trail[at];
          const dy = y - this.trail[at + 1];
          const dz = z - this.trail[at + 2];
          const length = Math.hypot(dx, dy, dz);
          if (length > 6) {
            // A jump (restart, recovery): start a new trail.
            this.trail[at] = x;
            this.trail[at + 1] = y;
            this.trail[at + 2] = z;
          } else if (length >= MARK_STEP) {
            this.normal.set(n.x, n.y, n.z);
            this.along.set(dx, dy, dz).divideScalar(length);
            this.across.crossVectors(this.along, this.normal).normalize().multiplyScalar(MARK_WIDTH / 2);
            this.addMark(this.trail[at], this.trail[at + 1], this.trail[at + 2], x, y, z);
            this.trail[at] = x;
            this.trail[at + 1] = y;
            this.trail[at + 2] = z;
            marked = true;
          }
        }
      }

      // Light dust from the rear wheels off the tarmac, smoke from a slide
      // on it.
      if (info.isInContact && ((offRoad && rear && speed > 5) || (skidding && speed > 6))) emit += 1;
    }
    if (marked) this.markAttribute.needsUpdate = true;

    // Puffs per second scale with speed; the rain keeps dust down. Dust
    // stays sparse and faint, so the field never fills the screen.
    const rate = offRoad ? Math.min(DUST_RATE, speed * 0.4) : Math.min(30, speed * 1.4);
    this.emitCarry += emit * dt * rate * (wet ? 0.35 : 1);
    if (this.emitCarry >= 1) {
      if (offRoad) this.dustColor.setRGB(0.55 + dry * 0.25, 0.5 + dry * 0.17, 0.4 + dry * 0.05);
      else this.dustColor.setRGB(0.85, 0.85, 0.85);
      while (this.emitCarry >= 1) {
        this.emitCarry -= 1;
        const wheel = wheels[2 + Math.floor(Math.random() * 2)];
        if (wheel.isInContact) this.emitPuff(wheel.raycastResult.hitPointWorld, vehicle.chassis.velocity, offRoad);
      }
    }
    this.stepPuffs(dt);
  }

  addMark(x0, y0, z0, x1, y1, z1) {
    const across = this.across;
    const at = this.markNext * 12;
    const p = this.markPositions;
    p[at] = x0 - across.x; p[at + 1] = y0 - across.y; p[at + 2] = z0 - across.z;
    p[at + 3] = x0 + across.x; p[at + 4] = y0 + across.y; p[at + 5] = z0 + across.z;
    p[at + 6] = x1 - across.x; p[at + 7] = y1 - across.y; p[at + 8] = z1 - across.z;
    p[at + 9] = x1 + across.x; p[at + 10] = y1 + across.y; p[at + 11] = z1 + across.z;
    this.markNext = (this.markNext + 1) % MARKS;
    this.markCount = Math.min(MARKS, this.markCount + 1);
    this.marks.geometry.setDrawRange(0, this.markCount * 6);
  }

  emitPuff(point, velocity, dust) {
    const i = this.puffNext;
    this.puffNext = (this.puffNext + 1) % PUFFS;
    this.puffPositions[i * 3] = point.x + (Math.random() - 0.5) * 0.6;
    this.puffPositions[i * 3 + 1] = point.y + 0.25;
    this.puffPositions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 0.6;
    this.puffVelocity[i * 3] = velocity.x * 0.25 + (Math.random() - 0.5) * 2;
    this.puffVelocity[i * 3 + 1] = 0.8 + Math.random() * 1.2;
    this.puffVelocity[i * 3 + 2] = velocity.z * 0.25 + (Math.random() - 0.5) * 2;
    this.puffAge[i] = 0;
    this.puffAlpha[i] = dust ? DUST_ALPHA : 0.32;
    this.puffColors[i * 4] = this.dustColor.r;
    this.puffColors[i * 4 + 1] = this.dustColor.g;
    this.puffColors[i * 4 + 2] = this.dustColor.b;
  }

  stepPuffs(dt) {
    let live = 0;
    const drag = Math.exp(-2.2 * dt);
    for (let i = 0; i < PUFFS; i += 1) {
      if (this.puffAge[i] >= PUFF_LIFE) {
        this.puffColors[i * 4 + 3] = 0;
        continue;
      }
      live += 1;
      this.puffAge[i] += dt;
      this.puffVelocity[i * 3] *= drag;
      this.puffVelocity[i * 3 + 1] *= drag;
      this.puffVelocity[i * 3 + 2] *= drag;
      this.puffPositions[i * 3] += this.puffVelocity[i * 3] * dt;
      this.puffPositions[i * 3 + 1] += this.puffVelocity[i * 3 + 1] * dt;
      this.puffPositions[i * 3 + 2] += this.puffVelocity[i * 3 + 2] * dt;
      const t = this.puffAge[i] / PUFF_LIFE;
      this.puffColors[i * 4 + 3] = this.puffAlpha[i] * Math.min(1, t * 8) * (1 - t);
    }
    if (live > 0 || this.live > 0) {
      this.puffPositionAttribute.needsUpdate = true;
      this.puffColorAttribute.needsUpdate = true;
    }
    this.live = live;
  }
}
