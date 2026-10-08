// Road rendering and road collision (plan 4.2.4 and 4.2.5).
//
// The road is drawn as pooled 100 m chunks. A pool slot owns its buffers for
// the whole session: rebuilding a chunk writes numbers into arrays that
// already exist, so a long drive neither allocates nor disposes anything.
//
// Each chunk also owns one cannon-es Trimesh body. The wheel rays hit that
// mesh, so the banking and the verges are felt through the physics.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CHUNK_LENGTH, SAMPLES_PER_CHUNK, SAMPLE_SPACING } from './road.js';

const SAMPLES = SAMPLES_PER_CHUNK + 1; // samples that touch one chunk
const PIECE_SEGMENTS = 5; // collider piece length, in 4 m segments

// Cross-section of the road, in metres from the centre line. The tarmac
// banks with the bend; the verges run from its edges down to flat ground
// GROUND_DROP under the centre line, so a banked bend sits on a small
// embankment and the ground can never cover the low edge of the tarmac.
export const VERGE_WIDTH = 7;
const SKIRT_DEPTH = 1.2; // hides any gap between the verge and the ground
const LINE_INNER = 0.3; // white edge line width
const LINE_OUTER = 0.1; // gap between the line and the tarmac edge
const MARK_HEIGHT = 0.012;
const DASH_LENGTH = 8; // metres of paint per dash
const DASH_GAP = 8;
const DASH_HALF = 0.1;
const MAX_DASHES = Math.ceil(SAMPLES_PER_CHUNK * DASH_LENGTH / (DASH_LENGTH + DASH_GAP)) + 1;

const COLORS = {
  asphalt: [74, 76, 80],
  line: [236, 236, 230],
  dash: [238, 206, 96],
  verge: [92, 130, 60],
  vergeDry: [176, 152, 86],
  grassA: [96, 124, 68],
  grassB: [110, 138, 78],
};

// Bands across the road. Each band is a pair of points: (offset, height)
// for the outer edge, then (offset, height) for the inner edge.
const BANDS = 7;
const VERGE_BANDS = [0, 1, 5, 6]; // skirt, verge, verge, skirt
const VERTS_PER_SAMPLE = BANDS * 2;
const BAND_VERTS = SAMPLES * VERTS_PER_SAMPLE;
const DASH_VERTS = MAX_DASHES * 4;
const BAND_INDEX_COUNT = SAMPLES_PER_CHUNK * BANDS * 6;
const DASH_INDEX_COUNT = MAX_DASHES * 6;

// Lowest the road edge gets is half the width times sin(max bank), about
// 0.8 m, plus up to 0.3 m of the coarse ground grid bowing up between its
// vertices in a dip. 1.2 m clears both.
export const GROUND_DROP = 1.2;

// Each band: outer offset, outer height, inner offset, inner height, paint,
// and whether each end is banked with the road (true) or level (false).
function bandLayout(halfWidth) {
  const w = halfWidth;
  const outer = w + VERGE_WIDTH;
  return [
    [-outer - 0.6, -GROUND_DROP - SKIRT_DEPTH, -outer, -GROUND_DROP, 'grassA', false, false],
    [-outer, -GROUND_DROP, -w, -0.02, 'verge', false, true],
    [-w + LINE_OUTER, 0, -w + LINE_OUTER + LINE_INNER, 0, 'line', true, true],
    [-w + LINE_OUTER + LINE_INNER, 0, w - LINE_OUTER - LINE_INNER, 0, 'asphalt', true, true],
    [w - LINE_OUTER - LINE_INNER, 0, w - LINE_OUTER, 0, 'line', true, true],
    [w, -0.02, outer, -GROUND_DROP, 'verge', true, false],
    [outer, -GROUND_DROP, outer + 0.6, -GROUND_DROP - SKIRT_DEPTH, 'grassA', false, false],
  ];
}

