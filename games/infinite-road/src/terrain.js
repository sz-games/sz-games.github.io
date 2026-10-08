// Streamed terrain with level of detail (plan 4.3, stage M).
//
// Two grids of square tiles follow the car:
//
//   near  256 m tiles, Chebyshev radius 1 (Low) or 2. The car's tile and its
//         neighbours use 8 m cells, the outer ring 16 m cells.
//   far   1024 m tiles with 32 m cells, radius 1, or 2 on High. Their
//         vertices inside the finished near square sink out of sight in
//         the vertex shader (plan 4.3.1), and the whole far grid sits a
//         little lower, so wherever both exist the near tile wins.
//
// Every tile edge has a skirt hanging down, which hides the cracks between
// neighbours of different detail.
//
// Height is a function of the world position, the seed, the tier and the
// road: the hills rise out of a strip that follows the road centre height
// GROUND_DROP below the tarmac, which is what the verges are built to meet.
// The road shape comes from a trace of the midline kept here for 10 km
// behind the car, so a tile built late agrees with one built early.
//
// Tiles are pooled and rebuilt in place, rows at a time, inside a per-frame
// time budget (plan 4.3.3). A tile shows once all its rows are done; the
// tiles it replaces stay until every wanted tile is ready, so the ground
// never has holes.
//
// The physics patch and heightAt() use the finest lattice (8 m) with the
// same triangle diagonal as the drawn tiles, so they agree with what is
// drawn by construction.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GROUND_DROP, VERGE_WIDTH } from './roadmesh.js';

const NEAR_TILE = 256;
const FAR_TILE = 1024;
const FINE_CELL = 8;
const MAX_CELLS = 32; // cells per tile edge at the finest level
const FAR_CELL = FAR_TILE / MAX_CELLS;
const FAR_SINK = 0.6; // far grid sits this much under the true height

const PATCH_CELLS = 16; // physics patch: 128 m square of the 8 m lattice
const PATCH_PIECES = 4; // cut into 4 x 4 bodies of 32 m
const PATCH_RECENTRE = 24; // metres from the patch centre before it moves

// 16 km of midline at 4 m: the 5 km the road builds ahead, and over 10 km
// behind the car.
const TRACE_CAPACITY = 4096;
// Next to the road the ground copies the height of the nearest point on the
// midline. Further out it copies the midline point at the same z, which is
// unique because the road always runs down -z, and smooth everywhere (the
// nearest point jumps on the inside of bends). The base blends between them
// just past the flat strip; within NEAR_SEARCH of the road the precise
// distance is measured, and it hands over to the estimate smoothly.
const BASE_BLEND = 30;
const NEAR_SEARCH = 130;
const HANDOVER = 40;

const HILL_WAVELENGTH = 380;
const HILL_HEIGHT = 26;
const MOUNTAIN_WAVELENGTH = 1500;
const MOUNTAIN_HEIGHT = 120;

// Palettes (sRGB 0..255): green hills and dry dusk country (plan 4.3.5).
const PALETTE = {
  green: { grass: [88, 130, 56], lush: [64, 108, 44], high: [80, 100, 62] },
  dry: { grass: [184, 156, 86], lush: [156, 136, 70], high: [160, 116, 80] },
  rock: [118, 112, 104],
};

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Integer lattice hash to -1..1.
function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0xffff) / 32767.5 - 1;
}

// Smooth value noise, -1..1.
function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

// A copy of the road midline (positions only), kept longer than the road
// keeps its own samples, indexed by the road's global sample index.
class RoadTrace {
  constructor() {
    this.x = new Float64Array(TRACE_CAPACITY);
    this.y = new Float64Array(TRACE_CAPACITY);
    this.z = new Float64Array(TRACE_CAPACITY);
    this.first = 0;
    this.last = -1;
  }

  sync(road) {
    const from = Math.max(this.last + 1, road.firstIndex);
    for (let index = from; index <= road.lastIndex; index += 1) {
      const sample = road.sample(index);
      const slot = index % TRACE_CAPACITY;
      this.x[slot] = sample.x;
      this.y[slot] = sample.y;
      this.z[slot] = sample.z;
      this.last = index;
    }
    if (this.last - this.first >= TRACE_CAPACITY) this.first = this.last - TRACE_CAPACITY + 1;
    if (from > this.last + 1) this.first = from;
  }

