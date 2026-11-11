import * as THREE from 'three';

// The landing page's 3D world: one spreadsheet of 36 × 28 cells, each cell an instanced block. Every chapter of the page names a
// layout ("city", "matched", "cube" …); as the page scrolls between two chapters, every block travels from its place in one
// layout to its place in the next (with a small per-cell stagger, so the sheet moves like a wave) and the camera glides
// between the two chapters' viewpoints. Everything is procedural: no models, textures or fonts are fetched.

const C = 36; // columns A … AJ
const R = 28; // rows 1 … 28
const N = C * R; // 1008 = 12 × 12 × 7, the final cube
const PX = 1; // column pitch: cells are wide and short, like Excel's
const PZ = 0.5; // row pitch
const SX = 0.9;
const SZ = 0.4;

const COLORS = {
  bg: '#0a0e0c',
  floor: '#0d1210',
  grid: '#1c2622',
  paper: '#e6ebe8',
  paperDim: '#a9b3ae',
  stone: '#7b8580',
  stoneDark: '#39413d',
  green: '#21a366',
  greenBright: '#3ccf87',
  amber: '#e0a23a',
  red: '#d8574b',
  dim: '#262d2a',
};
const col = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, new THREE.Color(v)]));

// ── deterministic noise ──────────
const hash = (a, b = 0, s = 0) => {
  let h = Math.imul(a * 374761393 + b * 668265263 + s * 2147483647, 1274126177) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, y, seed) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = smooth(x - xi); const yf = smooth(y - yi);
  const a = hash(xi, yi, seed); const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed); const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
const fbm = (x, y) => valueNoise(x, y, 1) * 0.6 + valueNoise(x * 2.1, y * 2.1, 2) * 0.3 + valueNoise(x * 4.3, y * 4.3, 3) * 0.1;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const bx = (i) => (i - (C - 1) / 2) * PX;
const bz = (j) => (j - (R - 1) / 2) * PZ;

// ── layouts ──────────
// A layout = per-cell centre (x, y, z), size (sx, sy, sz) and colour. Builders work cell by cell: (k, i = column, j = row).
function layout(build) {
  const L = { pos: new Float32Array(N * 3), scl: new Float32Array(N * 3), col: new Float32Array(N * 3), spin: false };
  const tmp = new THREE.Color();
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < C; i++) {
      const k = j * C + i;
      const out = build(i, j, k);
      const [x, y, z, sx, sy, sz] = out.box;
      L.pos.set([x, y, z], k * 3);
      L.scl.set([sx, sy, sz], k * 3);
      tmp.copy(out.color);
      if (out.shade) tmp.multiplyScalar(out.shade);
      L.col.set([tmp.r, tmp.g, tmp.b], k * 3);
    }
  }
  return L;
}
const onFloor = (x, z, h, sx = SX, sz = SZ) => [x, h / 2, z, sx, h, sz];
const mix = (a, b, t) => new THREE.Color().copy(a).lerp(b, t);
const status = (j) => { const r = hash(j, 7, 11); return r < 0.66 ? 0 : r < 0.86 ? 1 : 2; }; // per row: matched, close, missing
const half = (i) => (i < C / 2 ? -1 : 1);

const groupOf = (j) => Math.floor(hash(j, 3, 5) * 3); // a "region" value per row, for split / combine
const groupRank = (() => {
  const counts = [0, 0, 0]; const rank = []; const before = [];
  for (let j = 0; j < R; j++) { const g = groupOf(j); rank[j] = counts[g]++; }
  before[0] = 0; before[1] = counts[0]; before[2] = counts[0] + counts[1];
  return { rank, counts, before };
})();
const GROUP_COLORS = [col.paper, col.green, col.stone];

