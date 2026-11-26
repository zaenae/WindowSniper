export const HAND_VERSION = 5;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => mul(a, 1 / (len(a) || 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function sdRoundCone(px, py, pz, c) {
  const pax = px - c.ax, pay = py - c.ay, paz = pz - c.az;
  const y = pax * c.bax + pay * c.bay + paz * c.baz;
  const z = y - c.l2;
  const qx = pax * c.l2 - c.bax * y, qy = pay * c.l2 - c.bay * y, qz = paz * c.l2 - c.baz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * c.l2, z2 = z * z * c.l2;
  const k = Math.sign(c.rr) * c.rr * c.rr * x2;
  if (Math.sign(z) * c.a2 * z2 > k) return Math.sqrt(x2 + z2) * c.il2 - c.r2;
  if (Math.sign(y) * c.a2 * y2 < k) return Math.sqrt(x2 + y2) * c.il2 - c.r1;
  return (Math.sqrt(x2 * c.a2 * c.il2) + y * c.rr) * c.il2 - c.r1;
}
function roundCone(a, b, r1, r2) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = r1 - r2;
  const m = mul(add(a, b), 0.5);
  return { ax: a[0], ay: a[1], az: a[2], bax: ba[0], bay: ba[1], baz: ba[2], l2, rr, a2: l2 - rr * rr, il2: 1 / l2, r1, r2, a, b,
    sx: m[0], sy: m[1], sz: m[2], sr: Math.sqrt(l2) / 2 + Math.max(r1, r2) };
}

const lb = (x, y, z, c) => Math.hypot(x - c.sx, y - c.sy, z - c.sz) - c.sr;

function sdEllipsoid(px, py, pz, e) {
  const dx = px - e.cx, dy = py - e.cy, dz = pz - e.cz;
  const lu = dx * e.ux + dy * e.uy + dz * e.uz, lv = dx * e.vx + dy * e.vy + dz * e.vz, lw = dx * e.wx + dy * e.wy + dz * e.wz;
  const a = lu / e.ru, b = lv / e.rv, c = lw / e.rw;
  const k0 = Math.sqrt(a * a + b * b + c * c);
  const a2 = lu / (e.ru * e.ru), b2 = lv / (e.rv * e.rv), c2 = lw / (e.rw * e.rw);
  const k1 = Math.sqrt(a2 * a2 + b2 * b2 + c2 * c2) || 1e-9;
  return k0 * (k0 - 1) / k1;
}
function ellipsoid(center, u, v, ru, rv, rw) {
  u = norm(u); v = norm(sub(v, mul(u, dot(v, u)))); const w = cross(u, v);
  return { cx: center[0], cy: center[1], cz: center[2], ux: u[0], uy: u[1], uz: u[2], vx: v[0], vy: v[1], vz: v[2], wx: w[0], wy: w[1], wz: w[2], ru, rv, rw,
    sx: center[0], sy: center[1], sz: center[2], sr: Math.max(ru, rv, rw) };
}

function sdBox(px, py, pz, b) {
  const dx = px - b.cx, dy = py - b.cy, dz = pz - b.cz;
  const qx = Math.abs(dx * b.ux + dy * b.uy + dz * b.uz) - b.hu;
  const qy = Math.abs(dx * b.vx + dy * b.vy + dz * b.vz) - b.hv;
  const qz = Math.abs(dx * b.wx + dy * b.wy + dz * b.wz) - b.hw;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - b.r;
}
function box(center, u, v, hu, hv, hw, r) {
  const e = ellipsoid(center, u, v, 1, 1, 1);
  return { ...e, hu: hu - r, hv: hv - r, hw: hw - r, r };
}

const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

export function makeHand(grip) {
  const G = (s, v, w) => add(add(add(grip.top, mul(grip.axis, s)), mul(grip.fwd, v)), [w, 0, 0]);
  const up = mul(grip.axis, -1);

  const palm = [];
  const bones = [];
  const veins = [];
  const nails = [];
  const labels = [];

  palm.push(ellipsoid(G(48, -24, -27), grip.axis, add(grip.fwd, [0.55, 0, 0]), 46, 30, 14));
  palm.push(ellipsoid(G(52, -33, -9), grip.axis, grip.fwd, 44, 13, 19));
  palm.push(ellipsoid(G(86, -40, -16), grip.axis, grip.fwd, 24, 20, 21));
  palm.push(ellipsoid(G(22, -33, 9), add(grip.axis, mul(grip.fwd, -0.4)), grip.fwd, 26, 17, 15));
  palm.push(ellipsoid(G(-2, -30, -5), grip.axis, grip.fwd, 14, 14, 18));

  const finger = (name, joints, radii, k0, dorsalHint) => {
    for (let i = 0; i < joints.length - 1; i++) {
      bones.push({ cone: roundCone(joints[i], joints[i + 1], radii[i], radii[i + 1]), k0: i === 0 ? k0 : 3.2, k1: 2.2, first: i === 0 });
      labels.push(`${name}-${i}`);
    }

    const a = joints[joints.length - 2], b = joints[joints.length - 1];
    const dir = norm(sub(b, a));
    let dorsal = norm(sub(dorsalHint, mul(dir, dot(dorsalHint, dir))));
    const r = radii[radii.length - 1];
    nails.push({ base: add(add(a, mul(dir, len(sub(b, a)) * 0.62)), mul(dorsal, r * 0.93)), dir, dorsal, width: r * 1.2, length: len(sub(b, a)) * 0.75 + r * 0.55 });
  };

  const mcp = {
    index: G(-4, -9, -29), middle: G(24, -9, -31), ring: G(46, -10, -30), pinky: G(68, -12, -27),
  };
  for (const [n, p] of Object.entries(mcp)) {
    bones.push({ cone: roundCone(G(n === 'pinky' ? 84 : 72, -46, -20), p, 10, n === 'pinky' ? 9 : 10.5), k0: 12, k1: 10, first: false });
    labels.push(`${n}-meta`);

    bones.push({ cone: roundCone(add(p, [-6.5, 0, 0]), add(add(p, [-6.5, 0, 0]), mul(grip.fwd, -3)), 7.4, 7), k0: 6, k1: 6, first: false });
    labels.push(`${n}-knuckle`);
  }

  const outL = [1, 0, 0];
  finger('middle', [mcp.middle, G(26, 36, -17), G(28, 33, 11), G(29, 17, 22)], [10.8, 10, 9.1, 7.6], 9, outL);
  finger('ring', [mcp.ring, G(48, 34, -17), G(50, 31, 10), G(51, 17, 21)], [10.4, 9.6, 8.8, 7.3], 9, outL);
  finger('pinky', [mcp.pinky, G(69, 28, -16), G(70, 28, 6), G(71, 17, 17)], [9.2, 8.6, 7.9, 6.6], 8, outL);

  finger('index', [mcp.index, G(-11, 38, -25), G(-17, 59, -14), G(-17, 76, -2)], [10.8, 10, 9, 7.6], 9, add(mul(up, 1), [-0.6, 0, 0]));

  finger('thumb', [G(12, -30, 6), G(3, -12, 22), G(-4, 9, 25.5), G(-8, 27, 24)], [14, 12.5, 10.8, 8.4], 14, add(outL, mul(up, 0.55)));

  const v = (pts, r) => { for (let i = 0; i < pts.length - 1; i++) veins.push(roundCone(pts[i], pts[i + 1], r, r * 0.85)); };
  ['index', 'middle', 'ring', 'pinky'].forEach((n, i) => {
    const k = add(mcp[n], [-12, 0, 0]);
    const w0 = G(86 + i * 2, -50 + i * 2, -40.5), mid = add(mul(w0, 0.5), mul(k, 0.5));
    v([w0, add(mid, [-2.6, 0, 0]), k], 3.2);
  });
  v([G(96, -54, -39), G(72, -38, -44.5), G(50, -24, -45.5), G(32, -14, -44)], 2.6);
  v([G(72, -38, -44.5), G(60, -42, -43), G(44, -44, -40.5)], 2.3);

  const wrist = G(100, -60, -14);
  const armDir = norm([-0.24, -0.3, -1]);
  const along = d => add(wrist, mul(armDir, d));
  const side = norm(cross(armDir, [0, 1, 0]));
  const arm = [
    roundCone(add(along(-18), mul(side, 9)), add(along(140), mul(side, 13)), 20, 27),
    roundCone(add(along(-18), mul(side, -9)), add(along(140), mul(side, -12)), 19, 26),
    roundCone(along(120), along(360), 34, 40),
  ];
  const muscles = [
    ellipsoid(add(along(215), add(mul(side, 17), [0, 17, 0])), armDir, [0, 1, 0], 125, 30, 31),
    ellipsoid(add(along(205), add(mul(side, -15), [0, -11, 0])), armDir, [0, 1, 0], 118, 29, 28),
  ];
  v([add(along(10), add(mul(side, 4), [0, 19, 0])), add(along(110), add(mul(side, 10), [0, 26.5, 0])), add(along(200), add(mul(side, 6), [0, 37, 0]))], 2.3);

  return { palm, bones, labels, veins, nails, arm, muscles, wrist, armDir, mcp };
}

export function makeSdf(h) {
  const nb = h.bones.length;

  const armPts = [...h.arm.flatMap(c => [c.a, c.b]), ...h.muscles.map(e => [e.cx, e.cy, e.cz])];
  const ac = mul(armPts.reduce((p, q) => add(p, q), [0, 0, 0]), 1 / armPts.length);
  const ar = Math.max(...h.arm.map(c => Math.max(len(sub(c.a, ac)) + c.r1, len(sub(c.b, ac)) + c.r2)), ...h.muscles.map(e => len(sub([e.cx, e.cy, e.cz], ac)) + Math.max(e.ru, e.rv, e.rw)));
  const armSphere = { sx: ac[0], sy: ac[1], sz: ac[2], sr: ar };
  return function sdf(x, y, z) {
    let d = 1e9;
    for (const e of h.palm) if (lb(x, y, z, e) < d + 14) d = smin(d, sdEllipsoid(x, y, z, e), 14);
    if (lb(x, y, z, armSphere) < d + 26) {
      let a = 1e9;
      for (const c of h.arm) if (lb(x, y, z, c) < Math.min(a, d) + 26) a = smin(a, sdRoundCone(x, y, z, c), 14);
      for (const e of h.muscles) if (lb(x, y, z, e) < Math.min(a, d) + 26) a = smin(a, sdEllipsoid(x, y, z, e), 26);
      d = smin(d, a, 18);
    }

    let fingers = 1e9;
    for (let i = 0; i < nb; i++) {
      const b = h.bones[i], c = b.cone;
      const bound = lb(x, y, z, c);
      if (b.first || b.k0 >= 6) {
        if (bound > d + b.k0) continue;
        const di = sdRoundCone(x, y, z, c);
        if (b.first) {
          const t = clamp(((x - c.ax) * c.bax + (y - c.ay) * c.bay + (z - c.az) * c.baz) * c.il2, 0, 1);
          d = smin(d, di, b.k0 + (b.k1 - b.k0) * Math.min(1, t * 1.6));
        } else d = smin(d, di, b.k0);
      } else {
        if (bound > Math.min(fingers, d) + 4) continue;
        fingers = smin(fingers, sdRoundCone(x, y, z, c), b.k0);
      }
    }
    d = smin(d, fingers, 2.4);
    for (const c of h.veins) if (lb(x, y, z, c) < d + 2) d = smin(d, sdRoundCone(x, y, z, c), 1.6);
    return d;
  };
}

export function meshSdf(sdf, min, max, step) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const V = new Float32Array(nx * ny * nz);
  const idx = (i, j, k) => i + nx * (j + ny * k);
  const B = 4;
  const reach = Math.sqrt(3) * (B / 2 + 1) * step * 1.35;
  for (let bk = 0; bk < nz; bk += B) for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
    const cx = min[0] + (bi + B / 2) * step, cy = min[1] + (bj + B / 2) * step, cz = min[2] + (bk + B / 2) * step;
    const dc = sdf(cx, cy, cz);
    const i1 = Math.min(nx, bi + B + 1), j1 = Math.min(ny, bj + B + 1), k1 = Math.min(nz, bk + B + 1);
    if (Math.abs(dc) > reach) {
      const fill = dc > 0 ? 1e3 : -1e3;
      for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) for (let i = bi; i < i1; i++) {
        const n = idx(i, j, k); if (V[n] === 0) V[n] = fill;
      }
      continue;
    }
    for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) for (let i = bi; i < i1; i++) {
      const n = idx(i, j, k);
      if (V[n] === 0 || Math.abs(V[n]) === 1e3) V[n] = sdf(min[0] + i * step, min[1] + j * step, min[2] + k * step) || 1e-6;
    }
  }

  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { val[c] = V[idx(i + corner[c][0], j + corner[c][1], k + corner[c][2])]; if (val[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) {
      const va = val[a], vb = val[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corner[a][0] + t * (corner[b][0] - corner[a][0]);
      sy += corner[a][1] + t * (corner[b][1] - corner[a][1]);
      sz += corner[a][2] + t * (corner[b][2] - corner[a][2]);
      cnt++;
    }
    cellVert[cidx(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / cnt) * step, min[1] + (j + sy / cnt) * step, min[2] + (k + sz / cnt) * step);
  }

  const tris = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, c, b, a, d, c); else tris.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = V[idx(i, j, k)] < 0;
    if (i < nx - 1 && v0 !== (V[idx(i + 1, j, k)] < 0))
      quad(cellVert[cidx(i, j - 1, k - 1)], cellVert[cidx(i, j, k - 1)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j - 1, k)], v0);
    if (j < ny - 1 && v0 !== (V[idx(i, j + 1, k)] < 0))
      quad(cellVert[cidx(i - 1, j, k - 1)], cellVert[cidx(i - 1, j, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j, k - 1)], v0);
    if (k < nz - 1 && v0 !== (V[idx(i, j, k + 1)] < 0))
      quad(cellVert[cidx(i - 1, j - 1, k)], cellVert[cidx(i, j - 1, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i - 1, j, k)], v0);
  }
  return { positions: new Float32Array(pos), indices: pos.length / 3 > 65535 ? new Uint32Array(tris) : new Uint16Array(tris) };
}

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map(srgbToLinear);