  // Fractional global index of the midline point at world z, clamped to
  // the trace. z falls as the index rises.
  indexAtZ(z) {
    const zs = this.z;
    let lo = this.first;
    let hi = this.last;
    if (z >= zs[lo % TRACE_CAPACITY]) return lo;
    if (z <= zs[hi % TRACE_CAPACITY]) return hi;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (zs[mid % TRACE_CAPACITY] > z) lo = mid;
      else hi = mid;
    }
    const z0 = zs[lo % TRACE_CAPACITY];
    const z1 = zs[hi % TRACE_CAPACITY];
    return lo + (z0 - z) / Math.max(1e-6, z0 - z1);
  }
}

// The terrain height model. Pure: the same inputs always give the same
// height, whichever tile asks.
class HeightModel {
  constructor(seed, roadHalfWidth, octaves) {
    this.seed = seed | 0;
    this.half = roadHalfWidth;
    this.octaves = octaves;
    this.trace = new RoadTrace();
    // Row cache: the profile at one z is shared by a whole tile row.
    this.rowZ = NaN;
    this.rowIndex = 0;
    this.rowX = 0;
    this.rowY = 0;
    this.rowCos = 1;
    // Out values of the last height() call.
    this.roadDistance = 0;
    this.baseHeight = 0;
    this.lift = 0;
  }

  setRow(z) {
    if (z === this.rowZ) return;
    this.rowZ = z;
    const trace = this.trace;
    const f = trace.indexAtZ(z);
    const i0 = Math.max(trace.first, Math.min(trace.last - 1, Math.floor(f)));
    const i1 = i0 + 1;
    const t = Math.max(0, Math.min(1, f - i0));
    const a = i0 % TRACE_CAPACITY;
    const b = i1 % TRACE_CAPACITY;
    this.rowIndex = Math.round(f);
    this.rowX = trace.x[a] + (trace.x[b] - trace.x[a]) * t;
    this.rowY = trace.y[a] + (trace.y[b] - trace.y[a]) * t;
    const dx = trace.x[b] - trace.x[a];
    const dz = trace.z[b] - trace.z[a];
    this.rowCos = Math.abs(dz) / (Math.hypot(dx, dz) || 1);
  }

