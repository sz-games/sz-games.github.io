// Endless road midline (plan 4.2.1 and 4.2.2).
//
// Seeded random control points are laid out along a smooth heading and
// elevation walk, then a Catmull-Rom spline through those control points is
// resampled at a fixed spacing. Every sample carries the data the renderer
// and the car need: position, tangent, right vector, curvature and bank.
//
// Sample spacing is exactly SAMPLE_SPACING in "road metres", so any point on
// the road maps to a sample index with one multiply. Samples behind the car
// are recycled, so a long drive does not grow the array.

export const SAMPLE_SPACING = 4;
export const CONTROL_SPACING = 100;
export const SAMPLES_PER_CHUNK = CONTROL_SPACING / SAMPLE_SPACING;
export const CHUNK_LENGTH = CONTROL_SPACING;

// Plan 4.2.3 limits: no tighter than 40 m at speed, 8 percent gradient.
export const MAX_CURVATURE = 1 / 55;
export const MAX_GRADIENT = 0.08;

// Heading and elevation are bounded functions of the distance along the road,
// not integrated noise. That is what keeps the road from folding back onto
// itself: the car always drives roughly forward, and curvature is the
// derivative of a function that stays inside about 69 degrees.
const HEADING_RANGE = 1.2; // radians
const ELEVATION_RANGE = 20; // metres

const SUBSTEPS = 48; // curve samples per control segment for arc resampling
const BANK_GAIN = 12.0; // curvature to bank angle
const MAX_BANK = 0.17; // about 10 degrees
const BANK_SMOOTH = 0.25;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth bounded noise: a fixed sum of sines normalised by the sum of the
// amplitudes, so the result always stays inside -1..1. Wavelengths are in
// metres of distance along the road.
function makeNoise(random, wavelengths) {
  const terms = [];
  let total = 0;
  for (let i = 0; i < wavelengths.length; i += 1) {
    const amp = wavelengths[i][1] * (0.8 + random() * 0.4);
    terms.push({
      freq: (Math.PI * 2) / wavelengths[i][0],
      amp,
      phase: random() * Math.PI * 2,
    });
    total += amp;
  }
  const scale = 1 / total;
  return function noise(s) {
    let value = 0;
    for (let i = 0; i < terms.length; i += 1) {
      const term = terms[i];
      value += term.amp * Math.sin(s * term.freq + term.phase);
    }
    return value * scale;
  };
}

// Centripetal Catmull-Rom (alpha 0.5). Unlike the uniform variant it cannot
// overshoot or loop when the control points bunch up or turn sharply.
const KNOT_ALPHA = 0.5;

function knotStep(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.pow(Math.hypot(dx, dy, dz), KNOT_ALPHA) || 1e-4;
}

function catmullRom(p0, p1, p2, p3, t, k0, k1, k2, k3, axis) {
  const v0 = p0[axis];
  const v1 = p1[axis];
  const v2 = p2[axis];
  const v3 = p3[axis];

  const a1 = v0 + (v1 - v0) * ((t - k0) / (k1 - k0));
  const a2 = v1 + (v2 - v1) * ((t - k1) / (k2 - k1));
  const a3 = v2 + (v3 - v2) * ((t - k2) / (k3 - k2));

  const b1 = a1 + (a2 - a1) * ((t - k0) / (k2 - k0));
  const b2 = a2 + (a3 - a2) * ((t - k1) / (k3 - k1));

  return b1 + (b2 - b1) * ((t - k1) / (k2 - k1));
}