export function buildHandMesh(grip, gunOccluders = [], { step = 1.4 } = {}) {
  const h = makeHand(grip);
  const sdf = makeSdf(h);
  const occ = (x, y, z) => {
    let d = sdf(x, y, z);
    for (const b of gunOccluders) d = Math.min(d, sdBox(x, y, z, b));
    return d;
  };

  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const grow = (p, r) => { for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a] - r - 6); hi[a] = Math.max(hi[a], p[a] + r + 6); } };
  for (const b of h.bones) { grow(b.cone.a, b.cone.r1); grow(b.cone.b, b.cone.r2); }
  for (const e of h.palm) grow([e.cx, e.cy, e.cz], Math.max(e.ru, e.rv, e.rw));
  for (const c of h.arm) { grow(c.a, c.r1); grow(c.b, c.r2); }
  for (const e of h.muscles) grow([e.cx, e.cy, e.cz], Math.max(e.ru, e.rv, e.rw) * 0.6);

  const t0 = Date.now();
  const { positions, indices } = meshSdf(sdf, lo, hi, step);
  const n = positions.length / 3;

  const normals = new Float32Array(n * 3), colors = new Float32Array(n * 3), uvs = new Float32Array(n * 2);
  const e = 0.3;
  const grad = (x, y, z, f) => {
    const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e);
    const gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d;
    const l = Math.hypot(gx, gy, gz) || 1;
    return [gx / l, gy / l, gz / l];
  };
  const skin = hex(0x9e6244), flush = hex(0x9a4a38), pale = hex(0xb47d60), crease = hex(0x3a1e14), tan = hex(0x8a5236);
  const indexMid = h.labels.indexOf('index-1'), indexTip = h.labels.indexOf('index-2');
  const trigCones = [h.bones[indexMid].cone, h.bones[indexTip].cone];
  const trigger = [];
  for (let i = 0; i < n; i++) {
    let x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const d0 = sdf(x, y, z);
    const g0 = grad(x, y, z, sdf);
    x -= g0[0] * d0; y -= g0[1] * d0; z -= g0[2] * d0;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    const nn = grad(x, y, z, sdf);
    normals.set(nn, i * 3);

    if (Math.min(sdRoundCone(x, y, z, trigCones[0]), sdRoundCone(x, y, z, trigCones[1])) < 2.2) trigger.push(i);

    let o = 0, w = 1;
    for (const hh of [1.5, 3.5, 6.5, 11, 17]) { o += w * Math.max(0, hh - occ(x + nn[0] * hh, y + nn[1] * hh, z + nn[2] * hh)); w *= 0.62; }
    const ao = clamp(1 - o * 0.1, 0, 1);

    let red = 0;
    for (const { cone: c } of h.bones) {
      const dk = Math.hypot(x - c.b[0], y - c.b[1], z - c.b[2]) - c.r2;
      red = Math.max(red, Math.exp(-(dk * dk) / 60) * 0.55);
    }
    const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);

    const blotch = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.sin(y * 0.07) * 2) * Math.sin(z * 0.09 + Math.sin(x * 0.05) * 2);
    const speck = 0.5 + 0.5 * Math.sin(x * 1.7 + y * 2.3) * Math.sin(y * 1.9 - z * 2.1) * Math.sin(z * 2.2 + x * 1.3);
    const armT = clamp(dot(sub([x, y, z], h.wrist), h.armDir) / 120, 0, 1);
    let col = mix(skin, tan, armT * 0.5 + blotch * 0.3);
    col = mix(col, flush, red + (1 - blotch) * 0.14);
    col = mix(col, pale, speck * 0.08);
    col = mix(crease, col, 0.25 + 0.75 * Math.pow(ao, 1.6));
    colors.set(col.map(v => v * (0.45 + 0.55 * ao)), i * 3);

    const ax = Math.abs(nn[0]), ay = Math.abs(nn[1]), az = Math.abs(nn[2]);
    const sc = 1 / 22;
    if (ax >= ay && ax >= az) { uvs[i * 2] = z * sc; uvs[i * 2 + 1] = y * sc; }
    else if (ay >= az) { uvs[i * 2] = x * sc; uvs[i * 2 + 1] = z * sc; }
    else { uvs[i * 2] = x * sc; uvs[i * 2 + 1] = y * sc; }
  }

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ab = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const ac = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const fn = cross(ab, ac);
    const vn = [normals[a] + normals[b] + normals[c], normals[a + 1] + normals[b + 1] + normals[c + 1], normals[a + 2] + normals[b + 2] + normals[c + 2]];
    if (dot(fn, vn) < 0) { const tmp = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = tmp; }
  }

  const pip = h.bones[indexMid].cone.a;
  const dip = h.bones[indexMid].cone.b, tip = h.bones[indexTip].cone.b;
  const curlAxis = norm(cross(sub(dip, pip), sub(tip, dip)));

  return {
    positions, normals, colors, uvs, indices, nails: h.nails,
    trigger: { vertices: Uint32Array.from(trigger), pivot: pip, axis: curlAxis },
    stats: { vertices: n, triangles: indices.length / 3, ms: Date.now() - t0 },
  };
}

export { box as occluderBox };