  // Distance from (x, z) to the midline polyline near global index `hint`,
  // and the road centre height at the closest point. Sets nearDistance and
  // nearY.
  nearestRoad(x, z, hint) {
    const trace = this.trace;
    const lo = Math.max(trace.first, hint - 90);
    const hi = Math.min(trace.last, hint + 90);
    let best = lo;
    let bestDistance = Infinity;
    for (let index = lo; index <= hi; index += 3) {
      const slot = index % TRACE_CAPACITY;
      const dx = x - trace.x[slot];
      const dz = z - trace.z[slot];
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    const fineLo = Math.max(trace.first, best - 3);
    const fineHi = Math.min(trace.last, best + 3);
    for (let index = fineLo; index <= fineHi; index += 1) {
      const slot = index % TRACE_CAPACITY;
      const dx = x - trace.x[slot];
      const dz = z - trace.z[slot];
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }

    // Project onto the two segments either side of the closest sample.
    this.nearDistance = Math.sqrt(bestDistance);
    this.nearY = trace.y[best % TRACE_CAPACITY];
    for (let side = -1; side <= 0; side += 1) {
      const i0 = best + side;
      const i1 = i0 + 1;
      if (i0 < trace.first || i1 > trace.last) continue;
      const a = i0 % TRACE_CAPACITY;
      const b = i1 % TRACE_CAPACITY;
      const sx = trace.x[b] - trace.x[a];
      const sz = trace.z[b] - trace.z[a];
      const length2 = sx * sx + sz * sz;
      if (length2 < 1e-9) continue;
      const t = ((x - trace.x[a]) * sx + (z - trace.z[a]) * sz) / length2;
      if (t < 0 || t > 1) continue;
      const px = trace.x[a] + sx * t - x;
      const pz = trace.z[a] + sz * t - z;
      const distance = Math.hypot(px, pz);
      if (distance < this.nearDistance) {
        this.nearDistance = distance;
        this.nearY = trace.y[a] + (trace.y[b] - trace.y[a]) * t;
      }
    }
  }

  // Ground height at a lattice point of a tile with the given cell size.
  // Call setRow(z) first.
  height(x, z, cell) {
    // Flat strip along the road, wider for coarse cells so a coarse
    // triangle can never reach up through the tarmac.
    const flat = this.half + VERGE_WIDTH + 1 + cell;
    const farDistance = Math.abs(x - this.rowX) * this.rowCos;
    let distance = farDistance;
    let base = this.rowY;
    if (farDistance < NEAR_SEARCH) {
      this.nearestRoad(x, z, this.rowIndex);
      const nearBase = this.nearY + (this.rowY - this.nearY) * smoothstep(flat, flat + BASE_BLEND, this.nearDistance);
      const handover = smoothstep(NEAR_SEARCH - HANDOVER, NEAR_SEARCH, farDistance);
      distance = this.nearDistance + (farDistance - this.nearDistance) * handover;
      base = nearBase + (this.rowY - nearBase) * handover;
    }
    this.roadDistance = distance;
    this.baseHeight = base - GROUND_DROP;

    const near = smoothstep(flat, flat + 70, distance);
    if (near <= 0) {
      this.lift = 0;
      return this.baseHeight;
    }

    // Rolling hills: a few octaves of value noise, biased upwards so the
    // road mostly runs along valleys.
    const seed = this.seed;
    let hills = 0;
    let amplitude = 1;
    let frequency = 1 / HILL_WAVELENGTH;
    let total = 0;
    for (let octave = 0; octave < this.octaves; octave += 1) {
      hills += valueNoise(x * frequency, z * frequency, seed + octave * 31) * amplitude;
      total += amplitude;
      amplitude *= 0.5;
      frequency *= 2.03;
    }
    hills = hills / total * 0.8 + 0.3;

    // Ridged mountains far from the road.
    const far = smoothstep(140, 900, distance);
    let mountains = 0;
    if (far > 0) {
      const m1 = 1 - Math.abs(valueNoise(x / MOUNTAIN_WAVELENGTH, z / MOUNTAIN_WAVELENGTH, seed + 101));
      const m2 = 1 - Math.abs(valueNoise(x * 2.1 / MOUNTAIN_WAVELENGTH, z * 2.1 / MOUNTAIN_WAVELENGTH, seed + 131));
      mountains = (m1 * m1 * 0.75 + m2 * m2 * 0.25) * far;
    }

    this.lift = near * (hills * HILL_HEIGHT * (1 + far * 1.5)) + mountains * MOUNTAIN_HEIGHT;
    return this.baseHeight + this.lift;
  }

  // 0 green, 1 dry: large slow patches of country.
  biome(x, z) {
    const n = valueNoise(x / 2600, z / 2600, this.seed + 977) + valueNoise(x / 900, z / 900, this.seed + 979) * 0.25;
    return smoothstep(-0.06, 0.12, n);
  }
}

// Index buffers shared by every tile of one detail level: the grid, then
// skirts on all four edges, drawn both ways round.
function makeIndices(cells) {
  const side = cells + 1;
  const grid = cells * cells * 6;
  const skirts = 4 * cells * 12;
  const indices = new Uint16Array(grid + skirts);
  let at = 0;
  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const base = row * side + column;
      // Diagonal from (row, column) to (row + 1, column + 1): heightAt()
      // and the physics patch use the same split.
      indices[at++] = base;
      indices[at++] = base + side + 1;
      indices[at++] = base + 1;
      indices[at++] = base;
      indices[at++] = base + side;
      indices[at++] = base + side + 1;
    }
  }
  const skirtBase = side * side;
  for (let edge = 0; edge < 4; edge += 1) {
    for (let i = 0; i < cells; i += 1) {
      const a = edgeVertex(edge, i, side);
      const b = edgeVertex(edge, i + 1, side);
      const sa = skirtBase + edge * side + i;
      const sb = sa + 1;
      indices[at++] = a; indices[at++] = b; indices[at++] = sb;
      indices[at++] = a; indices[at++] = sb; indices[at++] = sa;
      indices[at++] = a; indices[at++] = sb; indices[at++] = b;
      indices[at++] = a; indices[at++] = sa; indices[at++] = sb;
    }
  }
  return new THREE.BufferAttribute(indices, 1);
}

// Grid vertex index of the i-th vertex along an edge (0 north row, 1 south
// row, 2 west column, 3 east column).
function edgeVertex(edge, i, side) {
  if (edge === 0) return i;
  if (edge === 1) return (side - 1) * side + i;
  if (edge === 2) return i * side;
  return i * side + side - 1;
}

const VERTEX_CAPACITY = (MAX_CELLS + 1) * (MAX_CELLS + 1) + 4 * (MAX_CELLS + 1);

