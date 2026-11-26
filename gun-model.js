import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildHandMesh, occluderBox, HAND_VERSION } from './hand-sdf.js';

const UNIT = 1 / 186;

function canvasTex(size, draw, { srgb = false, repeat = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

function noiseTex(size, { base = 128, amp = 60, blobs = 3000, rMin = 0.5, rMax = 2, alpha = 0.5 } = {}) {
  return canvasTex(size, (x, s) => {
    x.fillStyle = `rgb(${base},${base},${base})`; x.fillRect(0, 0, s, s);
    for (let i = 0; i < blobs; i++) {
      const v = Math.round(base + (Math.random() * 2 - 1) * amp);
      x.fillStyle = `rgba(${v},${v},${v},${alpha})`;
      x.beginPath(); x.arc(Math.random() * s, Math.random() * s, rMin + Math.random() * (rMax - rMin), 0, Math.PI * 2); x.fill();
    }
  });
}

const finishRough = canvasTex(512, (x, s) => {
  x.fillStyle = '#6e6e6e'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2200; i++) {
    const v = 70 + Math.random() * 110;
    x.strokeStyle = `rgba(${v},${v},${v},0.25)`; x.lineWidth = Math.random() * 1.4;
    const y = Math.random() * s;
    x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + Math.random() * 6 - 3); x.stroke();
  }
  for (let i = 0; i < 260; i++) {
    x.strokeStyle = `rgba(30,30,30,${0.2 + Math.random() * 0.4})`; x.lineWidth = 0.6 + Math.random() * 1.5;
    const px = Math.random() * s, py = Math.random() * s, a = Math.random() * Math.PI;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * (4 + Math.random() * 18), py + Math.sin(a) * (4 + Math.random() * 18)); x.stroke();
  }
});
const finishColor = canvasTex(512, (x, s) => {
  x.fillStyle = '#2a2b2e'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 500; i++) {
    const r = 10 + Math.random() * 50, g = x.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, Math.random() < 0.5 ? 'rgba(60,58,55,0.18)' : 'rgba(15,15,17,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(Math.random() * s, Math.random() * s); x.fillStyle = g; x.fillRect(-r, -r, 2 * r, 2 * r); x.restore();
  }
  for (let i = 0; i < 160; i++) {
    x.strokeStyle = `rgba(120,120,125,${Math.random() * 0.35})`; x.lineWidth = 0.5 + Math.random();
    const px = Math.random() * s, py = Math.random() * s;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.random() * 14 - 7, py + Math.random() * 4 - 2); x.stroke();
  }
}, { srgb: true });
const rubber = noiseTex(256, { base: 128, amp: 110, blobs: 9000, rMin: 0.6, rMax: 1.4 });
rubber.repeat.set(4, 4);
const skinPores = canvasTex(512, (x, s) => {
  x.fillStyle = '#808080'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 26000; i++) {
    const v = 95 + Math.random() * 50;
    x.fillStyle = `rgba(${v},${v},${v},0.55)`;
    x.beginPath(); x.arc(Math.random() * s, Math.random() * s, Math.random() * 1.2, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = 'rgba(60,60,60,0.22)';
  for (let i = 0; i < 700; i++) {
    const px = Math.random() * s, py = Math.random() * s, a = Math.random() * Math.PI;
    x.lineWidth = 0.5 + Math.random() * 0.8;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 10, py + Math.sin(a) * 10); x.stroke();
  }
});
const markings = canvasTex(1024, (x, s) => {
  x.clearRect(0, 0, s, s);
  x.fillStyle = 'rgba(205,205,210,0.75)';
  x.font = 'bold 64px Arial, Helvetica, sans-serif';
  x.textBaseline = 'middle';
  x.fillText('WS-50', 40, s / 2 - 40);
  x.font = '44px Arial, Helvetica, sans-serif';
  x.fillText('.50 AE', 280, s / 2 - 36);
  x.font = '30px Arial, Helvetica, sans-serif';
  x.fillStyle = 'rgba(200,200,205,0.5)';
  x.fillText('PISTOL  ·  MADE FOR CLOSING APPS', 44, s / 2 + 34);
}, { srgb: true });
markings.wrapS = markings.wrapT = THREE.ClampToEdgeWrapping;