const LAYOUTS = {
  city: () => layout((i, j) => {
    const n = fbm(i * 0.16 + 3, j * 0.3 + 7);
    const far = 0.3 + 0.7 * (1 - j / R); // rows nearer the camera stay low so the view runs deep
    const h = 0.15 + (11 * n ** 3 + (hash(i, j, 9) > 0.93 ? 1.5 : 0)) * far;
    const accent = hash(i, j, 4) > 0.955;
    return {
      box: onFloor(bx(i), bz(j), h),
      color: accent ? col.greenBright : mix(col.stoneDark, col.paperDim, clamp01(h / 7) * 0.85 + hash(i, j, 2) * 0.15),
    };
  }),

  two: () => layout((i, j) => ({
    box: onFloor(bx(i) + half(i) * 1.6, bz(j), 0.16 + hash(i, j, 1) * 0.06),
    color: mix(col.stoneDark, col.paperDim, 0.55 + hash(i, j, 3) * 0.2),
  })),

  matched: () => layout((i, j) => {
    const s = status(j);
    return s === 0
      ? { box: onFloor(bx(i) + half(i) * 1.6, bz(j), 0.55 + hash(j, 2) * 0.5), color: mix(col.green, col.greenBright, hash(i, j, 6) * 0.6) }
      : { box: onFloor(bx(i) + half(i) * 1.6, bz(j), 0.08), color: col.dim };
  }),

  close: () => layout((i, j) => {
    const s = status(j);
    const x = bx(i) + half(i) * 1.6 + (s === 1 && i >= C / 2 ? 0.35 : 0); // the near-miss row sits a little out of line
    return s === 1
      ? { box: onFloor(x, bz(j), 0.8 + hash(j, 4) * 0.4), color: col.amber, shade: 0.85 + hash(i, j, 6) * 0.3 }
      : { box: onFloor(x, bz(j), 0.12), color: s === 0 ? mix(col.dim, col.green, 0.35) : col.dim };
  }),

  changed: () => layout((i, j) => {
    const x = bx(i) + half(i) * 1.6;
    if (status(j) === 2 && i < C / 2) return { box: onFloor(x, bz(j), 0.45), color: col.red }; // removed
    if (j % 9 === 4 && i >= C / 2) return { box: onFloor(x, bz(j), 0.45), color: col.green }; // added
    if (hash(i, j, 12) > 0.93) return { box: onFloor(x, bz(j), 1.3), color: col.amber }; // edited cell
    return { box: onFloor(x, bz(j), 0.12), color: mix(col.stoneDark, col.paperDim, 0.35) };
  }),

  balanced: () => layout((i, j) => {
    const h = 0.2 + hash(j, i % (C / 2), 21) * 1.1; // the same figure on both sides of the gap
    const off = status(j) === 2 && i >= C / 2 && i % 6 === 0;
    return {
      box: onFloor(bx(i) + half(i) * 0.9, bz(j), off ? h + 0.9 : h),
      color: off ? col.red : mix(col.paperDim, col.green, 0.25 + (h / 1.3) * 0.5),
    };
  }),

  sheet: () => layout((i, j) => ({
    box: onFloor(bx(i), bz(j), 0.05, 0.96, 0.46),
    color: i === 0 || j === 0 ? mix(col.dim, col.green, 0.6) : mix(col.dim, col.stone, 0.25 + 0.2 * fbm(i * 0.2, j * 0.2)),
  })),

  messy: () => layout((i, j) => {
    const r = hash(i, j, 31);
    const c = r > 0.92 ? col.red : r > 0.82 ? col.amber : r > 0.45 ? col.paperDim : col.stone;
    return {
      box: onFloor(bx(i) + (hash(i, j, 32) - 0.5) * 0.5, bz(j) + (hash(i, j, 33) - 0.5) * 0.25, 0.05 + hash(i, j, 34) ** 2 * 2.2,
        SX * (0.6 + hash(i, j, 35) * 0.5), SZ),
      color: c,
      shade: 0.7 + hash(i, j, 36) * 0.4,
    };
  }),

  once: () => layout((i, j) => {
    if (j % 5 === 2) return { box: onFloor(bx(i), bz(j), 0.02), color: col.red }; // the duplicate, going
    if (j % 5 === 1) return { box: onFloor(bx(i), bz(j), 0.65), color: col.green }; // the row that stays
    return { box: onFloor(bx(i), bz(j), 0.22), color: mix(col.stoneDark, col.paperDim, 0.6) };
  }),

  tidy: () => layout((i, j) => ({
    box: onFloor(bx(i), bz(j), j === 0 ? 0.45 : 0.28),
    color: j === 0 ? col.green : j % 2 ? col.paper : col.paperDim,
  })),

  apart: () => layout((i, j) => {
    const g = groupOf(j);
    const z = bz(0) + (groupRank.before[g] + groupRank.rank[j]) * PZ + g * 2.6 - 2.6;
    return { box: onFloor(bx(i), z, 0.3), color: GROUP_COLORS[g], shade: 0.9 + hash(i, j, 8) * 0.15 };
  }),

  built: () => layout((i, j) => {
    const fresh = i >= C - 5;
    return fresh
      ? { box: onFloor(bx(i) + 1.2, bz(j), 0.75 + ((i - (C - 5)) * 0.18)), color: mix(col.green, col.greenBright, (i - (C - 5)) / 5) }
      : { box: onFloor(bx(i), bz(j), 0.25), color: j % 2 ? col.paper : col.paperDim };
  }),

  together: () => layout((i, j) => {
    const g = groupOf(j);
    const z = bz(0) + (groupRank.before[g] + groupRank.rank[j]) * PZ;
    return { box: onFloor(bx(i), z, 0.3), color: GROUP_COLORS[g], shade: 0.9 + hash(i, j, 8) * 0.15 };
  }),

  totals: () => layout((i, j) => {
    const v = 0.25 + 0.75 * clamp01(0.5 + 0.35 * Math.sin(i * 0.45) + 0.3 * (hash(i, 0, 41) - 0.5));
    const n = Math.round(R * v);
    const top = n - 1;
    if (j >= n) return { box: [bx(i), 0, 0, 0.001, 0.001, 0.001], color: col.dim };
    const slab = 0.2;
    return {
      box: [bx(i), j * slab + slab / 2, 0, 0.82, slab * 0.86, 0.82],
      color: j === top ? col.paper : mix(col.stoneDark, col.green, 0.3 + (j / R) * 0.7),
    };
  }),

  cube: () => {
    const L = layout((i, j, k) => {
      const a = k % 12; const b = Math.floor(k / 144); const c = Math.floor(k / 12) % 12;
      const p = 0.44;
      const changed = b === 3 || a === 3; // a row and a column, so turning the block is visible
      return {
        box: [(a - 5.5) * p, 1.9 + (b - 3) * p, (c - 5.5) * p, 0.4, 0.4, 0.4],
        color: changed ? col.green : (a + c + b) % 2 ? col.paper : col.paperDim,
        shade: changed ? 1 : 0.8 + hash(k, 1, 51) * 0.25,
      };
    });
    L.spin = true;
    return L;
  },
};

