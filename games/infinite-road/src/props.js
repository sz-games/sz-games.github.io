// Trees, bushes, rocks and road furniture (plan 4.3.5, stage M).
//
// Everything is an InstancedMesh of a tiny procedural model, one draw call
// per kind. Nothing here collides (plan 1.4: trees and signs do not stop
// the car).
//
// Scenery is scattered per near terrain tile when the tile is built, inside
// the terrain's own time budget, from a random stream seeded by the tile's
// grid position: the same square always grows the same trees, whatever its
// detail level. Each tile keeps its instance matrices; the instanced
// buffers are refilled from the visible tiles only when that set changes.
//
// Marker posts and chevrons follow the road: refilled each time the car
// passes a road chunk.

import * as THREE from 'three';
import { VERGE_WIDTH, GROUND_DROP } from './roadmesh.js';
import { CHUNK_LENGTH } from './road.js';

const SCRATCH = new THREE.Matrix4();
const POSITION = new THREE.Vector3();
const QUATERNION = new THREE.Quaternion();
const SCALE = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Per tile, before the tier's density scale.
const KINDS = ['pine', 'broadleaf', 'bush', 'rock'];
const PER_TILE = { pine: 70, broadleaf: 50, bush: 50, rock: 30 };
const CANDIDATES = 260;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------- models

// Merge non-indexed parts, each painted one colour, into one geometry.
function merge(parts) {
  let count = 0;
  const prepared = parts.map(([geometry, color]) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    flat.computeVertexNormals();
    count += flat.attributes.position.count;
    return [flat, new THREE.Color(color)];
  });
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let at = 0;
  for (const [geometry, color] of prepared) {
    const n = geometry.attributes.position.count;
    positions.set(geometry.attributes.position.array, at * 3);
    normals.set(geometry.attributes.normal.array, at * 3);
    for (let i = 0; i < n; i += 1) {
      colors[(at + i) * 3] = color.r;
      colors[(at + i) * 3 + 1] = color.g;
      colors[(at + i) * 3 + 2] = color.b;
    }
    at += n;
    geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

function translated(geometry, x, y, z) {
  geometry.translate(x, y, z);
  return geometry;
}

// Jitter the vertices of a low poly blob so no two kinds look machined.
function lumpy(geometry, amount, seed) {
  const random = mulberry32(seed);
  const position = geometry.attributes.position;
  const seen = new Map();
  for (let i = 0; i < position.count; i += 1) {
    const key = position.getX(i).toFixed(3) + ',' + position.getY(i).toFixed(3) + ',' + position.getZ(i).toFixed(3);
    let factor = seen.get(key);
    if (factor === undefined) {
      factor = 1 + (random() - 0.5) * amount;
      seen.set(key, factor);
    }
    position.setXYZ(i, position.getX(i) * factor, position.getY(i) * factor, position.getZ(i) * factor);
  }
  return geometry;
}

// All models are 1 unit-ish tall at scale 1 and stand on y = 0. The trunk
// reaches a little below the ground so a slope never shows its foot.
function makeModels() {
  const trunk = 0x6b4a32;
  return {
    pine: merge([
      [translated(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5), 0, 0.1, 0), trunk],
      [translated(new THREE.ConeGeometry(0.42, 0.62, 7), 0, 0.55, 0), 0x2f5a34],
      [translated(new THREE.ConeGeometry(0.32, 0.5, 7), 0, 0.85, 0), 0x356a3a],
    ]),
    broadleaf: merge([
      [translated(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 5), 0, 0.15, 0), trunk],
      [translated(lumpy(new THREE.IcosahedronGeometry(0.38, 0), 0.35, 7), 0, 0.72, 0), 0x4f8a3a],
    ]),
    bush: merge([
      [translated(lumpy(new THREE.IcosahedronGeometry(0.5, 0), 0.4, 11), 0, 0.25, 0), 0x6f8a44],
    ]),
    rock: merge([
      [translated(lumpy(new THREE.DodecahedronGeometry(0.5, 0), 0.5, 13), 0, 0.15, 0), 0x8a8580],
    ]),
    post: merge([
      [translated(new THREE.BoxGeometry(0.12, 1.0, 0.12), 0, 0.5, 0), 0xf2f2ee],
      [translated(new THREE.BoxGeometry(0.13, 0.18, 0.13), 0, 0.82, 0), 0xe06a1c],
    ]),
    chevron: merge([
      [translated(new THREE.BoxGeometry(0.08, 1.2, 0.08), 0, 0.6, 0), 0x707070],
      [translated(new THREE.BoxGeometry(0.9, 0.62, 0.04), 0, 1.45, 0), 0xf2c21b],
      [translated(new THREE.BoxGeometry(0.22, 0.5, 0.05), -0.12, 1.45, 0), 0x1d1d1d],
      [translated(new THREE.BoxGeometry(0.22, 0.5, 0.05), 0.2, 1.45, 0), 0x1d1d1d],
    ]),
  };
}