class Chunk {
  constructor(material) {
    const vertexCount = BAND_VERTS + DASH_VERTS;

    this.positions = new Float32Array(vertexCount * 3);
    this.normals = new Float32Array(vertexCount * 3);
    const colors = new Uint8Array(vertexCount * 3);

    const indices = new Uint16Array(BAND_INDEX_COUNT + DASH_INDEX_COUNT);
    for (let segment = 0; segment < SAMPLES_PER_CHUNK; segment += 1) {
      for (let band = 0; band < BANDS; band += 1) {
        const base = segment * VERTS_PER_SAMPLE + band * 2;
        const next = (segment + 1) * VERTS_PER_SAMPLE + band * 2;
        const at = (segment * BANDS + band) * 6;
        indices[at] = base;
        indices[at + 1] = base + 1;
        indices[at + 2] = next + 1;
        indices[at + 3] = base;
        indices[at + 4] = next + 1;
        indices[at + 5] = next;
      }
    }
    for (let dash = 0; dash < MAX_DASHES; dash += 1) {
      const at = BAND_INDEX_COUNT + dash * 6;
      indices[at] = BAND_VERTS + dash * 4;
      indices[at + 1] = BAND_VERTS + dash * 4 + 1;
      indices[at + 2] = BAND_VERTS + dash * 4 + 3;
      indices[at + 3] = BAND_VERTS + dash * 4;
      indices[at + 4] = BAND_VERTS + dash * 4 + 3;
      indices[at + 5] = BAND_VERTS + dash * 4 + 2;
    }

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.normalAttribute = new THREE.BufferAttribute(this.normals, 3);
    this.normalAttribute.setUsage(THREE.DynamicDrawUsage);
    this.colorAttribute = new THREE.BufferAttribute(colors, 3, true);
    this.colorAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('normal', this.normalAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;

    // Collision: four points per sample, three strips between them. The
    // buffer starts as a small flat patch so the shape and its octree are
    // never degenerate, even before the first build.
    this.colliderVertices = new Float32Array(SAMPLES * 4 * 3);
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      for (let corner = 0; corner < 4; corner += 1) {
        const at = (sample * 4 + corner) * 3;
        this.colliderVertices[at] = corner < 2 ? -5 : 5;
        this.colliderVertices[at + 1] = 0;
        this.colliderVertices[at + 2] = -sample * SAMPLE_SPACING;
      }
    }
    // The collider is cut into short pieces, each its own body. A piece is
    // 20 m of road, so a wheel ray or the hull meets 30 triangles at most;
    // one 100 m trimesh handed back most of its 150 triangles to every query
    // (its long thin triangles defeat the octree), which was the main cost
    // of a physics step.
    const pieceSamples = PIECE_SEGMENTS + 1;
    const pieceIndices = new Uint16Array(PIECE_SEGMENTS * 3 * 6);
    for (let segment = 0; segment < PIECE_SEGMENTS; segment += 1) {
      for (let band = 0; band < 3; band += 1) {
        const base = segment * 4 + band;
        const next = (segment + 1) * 4 + band;
        const at = (segment * 3 + band) * 6;
        pieceIndices[at] = base;
        pieceIndices[at + 1] = base + 1;
        pieceIndices[at + 2] = next + 1;
        pieceIndices[at + 3] = base;
        pieceIndices[at + 4] = next + 1;
        pieceIndices[at + 5] = next;
      }
    }
    this.pieces = [];
    this.bodies = [];
    for (let piece = 0; piece < SAMPLES_PER_CHUNK / PIECE_SEGMENTS; piece += 1) {
      const first = piece * PIECE_SEGMENTS * 4 * 3;
      const vertices = this.colliderVertices.slice(first, first + pieceSamples * 4 * 3);
      const shape = new CANNON.Trimesh(vertices, pieceIndices);
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(shape);
      // Trimesh copies the vertex buffer: refreshCollider writes into it.
      this.pieces.push({ shape, body, first });
      this.bodies.push(body);
    }
  }

  // Paint colours only change when the road width changes.
  paintColors(layout) {
    const colors = this.colorAttribute.array;
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      for (let band = 0; band < BANDS; band += 1) {
        const color = COLORS[layout[band][4]];
        for (let side = 0; side < 2; side += 1) {
          const at = (sample * VERTS_PER_SAMPLE + band * 2 + side) * 3;
          colors[at] = color[0];
          colors[at + 1] = color[1];
          colors[at + 2] = color[2];
        }
      }
    }
    const dashColor = COLORS.dash;
    for (let dash = 0; dash < MAX_DASHES; dash += 1) {
      for (let corner = 0; corner < 4; corner += 1) {
        const at = (BAND_VERTS + dash * 4 + corner) * 3;
        colors[at] = dashColor[0];
        colors[at + 1] = dashColor[1];
        colors[at + 2] = dashColor[2];
      }
    }
    this.colorAttribute.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
  }
}

