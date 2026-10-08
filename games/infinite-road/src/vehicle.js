// Arcade car handling on top of a cannon-es RaycastVehicle (plan 4.5).
//
// Six numbers do the tuning: mass, engine force, brake force, maximum
// steering, suspension stiffness and tyre friction. Everything else is a
// driving-feel layer on top of those: speed sensitive steering that ramps in,
// a handbrake that loosens the rear tyres, air pitch control, drag and
// downforce.
//
// The chassis origin is the centre of mass. It sits low and halfway between
// the axles, and the wheels sit where the Kenney model draws them, so the
// car can neither trip over its own track width nor stand on its nose under
// braking.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export const CAR_SCALE = 1.3;

// Layout in metres, chassis space. cannon-es drives a RaycastVehicle toward
// the body's -Z (the rolling direction is worldUp crossed with the right
// axis), so the car travels along -Z, +X is its right-hand side and the
// model, which faces +Z, is turned 180 degrees.
//
// The Kenney model at CAR_SCALE: wheels 0.39 m radius, centred 0.65 m out
// from the middle, axles 1.98 m apart; body 3.3 m long, 1.56 m wide.
const WHEEL_RADIUS = 0.39;
const WHEEL_X = 0.65;
const WHEELBASE = 1.976;
const WHEEL_FRONT_Z = -WHEELBASE / 2;
const WHEEL_REAR_Z = WHEELBASE / 2;
// The model's own axles sit 0.156 m behind its origin's midpoint.
const MODEL_Z = -0.156;
const CG_HEIGHT = 0.45; // centre of mass over the road at rest
const REST_LENGTH = 0.3;
const MAX_TRAVEL = 0.2;
const GRAVITY = 9.82;
const UP = new CANNON.Vec3(0, 1, 0);

export const TUNE = {
  mass: 780,
  engineForce: 2100, // newtons per driven wheel
  brakeForce: 9000, // newtons for the whole car
  maxSteering: 0.62, // radians, the parking lock
  suspensionStiffness: 30,
  frictionSlip: 1.4, // tyre grip in g
};

// Spring sag at rest decides where the springs mount: the wheels have to
// meet the road exactly where the model draws them.
function sagFor(stiffness) {
  return GRAVITY / (4 * stiffness);
}

// Feel constants, not part of the six tuning numbers.
// Steering is sized from grip, not from a curve: the lateral acceleration a
// steering angle asks for is v^2 * tan(lock) / wheelbase, so the lock that
// uses a fixed share of the available grip is wheelbase * grip / v^2.
const STEER_GRIP_SHARE = 0.95;
const MIN_STEER_LOCK = 0.006;
const STEER_RATE_IN = 6; // full lock in about 0.17 s
const STEER_RATE_OUT = 9; // back to centre in about 0.11 s
const FRONT_BRAKE_SHARE = 0.62;
const HANDBRAKE_FORCE = 5200; // newtons per rear wheel: locks them
const HANDBRAKE_GRIP = 0.5;
const OFFROAD_GRIP = 0.8;
const OFFROAD_DRAG = 600; // newtons of grass drag
const OFFROAD_ROLLING = 90; // more newtons of grass drag per m/s
const OFFROAD_ENGINE = 0.7; // share of engine force on grass
// Low gear pull: extra engine force at a standstill, fading out by
// PULL_FADE m/s, so the car leaps away but the top speed stays the same.
const LOW_GEAR_PULL = 0.3;
const PULL_FADE = 40;
const ENGINE_BRAKE = 450; // newtons of engine braking with no throttle
const DRAG_COEFFICIENT = 0.95; // times speed squared
const DOWNFORCE = 0.5;
const AIR_PITCH_TORQUE = 2600;
const REVERSE_FORCE = 0.35; // share of engine force in reverse
const REVERSE_SPEED = 6;
const FIXED_STEP = 1 / 60;
const MAX_STEPS = 4;