// --------------------------------------------------------------- scenery

class TileProps {
  constructor(scale) {
    this.matrices = {};
    this.colors = {};
    this.counts = {};
    for (const kind of KINDS) {
      const capacity = Math.ceil(PER_TILE[kind] * scale);
      this.matrices[kind] = new Float32Array(capacity * 16);
      this.colors[kind] = new Float32Array(capacity * 3);
      this.counts[kind] = 0;
    }
  }
}

export class Props {
  constructor(scene, terrain, road, options = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.road = road;
    this.half = road.width / 2;
    this.models = makeModels();
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.group = new THREE.Group();
    this.group.name = 'props';
    scene.add(this.group);
    this.version = -1;
    this.color = new THREE.Color();

    this.setTier(options.tier);

    // Road furniture: marker posts both sides, chevrons on tight bends.
    this.posts = this.makeMesh('post', 160, true);
    this.chevrons = this.makeMesh('chevron', 80, true);
    this.furnitureChunk = NaN;

    terrain.onNearTileReady = (tile) => this.scatter(tile);
  }

  // Every mesh sharing the material has instance colours (white when it
  // needs none): a mix would make three swap shader programs between them
  // twice a frame.
  makeMesh(kind, capacity, white = false) {
    const mesh = new THREE.InstancedMesh(this.models[kind], this.material, capacity);
    mesh.count = 0;
    if (white) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.name = kind;
    this.group.add(mesh);
    return mesh;
  }

  setTier(tier) {
    const props = tier.props || { density: 1, shadows: false };
    this.density = props.density;
    this.shadows = props.shadows;
    if (!this.meshes) this.meshes = {};
    // Capacity: every near tile the tier can show, plus the ones kept while
    // their replacements build.
    const tiles = (2 * tier.terrain.nearRadius + 1) ** 2 + 2 * (2 * tier.terrain.nearRadius + 1) + 4;
    for (const kind of KINDS) {
      const capacity = tiles * Math.ceil(PER_TILE[kind] * this.density);
      const old = this.meshes[kind];
      if (old && old.instanceMatrix.count >= capacity) {
        old.castShadow = this.shadows;
        continue;
      }
      if (old) {
        this.group.remove(old);
        old.dispose();
      }
      const mesh = this.makeMesh(kind, capacity);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = this.shadows;
      this.meshes[kind] = mesh;
    }
    this.version = -1;
  }