export class Road {
  constructor(options = {}) {
    this.seed = (options.seed === undefined ? 20260401 : options.seed) >>> 0;
    this.width = options.width || 9;

    const random = mulberry32(this.seed);
    this.curvatureNoise = makeNoise(random, [[2400, 0.55], [1000, 0.26], [430, 0.13], [190, 0.06]]);
    this.elevationNoise = makeNoise(random, [[5200, 0.5], [2400, 0.35], [1100, 0.15]]);
    // A flat straight test track, for the car lab (?track=straight).
    if (options.straight) {
      this.curvatureNoise = () => 0;
      this.elevationNoise = () => 0;
    }
    // Flat 90 degree bends, right then left, every 400 m after a 600 m
    // straight, for the car lab (?track=corners). The heading steps between
    // -45 and +45 degrees at one control point, so the spline rounds each
    // bend as tightly as it can, and the road still leads down -Z the way
    // the terrain expects.
    if (options.corners) {
      const step = Math.PI / 4 / HEADING_RANGE;
      this.curvatureNoise = (arc) => (arc > 600 && Math.floor((arc - 600) / 400) % 2 === 0 ? step : -step);
      this.elevationNoise = () => 0;
    }

    // Control points and samples share one global index space each.
    this.control = [];
    this.controlBase = 0;
    this.controlNext = 0;

    this.samples = [];
    this.sampleBase = 0;
    this.sampleNext = 0;

    this.heading = 0;
    this.elevation = 0;

    // Scratch, reused by every resample so the hot path never allocates.
    this.subX = new Float64Array(SUBSTEPS + 1);
    this.subY = new Float64Array(SUBSTEPS + 1);
    this.subZ = new Float64Array(SUBSTEPS + 1);
    this.subS = new Float64Array(SUBSTEPS + 1);

    this.seedControlPoint(0, 0, 0, 0);
    this.scratchEstimate = Road.makeScratch();
    this.ahead = options.ahead || 2000;
    this.ensureAhead(0);
  }

  seedControlPoint(index, x, y, z) {
    const point = { x, y, z };
    this.control.push(point);
    this.controlNext = index + 1;
    return point;
  }

  // Grow the control point list up to and including global index `target`.
  growControl(target) {
    while (this.controlNext <= target) {
      const index = this.controlNext;
      const previous = this.control[index - 1 - this.controlBase];
      const arc = index * CONTROL_SPACING;

      // Bounded heading and elevation, so the road always leads forward.
      const heading = HEADING_RANGE * this.curvatureNoise(arc);
      const elevation = ELEVATION_RANGE * this.elevationNoise(arc);
      const rise = Math.max(-MAX_GRADIENT * 0.7 * CONTROL_SPACING,
        Math.min(MAX_GRADIENT * 0.7 * CONTROL_SPACING, elevation - previous.y));

      this.heading = heading;
      this.elevation = previous.y + rise;

      // Heading 0 points down -Z, the same direction the car starts facing.
      const x = previous.x + Math.sin(heading) * CONTROL_SPACING;
      const z = previous.z - Math.cos(heading) * CONTROL_SPACING;
      this.seedControlPoint(index, x, this.elevation, z);
    }
  }

  controlAt(index) {
    return this.control[index - this.controlBase];
  }