// Camera viewpoints: position, look-at point and fog density.
const CAMERAS = {
  city: { pos: [5, 2.4, 15], look: [1, 3.4, -3], fog: 0.04 },
  two: { pos: [-12, 13, 17], look: [1.5, 0, 0], fog: 0.022 },
  matched: { pos: [-14, 6, 9], look: [1, 0.3, -0.5], fog: 0.032 },
  close: { pos: [13, 5, 5], look: [2, 0.3, 0], fog: 0.04 },
  changed: { pos: [3, 8.5, 9.5], look: [-3, 0, -1.5], fog: 0.035 },
  balanced: { pos: [-6, 12, 3], look: [-1, 0, -0.5], fog: 0.03 },
  sheet: { pos: [0, 30, 9], look: [0, 0, -1], fog: 0.012 },
  messy: { pos: [10, 6, 10], look: [3, 0.5, 0], fog: 0.035 },
  once: { pos: [-12, 4, 8], look: [-3, 0.2, 0], fog: 0.04 },
  tidy: { pos: [12, 3, 9], look: [4, 0, -1], fog: 0.035 },
  apart: { pos: [-15, 9, 2], look: [0, 0, 0], fog: 0.03 },
  built: { pos: [8, 3.2, 9.5], look: [15, 0.6, 0], fog: 0.04 },
  together: { pos: [-11, 11, 9], look: [-2, 0, 0], fog: 0.03 },
  totals: { pos: [-5, 3.5, 12], look: [-6, 2.6, 0], fog: 0.035 },
  cube: { pos: [-1, 5, 13], look: [-3.6, 1.7, 0], fog: 0.03 },
  far: { pos: [0, 6, 16], look: [0, 0.4, 0], fog: 0.03 },
};

// ── helpers that draw the spreadsheet chrome onto canvases ──────────
const colName = (i) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));

