// Best-run ghost (stage M): a see-through car that replays your best run.
//
// A run is recorded as offsets from the road midline, 20 times a second:
// distance along the road since the start line, lateral offset, height over
// the road and heading against the road. R restarts from wherever the start
// line is now, so the ghost replays the same driving line from there and
// shows how far along the best run was at the same moment. Session only,
// no network, no storage.
//
// Both buffers are allocated once; recording and replay allocate nothing.

import * as THREE from 'three';
import { SAMPLE_SPACING } from './road.js';

const RATE = 20; // samples per second
const MAX_SECONDS = 20 * 60;
const FIELDS = 4; // ds, lateral, height, relative heading
const CAPACITY = RATE * MAX_SECONDS;

function wrap(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export class Ghost {
  constructor(scene, road) {
    this.road = road;
    this.current = new Float32Array(CAPACITY * FIELDS);
    this.best = new Float32Array(CAPACITY * FIELDS);
    this.currentCount = 0;
    this.bestCount = 0;
    this.bestDistance = 0;
    this.clock = 0;
    this.startS = 0;

    this.group = new THREE.Group();
    this.group.name = 'ghost';
    this.group.visible = false;
    this.group.rotation.order = 'YXZ';
    scene.add(this.group);
    this.material = new THREE.MeshLambertMaterial({
      color: 0x9fe4ff,
      emissive: 0x1d4a66,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.ready = false;
  }

  // Copy the car's look once the model has loaded: same geometry, one
  // see-through material, no shadows.
  setModel(nodes) {
    for (const node of nodes) {
      const copy = node.clone(true);
      copy.traverse((child) => {
        if (child.isMesh) {
          child.material = this.material;
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      this.group.add(copy);
    }
    this.ready = true;
  }

  // A run ends (restart): keep it if it went further than the best.
  endRun(distance) {
    if (this.currentCount > RATE * 3 && distance > this.bestDistance) {
      const swap = this.best;
      this.best = this.current;
      this.current = swap;
      this.bestCount = this.currentCount;
      this.bestDistance = distance;
    }
    this.currentCount = 0;
  }

  startRun(startS) {
    this.startS = startS;
    this.clock = 0;
    this.nextSample = 0;
    this.currentCount = 0;
    this.group.visible = false;
  }

  // Record the car (every 1/RATE s of game time) and place the ghost.
  update(dt, vehicle, roadPoint) {
    this.clock += dt;
    if (this.clock >= this.nextSample && this.currentCount < CAPACITY) {
      this.nextSample += 1 / RATE;
      const at = this.currentCount * FIELDS;
      const roadHeading = Math.atan2(roadPoint.tangentX, roadPoint.tangentZ);
      this.current[at] = roadPoint.s - this.startS
        + ((vehicle.chassis.position.x - roadPoint.x) * roadPoint.tangentX
        + (vehicle.chassis.position.z - roadPoint.z) * roadPoint.tangentZ);
      this.current[at + 1] = roadPoint.lateral;
      this.current[at + 2] = vehicle.chassis.position.y
        - (roadPoint.height - roadPoint.lateral * Math.tan(roadPoint.bank));
      this.current[at + 3] = wrap(vehicle.heading - roadHeading);
      this.currentCount += 1;
    }
    this.place();
  }

  place() {
    const frame = this.clock * RATE;
    const i = Math.floor(frame);
    if (!this.ready || this.bestCount < 2 || i + 1 >= this.bestCount) {
      this.group.visible = false;
      return;
    }
    const t = frame - i;
    const a = i * FIELDS;
    const b = a + FIELDS;
    const best = this.best;
    const ds = best[a] + (best[b] - best[a]) * t;
    const lateral = best[a + 1] + (best[b + 1] - best[a + 1]) * t;
    const height = best[a + 2] + (best[b + 2] - best[a + 2]) * t;
    const heading = best[a + 3] + wrap(best[b + 3] - best[a + 3]) * t;

    const road = this.road;
    const s = this.startS + ds;
    const f = s / SAMPLE_SPACING;
    const i0 = Math.floor(f);
    if (i0 < road.firstIndex || i0 + 1 > road.lastIndex) {
      this.group.visible = false;
      return;
    }
    const p = road.sample(i0);
    const q = road.sample(i0 + 1);
    const u = f - i0;
    const x = p.x + (q.x - p.x) * u;
    const y = p.y + (q.y - p.y) * u;
    const z = p.z + (q.z - p.z) * u;
    const bank = p.bank + (q.bank - p.bank) * u;
    this.group.position.set(
      x + p.rx * lateral,
      y - lateral * Math.tan(bank) + height,
      z + p.rz * lateral,
    );
    const roadHeading = Math.atan2(p.tx, p.tz);
    // The car's local forward is -Z; heading 0 faces +Z in atan2(x, z).
    this.group.rotation.set(Math.asin(Math.max(-1, Math.min(1, p.ty))), roadHeading + heading + Math.PI, -bank);
    this.group.visible = true;
  }
}