class Tile {
  constructor(material, tileSize) {
    this.tileSize = tileSize;
    this.positions = new Float32Array(VERTEX_CAPACITY * 3);
    this.normals = new Float32Array(VERTEX_CAPACITY * 3);
    this.colors = new Uint8Array(VERTEX_CAPACITY * 3);
    // Heights with a one-cell border, for normals.
    this.heights = new Float32Array((MAX_CELLS + 3) * (MAX_CELLS + 3));
    this.lifts = new Float32Array((MAX_CELLS + 1) * (MAX_CELLS + 1));
    this.distances = new Float32Array((MAX_CELLS + 1) * (MAX_CELLS + 1));

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.normalAttribute = new THREE.BufferAttribute(this.normals, 3);
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 3, true);
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('normal', this.normalAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), tileSize);

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.visible = false;
    this.mesh.receiveShadow = true;

    this.key = '';
    this.ready = false;
    this.cells = 0;
    this.originX = 0;
    this.originZ = 0;
    this.row = 0; // build progress, in rows of the bordered height grid
    this.minY = 0;
    this.maxY = 0;
  }
}

export class Terrain {
  constructor(scene, road, world, options = {}) {
    this.scene = scene;
    this.road = road;
    this.world = world;
    this.seed = (options.seed === undefined ? 1234 : options.seed) | 0;
    this.half = road.width / 2;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);