// A cannon-es Trimesh caches three things when it is built: the local AABB,
// the bounding radius, the per triangle normals and the octree. A pooled
// chunk moves to new ground every time it is rebuilt, and every ray test
// reads those caches, so all four have to be refreshed or the wheel rays hit
// a shape with zero normals and report NaN.
function refreshCollider(chunk) {
  for (const { shape, body, first } of chunk.pieces) {
    shape.vertices.set(chunk.colliderVertices.subarray(first, first + shape.vertices.length));
    shape.updateAABB();
    shape.updateBoundingSphereRadius();
    shape.updateNormals();
    shape.updateTree();
    body.updateBoundingRadius();
    body.aabbNeedsUpdate = true;
    body.updateAABB();
  }
}

export class RoadRenderer {
  constructor(scene, road, world, options = {}) {
    this.scene = scene;
    this.road = road;
    this.world = world;
    this.width = options.width || road.width;
    this.behind = options.behind === undefined ? 220 : options.behind;
    this.capacity = 0;

    // Phong with no specular when dry: rain only changes its numbers
    // (weather.js setRoadWet), so wetting the road never recompiles.
    this.material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      specular: 0x000000,
      shininess: 8,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.layout = bandLayout(this.width / 2);
    // Optional (x, z) => 0..1: how dry the country is, so the verges match
    // the terrain beside them.
    this.groundTint = options.groundTint || null;

    this.group = new THREE.Group();
    this.group.name = 'road';
    this.scene.add(this.group);

    this.pool = [];
    this.active = new Map();

    // Per chunk scratch for the banked road frame.
    this.across = new Float32Array(SAMPLES * 3);
    this.up = new Float32Array(SAMPLES * 3);
    this.midX = 0;
    this.midY = 0;
    this.midZ = 0;

    this.setViewDistance(options.viewDistance || 900);
  }

  setViewDistance(metres) {
    const wanted = Math.ceil((metres + this.behind) / CHUNK_LENGTH) + 2;
    if (wanted === this.capacity) return;

    for (const chunk of this.active.values()) this.release(chunk);
    this.active.clear();
    this.capacity = wanted;

    while (this.pool.length < wanted) {
      const chunk = new Chunk(this.material);
      chunk.paintColors(this.layout);
      this.pool.push(chunk);
    }
    while (this.pool.length > wanted) this.pool.pop().dispose();
  }

  setWidth(width) {
    if (width === this.width) return;
    this.width = width;
    this.layout = bandLayout(width / 2);
    for (const chunk of this.pool) chunk.paintColors(this.layout);
    // Force every live chunk to be rebuilt with the new cross-section.
    for (const [index, chunk] of this.active) {
      this.release(chunk);
      this.active.delete(index);
    }
  }

  take() {
    const chunk = this.pool.pop();
    if (!chunk) return null;
    this.group.add(chunk.mesh);
    for (const body of chunk.bodies) this.world.addBody(body);
    chunk.mesh.visible = true;
    return chunk;
  }

  release(chunk) {
    chunk.mesh.visible = false;
    this.group.remove(chunk.mesh);
    for (const body of chunk.bodies) this.world.removeBody(body);
    this.pool.push(chunk);
  }

  // Banked road frame for one sample: across tilts down into the turn, up
  // follows the surface including the climb.
  frame(sampleIndex, at) {
    const road = this.road;
    const last = road.lastIndex;
    const index = Math.max(road.firstIndex, Math.min(sampleIndex, last));
    const point = road.sample(index);
    const cos = Math.cos(point.bank);
    const sin = Math.sin(point.bank);

    // Horizontal right vector, then tilt it down by the bank angle.
    const ax = point.rx * cos;
    const ay = -sin;
    const az = point.rz * cos;

    // Surface normal: across x tangent, so climbs shade correctly.
    const ux = ay * point.tz - az * point.ty;
    const uy = az * point.tx - ax * point.tz;
    const uz = ax * point.ty - ay * point.tx;
    const length = Math.hypot(ux, uy, uz) || 1;

    this.across[at] = ax;
    this.across[at + 1] = ay;
    this.across[at + 2] = az;
    this.up[at] = ux / length;
    this.up[at + 1] = uy / length;
    this.up[at + 2] = uz / length;

    return point;
  }