export function makeMaterials() {
  return {
    finish: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: finishColor, metalness: 0.75, roughness: 0.42, roughnessMap: finishRough, clearcoat: 0.3, clearcoatRoughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x141517, metalness: 0.7, roughness: 0.5, roughnessMap: finishRough }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9fa3a8, metalness: 1.0, roughness: 0.3 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x131314, metalness: 0.0, roughness: 0.92, bumpMap: rubber, bumpScale: 1.6 }),
    bore: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    dot: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35 }),
    markings: new THREE.MeshStandardMaterial({ map: markings, transparent: true, metalness: 0.5, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd2a650, metalness: 1.0, roughness: 0.28 }),
    casing: new THREE.MeshStandardMaterial({ color: 0xe0b366, metalness: 1.0, roughness: 0.2, vertexColors: true }),
    soot: new THREE.MeshStandardMaterial({ color: 0x17120e, metalness: 0.2, roughness: 0.95, side: THREE.DoubleSide }),
    primer: new THREE.MeshStandardMaterial({ color: 0xc9cbcf, metalness: 1.0, roughness: 0.32 }),
    skin: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.5,
      sheen: 0.18, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xff8a70), clearcoat: 0.06, clearcoatRoughness: 0.6,
    }),
    nail: new THREE.MeshPhysicalMaterial({ color: 0xa8705f, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
  };
}

function extrudeSide(shape, width, mat, bevel = 1.6) {
  const depth = Math.max(0.01, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 20 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function extrudeLength(shape, z0, z1, mat, bevel = 1.4) {
  const depth = z1 - z0 - 2 * bevel;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 12 });
  g.translate(0, 0, z0 + bevel);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function shapeOf(points, holes = []) {
  const s = new THREE.Shape();
  points.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v)));
  s.closePath();
  for (const h of holes) { const p = new THREE.Path(); h.forEach(([u, v], i) => (i ? p.lineTo(u, v) : p.moveTo(u, v))); p.closePath(); s.holes.push(p); }
  return s;
}
const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
function at(obj, parent, x, y, z) { obj.position.set(x, y, z); parent.add(obj); return obj; }

const GRIP = (() => {
  const top = [0, -40, -84];
  const axis = new THREE.Vector3(0, -100, -26).normalize();
  const fwd = new THREE.Vector3(0, axis.z, -axis.y);
  if (fwd.z < 0) fwd.negate();
  return { top, axis: axis.toArray(), fwd: fwd.toArray() };
})();