    this.nearMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.farMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    // Hide far vertices under the finished near square (plan 4.3.1).
    this.nearRect = { value: new THREE.Vector4(1, 1, -1, -1) };
    this.farMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.nearRect = this.nearRect;
      shader.vertexShader = 'uniform vec4 nearRect;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.y -= ${FAR_SINK.toFixed(2)};
        if (transformed.x > nearRect.x && transformed.x < nearRect.z
          && transformed.z > nearRect.y && transformed.z < nearRect.w) transformed.y -= 400.0;`,
      );
    };

    this.indices = { 32: makeIndices(32), 16: makeIndices(16) };
    this.nearTiles = new Map();
    this.farTiles = new Map();
    this.nearPool = [];
    this.farPool = [];
    this.queue = [];
    this.wantedNear = new Set();
    this.wantedFar = new Set();
    this.nearCentre = '';
    this.farCentre = '';
    this.tilesBuilt = 0;
    // Bumped whenever the set of visible near tiles changes (props refill).
    this.version = 0;
    // Set by Props: called when a near tile has just been built.
    this.onNearTileReady = null;
    this.buildMs = 0;
    this.maxBuildMs = 0;

    this.color = [0, 0, 0];
    this.buildPatch();
    this.setTier(options.tier || { terrain: { nearRadius: 2, farRadius: 1, octaves: 3, budgetMs: 3 } });
  }

  setTier(tier) {
    const settings = tier.terrain;
    const changed = !this.model || this.model.octaves !== settings.octaves;
    this.nearRadius = settings.nearRadius;
    this.farRadius = settings.farRadius;
    this.budgetMs = settings.budgetMs;
    if (changed) {
      const trace = this.model ? this.model.trace : null;
      this.model = new HeightModel(this.seed, this.half, settings.octaves);
      if (trace) this.model.trace = trace;
      // Every tile is stale: heights depend on the octaves.
      for (const tile of this.nearTiles.values()) this.releaseTile(tile, this.nearPool);
      for (const tile of this.farTiles.values()) this.releaseTile(tile, this.farPool);
      this.nearTiles.clear();
      this.farTiles.clear();
      this.queue.length = 0;
      this.retired = false;
      this.patchCentreX = NaN;
    }
    this.nearCentre = '';
    this.farCentre = '';
  }

  // ----------------------------------------------------------- streaming

  // Called every frame with the car position. With sync, every wanted tile
  // is built now (start, restart, recoveries).
  update(carX, carZ, sync = false) {
    this.model.trace.sync(this.road);
    this.plan(carX, carZ);
    this.build(sync ? Infinity : this.budgetMs);
    this.retire();
    this.updatePatch(carX, carZ, sync);
  }

  plan(carX, carZ) {
    const nearX = Math.floor(carX / NEAR_TILE);
    const nearZ = Math.floor(carZ / NEAR_TILE);
    const farX = Math.floor(carX / FAR_TILE);
    const farZ = Math.floor(carZ / FAR_TILE);
    const nearCentre = nearX + ',' + nearZ;
    const farCentre = farX + ',' + farZ;
    if (nearCentre === this.nearCentre && farCentre === this.farCentre) return;
    this.nearCentre = nearCentre;
    this.farCentre = farCentre;

    this.queue.length = 0;
    this.wantedNear.clear();
    this.wantedFar.clear();
    const jobs = [];

    const radius = this.nearRadius;
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const ring = Math.max(Math.abs(dx), Math.abs(dz));
        const cells = ring <= 1 ? MAX_CELLS : MAX_CELLS / 2;
        const key = (nearX + dx) + ',' + (nearZ + dz) + ',' + cells;
        this.wantedNear.add(key);
        const existing = this.nearTiles.get(key);
        if (existing && existing.ready) continue;
        jobs.push({ far: false, key, tx: nearX + dx, tz: nearZ + dz, cells, order: ring });
      }
    }
    const farRadius = this.farRadius;
    for (let dz = -farRadius; dz <= farRadius; dz += 1) {
      for (let dx = -farRadius; dx <= farRadius; dx += 1) {
        const key = (farX + dx) + ',' + (farZ + dz);
        this.wantedFar.add(key);
        const existing = this.farTiles.get(key);
        if (existing && existing.ready) continue;
        jobs.push({ far: true, key, tx: farX + dx, tz: farZ + dz, cells: MAX_CELLS,
          order: 1.5 + Math.max(Math.abs(dx), Math.abs(dz)) });
      }
    }
    // Nearest first.
    jobs.sort((a, b) => a.order - b.order);
    this.queue.push(...jobs);
    this.retired = false;
  }

  build(budgetMs) {
    if (this.queue.length === 0) return;
    const start = performance.now();
    while (this.queue.length > 0) {
      const job = this.queue[0];
      const tiles = job.far ? this.farTiles : this.nearTiles;
      let tile = tiles.get(job.key);
      if (!tile) {
        tile = this.takeTile(job.far);
        tile.key = job.key;
        tile.cells = job.cells;
        const size = job.far ? FAR_TILE : NEAR_TILE;
        tile.originX = job.tx * size;
        tile.originZ = job.tz * size;
        tile.row = 0;
        tile.ready = false;
        tiles.set(job.key, tile);
      }
      // A few rows at a time, so no frame builds a whole tile when the
      // budget is tight.
      const done = this.buildRows(tile, 6);
      if (done) {
        this.finishTile(tile);
        this.queue.shift();
      }
      if (performance.now() - start > budgetMs) break;
    }
    const spent = performance.now() - start;
    this.buildMs += spent;
    this.maxBuildMs = Math.max(this.maxBuildMs, spent);
  }

  takeTile(far) {
    const pool = far ? this.farPool : this.nearPool;
    const tile = pool.pop() || new Tile(far ? this.farMaterial : this.nearMaterial, far ? FAR_TILE : NEAR_TILE);
    return tile;
  }

  releaseTile(tile, pool) {
    if (tile.mesh.parent) this.group.remove(tile.mesh);
    if (tile.tileSize === NEAR_TILE) this.version += 1;
    tile.mesh.visible = false;
    tile.ready = false;
    tile.key = '';
    pool.push(tile);
  }

  // Once every wanted tile is ready, drop the rest and move the near
  // square the far grid sinks under.
  retire() {
    if (this.queue.length > 0 || this.retired) return;
    this.retired = true;
    for (const [key, tile] of this.nearTiles) {
      if (!this.wantedNear.has(key)) {
        this.releaseTile(tile, this.nearPool);
        this.nearTiles.delete(key);
      }
    }
    for (const [key, tile] of this.farTiles) {
      if (!this.wantedFar.has(key)) {
        this.releaseTile(tile, this.farPool);
        this.farTiles.delete(key);
      }
    }
    const [x, z] = this.nearCentre.split(',').map(Number);
    if (Number.isFinite(x)) {
      const r = this.nearRadius;
      // Shrink by one far cell: the far vertices on the boundary stay up,
      // so the far triangles that cross it slope down under near tiles.
      this.nearRect.value.set(
        (x - r) * NEAR_TILE + FAR_CELL * 0.5,
        (z - r) * NEAR_TILE + FAR_CELL * 0.5,
        (x + r + 1) * NEAR_TILE - FAR_CELL * 0.5,
        (z + r + 1) * NEAR_TILE - FAR_CELL * 0.5,
      );
    }
  }

  // Heights on a grid with a one-cell border, rows at a time. Returns true
  // when the tile is complete.
  buildRows(tile, rows) {
    const cells = tile.cells;
    const size = tile.tileSize;
    const cell = size / cells;
    const border = cells + 3;
    const model = this.model;
    const end = Math.min(border, tile.row + rows);
    for (let row = tile.row; row < end; row += 1) {
      const z = tile.originZ + (row - 1) * cell;
      model.setRow(z);
      for (let column = 0; column < border; column += 1) {
        const x = tile.originX + (column - 1) * cell;
        tile.heights[row * border + column] = model.height(x, z, cell);
        if (row >= 1 && row <= cells + 1 && column >= 1 && column <= cells + 1) {
          const at = (row - 1) * (cells + 1) + column - 1;
          tile.lifts[at] = model.lift;
          tile.distances[at] = model.roadDistance;
        }
      }
    }
    tile.row = end;
    return end >= border;
  }

  finishTile(tile) {
    const cells = tile.cells;
    const side = cells + 1;
    const border = cells + 3;
    const cell = tile.tileSize / cells;
    const positions = tile.positions;
    const normals = tile.normals;
    const colors = tile.colors;
    const heights = tile.heights;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let row = 0; row < side; row += 1) {
      const z = tile.originZ + row * cell;
      for (let column = 0; column < side; column += 1) {
        const x = tile.originX + column * cell;
        const h = heights[(row + 1) * border + column + 1];
        const at = (row * side + column) * 3;
        positions[at] = x;
        positions[at + 1] = h;
        positions[at + 2] = z;
        minY = Math.min(minY, h);
        maxY = Math.max(maxY, h);

        const left = heights[(row + 1) * border + column];
        const right = heights[(row + 1) * border + column + 2];
        const back = heights[row * border + column + 1];
        const front = heights[(row + 2) * border + column + 1];
        const nx = (left - right) / (2 * cell);
        const nz = (back - front) / (2 * cell);
        const length = Math.hypot(nx, 1, nz);
        normals[at] = nx / length;
        normals[at + 1] = 1 / length;
        normals[at + 2] = nz / length;

        this.colorAt(x, z, 1 / length, tile.lifts[row * side + column], tile.distances[row * side + column]);
        colors[at] = this.color[0];
        colors[at + 1] = this.color[1];
        colors[at + 2] = this.color[2];
      }
    }

    // Skirts: copies of the edge vertices hanging down.
    const depth = 2 + cell * 0.3;
    const skirtBase = side * side;
    for (let edge = 0; edge < 4; edge += 1) {
      for (let i = 0; i < side; i += 1) {
        const from = edgeVertex(edge, i, side) * 3;
        const to = (skirtBase + edge * side + i) * 3;
        positions[to] = positions[from];
        positions[to + 1] = positions[from + 1] - depth;
        positions[to + 2] = positions[from + 2];
        normals[to] = normals[from];
        normals[to + 1] = normals[from + 1];
        normals[to + 2] = normals[from + 2];
        colors[to] = colors[from];
        colors[to + 1] = colors[from + 1];
        colors[to + 2] = colors[from + 2];
      }
    }

    const geometry = tile.geometry;
    geometry.setIndex(this.indices[cells]);
    const vertexCount = side * side + 4 * side;
    tile.positionAttribute.needsUpdate = true;
    tile.normalAttribute.needsUpdate = true;
    tile.colorAttribute.needsUpdate = true;
    geometry.setDrawRange(0, Infinity);
    const halfSize = tile.tileSize / 2;
    geometry.boundingSphere.center.set(tile.originX + halfSize, (minY + maxY) / 2, tile.originZ + halfSize);
    geometry.boundingSphere.radius = Math.hypot(halfSize * Math.SQRT2, (maxY - minY) / 2 + depth);
    tile.vertexCount = vertexCount;
    tile.minY = minY;
    tile.maxY = maxY;
    tile.ready = true;
    tile.mesh.visible = true;
    if (!tile.mesh.parent) this.group.add(tile.mesh);
    // A near tile replacing the same square at another detail hides the
    // old one now, so the two never fight over the same pixels.
    if (tile.tileSize === NEAR_TILE) {
      if (this.onNearTileReady) this.onNearTileReady(tile);
      this.version += 1;
      const square = tile.key.slice(0, tile.key.lastIndexOf(',') + 1);
      for (const [key, other] of this.nearTiles) {
        if (other !== tile && key.startsWith(square)) other.mesh.visible = false;
      }
    }
    this.tilesBuilt += 1;
  }

  // Vertex colour: biome palette, darker in hollows, rock on steep slopes.
  colorAt(x, z, normalY, lift, distance) {
    const model = this.model;
    const dry = model.biome(x, z);
    const green = PALETTE.green;
    const brown = PALETTE.dry;
    const detail = valueNoise(x / 37, z / 37, model.seed + 7) * 0.5 + valueNoise(x / 9, z / 9, model.seed + 9) * 0.25;
    const lush = smoothstep(-0.2, 0.5, detail);
    const high = smoothstep(25, 80, lift);
    const rock = smoothstep(0.86, 0.72, normalY) * smoothstep(20, 40, distance);
    const shade = 0.93 + detail * 0.1;
    for (let channel = 0; channel < 3; channel += 1) {
      const g = green.grass[channel] + (green.lush[channel] - green.grass[channel]) * lush;
      const d = brown.grass[channel] + (brown.lush[channel] - brown.grass[channel]) * lush;
      let value = g + (d - g) * dry;
      const h = green.high[channel] + (brown.high[channel] - green.high[channel]) * dry;
      value += (h - value) * high;
      value += (PALETTE.rock[channel] - value) * rock;
      this.color[channel] = Math.max(0, Math.min(255, value * shade));
    }
  }

  // -------------------------------------------------------------- physics

  // The patch is cut into PATCH_PIECES x PATCH_PIECES bodies, so a wheel
  // ray or the hull only meets the few triangles of the piece under it.
  buildPatch() {
    const cells = PATCH_CELLS / PATCH_PIECES;
    const side = cells + 1;
    const indices = new Uint16Array(cells * cells * 6);
    let at = 0;
    for (let row = 0; row < cells; row += 1) {
      for (let column = 0; column < cells; column += 1) {
        const base = row * side + column;
        indices[at++] = base;
        indices[at++] = base + side + 1;
        indices[at++] = base + 1;
        indices[at++] = base;
        indices[at++] = base + side;
        indices[at++] = base + side + 1;
      }
    }
    this.pieces = [];
    for (let piece = 0; piece < PATCH_PIECES * PATCH_PIECES; piece += 1) {
      const vertices = new Float32Array(side * side * 3);
      for (let row = 0; row < side; row += 1) {
        for (let column = 0; column < side; column += 1) {
          vertices[(row * side + column) * 3] = column * FINE_CELL;
          vertices[(row * side + column) * 3 + 2] = row * FINE_CELL;
        }
      }
      const shape = new CANNON.Trimesh(vertices, indices);
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(shape);
      if (this.world) this.world.addBody(body);
      this.pieces.push({ shape, body, row: Math.floor(piece / PATCH_PIECES), column: piece % PATCH_PIECES });
    }
    // The whole patch, for the car lab: heights on the lattice and origin.
    this.patchHeights = new Float32Array((PATCH_CELLS + 1) * (PATCH_CELLS + 1));
    this.patchOriginX = 0;
    this.patchOriginZ = 0;
    this.patchCentreX = NaN;
    this.patchCentreZ = NaN;
  }

  // The 128 m patch of the 8 m lattice under the car.
  updatePatch(carX, carZ, force) {
    if (!force && Math.abs(carX - this.patchCentreX) < PATCH_RECENTRE
      && Math.abs(carZ - this.patchCentreZ) < PATCH_RECENTRE) return;
    const originX = Math.round(carX / FINE_CELL) * FINE_CELL - (PATCH_CELLS / 2) * FINE_CELL;
    const originZ = Math.round(carZ / FINE_CELL) * FINE_CELL - (PATCH_CELLS / 2) * FINE_CELL;
    this.patchCentreX = originX + (PATCH_CELLS / 2) * FINE_CELL;
    this.patchCentreZ = originZ + (PATCH_CELLS / 2) * FINE_CELL;
    this.patchOriginX = originX;
    this.patchOriginZ = originZ;
    const side = PATCH_CELLS + 1;
    for (let row = 0; row < side; row += 1) {
      const z = originZ + row * FINE_CELL;
      this.model.setRow(z);
      for (let column = 0; column < side; column += 1) {
        this.patchHeights[row * side + column] = this.model.height(originX + column * FINE_CELL, z, FINE_CELL);
      }
    }
    const cells = PATCH_CELLS / PATCH_PIECES;
    const pieceSide = cells + 1;
    for (const { shape, body, row, column } of this.pieces) {
      const vertices = shape.vertices;
      for (let r = 0; r < pieceSide; r += 1) {
        for (let c = 0; c < pieceSide; c += 1) {
          vertices[(r * pieceSide + c) * 3 + 1] = this.patchHeights[(row * cells + r) * side + column * cells + c];
        }
      }
      body.position.set(originX + column * cells * FINE_CELL, 0, originZ + row * cells * FINE_CELL);
      shape.updateAABB();
      shape.updateBoundingSphereRadius();
      shape.updateNormals();
      shape.updateTree();
      body.updateBoundingRadius();
      body.aabbNeedsUpdate = true;
      body.updateAABB();
    }
  }

  // Height of the drawn ground at a world point, on the 8 m lattice and its
  // triangles: what the car and the camera stand on.
  heightAt(x, z) {
    if (this.model.trace.last < 1) return -Infinity;
    const gx = x / FINE_CELL;
    const gz = z / FINE_CELL;
    const column = Math.floor(gx);
    const row = Math.floor(gz);
    const fx = gx - column;
    const fz = gz - row;
    const x0 = column * FINE_CELL;
    const z0 = row * FINE_CELL;
    const model = this.model;
    model.setRow(z0);
    const h00 = model.height(x0, z0, FINE_CELL);
    const h10 = fx >= fz ? model.height(x0 + FINE_CELL, z0, FINE_CELL) : 0;
    model.setRow(z0 + FINE_CELL);
    const h11 = model.height(x0 + FINE_CELL, z0 + FINE_CELL, FINE_CELL);
    if (fx >= fz) {
      // Triangle (0,0) (1,1) (1,0) in (column, row).
      return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
    }
    const h01 = model.height(x0, z0 + FINE_CELL, FINE_CELL);
    return h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  }

  // Height of the tile actually drawn at a world point (near tiles first,
  // then the far grid, which the shader lowers by FAR_SINK). For the car
  // lab: what the player sees, at whatever detail is showing there.
  drawnHeight(x, z) {
    for (const far of [false, true]) {
      const tiles = far ? this.farTiles : this.nearTiles;
      for (const tile of tiles.values()) {
        if (!tile.ready || !tile.mesh.visible) continue;
        const size = tile.tileSize;
        if (x < tile.originX || z < tile.originZ || x >= tile.originX + size || z >= tile.originZ + size) continue;
        const cell = size / tile.cells;
        const side = tile.cells + 1;
        const gx = (x - tile.originX) / cell;
        const gz = (z - tile.originZ) / cell;
        const column = Math.min(tile.cells - 1, Math.floor(gx));
        const row = Math.min(tile.cells - 1, Math.floor(gz));
        const fx = gx - column;
        const fz = gz - row;
        const h = (r, c) => tile.positions[(r * side + c) * 3 + 1];
        const h00 = h(row, column);
        const h11 = h(row + 1, column + 1);
        let height;
        if (fx >= fz) {
          const h10 = h(row, column + 1);
          height = h00 + (h10 - h00) * fx + (h11 - h10) * fz;
        } else {
          const h01 = h(row + 1, column);
          height = h00 + (h01 - h00) * fz + (h11 - h01) * fx;
        }
        return far ? height - FAR_SINK : height;
      }
    }
    return -Infinity;
  }

  // Pure model height at a lattice point (for the car lab).
  latticeHeight(x, z, cell = FINE_CELL) {
    this.model.setRow(z);
    return this.model.height(x, z, cell);
  }

  // Biome at a point, 0 green .. 1 dry, for props.
  biomeAt(x, z) {
    return this.model.biome(x, z);
  }

  // Woodland patches, 0 open .. 1 forest, for props.
  forestAt(x, z) {
    const seed = this.model.seed;
    const n = valueNoise(x / 420, z / 420, seed + 401) * 0.7 + valueNoise(x / 150, z / 150, seed + 403) * 0.3;
    return smoothstep(-0.1, 0.45, n);
  }

  get tileCount() {
    return this.nearTiles.size + this.farTiles.size;
  }

  get pending() {
    return this.queue.length;
  }

  dispose() {
    for (const tile of [...this.nearTiles.values(), ...this.farTiles.values(), ...this.nearPool, ...this.farPool]) {
      tile.geometry.dispose();
    }
    this.scene.remove(this.group);
    this.nearMaterial.dispose();
    this.farMaterial.dispose();
    if (this.world) for (const { body } of this.pieces) this.world.removeBody(body);
  }
}

export { NEAR_TILE, FINE_CELL };
