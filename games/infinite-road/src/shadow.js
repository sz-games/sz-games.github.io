// A soft blob shadow under the car for the tiers without shadow maps.
//
// Without it a Low or Medium car seems to hover: nothing ties it to the
// road. The texture is drawn at start-up, so it costs no download, and the
// quad lies on the banked road surface under the drawn car.

import * as THREE from 'three';

const LENGTH = 3.9;
const WIDTH = 2.1;
const FADE_HEIGHT = 3; // metres over the road at which the shadow is gone

function makeTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class BlobShadow {
  constructor(scene) {
    this.material = new THREE.MeshBasicMaterial({
      map: makeTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const geometry = new THREE.PlaneGeometry(WIDTH, LENGTH);
    geometry.rotateX(-Math.PI / 2); // lie flat, long side along Z
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'car-shadow';
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.enabled = true;
    this.normal = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.basis = new THREE.Matrix4();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.mesh.visible = enabled;
  }

  update(vehicle, surfaceAt, roadPoint, halfWidth) {
    if (!this.enabled) return;
    const position = vehicle.renderPosition;
    const ground = surfaceAt(position.x, position.z);
    if (!Number.isFinite(ground)) {
      this.mesh.visible = false;
      return;
    }
    const height = position.y - vehicle.restHeight() - ground;
    const fade = 1 - Math.min(1, Math.max(0, height) / FADE_HEIGHT);
    this.mesh.visible = fade > 0.02;
    this.material.opacity = 0.5 * fade;

    // Lie on the banked tarmac on the road, level off it.
    if (Math.abs(roadPoint.lateral) < halfWidth) {
      const cos = Math.cos(roadPoint.bank);
      const sin = Math.sin(roadPoint.bank);
      const ax = roadPoint.rightX * cos;
      const ay = -sin;
      const az = roadPoint.rightZ * cos;
      const tx = roadPoint.tangentX;
      const ty = roadPoint.tangentY;
      const tz = roadPoint.tangentZ;
      this.normal.set(ay * tz - az * ty, az * tx - ax * tz, ax * ty - ay * tx).normalize();
    } else {
      this.normal.set(0, 1, 0);
    }

    // Long axis along the car's heading, projected onto the surface.
    this.forward.copy(vehicle.renderForward);
    this.forward.addScaledVector(this.normal, -this.forward.dot(this.normal));
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.right.crossVectors(this.forward, this.normal).normalize();
    // Local X is right, Y the surface normal, Z backwards.
    this.basis.makeBasis(this.right, this.normal, this.forward.negate());
    this.mesh.quaternion.setFromRotationMatrix(this.basis);
    this.mesh.position.set(position.x, ground + 0.03, position.z);
  }
}