function buildPistol(M) {
  const body = new THREE.Group();

  body.add(extrudeLength(shapeOf([[-15.5, -15], [15.5, -15], [15.5, -2], [9.5, 15], [-9.5, 15], [-15.5, -2]]), -6, 136, M.finish, 1.8));

  at(rbox(9, 3, 128, 0.8, M.finish), body, 0, 16.5, 68);
  for (let z = 12; z < 128; z += 7.5) at(new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.4, 2.2), M.bore), body, 0, 17.6, z);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 2, 32), M.dark);
  crown.rotation.x = Math.PI / 2; at(crown, body, 0, 0, 136.2);
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 3, 28), M.bore);
  bore.rotation.x = Math.PI / 2; at(bore, body, 0, 0, 136.4);

  at(rbox(4.5, 7, 9, 1, M.dark), body, 0, 20.5, 129);

  const mark = new THREE.Mesh(new THREE.PlaneGeometry(110, 28), M.markings);
  mark.rotation.y = Math.PI / 2;
  at(mark, body, 15.6, 0, 70);

  const slide = new THREE.Group();
  body.add(slide);
  slide.add(extrudeLength(shapeOf([[-15, -15], [15, -15], [15, 9], [11, 15.5], [-11, 15.5], [-15, 9]]), -132, -6.5, M.finish, 2));
  for (let i = 0; i < 11; i++) at(new THREE.Mesh(new THREE.BoxGeometry(31.6, 17, 1.6), M.dark), slide, 0, -1, -126 + i * 3.4);
  at(rbox(26, 7, 10, 1.4, M.dark), slide, 0, 18, -120);
  for (const sx of [-6, 6]) at(new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), M.dot), slide, sx, 19.5, -114.9);
  at(rbox(5, 7, 16, 1.5, M.dark), slide, 16.4, 6, -108);
  at(new THREE.Mesh(new THREE.BoxGeometry(2, 9, 40), M.bore), slide, -15.2, 4, -40);
  at(rbox(1.6, 8, 38, 0.6, M.steel), slide, -15.6, 4, -40);

  const frame = shapeOf([
    [96, -15], [-126, -15], [-140, -19], [-138, -27], [-120, -34], [-108, -40],
    [-111, -60], [-120, -95], [-128, -128], [-132, -142], [-80, -146], [-77, -138],
    [-70, -108], [-63, -78], [-58, -58],
    [-46, -66], [-30, -72], [22, -72], [36, -70], [42, -64], [42, -30], [96, -30],
  ], [[
    [-40, -30], [28, -30], [32, -34], [32, -54], [26, -60], [-30, -60], [-41, -50],
  ]]);
  body.add(extrudeSide(frame, 26, M.finish, 2.2));

  for (let i = 0; i < 4; i++) at(new THREE.Mesh(new THREE.BoxGeometry(22, 1.6, 5), M.bore), body, 0, -31.4, 52 + i * 11);

  body.add(extrudeSide(shapeOf([[-110, -44], [-113, -62], [-121, -95], [-129, -126], [-131, -136], [-82, -138], [-75, -110], [-68, -82], [-62, -58]]), 36, M.rubber, 3.5));

  const trig = new THREE.Shape();
  trig.moveTo(-8, -30); trig.lineTo(-1, -30);
  trig.quadraticCurveTo(4, -42, -3, -55); trig.lineTo(-8, -54);
  trig.quadraticCurveTo(-3, -42, -8, -30);
  body.add(extrudeSide(trig, 7, M.dark, 1.2));

  const hammer = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.5, 2.4, 10, 24), M.dark);
  ring.rotation.y = Math.PI / 2;
  hammer.add(ring);
  at(rbox(8, 10, 8, 1.5, M.dark), hammer, 0, -8, 1.5);
  hammer.rotation.x = -0.35;
  at(hammer, body, 0, 8, -137);

  at(rbox(3, 6, 30, 1.2, M.dark), body, 14.6, -21, -40);

  const mag = new THREE.Group();
  mag.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...GRIP.axis));
  mag.position.set(...GRIP.top);
  body.add(mag);
  at(rbox(32, 7, 58, 2, M.dark), mag, 0, -110, -2);
  at(rbox(22, 100, 40, 1.5, M.steel), mag, 0, -58, -2);

  const muzzle = at(new THREE.Object3D(), body, 0, 0, 140);
  const ejectPort = at(new THREE.Object3D(), body, -18, 8, -40);

  const occluders = [
    occluderBox([0, -90, -98], GRIP.axis, GRIP.fwd, 52, 26, 18, 4),
    occluderBox([0, -22, -20], [0, 0, 1], [0, 1, 0], 112, 8, 13, 2),
    occluderBox([0, 0, 0], [0, 0, 1], [0, 1, 0], 136, 16, 15.5, 2),
  ];
  return { body, slide, mag, magHome: mag.position.clone(), magAxis: new THREE.Vector3(...GRIP.axis), muzzle, ejectPort, occluders };
}