  // Scatter one near tile's scenery into its own cache.
  scatter(tile) {
    if (!tile.props || tile.props.density !== this.density) {
      tile.props = new TileProps(this.density);
      tile.props.density = this.density;
    }
    const props = tile.props;
    for (const kind of KINDS) props.counts[kind] = 0;

    const size = tile.tileSize;
    const cells = tile.cells;
    const cell = size / cells;
    const side = cells + 1;
    const tx = Math.round(tile.originX / size);
    const tz = Math.round(tile.originZ / size);
    const random = mulberry32((Math.imul(tx, 73856093) ^ Math.imul(tz, 19349663) ^ 0x5eed) >>> 0);
    const clear = this.half + VERGE_WIDTH + 3.5;
    const terrain = this.terrain;
    const candidates = Math.round(CANDIDATES * this.density);

    for (let i = 0; i < candidates; i += 1) {
      // Draw every random number up front, so the stream never depends on
      // which branch was taken.
      const u = random();
      const v = random();
      const pick = random();
      const spin = random() * Math.PI * 2;
      const grow = random();
      const tint = random();

      const x = tile.originX + u * size;
      const z = tile.originZ + v * size;
      const gx = Math.min(cells - 1e-6, u * cells);
      const gz = Math.min(cells - 1e-6, v * cells);
      const column = Math.floor(gx);
      const row = Math.floor(gz);
      const fx = gx - column;
      const fz = gz - row;
      const at = row * side + column;

      // Distance to the road, bilinear from the tile's own grid.
      const d00 = tile.distances[at];
      const d10 = tile.distances[at + 1];
      const d01 = tile.distances[at + side];
      const d11 = tile.distances[at + side + 1];
      const distance = (d00 * (1 - fx) + d10 * fx) * (1 - fz) + (d01 * (1 - fx) + d11 * fx) * fz;
      if (distance < clear) continue;

      // Height on the drawn triangle, and the slope from the normals.
      const p = tile.positions;
      const h00 = p[at * 3 + 1];
      const h11 = p[(at + side + 1) * 3 + 1];
      let height;
      if (fx >= fz) {
        const h10 = p[(at + 1) * 3 + 1];
        height = h00 + (h10 - h00) * fx + (h11 - h10) * fz;
      } else {
        const h01 = p[(at + side) * 3 + 1];
        height = h00 + (h01 - h00) * fz + (h11 - h01) * fx;
      }
      const normalY = tile.normals[at * 3 + 1];
      const dry = terrain.biomeAt(x, z);
      const forest = terrain.forestAt(x, z);
      const lift = tile.lifts[at];

      let kind;
      let scale;
      if (normalY < 0.8) {
        if (pick > 0.5) continue;
        kind = 'rock';
      } else if (dry > 0.5) {
        // Dry country: scattered bushes and rocks, the odd tree in hollows.
        if (pick < 0.32) kind = 'bush';
        else if (pick < 0.45) kind = 'rock';
        else if (pick < 0.52 && forest > 0.3) kind = 'broadleaf';
        else continue;
      } else {
        // Green hills: woods where the forest noise says so, pines higher up.
        const woods = 0.12 + forest * 0.75;
        if (pick < woods) kind = lift > 30 || pick < woods * 0.4 ? 'pine' : 'broadleaf';
        else if (pick < woods + 0.08) kind = 'bush';
        else if (pick < woods + 0.11) kind = 'rock';
        else continue;
      }
      // Trees keep a little further from the road than bushes and rocks.
      if ((kind === 'pine' || kind === 'broadleaf') && distance < clear + 4) continue;
      const count = props.counts[kind];
      if (count * 16 >= props.matrices[kind].length) continue;

      if (kind === 'pine') scale = 8 + grow * 9;
      else if (kind === 'broadleaf') scale = 6 + grow * 6;
      else if (kind === 'bush') scale = 1.2 + grow * 1.6;
      else scale = 0.8 + grow * grow * 3.2;

      POSITION.set(x, height - (kind === 'rock' ? scale * 0.15 : 0.1), z);
      QUATERNION.setFromAxisAngle(UP, spin);
      SCALE.set(scale, scale * (kind === 'rock' ? 0.7 + tint * 0.5 : 1), scale);
      SCRATCH.compose(POSITION, QUATERNION, SCALE);
      SCRATCH.toArray(props.matrices[kind], count * 16);

      // Tint: drier and paler in the dry country, a little variety always.
      const variety = 0.85 + tint * 0.3;
      if (kind === 'rock') this.color.setRGB(variety, variety * 0.98, variety * 0.95);
      else this.color.setRGB(variety * (1 + dry * 0.55), variety * (1 + dry * 0.15), variety * (1 - dry * 0.25));
      props.colors[kind][count * 3] = this.color.r;
      props.colors[kind][count * 3 + 1] = this.color.g;
      props.colors[kind][count * 3 + 2] = this.color.b;
      props.counts[kind] = count + 1;
    }
    tile.propsKey = tile.key;
  }