  build(chunk, chunkIndex) {
    const road = this.road;
    const firstIndex = chunkIndex * SAMPLES_PER_CHUNK;
    const layout = this.layout;
    const positions = chunk.positions;
    const normals = chunk.normals;
    const collider = chunk.colliderVertices;
    const half = this.width / 2;
    const colliderOffsets = [-half - VERGE_WIDTH, -half, half, half + VERGE_WIDTH];
    const colliderHeights = [-GROUND_DROP, 0, 0, -GROUND_DROP];
    const colliderBanked = [false, true, true, false];

    for (let sample = 0; sample < SAMPLES; sample += 1) {
      this.frame(firstIndex + sample, sample * 3);
    }

    let dashes = 0;
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      const point = road.sample(Math.max(road.firstIndex,
        Math.min(firstIndex + sample, road.lastIndex)));
      const at3 = sample * 3;
      const ax = this.across[at3];
      const ay = this.across[at3 + 1];
      const az = this.across[at3 + 2];
      const ux = this.up[at3];
      const uy = this.up[at3 + 1];
      const uz = this.up[at3 + 2];

      if (this.groundTint) this.tintVerges(chunk, sample, this.groundTint(point.x, point.z));

      for (let band = 0; band < BANDS; band += 1) {
        const spec = layout[band];
        for (let side = 0; side < 2; side += 1) {
          const offset = side === 0 ? spec[0] : spec[2];
          const height = side === 0 ? spec[1] : spec[3];
          const banked = side === 0 ? spec[5] : spec[6];
          const at = (sample * VERTS_PER_SAMPLE + band * 2 + side) * 3;
          if (banked) {
            positions[at] = point.x + ax * offset + ux * height;
            positions[at + 1] = point.y + ay * offset + uy * height;
            positions[at + 2] = point.z + az * offset + uz * height;
          } else {
            positions[at] = point.x + point.rx * offset;
            positions[at + 1] = point.y + height;
            positions[at + 2] = point.z + point.rz * offset;
          }
          normals[at] = ux;
          normals[at + 1] = uy;
          normals[at + 2] = uz;
        }
      }

      for (let corner = 0; corner < 4; corner += 1) {
        const at = (sample * 4 + corner) * 3;
        const offset = colliderOffsets[corner];
        const height = colliderHeights[corner];
        if (colliderBanked[corner]) {
          collider[at] = point.x + ax * offset + ux * height;
          collider[at + 1] = point.y + ay * offset + uy * height;
          collider[at + 2] = point.z + az * offset + uz * height;
        } else {
          collider[at] = point.x + point.rx * offset;
          collider[at + 1] = point.y + height;
          collider[at + 2] = point.z + point.rz * offset;
        }
      }

      // Centre dashes: one quad per painted sample pair.
      const painted = (firstIndex + sample) % (DASH_LENGTH + DASH_GAP) < DASH_LENGTH;
      if (painted && sample < SAMPLES - 1 && dashes < MAX_DASHES) {
        const nextAt = (sample + 1) * 3;
        const nax = this.across[nextAt];
        const nay = this.across[nextAt + 1];
        const naz = this.across[nextAt + 2];
        const nux = this.up[nextAt];
        const nuy = this.up[nextAt + 1];
        const nuz = this.up[nextAt + 2];
        const nextPoint = road.sample(Math.max(road.firstIndex,
          Math.min(firstIndex + sample + 1, road.lastIndex)));
        const at = (BAND_VERTS + dashes * 4) * 3;

        positions[at] = point.x + ax * -DASH_HALF + ux * MARK_HEIGHT;
        positions[at + 1] = point.y + ay * -DASH_HALF + uy * MARK_HEIGHT;
        positions[at + 2] = point.z + az * -DASH_HALF + uz * MARK_HEIGHT;
        normals[at] = ux;
        normals[at + 1] = uy;
        normals[at + 2] = uz;

        positions[at + 3] = point.x + ax * DASH_HALF + ux * MARK_HEIGHT;
        positions[at + 4] = point.y + ay * DASH_HALF + uy * MARK_HEIGHT;
        positions[at + 5] = point.z + az * DASH_HALF + uz * MARK_HEIGHT;
        normals[at + 3] = ux;
        normals[at + 4] = uy;
        normals[at + 5] = uz;

        positions[at + 6] = nextPoint.x + nax * -DASH_HALF + nux * MARK_HEIGHT;
        positions[at + 7] = nextPoint.y + nay * -DASH_HALF + nuy * MARK_HEIGHT;
        positions[at + 8] = nextPoint.z + naz * -DASH_HALF + nuz * MARK_HEIGHT;
        normals[at + 6] = nux;
        normals[at + 7] = nuy;
        normals[at + 8] = nuz;

        positions[at + 9] = nextPoint.x + nax * DASH_HALF + nux * MARK_HEIGHT;
        positions[at + 10] = nextPoint.y + nay * DASH_HALF + nuy * MARK_HEIGHT;
        positions[at + 11] = nextPoint.z + naz * DASH_HALF + nuz * MARK_HEIGHT;
        normals[at + 9] = nux;
        normals[at + 10] = nuy;
        normals[at + 11] = nuz;

        dashes += 1;
      }

      if (sample === 0 || sample === SAMPLES - 1) {
        this.midX = point.x;
        this.midY = point.y;
        this.midZ = point.z;
      }
    }