  // Build the samples for one control segment (25 samples of 4 m).
  buildSegment(segmentIndex) {
    this.growControl(segmentIndex + 2);

    const p0 = this.controlAt(segmentIndex - 1) || this.controlAt(segmentIndex);
    const p1 = this.controlAt(segmentIndex);
    const p2 = this.controlAt(segmentIndex + 1);
    const p3 = this.controlAt(segmentIndex + 2);

    // Knots for the centripetal parameterisation.
    const k1 = knotStep(p0, p1);
    const k2 = k1 + knotStep(p1, p2);
    const k3 = k2 + knotStep(p2, p3);
    const k0 = k1 - knotStep(p0, p1);

    // Walk the spline once to get an arc length table.
    const subX = this.subX;
    const subY = this.subY;
    const subZ = this.subZ;
    const subS = this.subS;
    let arc = 0;

    for (let i = 0; i <= SUBSTEPS; i += 1) {
      const t = k1 + (i / SUBSTEPS) * (k2 - k1);
      const x = catmullRom(p0, p1, p2, p3, t, k0, k1, k2, k3, 'x');
      const y = catmullRom(p0, p1, p2, p3, t, k0, k1, k2, k3, 'y');
      const z = catmullRom(p0, p1, p2, p3, t, k0, k1, k2, k3, 'z');
      subX[i] = x;
      subY[i] = y;
      subZ[i] = z;
      if (i > 0) {
        const dx = x - subX[i - 1];
        const dy = y - subY[i - 1];
        const dz = z - subZ[i - 1];
        arc += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      subS[i] = arc;
    }

    const segmentLength = arc || CONTROL_SPACING;
    let cursor = 0;

    for (let j = 0; j <= SAMPLES_PER_CHUNK; j += 1) {
      const index = segmentIndex * SAMPLES_PER_CHUNK + j;
      if (index < this.sampleNext) continue;

      // The first and last sample of a segment sit exactly on its control
      // points, so neighbouring segments share one clean boundary sample.
      let nx;
      let ny;
      let nz;
      if (j === 0) {
        nx = p1.x; ny = p1.y; nz = p1.z;
      } else if (j === SAMPLES_PER_CHUNK) {
        nx = p2.x; ny = p2.y; nz = p2.z;
      } else {
        // Even spacing along the segment, so neighbouring segments join up
        // without a jump even when the segment arc is not exactly 100 m.
        const wanted = (j / SAMPLES_PER_CHUNK) * segmentLength;
        while (cursor < SUBSTEPS && subS[cursor + 1] < wanted) cursor += 1;
        const span = subS[cursor + 1] - subS[cursor];
        const blend = span > 1e-6 ? (wanted - subS[cursor]) / span : 0;
        nx = subX[cursor] + (subX[cursor + 1] - subX[cursor]) * blend;
        ny = subY[cursor] + (subY[cursor + 1] - subY[cursor]) * blend;
        nz = subZ[cursor] + (subZ[cursor + 1] - subZ[cursor]) * blend;
      }

      this.samples.push({
        index,
        s: index * SAMPLE_SPACING,
        x: nx,
        y: ny,
        z: nz,
        tx: 0, ty: 0, tz: -1,
        rx: 1, ry: 0, rz: 0,
        curvature: 0,
        bank: 0,
      });
      this.sampleNext = index + 1;
    }
  }

  // Fill tangents, right vectors, curvature and bank from finite differences.
  // Two passes: curvature needs the tangent of the sample after it.
  refreshFrames(fromIndex) {
    const first = Math.max(this.sampleBase, fromIndex - 1);
    // A tangent only needs positions, so the newest sample gets one now.
    const tangentLast = this.sampleNext - 1;
    // Curvature needs the tangent of the sample after it, so it stops short.
    const curvatureLast = this.sampleNext - 2;

    for (let index = first; index <= tangentLast; index += 1) {
      const here = this.samples[index - this.sampleBase];
      const previous = this.samples[index - 1 - this.sampleBase] || null;
      const next = this.samples[index + 1 - this.sampleBase] || null;
      // The newest sample only has one neighbour, and so does the oldest.
      const ahead = next || here;
      const behind = previous || here;

      let tx = ahead.x - behind.x;
      let ty = ahead.y - behind.y;
      let tz = ahead.z - behind.z;
      const length = Math.hypot(tx, ty, tz) || 1;

      here.tx = tx / length;
      here.ty = ty / length;
      here.tz = tz / length;

      // right = tangent x worldUp, so right is -tz on x and tx on z.
      let rx = -tz;
      let rz = tx;
      const rightLength = Math.hypot(rx, rz);
      if (rightLength < 1e-6) {
        rx = 1;
        rz = 0;
      } else {
        rx /= rightLength;
        rz /= rightLength;
      }
      here.rx = rx;
      here.ry = 0;
      here.rz = rz;
    }

    for (let index = Math.max(this.sampleBase + 1, first); index <= curvatureLast; index += 1) {
      const here = this.samples[index - this.sampleBase];
      const next = this.samples[index + 1 - this.sampleBase];
      const previous = this.samples[index - 1 - this.sampleBase];

      // Signed curvature about the up axis: positive turns right.
      const span = (next.index - previous.index) * SAMPLE_SPACING;
      const dtx = next.tx - previous.tx;
      const dty = next.ty - previous.ty;
      const dtz = next.tz - previous.tz;
      const curvature = (dtx * here.rx + dty * here.ry + dtz * here.rz) / span;
      here.curvature = curvature;

      // Bank follows the curvature, smoothed over about 16 m so the road
      // does not twitch at every sample.
      const targetBank = Math.max(-MAX_BANK, Math.min(MAX_BANK, curvature * BANK_GAIN));
      const bank = previous.bank;
      here.bank = bank + (targetBank - bank) * BANK_SMOOTH;
    }
  }

  // Keep the midline at least `ahead` metres in front of arc position `s`.
  ensureAhead(s) {
    const needed = Math.ceil((s + this.ahead) / CONTROL_SPACING) + 1;

    while (this.controlNext <= needed) {
      // The segment that owns the first sample we still owe.
      const from = Math.floor(this.sampleNext / SAMPLES_PER_CHUNK);
      const before = this.sampleNext;
      this.buildSegment(from);
      if (this.sampleNext === before) break;
      this.refreshFrames(before);
    }
  }

  // Drop what the car left behind so the arrays stay flat over a long drive.
  dropBehind(s) {
    const keepIndex = Math.ceil(s / SAMPLE_SPACING);
    if (keepIndex - this.sampleBase > 128) {
      const drop = keepIndex - this.sampleBase - 128;
      this.samples.splice(0, drop);
      this.sampleBase += drop;
    }
    const keepControl = Math.floor(keepIndex / SAMPLES_PER_CHUNK) - 1;
    if (keepControl - this.controlBase > 4) {
      const drop = keepControl - this.controlBase - 4;
      this.control.splice(0, drop);
      this.controlBase += drop;
    }
  }

  update(carS, ahead) {
    this.ahead = ahead;
    this.ensureAhead(carS);
    this.dropBehind(carS);
  }

  get firstIndex() {
    return this.sampleBase;
  }

  get lastIndex() {
    return this.sampleNext - 1;
  }

  sample(index) {
    return this.samples[index - this.sampleBase];
  }

  // Nearest sample to a world point, searched around an estimated index.
  nearest(x, z, estimatedIndex, out) {
    const lo = Math.max(this.sampleBase, estimatedIndex - 48);
    const hi = Math.min(this.sampleNext - 1, estimatedIndex + 48);
    let best = null;
    let bestDistance = Infinity;

    for (let index = lo; index <= hi; index += 1) {
      const point = this.samples[index - this.sampleBase];
      const dx = x - point.x;
      const dz = z - point.z;
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }

    if (!best) best = this.samples[Math.max(0, this.sampleBase - this.sampleBase)];

    // Signed lateral offset: positive to the right of the driving direction.
    const dx = x - best.x;
    const dz = z - best.z;
    out.sample = best;
    out.index = best.index;
    out.s = best.s;
    out.x = best.x;
    out.z = best.z;
    out.lateral = dx * best.rx + dz * best.rz;
    out.height = best.y;
    out.tangentX = best.tx;
    out.tangentY = best.ty;
    out.tangentZ = best.tz;
    out.rightX = best.rx;
    out.rightY = best.ry;
    out.rightZ = best.rz;
    out.bank = best.bank;
    out.curvature = best.curvature;
    return out;
  }

  estimateIndex(carS, x, z, tx, tz) {
    const base = this.nearest(x, z, Math.round(carS / SAMPLE_SPACING), this.scratchEstimate);
    const dx = x - base.sample.x;
    const dz = z - base.sample.z;
    const along = dx * base.tangentX + dz * base.tangentZ;
    return Math.round(base.index + along / SAMPLE_SPACING);
  }

  static makeScratch() {
    return {
      sample: null,
      index: 0,
      s: 0,
      x: 0,
      y: 0,
      z: 0,
      lateral: 0,
      height: 0,
      tangentX: 0,
      tangentY: 0,
      tangentZ: -1,
      rightX: 1,
      rightY: 0,
      rightZ: 0,
      bank: 0,
      curvature: 0,
    };
  }
}