const HAND_STEP = 1.4;
const CACHE_KEY = `hand-v${HAND_VERSION}-${HAND_STEP}`;

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('windowsniper', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('meshes');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('meshes', mode);
      const req = fn(tx.objectStore('meshes'));
      tx.oncomplete = () => { resolve(req.result); open.result.close(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function loadHandData(occluders, { cache = true } = {}) {
  if (cache) {
    try { const hit = await idb('readonly', st => st.get(CACHE_KEY)); if (hit) return hit; } catch {  }
  }
  let data;
  try {
    data = await new Promise((resolve, reject) => {
      const w = new Worker(new URL('./hand-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = e => { resolve(e.data); w.terminate(); };
      w.onerror = e => { reject(e); w.terminate(); };
      w.postMessage({ grip: GRIP, occluders, step: HAND_STEP });
    });
  } catch {
    data = buildHandMesh(GRIP, occluders, { step: HAND_STEP });
  }
  if (cache) {
    try {
      await idb('readwrite', st => { st.clear(); return st.put(data, CACHE_KEY); });
    } catch {  }
  }
  return data;
}

function buildHand(parent, M, data) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(data.indices, 1));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, M.skin);
  parent.add(mesh);

  for (const n of data.nails) {
    const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.nail);
    const y = new THREE.Vector3(...n.dir), z = new THREE.Vector3(...n.dorsal), x = new THREE.Vector3().crossVectors(z, y);
    nail.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, z, y));
    nail.scale.set(n.width * 0.5, 1.4, n.length * 0.5);
    nail.position.fromArray(n.base);
    parent.add(nail);
  }

  const base = data.positions.slice(), baseN = data.normals.slice();
  const pivot = new THREE.Vector3(...data.trigger.pivot), axis = new THREE.Vector3(...data.trigger.axis);
  const q = new THREE.Quaternion(), v = new THREE.Vector3();
  let last = 0;
  function squeeze(amount) {
    if (Math.abs(amount - last) < 0.002) return;
    last = amount;
    q.setFromAxisAngle(axis, amount * 0.28);
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    for (const i of data.trigger.vertices) {
      v.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).sub(pivot).applyQuaternion(q).add(pivot);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      v.set(baseN[i * 3], baseN[i * 3 + 1], baseN[i * 3 + 2]).applyQuaternion(q);
      N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z;
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
  }
  return { mesh, squeeze, stats: data.stats };
}

export function buildCasing(M, mm) {
  const outer = [
    [0, 0], [5.2, 0], [6.4, 0.15], [6.55, 0.6], [6.55, 1.25],
    [6.2, 1.5], [5.75, 1.75], [5.75, 2.5],
    [6.4, 3.1], [6.95, 3.6],
    [6.92, 20], [6.88, 31.6], [6.82, 32.4], [6.6, 32.6],
  ];
  const inner = [[6.6, 32.6], [6.25, 32.55], [6.3, 31.5], [6.3, 26], [5.6, 24.6], [0, 24.2]];
  const lathe = pts => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(Math.max(r, 0.001) * mm, h * mm)), 40);
  const geo = lathe(outer);

  const tone = outer.map(([r, h]) => {
    if (h <= 0.15) return [0.82, 0.8, 0.76];
    const blush = Math.max(0, (h - 24) / 8.6);
    return [1 - blush * 0.38, 1 - blush * 0.45, 1 - blush * 0.55];
  });
  const n = outer.length, cols = new Float32Array(geo.attributes.position.count * 3);
  for (let v = 0; v < geo.attributes.position.count; v++) cols.set(tone[v % n], v * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();

  const soot = new THREE.Mesh(lathe(inner), M.soot);

  const casing = new THREE.Group();
  const body = new THREE.Mesh(geo, M.casing);
  body.castShadow = true;
  casing.add(body, soot);

  const primer = new THREE.Mesh(new THREE.CylinderGeometry(2.75 * mm, 2.75 * mm, 0.3 * mm, 24), M.primer);
  primer.position.y = -0.1 * mm;
  casing.add(primer);
  const strike = new THREE.Mesh(new THREE.SphereGeometry(0.85 * mm, 12, 8), M.bore);
  strike.scale.y = 0.35;
  strike.position.y = -0.22 * mm;
  casing.add(strike);
  casing.userData.mouth = new THREE.Vector3(0, 32.6 * mm, 0);
  return casing;
}

export function buildGunModel({ cache = true } = {}) {
  const M = makeMaterials();
  const root = new THREE.Group();
  const mm = new THREE.Group();
  mm.scale.setScalar(UNIT);
  mm.position.set(0, 70 * UNIT, 105 * UNIT);
  root.add(mm);
  const pistol = buildPistol(M);
  mm.add(pistol.body);
  const shadows = () => root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  shadows();
  const model = { root, ...pistol, squeeze: () => {}, handStats: null, M, UNIT };
  model.handReady = loadHandData(pistol.occluders, { cache }).then(data => {
    const hand = buildHand(pistol.body, M, data);
    shadows();
    model.squeeze = hand.squeeze;
    model.handStats = hand.stats;
    return model;
  });
  return model;
}