// The hull: spheres, because cannon-es has no box against trimesh test. The
// lower four keep the floor off the road on a hard landing, the upper two
// let an overturned car rest on its roof or its side instead of sinking.
const HULL = [
  [0.48, 0.0, -1.05, 0.28],
  [-0.48, 0.0, -1.05, 0.28],
  [0.48, 0.0, 1.1, 0.28],
  [-0.48, 0.0, 1.1, 0.28],
  [0.3, 0.26, 0.1, 0.28],
  [-0.3, 0.26, 0.1, 0.28],
];

// Visual body lean on top of the physics, in radians per g.
const LEAN_ROLL = 0.045;
const LEAN_PITCH = 0.03;

// Top speed in metres per second. Used by the camera, the audio and the
// gearbox, so the whole car agrees on how fast "fast" is.
export const MAX_SPEED = 60;

// Fake gearbox, used for the engine note and the rev bar.
const GEAR_TOPS = [11, 20, 31, 45, 70];

export const chassisMaterial = new CANNON.Material('chassis');

export class Vehicle {
  constructor(world, tune = TUNE) {
    this.world = world;
    this.tune = tune;

    this.chassis = new CANNON.Body({
      mass: tune.mass,
      material: chassisMaterial,
      angularDamping: 0.25,
      linearDamping: 0,
    });
    for (const [x, y, z, radius] of HULL) {
      this.chassis.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(x, y, z));
    }
    // Inertia of the real body box, not of the sphere cluster's bounds.
    this.setInertia();

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassis,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const connectionY = this.connectionY();
    const wheel = {
      radius: WHEEL_RADIUS,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: tune.suspensionStiffness,
      suspensionRestLength: REST_LENGTH,
      frictionSlip: tune.frictionSlip,
      dampingRelaxation: 3.4,
      dampingCompression: 2.4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.08,
      axleLocal: new CANNON.Vec3(1, 0, 0),
      maxSuspensionTravel: MAX_TRAVEL,
      useCustomSlidingRotationalSpeed: false,
    };

    // 0 front right, 1 front left, 2 rear right, 3 rear left.
    this.vehicle.addWheel({ ...wheel, chassisConnectionPointLocal: new CANNON.Vec3(WHEEL_X, connectionY, WHEEL_FRONT_Z) });
    this.vehicle.addWheel({ ...wheel, chassisConnectionPointLocal: new CANNON.Vec3(-WHEEL_X, connectionY, WHEEL_FRONT_Z) });
    this.vehicle.addWheel({ ...wheel, chassisConnectionPointLocal: new CANNON.Vec3(WHEEL_X, connectionY, WHEEL_REAR_Z) });
    this.vehicle.addWheel({ ...wheel, chassisConnectionPointLocal: new CANNON.Vec3(-WHEEL_X, connectionY, WHEEL_REAR_Z) });

    this.vehicle.addToWorld(world);

    // Visual nodes. bodyNode follows the interpolated chassis pose; the
    // model and the wheels are its children, in chassis space.
    this.bodyNode = null;
    this.modelNode = null;
    this.wheelNodes = [];
    this.wheelAngles = [0, 0, 0, 0];
    this.wheelSpinRates = [0, 0, 0, 0];

    // Render interpolation: the pose before and after the last fixed step.
    this.previousPosition = new THREE.Vector3();
    this.previousQuaternion = new THREE.Quaternion();
    this.currentPosition = new THREE.Vector3();
    this.currentQuaternion = new THREE.Quaternion();
    this.renderPosition = new THREE.Vector3();
    this.renderQuaternion = new THREE.Quaternion();

    this.forward = new THREE.Vector3(0, 0, -1);
    this.renderForward = new THREE.Vector3(0, 0, -1);
    this.speed = 0;
    this.rpm = 0.2;
    this.gear = 1;
    this.slip = 0;
    this.airborne = false;
    this.landing = 0;
    this.wasAirborne = false;
    this.engineBrake = 0;
    this.steerValue = 0;
    this.handbrakeOn = false;
    this.accumulator = 0;
    this.lateralG = 0;
    this.longitudinalG = 0;
    this.lean = { roll: 0, pitch: 0, rollSpeed: 0, pitchSpeed: 0 };
    this.lastVelocity = new CANNON.Vec3();