function labelStrip(labels, cellPx, horizontal) {
  const long = labels.length * cellPx;
  const short = 56;
  const canvas = document.createElement('canvas');
  canvas.width = horizontal ? long : short;
  canvas.height = horizontal ? short : long;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(160,175,168,0.9)';
  g.font = '500 26px "Geist Mono Variable", ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  labels.forEach((l, n) => {
    if (horizontal) g.fillText(l, n * cellPx + cellPx / 2, short / 2);
    else g.fillText(l, short / 2, n * cellPx + cellPx / 2);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function speckleTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const img = g.createImageData(size, size);
  for (let p = 0; p < size * size; p++) {
    const v = 214 + (hash(p, 3, 77) - 0.5) * 70 + (valueNoise((p % size) / 14, Math.floor(p / size) / 14, 5) - 0.5) * 50;
    img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = Math.max(0, Math.min(255, v));
    img.data[p * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Starts the world on `canvas`. `stops` = [{ scene, cam? }] in scroll order; `getProgress()` returns the fractional stop index
 * (2.5 = halfway between stop 2 and stop 3). Returns { start, setPointer, drag, dispose }.
 */
export function createWorld(canvas, { stops, getProgress, reducedMotion = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(col.bg, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(col.bg, 0.04);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  // lights
  scene.add(new THREE.HemisphereLight('#dfe9e4', '#0a0e0c', 0.8));
  const key = new THREE.DirectionalLight('#fff3e2', 2.4);
  key.position.set(9, 16, 11);
  scene.add(key);
  const rim = new THREE.DirectionalLight(COLORS.green, 1.3);
  rim.position.set(-12, 5, -14);
  scene.add(rim);
  const fill = new THREE.PointLight(COLORS.greenBright, 7, 30, 1.6);
  fill.position.set(0, 7, 4);
  scene.add(fill);

  // floor + grid lines on the cell edges, running far past the sheet
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: col.floor, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  scene.add(floor);
  const lines = [];
  for (let x = -80; x <= 80; x += PX) lines.push(x, 0, -80, x, 0, 80);
  for (let z = -80; z <= 80; z += PZ) lines.push(-80, 0, z, 80, 0, z);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: col.grid, transparent: true, opacity: 0.85 }));
  grid.position.y = 0.001;
  scene.add(grid);

  // column letters along the far edge, row numbers down the left: it should read as a sheet from above
  const colTex = labelStrip(Array.from({ length: C }, (_, i) => colName(i)), 64, true);
  const colStrip = new THREE.Mesh(new THREE.PlaneGeometry(C * PX, 0.5), new THREE.MeshBasicMaterial({ map: colTex, transparent: true, depthWrite: false }));
  colStrip.rotation.x = -Math.PI / 2;
  colStrip.position.set(0, 0.004, bz(0) - PZ * 1.4);
  scene.add(colStrip);
  const rowTex = labelStrip(Array.from({ length: R }, (_, j) => String(j + 1)), 32, false);
  const rowStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.9, R * PZ), new THREE.MeshBasicMaterial({ map: rowTex, transparent: true, depthWrite: false }));
  rowStrip.rotation.x = -Math.PI / 2;
  rowStrip.position.set(bx(0) - PX * 1.5, 0.004, 0);
  scene.add(rowStrip);

  // the cells
  const speckle = speckleTexture();
  const cellMat = new THREE.MeshStandardMaterial({ map: speckle, roughness: 0.7, metalness: 0.05 });
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cellMat, N);
  cells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cells.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  cells.instanceColor.setUsage(THREE.DynamicDrawUsage);
  cells.frustumCulled = false;
  scene.add(cells);

  // falling streaks of light, like values pouring into the sheet
  const RAIN = reducedMotion ? 0 : 160;
  const rainPos = new Float32Array(RAIN * 6);
  const rainSpeed = new Float32Array(RAIN);
  const seedDrop = (n, y) => {
    const x = (hash(n, 1, Math.random() * 1e6 | 0) - 0.5) * 60;
    const z = -30 + hash(n, 2, Math.random() * 1e6 | 0) * 38;
    const len = 0.6 + hash(n, 3) * 2.4;
    const top = y ?? 22 + hash(n, 4) * 10;
    rainPos.set([x, top, z, x, top - len, z], n * 6);
    rainSpeed[n] = 4 + hash(n, 5) * 7;
  };
  for (let n = 0; n < RAIN; n++) seedDrop(n, hash(n, 6) * 26);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({
    color: COLORS.greenBright, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(rain);

  // build the layouts this page uses
  const built = {};
  for (const s of stops) if (!built[s.scene]) built[s.scene] = LAYOUTS[s.scene]();
  const delay = new Float32Array(N);
  for (let k = 0; k < N; k++) delay[k] = clamp01((k % C) / C * 0.7 + hash(k, 0, 61) * 0.3);

  // per-frame state
  let width = 1; let height = 1;
  let shown = 0; // smoothed progress
  let intro = reducedMotion ? 1 : 0;
  let started = false;
  let spin = 0; let spinTarget = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const vPos = new THREE.Vector3(); const vScl = new THREE.Vector3();
  const camPos = new THREE.Vector3(); const camLook = new THREE.Vector3();
  const tmpA = new THREE.Vector3(); const tmpB = new THREE.Vector3();
  const right = new THREE.Vector3();
  const clock = new THREE.Clock();
  let raf = 0;

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < 1 ? 58 : 42;
    camera.updateProjectionMatrix();
  }

  function camOf(stop) { return CAMERAS[stop.cam ?? stop.scene]; }

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    const target = Math.max(0, Math.min(stops.length - 1, getProgress()));
    shown += (target - shown) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - shown) < 1e-4) shown = target;
    if (started && intro < 1) intro = Math.min(1, intro + dt / 2.2);
    const introE = ease(intro);

    const a = Math.min(stops.length - 1, Math.floor(shown));
    const b = Math.min(stops.length - 1, a + 1);
    // hold each layout while its text is read, move in the middle of the gap
    const tRaw = clamp01((shown - a - 0.18) / 0.64);
    const A = built[stops[a].scene];
    const B = built[stops[b].scene];

    spin += (spinTarget - spin) * (1 - Math.exp(-dt * 5));
    const idle = reducedMotion ? 0 : time * 0.12;
    const angleA = A.spin ? spin + idle : 0;
    const angleB = B.spin ? spin + idle : 0;

    for (let k = 0; k < N; k++) {
      const t = ease(clamp01((tRaw - 0.35 * delay[k]) / 0.65));
      const k3 = k * 3;
      // positions, with the cube layout turned about its own vertical axis
      tmpA.set(A.pos[k3], A.pos[k3 + 1], A.pos[k3 + 2]);
      if (angleA) tmpA.applyAxisAngle(up, angleA);
      tmpB.set(B.pos[k3], B.pos[k3 + 1], B.pos[k3 + 2]);
      if (angleB) tmpB.applyAxisAngle(up, angleB);
      vPos.lerpVectors(tmpA, tmpB, t);
      // a small lift mid-flight so cells arc instead of sliding through each other
      vPos.y += Math.sin(t * Math.PI) * 0.6 * (A === B ? 0 : 1);
      vScl.set(
        A.scl[k3] + (B.scl[k3] - A.scl[k3]) * t,
        A.scl[k3 + 1] + (B.scl[k3 + 1] - A.scl[k3 + 1]) * t,
        A.scl[k3 + 2] + (B.scl[k3 + 2] - A.scl[k3 + 2]) * t,
      );
      if (introE < 1) {
        const local = ease(clamp01(introE * 1.6 - delay[k] * 0.6));
        vPos.y *= local; vScl.y = Math.max(0.001, vScl.y * local);
      }
      q.setFromAxisAngle(up, angleA * (1 - t) + angleB * t);
      m4.compose(vPos, q, vScl);
      cells.setMatrixAt(k, m4);
      cells.instanceColor.array[k3] = A.col[k3] + (B.col[k3] - A.col[k3]) * t;
      cells.instanceColor.array[k3 + 1] = A.col[k3 + 1] + (B.col[k3 + 1] - A.col[k3 + 1]) * t;
      cells.instanceColor.array[k3 + 2] = A.col[k3 + 2] + (B.col[k3 + 2] - A.col[k3 + 2]) * t;
    }
    cells.instanceMatrix.needsUpdate = true;
    cells.instanceColor.needsUpdate = true;

    // camera between the two viewpoints; portrait screens step back so the sheet still fits
    const ca = camOf(stops[a]); const cb = camOf(stops[b]);
    const ct = ease(clamp01((shown - a - 0.1) / 0.8));
    camPos.set(...ca.pos).lerp(tmpA.set(...cb.pos), ct);
    camLook.set(...ca.look).lerp(tmpB.set(...cb.look), ct);
    if (camera.aspect < 1) camPos.sub(camLook).multiplyScalar(1 + (1 - camera.aspect) * 0.55).add(camLook);
    // intro: start higher and further, settle into the first view
    if (introE < 1) camPos.add(tmpA.set(0, 6, 8).multiplyScalar(1 - introE));
    // pointer parallax
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
    right.subVectors(camLook, camPos).cross(up).normalize();
    camPos.addScaledVector(right, pointer.sx * 0.5).addScaledVector(up, -pointer.sy * 0.3);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    scene.fog.density = ca.fog + (cb.fog - ca.fog) * ct;

    // rain
    if (RAIN) {
      for (let n = 0; n < RAIN; n++) {
        const d = rainSpeed[n] * dt;
        rainPos[n * 6 + 1] -= d; rainPos[n * 6 + 4] -= d;
        if (rainPos[n * 6 + 4] < 0) seedDrop(n);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    fill.intensity = 6 + Math.sin(time * 0.7) * 1.5;

    renderer.render(scene, camera);
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    start() { started = true; },
    setPointer(x, y) { if (!reducedMotion) { pointer.x = x; pointer.y = y; } },
    drag(dx) { spinTarget += dx * 0.008; },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      scene.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      speckle.dispose();
      renderer.dispose();
    },
  };
}
