// Chase camera with lag, look-ahead and a speed FOV kick (plan 4.6).
//
// The camera follows the car's path (its heading at parking speeds), not the
// road, so a slide still reads as a slide and a handbrake spin turns the car
// in front of the camera instead of swinging the camera round. It looks at a
// point down the road, which is what makes the corners read as corners, and
// the aim is held close enough to the car that the car never leaves the
// picture (car lab: spin).

import * as THREE from 'three';

const CHASE = {
  distance: 6.4,
  height: 2.6,
  lookAhead: 26,
  lag: 5.5, // position catch-up per second
  yawRate: 6, // heading catch-up per second
  aimLag: 7,
  baseFov: 62,
  fovKick: 11,
};

// Widest angle, at the camera, between the car and the aim point: about
// two thirds of the vertical half field of view, so the whole car stays in
// the picture whatever the aim lag is doing.
const MAX_AIM_OFF = 15 * Math.PI / 180;

function wrapAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// The chase camera never goes lower than this over the road or the ground.
const MIN_CLEARANCE = 1.1;

// Nose camera, from the centre of mass: low over the nose, ahead of the
// cockpit, with both front wheels in view. Local -Z is forwards.
const HOOD_HEIGHT = 0.52;
const HOOD_FORWARD = -0.55;
const HOOD = { baseFov: 70, fovKick: 6 };

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.position = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.hoodOffset = new THREE.Vector3();
    this.hoodLook = new THREE.Vector3();
    this.shake = 0;
    this.mode = 'chase';
    this.lookTargetX = 0;
    this.lookTargetY = 0;
    this.lookTargetZ = 0;
    this.travelWeight = 0;
    this.time = 0;
    this.aimClamps = 0;
    this.initialised = false;
  }

  setMode(mode) {
    this.mode = mode === 'hood' ? 'hood' : 'chase';
    return this.mode;
  }

  // Snap behind the car, looking down the road: used at the start, on R
  // and after every recovery, so the camera never swoops across the map.
  reset(vehicle, roadPoint) {
    this.yaw = Math.atan2(roadPoint.tangentX, roadPoint.tangentZ);
    const dirX = Math.sin(this.yaw);
    const dirZ = Math.cos(this.yaw);
    const car = vehicle.renderPosition;
    this.position.set(
      car.x - dirX * CHASE.distance,
      car.y + CHASE.height,
      car.z - dirZ * CHASE.distance,
    );
    this.lookTargetX = car.x + roadPoint.tangentX * CHASE.lookAhead;
    this.lookTargetY = car.y + roadPoint.tangentY * CHASE.lookAhead;
    this.lookTargetZ = car.z + roadPoint.tangentZ * CHASE.lookAhead;
    this.shake = 0;
    this.travelWeight = 0;
    this.initialised = true;
    this.apply();
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  update(dt, vehicle, roadPoint, speedNorm, surfaceAt) {
    if (!this.initialised) return;

    if (this.mode === 'hood') {
      this.updateHood(dt, vehicle, speedNorm);
      return;
    }

    // Follow the way the car is travelling, not the way it points: in a
    // slide or a handbrake spin the body turns under a steady path, and a
    // camera tied to the body would swing round to the car's side and lose
    // it. At parking speeds (and in reverse, which tops out at 6 m/s) the
    // camera sits behind the body instead, so it settles behind the car
    // after a spin has stopped.
    const car = vehicle.renderPosition;
    const velocity = vehicle.chassis.velocity;
    const flatSpeed = Math.hypot(velocity.x, velocity.z);
    const travel = smoothstep(5, 10, flatSpeed);
    this.travelWeight += (travel - this.travelWeight) * Math.min(1, dt * 4);
    const heading = vehicle.renderHeading;
    const course = flatSpeed > 0.5 ? Math.atan2(velocity.x, velocity.z) : heading;
    const target = heading + wrapAngle(course - heading) * this.travelWeight;
    this.yaw += wrapAngle(target - this.yaw) * Math.min(1, dt * CHASE.yawRate);
    this.yaw = wrapAngle(this.yaw);

    const dirX = Math.sin(this.yaw);
    const dirZ = Math.cos(this.yaw);

    // Speed pulls the camera back and drops it a little; a car sliding
    // sideways pulls it back further, so the whole length of the car fits.
    const sideways = Math.abs(wrapAngle(heading - course)) * this.travelWeight;
    const distance = CHASE.distance + speedNorm * 1.6 + smoothstep(0.3, 1.2, sideways) * 2;
    const height = CHASE.height - speedNorm * 0.35;
    this.offset.set(
      car.x - dirX * distance,
      car.y + height,
      car.z - dirZ * distance,
    );
    this.position.lerp(this.offset, 1 - Math.exp(-CHASE.lag * dt));

    // The lerp cuts across the circle round the car when the yaw swings;
    // never let it bring the camera in over the car's roof.
    const awayX = this.position.x - car.x;
    const awayZ = this.position.z - car.z;
    const away = Math.hypot(awayX, awayZ);
    const nearest = CHASE.distance;
    if (away < nearest) {
      const scale = away > 0.01 ? nearest / away : 0;
      this.position.x = scale ? car.x + awayX * scale : car.x - dirX * nearest;
      this.position.z = scale ? car.z + awayZ * scale : car.z - dirZ * nearest;
    }

    // Never inside a crest, the verge or the ground behind the car.
    if (surfaceAt) {
      const floor = surfaceAt(this.position.x, this.position.z) + MIN_CLEARANCE;
      if (Number.isFinite(floor) && this.position.y < floor) this.position.y = floor;
    }

    // Look ahead: down the road while the camera points along it, which is
    // what makes the corners read as corners; along the camera's own
    // heading once the car has turned away from the road.
    const roadFlat = Math.hypot(roadPoint.tangentX, roadPoint.tangentZ) || 1;
    const along = (dirX * roadPoint.tangentX + dirZ * roadPoint.tangentZ) / roadFlat;
    const roadWeight = smoothstep(0.75, 0.95, along);
    let lookX = dirX + (roadPoint.tangentX / roadFlat - dirX) * roadWeight;
    let lookZ = dirZ + (roadPoint.tangentZ / roadFlat - dirZ) * roadWeight;
    const lookLength = Math.hypot(lookX, lookZ) || 1;
    lookX /= lookLength;
    lookZ /= lookLength;
    const lookY = roadPoint.tangentY * roadWeight;
    const aim = 1 - Math.exp(-CHASE.aimLag * dt);
    this.lookTargetX += (car.x + lookX * CHASE.lookAhead - this.lookTargetX) * aim;
    this.lookTargetY += (car.y + lookY * CHASE.lookAhead - this.lookTargetY) * aim;
    this.lookTargetZ += (car.z + lookZ * CHASE.lookAhead - this.lookTargetZ) * aim;
    this.keepCarInView(car);

    // Game time, not the wall clock, so the car lab repeats exactly.
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shake = this.shake * 0.35;

    this.camera.position.copy(this.position);
    if (shake > 0.002) {
      const time = this.time;
      this.camera.position.x += Math.sin(time * 47.3) * shake;
      this.camera.position.y += Math.sin(time * 61.7) * shake * 0.7;
      this.camera.position.z += Math.sin(time * 53.1) * shake;
    }
    this.lookAt.set(this.lookTargetX, this.lookTargetY, this.lookTargetZ);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.lookAt);
    // A little of the car's lean, banking included, bleeds into the camera.
    this.camera.rotateZ(vehicle.roll * 0.22);

    const targetFov = CHASE.baseFov + CHASE.fovKick * speedNorm;
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }

  // The aim point may wander from the car (look-ahead, aim lag), but never
  // so far that the car leaves the middle of the picture: if the angle
  // between them at the camera passes MAX_AIM_OFF, swing the aim back
  // towards the car until it does not. Normal driving sits near 15 degrees
  // and never reaches the limit.
  keepCarInView(car) {
    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;
    let cx = car.x - px;
    let cy = car.y - py;
    let cz = car.z - pz;
    const carLength = Math.hypot(cx, cy, cz);
    let ax = this.lookTargetX - px;
    let ay = this.lookTargetY - py;
    let az = this.lookTargetZ - pz;
    const aimLength = Math.hypot(ax, ay, az);
    if (carLength < 0.01 || aimLength < 0.01) return;
    cx /= carLength;
    cy /= carLength;
    cz /= carLength;
    ax /= aimLength;
    ay /= aimLength;
    az /= aimLength;
    const angle = Math.acos(Math.max(-1, Math.min(1, cx * ax + cy * ay + cz * az)));
    if (angle <= MAX_AIM_OFF) return;
    // Counted for the car lab, which checks normal driving never needs it.
    this.aimClamps += 1;

    // Rotate the car direction towards the aim by MAX_AIM_OFF, in their
    // common plane.
    let ox = ax - cx * Math.cos(angle);
    let oy = ay - cy * Math.cos(angle);
    let oz = az - cz * Math.cos(angle);
    const orthoLength = Math.hypot(ox, oy, oz);
    if (orthoLength < 1e-6) {
      // Aim exactly behind the camera: look straight at the car.
      ox = 0;
      oy = 0;
      oz = 0;
    } else {
      ox /= orthoLength;
      oy /= orthoLength;
      oz /= orthoLength;
    }
    const cos = Math.cos(MAX_AIM_OFF);
    const sin = Math.sin(MAX_AIM_OFF);
    const reach = Math.max(CHASE.lookAhead * 0.5, aimLength);
    this.lookTargetX = px + (cx * cos + ox * sin) * reach;
    this.lookTargetY = py + (cy * cos + oy * sin) * reach;
    this.lookTargetZ = pz + (cz * cos + oz * sin) * reach;
  }

  updateHood(dt, vehicle, speedNorm) {
    const car = vehicle.renderPosition;
    this.hoodOffset.set(0, HOOD_HEIGHT, HOOD_FORWARD);
    this.hoodLook.set(0, -0.4, -24);
    vehicle.rotateVector(this.hoodOffset, this.hoodOffset);
    vehicle.rotateVector(this.hoodLook, this.hoodLook);

    this.camera.position.set(
      car.x + this.hoodOffset.x,
      car.y + this.hoodOffset.y,
      car.z + this.hoodOffset.z,
    );
    this.lookAt.set(
      this.camera.position.x + this.hoodLook.x,
      this.camera.position.y + this.hoodLook.y,
      this.camera.position.z + this.hoodLook.z,
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.lookAt);

    const targetFov = HOOD.baseFov + HOOD.fovKick * speedNorm;
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }

  apply() {
    this.camera.position.copy(this.position);
    this.lookAt.set(this.lookTargetX, this.lookTargetY, this.lookTargetZ);
    this.camera.lookAt(this.lookAt);
  }
}