    this.roll = 0;
    this.scratchForward = new CANNON.Vec3();
    this.scratchRotate = new CANNON.Vec3();
    this.drag = new CANNON.Vec3();
    this.downforce = new CANNON.Vec3();
    this.basis = new THREE.Matrix4();
    this.basisX = new THREE.Vector3();
    this.basisY = new THREE.Vector3();
    this.basisZ = new THREE.Vector3();
    this.basisQuaternion = new THREE.Quaternion();

    this.capturePose();
    this.capturePose();
  }

  connectionY() {
    return -CG_HEIGHT + WHEEL_RADIUS + REST_LENGTH - sagFor(this.tune.suspensionStiffness);
  }

  setInertia() {
    const body = this.chassis;
    const mass = this.tune.mass;
    const x = 1.56;
    const y = 0.8;
    const z = 3.3;
    body.mass = mass;
    body.invMass = mass > 0 ? 1 / mass : 0;
    body.inertia.set(
      mass / 12 * (y * y + z * z),
      mass / 12 * (x * x + z * z),
      mass / 12 * (x * x + y * y),
    );
    body.invInertia.set(1 / body.inertia.x, 1 / body.inertia.y, 1 / body.inertia.z);
    body.updateInertiaWorld(true);
  }

  // The car group follows the chassis; the model inside it is dropped to the
  // road and slid back so its axles meet the physics wheels.
  setBodyNode(node) {
    this.bodyNode = node;
    this.modelNode = new THREE.Group();
    this.modelNode.position.set(0, -CG_HEIGHT, MODEL_Z);
    this.modelNode.rotation.y = Math.PI; // the model faces +Z, the car -Z
    this.modelNode.scale.setScalar(CAR_SCALE);
    this.leanNode = new THREE.Group();
    this.leanNode.add(this.modelNode);
    node.add(this.leanNode);
  }

  // Wheel meshes from the model, by name. Each is wrapped in a node that
  // sits on the physics wheel centre: the node steers and spins, the mesh
  // inside it is turned like the model and centred on its own bounds.
  setWheelMeshes(meshes) {
    const order = ['wheel-front-right', 'wheel-front-left', 'wheel-back-right', 'wheel-back-left'];
    this.wheelNodes = [];
    const box = new THREE.Box3();
    const centre = new THREE.Vector3();
    for (const name of order) {
      const mesh = meshes.find((candidate) => candidate.name === name);
      const holder = new THREE.Group();
      holder.name = name;
      if (mesh) {
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, Math.PI, 0);
        mesh.scale.setScalar(CAR_SCALE);
        mesh.updateMatrixWorld(true);
        box.setFromObject(mesh);
        box.getCenter(centre);
        mesh.position.copy(centre).negate();
        holder.add(mesh);
      }
      this.bodyNode.add(holder);
      this.wheelNodes.push(holder);
    }
    this.syncWheels();
  }

  // Live tuning from the settings panel: everything read per step updates
  // itself, the wheel setup and the mass have to be pushed in.
  applyTuning() {
    this.setInertia();
    const connectionY = this.connectionY();
    for (const info of this.vehicle.wheelInfos) {
      info.suspensionStiffness = this.tune.suspensionStiffness;
      info.maxSuspensionForce = 100000;
      info.chassisConnectionPointLocal.y = connectionY;
    }
  }

  // Put the car on the road surface at a midline sample, lined up with the
  // road: facing down it, pitched with the climb and rolled with the bank.
  // `lateral` keeps it in its lane when the recovery puts it back in place.
  reset(point, lateral = 0) {
    const body = this.chassis;
    const cos = Math.cos(point.bank);
    const sin = Math.sin(point.bank);
    // The banked road frame, as the road mesh builds it.
    const ax = point.rightX * cos;
    const ay = -sin;
    const az = point.rightZ * cos;
    const tx = point.tangentX;
    const ty = point.tangentY;
    const tz = point.tangentZ;
    let ux = ay * tz - az * ty;
    let uy = az * tx - ax * tz;
    let uz = ax * ty - ay * tx;
    const length = Math.hypot(ux, uy, uz) || 1;
    ux /= length;
    uy /= length;
    uz /= length;

    const offset = lateral / Math.max(0.5, cos);
    const lift = CG_HEIGHT + 0.03;
    body.position.set(
      point.x + ax * offset + ux * lift,
      point.height + ay * offset + uy * lift,
      point.z + az * offset + uz * lift,
    );

    // Local +X is right, +Y up and +Z backwards (the car drives along -Z).
    this.basisX.set(ax, ay, az);
    this.basisY.set(ux, uy, uz);
    this.basisZ.set(-tx, -ty, -tz);
    this.basis.makeBasis(this.basisX, this.basisY, this.basisZ);
    this.basisQuaternion.setFromRotationMatrix(this.basis);
    body.quaternion.set(this.basisQuaternion.x, this.basisQuaternion.y,
      this.basisQuaternion.z, this.basisQuaternion.w);

    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.force.setZero();
    body.torque.setZero();
    body.wakeUp();
    body.aabbNeedsUpdate = true;
    body.updateAABB();

    const restLength = REST_LENGTH - sagFor(this.tune.suspensionStiffness);
    for (const info of this.vehicle.wheelInfos) {
      info.rotation = 0;
      info.deltaRotation = 0;
      info.suspensionLength = restLength;
      info.engineForce = 0;
      info.brake = 0;
      info.steering = 0;
      info.sliding = false;
    }

    this.speed = 0;
    this.rpm = 0.2;
    this.gear = 1;
    this.slip = 0;
    this.landing = 0;
    this.airborne = false;
    this.wasAirborne = false;
    this.steerValue = 0;
    this.accumulator = 0;
    this.lateralG = 0;
    this.longitudinalG = 0;
    this.lean.roll = 0;
    this.lean.pitch = 0;
    this.lean.rollSpeed = 0;
    this.lean.pitchSpeed = 0;
    this.lastVelocity.setZero();
    this.wheelSpinRates.fill(0);

    this.updateForward();
    // No interpolation across a teleport.
    this.capturePose();
    this.capturePose();
    this.sync();
  }

  capturePose() {
    this.previousPosition.copy(this.currentPosition);
    this.previousQuaternion.copy(this.currentQuaternion);
    const p = this.chassis.position;
    const q = this.chassis.quaternion;
    this.currentPosition.set(p.x, p.y, p.z);
    this.currentQuaternion.set(q.x, q.y, q.z, q.w);
  }

  updateForward() {
    this.vehicle.getVehicleAxisWorld(2, this.scratchForward);
    // -Z is the direction of travel, see the layout note above.
    this.forward.set(-this.scratchForward.x, -this.scratchForward.y, -this.scratchForward.z);
    if (this.forward.lengthSq() > 1e-6) this.forward.normalize();

    // Roll about the car's own length: how high the right side sits.
    const q = this.chassis.quaternion;
    const rightY = 2 * (q.x * q.y + q.w * q.z);
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
    this.roll = Math.atan2(rightY, upY);
  }

  // Up vector's height: 1 upright, 0 on its side, -1 on the roof.
  get uprightness() {
    const q = this.chassis.quaternion;
    return 1 - 2 * (q.x * q.x + q.z * q.z);
  }

  // Rotate a vector by the drawn chassis orientation, in place.
  rotateVector(vector, result) {
    return result.copy(vector).applyQuaternion(this.renderQuaternion);
  }

  // Speed along the direction of travel, positive when driving forwards.
  get forwardSpeed() {
    return this.chassis.velocity.dot(this.forward);
  }

  // Grip the steering can count on right now, in m/s^2.
  gripAccel() {
    return this.tune.frictionSlip * GRAVITY;
  }

  // Full steering lock at the current speed, in radians.
  steerLock(speed = this.speed) {
    const grip = this.gripAccel() * STEER_GRIP_SHARE;
    return Math.min(
      this.tune.maxSteering,
      Math.max(MIN_STEER_LOCK, (WHEELBASE * grip) / Math.max(1, speed * speed)),
    );
  }

  // Height of the chassis origin over the road with the springs at rest.
  restHeight() {
    return CG_HEIGHT;
  }

  // Rate-limited steering: keys ask for full lock at once, the wheel gets
  // there in a third of a second and comes back faster.
  rampSteering(target, dt) {
    const current = this.steerValue;
    const outward = Math.abs(target) > Math.abs(current) && target * current >= 0;
    const rate = outward ? STEER_RATE_IN : STEER_RATE_OUT;
    const step = rate * dt;
    if (target > current) this.steerValue = Math.min(target, current + step);
    else this.steerValue = Math.max(target, current - step);
  }

  // Map the driving controls onto wheel forces for one physics step.
  applyControls(input, roadState, dt) {
    const speed = this.chassis.velocity.length();
    this.rampSteering(input.steer, dt);
    // A positive cannon steer value turns the car to its left, so the input
    // sign is flipped here.
    const steer = -this.steerValue * this.steerLock(speed);
    this.vehicle.setSteeringValue(steer, 0);
    this.vehicle.setSteeringValue(steer, 1);

    const offRoad = !roadState.onRoad;
    const forwardSpeed = this.chassis.velocity.dot(this.forward);
    this.handbrakeOn = Boolean(input.handbrake);

    let engine = 0;
    let brake = 0;
    if (input.throttle > 0) {
      const pull = 1 + LOW_GEAR_PULL * Math.max(0, 1 - Math.max(0, forwardSpeed) / PULL_FADE);
      engine = this.tune.engineForce * pull * input.throttle * (offRoad ? OFFROAD_ENGINE : 1);
    } else if (input.brake > 0) {
      if (forwardSpeed > 1) {
        // Rolling forwards: brake. Only reverse once the car has stopped.
        brake = input.brake;
      } else if (forwardSpeed > -REVERSE_SPEED) {
        engine = -this.tune.engineForce * REVERSE_FORCE * input.brake;
      }
    }
    if (input.handbrake) engine *= 0.1;
    // Hands off and nearly stopped: hold the car, so it does not creep down
    // a slope while the player looks around.
    const idle = input.throttle === 0 && input.brake === 0 && !input.handbrake;
    if (idle && speed < 1.5 && this.vehicle.numWheelsOnGround >= 3) brake = 0.35;

    // cannon-es engine force is a force; it applies force * dt per step.
    this.vehicle.applyEngineForce(engine, 2);
    this.vehicle.applyEngineForce(engine, 3);
    this.vehicle.applyEngineForce(0, 0);
    this.vehicle.applyEngineForce(0, 1);

    // cannon-es brake is an impulse cap per step, so force * dt.
    const total = this.tune.brakeForce * brake;
    const frontBrake = total * FRONT_BRAKE_SHARE / 2 * dt;
    const rearBrake = total * (1 - FRONT_BRAKE_SHARE) / 2 * dt;
    const grip = this.tune.frictionSlip * (offRoad ? OFFROAD_GRIP : 1);
    for (let index = 0; index < 4; index += 1) {
      const wheelInfo = this.vehicle.wheelInfos[index];
      const rear = index >= 2;
      if (rear && input.handbrake) {
        // Handbrake locks the rear wheels: they brake hard and lose grip.
        wheelInfo.brake = HANDBRAKE_FORCE * dt;
        wheelInfo.frictionSlip = grip * HANDBRAKE_GRIP;
      } else {
        wheelInfo.brake = rear ? rearBrake : frontBrake;
        wheelInfo.frictionSlip = grip;
      }
    }

    this.airborne = this.vehicle.numWheelsOnGround === 0;
    if (this.airborne) {
      // Air control about the car's own axle, as in PolyTrack.
      const pitch = (input.throttle - input.brake) * AIR_PITCH_TORQUE;
      this.scratchRotate.set(pitch, 0, 0);
      this.chassis.quaternion.vmult(this.scratchRotate, this.scratchRotate);
      this.chassis.torque.vadd(this.scratchRotate, this.chassis.torque);
    }

    if (this.wasAirborne && !this.airborne) this.landing = Math.min(1, Math.abs(this.chassis.velocity.y) / 8);
    this.wasAirborne = this.airborne;
    this.landing *= 0.9;
  }

  // Aerodynamic drag, grass drag and downforce. Applied as forces so the
  // suspension still does its job.
  applyForces(roadState) {
    const velocity = this.chassis.velocity;
    const speed = velocity.length();
    if (speed > 0.05) {
      const drag = DRAG_COEFFICIENT * speed * speed + this.engineBrake * ENGINE_BRAKE * Math.min(1, speed / 3);
      const extra = roadState.onRoad ? 0 : OFFROAD_DRAG * Math.min(1, speed / 3) + OFFROAD_ROLLING * speed;
      const total = drag + extra;
      this.drag.set(
        -velocity.x / speed * total,
        -velocity.y / speed * total * 0.15,
        -velocity.z / speed * total,
      );
      this.chassis.applyForce(this.drag);
    }

    if (speed > 4 && this.vehicle.numWheelsOnGround > 0) {
      // Downforce pushes along the car's own floor, not straight down.
      const force = DOWNFORCE * speed * speed;
      this.scratchRotate.set(0, -force, 0);
      this.chassis.quaternion.vmult(this.scratchRotate, this.downforce);
      this.chassis.applyForce(this.downforce);
    }
  }

  step(dt, input, roadState) {
    // Engine braking when the throttle is off, so coasting slows the car.
    this.engineBrake = input.throttle > 0 || input.brake > 0 ? 0 : 1;

    // Fixed timestep, at most four steps per frame, so the handling is the
    // same at 30 fps and at 144 fps. What is left over in the accumulator
    // becomes the blend between the last two poses when the car is drawn.
    this.accumulator = Math.min(this.accumulator + dt, FIXED_STEP * MAX_STEPS);
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS) {
      this.updateForward();
      this.applyControls(input, roadState, FIXED_STEP);
      this.applyForces(roadState);
      this.world.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps += 1;
      this.capturePose();
      this.afterStep(input);
    }

    this.updateForward();
    this.speed = this.chassis.velocity.length();
    this.updateGearbox();
    this.updateSlip();
  }

  // Per physics step bookkeeping for the visuals: g forces, wheel spin.
  afterStep(input) {
    const velocity = this.chassis.velocity;
    const ax = (velocity.x - this.lastVelocity.x) / FIXED_STEP;
    const ay = (velocity.y - this.lastVelocity.y) / FIXED_STEP;
    const az = (velocity.z - this.lastVelocity.z) / FIXED_STEP;
    this.lastVelocity.copy(velocity);
    this.scratchRotate.set(1, 0, 0);
    this.chassis.quaternion.vmult(this.scratchRotate, this.scratchRotate);
    const lateral = (ax * this.scratchRotate.x + ay * this.scratchRotate.y + az * this.scratchRotate.z) / GRAVITY;
    const longitudinal = (ax * this.forward.x + ay * this.forward.y + az * this.forward.z) / GRAVITY;
    // Light smoothing: contact impulses make single-step spikes.
    this.lateralG += (Math.max(-2, Math.min(2, lateral)) - this.lateralG) * 0.2;
    this.longitudinalG += (Math.max(-2, Math.min(2, longitudinal)) - this.longitudinalG) * 0.2;

    // Wheel spin from the road speed under each wheel. Locked wheels stop,
    // wheels in the air slowly run down, driven wheels spin up under full
    // throttle at low speed.
    const forwardSpeed = velocity.dot(this.forward);
    for (let index = 0; index < 4; index += 1) {
      const info = this.vehicle.wheelInfos[index];
      let rate;
      if (index >= 2 && this.handbrakeOn) rate = 0;
      else if (info.isInContact) {
        rate = forwardSpeed / WHEEL_RADIUS;
        if (index >= 2 && input.throttle > 0.5 && Math.abs(forwardSpeed) < 6 && info.sliding) rate += 18;
      } else rate = this.wheelSpinRates[index] * 0.985;
      this.wheelSpinRates[index] = rate;
      this.wheelAngles[index] = (this.wheelAngles[index] + rate * FIXED_STEP) % (Math.PI * 2);
    }
  }

  wheelSpinRate(index) {
    return this.wheelSpinRates[index];
  }

  // Fake gearbox: a gear change is audible in the engine note.
  updateGearbox() {
    const speed = Math.abs(this.forwardSpeed);
    let gear = 1;
    while (gear < GEAR_TOPS.length && speed > GEAR_TOPS[gear - 1]) gear += 1;
    this.gear = gear;
    const lower = gear === 1 ? 0 : GEAR_TOPS[gear - 2];
    const top = GEAR_TOPS[gear - 1];
    const within = Math.min(1, Math.max(0, (speed - lower) / (top - lower)));
    this.rpm += (0.18 + within * 0.82 - this.rpm) * 0.2;
  }

  // How sideways the car is: three sliding wheels is a slide, one is a
  // scrub on a bend.
  updateSlip() {
    let sliding = 0;
    for (const info of this.vehicle.wheelInfos) {
      if (info.isInContact && info.sliding) sliding += 1;
    }
    this.slip = Math.min(1, sliding / 3);
  }

  // Copy the physics onto the visible car, blended between the last two
  // physics steps so the picture moves evenly at any frame rate.
  sync(dt = 0) {
    const alpha = Math.min(1, Math.max(0, this.accumulator / FIXED_STEP));
    this.renderPosition.copy(this.previousPosition).lerp(this.currentPosition, alpha);
    this.renderQuaternion.copy(this.previousQuaternion).slerp(this.currentQuaternion, alpha);
    this.renderForward.set(0, 0, -1).applyQuaternion(this.renderQuaternion);

    if (this.bodyNode) {
      this.bodyNode.position.copy(this.renderPosition);
      this.bodyNode.quaternion.copy(this.renderQuaternion);
    }
    this.updateLean(dt);
    this.syncWheels();
  }

  // A soft spring leans the body against the g forces. Visual only.
  updateLean(dt) {
    if (!this.leanNode) return;
    const lean = this.lean;
    if (dt > 0) {
      const targetRoll = -this.lateralG * LEAN_ROLL;
      const targetPitch = this.longitudinalG * LEAN_PITCH;
      const stiffness = 90;
      const damping = 12;
      const step = Math.min(dt, 0.05);
      lean.rollSpeed += ((targetRoll - lean.roll) * stiffness - lean.rollSpeed * damping) * step;
      lean.pitchSpeed += ((targetPitch - lean.pitch) * stiffness - lean.pitchSpeed * damping) * step;
      lean.roll += lean.rollSpeed * step;
      lean.pitch += lean.pitchSpeed * step;
    }
    // Lean about a pivot at axle height, so the wheels stay in the arches.
    this.leanNode.rotation.set(lean.pitch, 0, lean.roll);
    this.leanNode.position.set(0, -CG_HEIGHT + WHEEL_RADIUS, 0);
    if (this.modelNode) this.modelNode.position.set(0, -WHEEL_RADIUS, MODEL_Z);
  }

  // Wheels in chassis space: spring length from the ray, steer about Y,
  // spin about the axle.
  syncWheels() {
    for (let index = 0; index < this.wheelNodes.length; index += 1) {
      const info = this.vehicle.wheelInfos[index];
      const node = this.wheelNodes[index];
      const connection = info.chassisConnectionPointLocal;
      node.position.set(connection.x, connection.y - info.suspensionLength, connection.z);
      node.rotation.set(0, 0, 0);
      node.rotation.order = 'YXZ';
      node.rotation.y = info.steering;
      // Rolling forward (-Z) turns the top of the wheel forward: negative X.
      node.rotation.x = -this.wheelAngles[index];
    }
  }

  get speedKmh() {
    return this.speed * 3.6;
  }

  get reversing() {
    return this.forwardSpeed < -REVERSE_SPEED;
  }

  // Yaw only, for the chase camera.
  get heading() {
    return Math.atan2(this.forward.x, this.forward.z);
  }

  // Yaw of the drawn car, for the camera.
  get renderHeading() {
    return Math.atan2(this.renderForward.x, this.renderForward.z);
  }
}
