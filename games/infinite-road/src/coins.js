// Coins along the road. One InstancedMesh, a fixed pool of slots and no
// allocation after start. Collection is a distance check, not a collision.

import * as THREE from 'three';
import { SAMPLE_SPACING, Road } from './road.js';

const COUNT = 96;
const AHEAD_NEAR = 240;
const AHEAD_FAR = 900;
const PICKUP_RADIUS = 3.2;
const COIN_HEIGHT = 1.15;

export class Coins {
  constructor(scene, road) {
    this.road = road;
    this.score = 0;
    this.scratch = Road.makeScratch();

    const geometry = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 10);
    geometry.rotateX(Math.PI / 2);
    // No environment map, so a lit diffuse gold with some glow of its own;
    // a standard material read as olive mud against the sky.
    const material = new THREE.MeshLambertMaterial({
      color: 0xffc933,
      emissive: 0x8a5a00,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.slots = [];
    for (let i = 0; i < COUNT; i += 1) {
      this.slots.push({ filled: false, x: 0, y: 0, z: 0, s: 0, spin: Math.random() * 6.28 });
    }

    this.matrix = new THREE.Matrix4();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3(1, 1, 1);
    this.position = new THREE.Vector3();
    this.axis = new THREE.Vector3(0, 1, 0);
  }

  // Put a coin on the road at arc position `s`, somewhere across the tarmac.
  place(slot, s, halfWidth) {
    const road = this.road;
    const index = Math.round(s / SAMPLE_SPACING);
    if (index < road.firstIndex || index > road.lastIndex) return false;

    const sample = road.sample(index);
    const cos = Math.cos(sample.bank);
    const sin = Math.sin(sample.bank);
    const offset = (Math.random() * 2 - 1) * (halfWidth - 1.4);

    slot.s = s;
    slot.x = sample.x + sample.rx * cos * offset;
    slot.y = sample.y - sin * offset + COIN_HEIGHT;
    slot.z = sample.z + sample.rz * cos * offset;
    slot.filled = true;
    return true;
  }

  update(dt, carPosition, carS, halfWidth, onCollect) {
    this.spin = 0;
    for (let i = 0; i < COUNT; i += 1) {
      const slot = this.slots[i];

      if (!slot.filled || slot.s < carS - 60) {
        const s = carS + AHEAD_NEAR + Math.random() * (AHEAD_FAR - AHEAD_NEAR);
        if (!this.place(slot, s, halfWidth)) continue;
      }

      const dx = carPosition.x - slot.x;
      const dy = carPosition.y - slot.y;
      const dz = carPosition.z - slot.z;
      if (dx * dx + dy * dy + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) {
        this.score += 1;
        if (onCollect) onCollect(this.score);
        slot.filled = false;
        continue;
      }

      slot.spin += dt * 2.4;
      this.position.set(slot.x, slot.y, slot.z);
      this.quaternion.setFromAxisAngle(this.axis, slot.spin);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(i, this.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset(carS, halfWidth) {
    this.score = 0;
    for (const slot of this.slots) {
      slot.filled = false;
      this.place(slot, carS + AHEAD_NEAR + Math.random() * (AHEAD_FAR - AHEAD_NEAR), halfWidth);
    }
  }
}