  // Refill the instanced buffers from the visible near tiles when the set
  // has changed, and the road furniture when the car passes a chunk.
  update(carS) {
    if (this.terrain.version !== this.version) {
      this.version = this.terrain.version;
      this.refill();
    }
    const chunk = Math.floor(carS / CHUNK_LENGTH);
    if (chunk !== this.furnitureChunk) {
      this.furnitureChunk = chunk;
      this.placeFurniture(carS);
    }
  }

  refill() {
    const counts = {};
    for (const kind of KINDS) counts[kind] = 0;
    for (const tile of this.terrain.nearTiles.values()) {
      if (!tile.ready || !tile.mesh.visible) continue;
      if (tile.propsKey !== tile.key || !tile.props || tile.props.density !== this.density) this.scatter(tile);
      for (const kind of KINDS) {
        const mesh = this.meshes[kind];
        const n = Math.min(tile.props.counts[kind], mesh.instanceMatrix.count - counts[kind]);
        if (n <= 0) continue;
        mesh.instanceMatrix.array.set(tile.props.matrices[kind].subarray(0, n * 16), counts[kind] * 16);
        mesh.instanceColor.array.set(tile.props.colors[kind].subarray(0, n * 3), counts[kind] * 3);
        counts[kind] += n;
      }
    }
    for (const kind of KINDS) {
      const mesh = this.meshes[kind];
      mesh.count = counts[kind];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
    this.counts = counts;
  }

  // Marker posts every 48 m each side, chevrons on the outside of tight
  // bends, from 200 m behind the car to 900 m ahead.
  placeFurniture(carS) {
    const road = this.road;
    const first = Math.max(road.firstIndex + 1, Math.floor((carS - 200) / 4));
    const last = Math.min(road.lastIndex - 1, Math.floor((carS + 900) / 4));
    const posts = this.posts;
    const chevrons = this.chevrons;
    let postCount = 0;
    let chevronCount = 0;
    const lateral = this.half + 1.3;

    for (let index = first; index <= last; index += 1) {
      const point = road.sample(index);
      const tan = Math.tan(point.bank);
      const edge = (side) => point.y - side * this.half * tan;
      // Height of the verge at the post: down from the tarmac edge.
      const vergeY = (side) => {
        const e = edge(side);
        return e + (point.y - GROUND_DROP - e) * ((lateral - this.half) / VERGE_WIDTH);
      };
      const heading = Math.atan2(point.tx, point.tz);

      if (index % 12 === 0 && postCount + 2 <= posts.instanceMatrix.count) {
        for (const side of [-1, 1]) {
          POSITION.set(point.x + point.rx * lateral * side, vergeY(side), point.z + point.rz * lateral * side);
          QUATERNION.setFromAxisAngle(UP, heading);
          SCALE.set(1, 1, 1);
          SCRATCH.compose(POSITION, QUATERNION, SCALE);
          posts.setMatrixAt(postCount, SCRATCH);
          postCount += 1;
        }
      }

      const curvature = point.curvature;
      if (Math.abs(curvature) > 1 / 120 && index % 6 === 3 && chevronCount < chevrons.instanceMatrix.count) {
        // Outside of the bend: a right hander (positive) puts it on the left.
        const side = curvature > 0 ? -1 : 1;
        const out = lateral + 0.6;
        POSITION.set(point.x + point.rx * out * side, vergeY(side) - 0.05, point.z + point.rz * out * side);
        // Face the oncoming driver; mirror the arrow for left handers.
        QUATERNION.setFromAxisAngle(UP, heading + Math.PI);
        SCALE.set(curvature > 0 ? 1 : -1, 1, 1);
        SCRATCH.compose(POSITION, QUATERNION, SCALE);
        chevrons.setMatrixAt(chevronCount, SCRATCH);
        chevronCount += 1;
      }
    }
    posts.count = postCount;
    chevrons.count = chevronCount;
    posts.instanceMatrix.needsUpdate = true;
    chevrons.instanceMatrix.needsUpdate = true;
  }

  get instanceCount() {
    let total = this.posts.count + this.chevrons.count;
    for (const kind of KINDS) total += this.meshes[kind].count;
    return total;
  }
}