    chunk.positionAttribute.needsUpdate = true;
    chunk.normalAttribute.needsUpdate = true;
    if (this.groundTint) chunk.colorAttribute.needsUpdate = true;
    chunk.geometry.setDrawRange(0, BAND_INDEX_COUNT + dashes * 6);
    chunk.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(this.midX, this.midY, this.midZ),
      CHUNK_LENGTH,
    );
    chunk.geometry.boundingBox = null;

    refreshCollider(chunk);
  }

  // Verge and skirt colours for one sample, between green and dry.
  tintVerges(chunk, sample, dry) {
    const colors = chunk.colorAttribute.array;
    const green = COLORS.verge;
    const brown = COLORS.vergeDry;
    const r = green[0] + (brown[0] - green[0]) * dry;
    const g = green[1] + (brown[1] - green[1]) * dry;
    const b = green[2] + (brown[2] - green[2]) * dry;
    for (const band of VERGE_BANDS) {
      for (let side = 0; side < 2; side += 1) {
        const at = (sample * VERTS_PER_SAMPLE + band * 2 + side) * 3;
        colors[at] = r;
        colors[at + 1] = g;
        colors[at + 2] = b;
      }
    }
  }

  update(carS, viewDistance) {
    // Never build before the road starts: a chunk of repeated samples would
    // be a strip of degenerate triangles, and cannon's ray tests turn those
    // into NaN hits.
    const firstSampleChunk = Math.floor(this.road.firstIndex / SAMPLES_PER_CHUNK);
    const firstChunk = Math.max(firstSampleChunk, Math.floor((carS - this.behind) / CHUNK_LENGTH));
    const lastChunk = Math.floor((carS + viewDistance) / CHUNK_LENGTH);

    // Release first, both sides: after a restart the old chunks lie ahead of
    // the new range, and keeping them would leave holes in the new road.
    for (const [index, chunk] of this.active) {
      if (index < firstChunk || index > lastChunk) {
        this.release(chunk);
        this.active.delete(index);
      }
    }

    for (let index = firstChunk; index <= lastChunk; index += 1) {
      if (this.active.has(index)) continue;
      const chunk = this.take();
      if (!chunk) break; // Pool smaller than the range: keep what we have.
      this.build(chunk, index);
      this.active.set(index, chunk);
    }
  }

  get chunkCount() {
    return this.active.size;
  }

  get bodyCount() {
    return this.world.bodies.length;
  }
}
