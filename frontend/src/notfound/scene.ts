import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Material,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Spherical,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * The 404 page's 3D scene: an S1/S2 metro (retired in 2024) at the end of
 * the track. Over the still image it starts parked, exactly where the still
 * has it (a seamless swap); the replay button lets it roll in. Loaded
 * only after the page's text, and only where it can run well (see page.ts).
 * Draws a frame only while something moves, and not at all off screen.
 *
 * Zoom: two-finger pinch, Ctrl/⌘ + wheel (a trackpad pinch sends that too),
 * double-click or double-tap toward the train, and the page's buttons. A
 * plain wheel keeps scrolling the page, except in full screen. The camera
 * stays between MIN_DISTANCE and ZOOM_OUT × the fitted distance, so the
 * train never fills the lens or shrinks to a dot.
 */

export interface SceneOptions {
  modelUrl: string;
  /** The rails segment (public/models/rails.glb); without it, simple rails. */
  railsUrl?: string;
  reducedMotion: boolean;
  /** Start with the train at rest (as on the still image) instead of
   *  letting it roll in the first time the stage is in view. */
  parked?: boolean;
  dark: boolean;
  /** 0–1 while the model downloads, when the size is known. */
  onProgress?: (fraction: number) => void;
  /** Whether a plain wheel zooms (full screen) instead of scrolling the page. */
  wheelZooms?: () => boolean;
  /** A plain wheel scrolled the page past the train: tell how to zoom. */
  onWheelScroll?: () => void;
}

export interface SceneHandle {
  /** Let the train arrive again (no-op with reduced motion). */
  replay(): void;
  /** Turn the view by keyboard: azimuth and tilt steps in radians. */
  turn(azimuth: number, tilt: number): void;
  /** Zoom by a factor: above 1 closer, below 1 further away. */
  zoom(factor: number): void;
  /** Back to the first view. */
  reset(): void;
  /** Light or dark, as the page now is. */
  setTheme(dark: boolean): void;
  dispose(): void;
}

/** The five metro lines' colours, as on the map. */
const LINE_COLORS = ["#3CB44B", "#F58231", "#4363D8", "#E6194B", "#FFE119"];

const TRAIN_LENGTH = 10;
/** Where the rails end (the train stops a little before). */
const TRACK_END = 2;
const TRACK_LENGTH = 40;
/** Standard gauge over the S1/S2's width (1,435 mm / 3.0 m): the rails to the train's scale. */
const GAUGE_PER_WIDTH = 1.435 / 3.0;
/** The rails segment's length in gauges, if its file doesn't say (extras.segment). */
const RAILS_SEGMENT = 5.6253;
const ARRIVE_MS = 3600;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Closest the camera gets to the point it looks at: still outside the car body. */
const MIN_DISTANCE = 4.5;
/** Furthest out, as a multiple of the fitted first view. */
const ZOOM_OUT = 1.8;
const MOVE_MS = 420;
/** Never more pixels than this in the canvas (a 4K full screen at 2× would be 33M). */
const MAX_PIXELS = 4_500_000;
/** tan(half the vertical field of view): wide stages, narrow stages, and the widest we go. */
const TAN_WIDE = Math.tan((16 * Math.PI) / 180);
const TAN_MAX = Math.tan((30 * Math.PI) / 180);
/** How much width a stage narrower than 16:10 keeps (tan of half the
 *  horizontal view): the still image's own (16:10 at 32°, shown with
 *  object-fit: contain), so the 3D's first frame frames the train exactly
 *  like the still and the swap doesn't jump. A bit more when upright. */
const POSTER_ASPECT = 1.6;
const TAN_FIT_X = TAN_WIDE * POSTER_ASPECT;
const TAN_FIT_X_PORTRAIT = 0.48;

/** Lay the model along +x, wheels on y = 0, front end at x = 0. */
function placeTrain(model: Object3D): Group {
  const holder = new Group();
  holder.add(model);
  let box = new Box3().setFromObject(holder);
  const size = box.getSize(new Vector3());
  // Longest horizontal side along x.
  if (size.z > size.x) model.rotation.y = Math.PI / 2;
  box = new Box3().setFromObject(holder);
  const length = box.getSize(new Vector3()).x;
  const scale = TRAIN_LENGTH / length;
  model.scale.multiplyScalar(scale);
  box = new Box3().setFromObject(holder);
  model.position.x -= box.max.x;
  model.position.y -= box.min.y;
  model.position.z -= (box.min.z + box.max.z) / 2;
  return holder;
}

interface Rails {
  /** One segment: rails along +x ending at x = 0, gauge 1, rail tops at y = 0
   *  (after `matrix`: the file's positions are quantized). */
  mesh: Mesh;
  matrix: Matrix4;
  /** The segment's bounds, in gauges. */
  box: Box3;
  /** Its length in gauges (rail end to rail end, so segments join). */
  segment: number;
}

/** The rails segment from its file (see assets-src/models/README.md). */
function railsFrom(scene: Object3D): Rails | null {
  let mesh: Mesh | null = null;
  scene.traverse((o) => {
    if (!mesh && (o as Mesh).isMesh) mesh = o as Mesh;
  });
  if (!mesh) return null;
  const m = mesh as Mesh;
  m.updateWorldMatrix(true, false);
  // Not baked into the geometry: its positions are normalized int16
  // (KHR_mesh_quantization), which can't hold values past ±1. The node's
  // transform goes into each instance's matrix instead.
  const matrix = m.matrixWorld.clone();
  m.geometry.computeBoundingBox();
  const box = m.geometry.boundingBox!.clone().applyMatrix4(matrix);
  const segment = Number(scene.userData.segment) || RAILS_SEGMENT;
  return { mesh: m, matrix, box, segment };
}

/**
 * The track: the rails (the model, repeated, to the train's scale; or
 * simple boxes if it didn't load) with no bed under them, a soft shadow
 * that grounds them, and the five lines as a strip along the far side.
 */
function buildTrack(dark: boolean, gauge: number, rails: Rails | null): { group: Group; setDark(dark: boolean): void } {
  const group = new Group();
  const themed: ((dark: boolean) => void)[] = [];
  const length = TRACK_LENGTH;
  const startX = TRACK_END - length;

  // How deep the sleepers sit, and how wide: from the model, or simple ones.
  let sleeperBottom = -0.32 * gauge;
  let sleeperHalf = gauge;
  if (rails) {
    const box = rails.box;
    sleeperBottom = box.min.y * gauge;
    sleeperHalf = Math.max(-box.min.z, box.max.z) * gauge;
    const step = rails.segment * gauge;
    const count = Math.ceil(length / step);
    const inst = new InstancedMesh(rails.mesh.geometry, rails.mesh.material as Material, count);
    const m = new Matrix4();
    for (let i = 0; i < count; i++) {
      m.makeScale(gauge, gauge, gauge).setPosition(TRACK_END - i * step, 0, 0).multiply(rails.matrix);
      inst.setMatrixAt(i, m);
    }
    inst.computeBoundingSphere();
    group.add(inst);
  } else {
    const sleeperMat = new MeshStandardMaterial({ roughness: 0.9 });
    themed.push((d) => sleeperMat.color.set(d ? "#4a4237" : "#8a7458"));
    const railMat = new MeshStandardMaterial({ color: "#9aa3ad", metalness: 0.8, roughness: 0.35 });
    const n = Math.round(length / (gauge * 0.6));
    const sleepers = new InstancedMesh(new BoxGeometry(gauge * 0.25, -sleeperBottom * 0.6, sleeperHalf * 2), sleeperMat, n);
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
      m.makeTranslation(startX + 0.2 + i * (length / n), sleeperBottom * 0.7, 0);
      sleepers.setMatrixAt(i, m);
    }
    group.add(sleepers);
    for (const z of [-gauge / 2, gauge / 2]) {
      const rail = new Mesh(new BoxGeometry(length, gauge * 0.15, gauge * 0.08), railMat);
      rail.position.set(startX + length / 2, -gauge * 0.075, z);
      group.add(rail);
    }
  }

  // A soft shadow under the sleepers (a gradient, no shadow maps): the
  // track stands on something without a block under it.
  const bedTop = sleeperBottom;
  const bedHalf = sleeperHalf * 1.6;
  const shadow = softShadow(startX, length, sleeperHalf * 2.6, bedTop - 0.005);
  group.add(shadow.mesh);
  themed.push(shadow.setDark);

  // The five lines, as a strip along the far side of the track.
  LINE_COLORS.forEach((c, i) => {
    const mat = new MeshStandardMaterial({ color: c, roughness: 0.6, emissive: new Color(c) });
    themed.push((d) => (mat.emissiveIntensity = d ? 0.35 : 0.05));
    const stripe = new Mesh(new BoxGeometry(length * (1 - i * 0.08), 0.04, 0.16), mat);
    stripe.position.set(startX + (length * (1 - i * 0.08)) / 2, bedTop + 0.01, -bedHalf - 0.25 - i * 0.22);
    group.add(stripe);
  });

  const setDark = (d: boolean) => themed.forEach((f) => f(d));
  setDark(dark);
  return { group, setDark };
}

/** A blurred dark band on the ground, fading out across and at the far end. */
function softShadow(startX: number, length: number, width: number, y: number): { mesh: Mesh; setDark(dark: boolean): void } {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const paint = (dark: boolean) => {
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, 256, 64);
    const across = g.createLinearGradient(0, 0, 0, 64);
    const ink = dark ? "0, 0, 0" : "60, 45, 25";
    across.addColorStop(0, `rgba(${ink}, 0)`);
    across.addColorStop(0.5, `rgba(${ink}, ${dark ? 0.55 : 0.3})`);
    across.addColorStop(1, `rgba(${ink}, 0)`);
    g.fillStyle = across;
    g.fillRect(0, 0, 256, 64);
    // Fade out along the far end and at the end of the rails.
    g.globalCompositeOperation = "destination-in";
    const along = g.createLinearGradient(0, 0, 256, 0);
    along.addColorStop(0, "rgba(0,0,0,0)");
    along.addColorStop(0.35, "rgba(0,0,0,1)");
    along.addColorStop(0.985, "rgba(0,0,0,1)");
    along.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = along;
    g.fillRect(0, 0, 256, 64);
    tex.needsUpdate = true;
  };
  const mesh = new Mesh(new PlaneGeometry(length, width), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(startX + length / 2, y, 0);
  mesh.renderOrder = -1;
  return { mesh, setDark: paint };
}

export async function mount(stage: HTMLElement, opts: SceneOptions): Promise<SceneHandle> {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;

  const canvas = renderer.domElement;
  canvas.className = "stage-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 16 / 9, 0.1, 200);
  const sky = new HemisphereLight();
  scene.add(sky);
  const sun = new DirectionalLight("#fff4e0");
  sun.position.set(-6, 10, 8);
  scene.add(sun);
  const fill = new DirectionalLight("#bcd0ff", 0.6);
  fill.position.set(8, 4, -6);
  scene.add(fill);

  // The train and the rails, in parallel; one progress bar for both.
  const loader = new GLTFLoader();
  const loaded: number[] = [0, 0];
  const totals: number[] = [0, 0];
  const progress = (i: number) => (e: ProgressEvent) => {
    if (!e.lengthComputable || !e.total) return;
    loaded[i] = e.loaded;
    totals[i] = e.total;
    const total = totals[0] + totals[1];
    if (total) opts.onProgress?.((loaded[0] + loaded[1]) / total);
  };
  const [gltf, railsGltf] = await Promise.all([
    loader.loadAsync(opts.modelUrl, progress(0)),
    // The rails are a nice-to-have: if they don't load, simple ones.
    opts.railsUrl ? loader.loadAsync(opts.railsUrl, progress(1)).catch(() => null) : Promise.resolve(null),
  ]);
  const train = placeTrain(gltf.scene);
  scene.add(train);
  const trainWidth = new Box3().setFromObject(train).getSize(new Vector3()).z;
  const rails = railsGltf ? railsFrom(railsGltf.scene) : null;
  const track = buildTrack(opts.dark, trainWidth * GAUGE_PER_WIDTH, rails);
  scene.add(track.group);
  // Light or dark (the page's switch can change it while it runs).
  const setTheme = (dark: boolean) => {
    renderer.toneMappingExposure = dark ? 1.15 : 1.0;
    sky.color.set(dark ? "#c9d6ff" : "#ffffff");
    sky.groundColor.set(dark ? "#1a1f2b" : "#b9ab90");
    sky.intensity = dark ? 1.6 : 1.9;
    sun.intensity = dark ? 1.6 : 2.4;
    track.setDark(dark);
  };
  setTheme(opts.dark);

  // Where the train comes to rest: its nose a little before the rails end.
  const stopX = TRACK_END - 0.8;

  // A three-quarter view from the platform side, looking at the train's nose.
  const homeTarget = new Vector3(stopX - TRAIN_LENGTH * 0.32, 1.1, 0);
  const homeOffset = new Vector3(3.6 + TRAIN_LENGTH * 0.32, 2.5, 10.2);
  const homeDistance = homeOffset.length();
  // The fitted distance for the stage's shape (narrow stages step back).
  let fitted = homeDistance;
  camera.position.copy(homeTarget).add(homeOffset);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget);
  // Pinch zoom (touch); the wheel is ours (see onWheel): it scrolls the
  // page unless Ctrl/⌘ is held or the stage is full screen.
  controls.enableZoom = true;
  controls.zoomSpeed = 1.1;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = fitted * ZOOM_OUT;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.45;
  controls.update();

  const restX = stopX;
  const startX = restX - TRAIN_LENGTH * 2.6;
  const parked = opts.reducedMotion || opts.parked;
  // Rolling in: waits off screen (Infinity) until the stage is in view, so a
  // visitor who scrolls to it later still sees the arrival.
  let arriveStart = parked ? -Infinity : Infinity;
  train.position.x = parked ? restX : startX;

  let frame = 0;
  let visible = true;
  let interactingUntil = 0;

  // A smooth camera move (zoom buttons, double-tap, reset), around the
  // point looked at so it never passes through the train.
  let move: { from: Spherical; to: Spherical; fromTarget: Vector3; toTarget: Vector3; start: number } | null = null;
  const sphericalOf = (pos: Vector3, tgt: Vector3) => new Spherical().setFromVector3(pos.clone().sub(tgt));

  function moveTo(toTarget: Vector3, to: Spherical) {
    if (opts.reducedMotion) {
      move = null;
      controls.target.copy(toTarget);
      camera.position.setFromSpherical(to).add(toTarget);
    } else {
      const from = sphericalOf(camera.position, controls.target);
      // The short way round.
      let dTheta = to.theta - from.theta;
      dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
      to = to.clone();
      to.theta = from.theta + dTheta;
      move = { from, to, fromTarget: controls.target.clone(), toTarget: toTarget.clone(), start: performance.now() };
    }
    interactingUntil = performance.now() + 600;
    request();
  }

  /** Where the camera is going: the end of a move, or where it is. */
  function destination(): { target: Vector3; sph: Spherical } {
    if (move) return { target: move.toTarget.clone(), sph: move.to.clone() };
    return { target: controls.target.clone(), sph: sphericalOf(camera.position, controls.target) };
  }

  function zoomBy(factor: number, smooth: boolean) {
    const { target, sph } = destination();
    sph.radius = clamp(sph.radius / factor, MIN_DISTANCE, fitted * ZOOM_OUT);
    if (smooth) return moveTo(target, sph);
    move = null;
    controls.target.copy(target);
    camera.position.setFromSpherical(sph).add(target);
    interactingUntil = performance.now() + 600;
    request();
  }

  function reset() {
    const sph = new Spherical().setFromVector3(homeOffset);
    sph.radius = fitted;
    moveTo(homeTarget, sph);
  }

  // Double-click or double-tap: zoom in toward the spot on the train;
  // close up already, back to the first view.
  const raycaster = new Raycaster();
  function zoomAt(clientX: number, clientY: number) {
    const { target, sph } = destination();
    if (sph.radius <= MIN_DISTANCE * 1.25) return reset();
    const rect = canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(train, true)[0];
    if (hit) {
      target.lerp(hit.point, 0.75);
      // Stay over the track, at the train's height.
      target.set(clamp(target.x, stopX - TRAIN_LENGTH * 1.2, stopX), clamp(target.y, 0.4, 2.6), clamp(target.z, -1.5, 1.5));
    }
    sph.radius = clamp(sph.radius * 0.5, MIN_DISTANCE, fitted * ZOOM_OUT);
    moveTo(target, sph);
  }

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    // Sharp on high-density screens, but capped for big full screens.
    const ratio = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (width * height))));
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Stages narrower than the still image (a phone, a portrait full
    // screen): a wider lens, and past the widest lens a step back, so the
    // whole train stays in view.
    const fitX = camera.aspect < 1 ? TAN_FIT_X_PORTRAIT : TAN_FIT_X;
    let tan = Math.max(TAN_WIDE, fitX / camera.aspect);
    const fit = Math.max(1, tan / TAN_MAX);
    tan = Math.min(tan, TAN_MAX);
    camera.fov = (2 * Math.atan(tan) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    // Keep the visitor's zoom, relative to the new fitted distance.
    const nextFitted = homeDistance * fit;
    if (Math.abs(nextFitted - fitted) > 1e-3) {
      const scale = nextFitted / fitted;
      fitted = nextFitted;
      controls.maxDistance = fitted * ZOOM_OUT;
      const off = camera.position.clone().sub(controls.target).multiplyScalar(scale);
      off.setLength(clamp(off.length(), MIN_DISTANCE, controls.maxDistance));
      camera.position.copy(controls.target).add(off);
      if (move) move.to.radius = clamp(move.to.radius * scale, MIN_DISTANCE, controls.maxDistance);
    }
    request();
  };

  function step(now: number): boolean {
    let moving = false;
    if (move) {
      const k = easeOutCubic(Math.min(1, (now - move.start) / MOVE_MS));
      const s = new Spherical(
        move.from.radius + (move.to.radius - move.from.radius) * k,
        move.from.phi + (move.to.phi - move.from.phi) * k,
        move.from.theta + (move.to.theta - move.from.theta) * k,
      );
      controls.target.lerpVectors(move.fromTarget, move.toTarget, k);
      camera.position.setFromSpherical(s).add(controls.target);
      if (k >= 1) move = null;
      moving = true;
    }
    const t = now - arriveStart;
    if (arriveStart === Infinity) {
      train.position.x = startX; // waiting to be in view
    } else if (t < ARRIVE_MS) {
      train.position.x = startX + (restX - startX) * easeOutCubic(Math.max(0, t) / ARRIVE_MS);
      moving = true;
    } else {
      train.position.x = restX;
    }
    if (controls.update()) moving = true;
    return moving || now < interactingUntil;
  }

  function loop(now: number) {
    frame = 0;
    if (!visible) return;
    const more = step(now);
    renderer.render(scene, camera);
    if (more) frame = requestAnimationFrame(loop);
  }

  function request() {
    if (!frame && visible) frame = requestAnimationFrame(loop);
  }

  controls.addEventListener("start", () => {
    move = null; // the visitor takes over
    interactingUntil = Infinity;
    request();
  });
  controls.addEventListener("end", () => {
    interactingUntil = performance.now() + 1500; // let the damping settle
    request();
  });

  // The wheel: caught before OrbitControls sees it.
  const onWheel = (e: WheelEvent) => {
    e.stopPropagation();
    if (!(e.ctrlKey || e.metaKey || opts.wheelZooms?.())) {
      opts.onWheelScroll?.();
      return; // the page scrolls
    }
    e.preventDefault(); // not the browser's page zoom
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    // A trackpad pinch sends small steps with ctrlKey; a mouse wheel big ones.
    const k = e.ctrlKey ? 0.012 : 0.0018;
    zoomBy(Math.exp(clamp(-px * k, -0.5, 0.5)), false);
  };
  stage.addEventListener("wheel", onWheel, { capture: true, passive: false });

  // Double-tap and double-click, from pointer events so both work the same
  // (and a drag or a page scroll is never a tap).
  let down = { x: 0, y: 0, t: 0, id: -1 };
  let lastTap = { x: 0, y: 0, t: 0 };
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== down.id) return;
    down.id = -1;
    const now = performance.now();
    const slop = e.pointerType === "mouse" ? 4 : 12;
    if (now - down.t > 300 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > slop) return;
    if (now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 32) {
      lastTap.t = 0;
      zoomAt(e.clientX, e.clientY);
    } else {
      lastTap = { x: e.clientX, y: e.clientY, t: now };
    }
  };
  const onCancel = () => {
    down.id = -1;
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  // A page zoom or another screen changes the pixel ratio, not the stage's size.
  window.addEventListener("resize", resize);

  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && !document.hidden;
    // Well in view for the first time: now the train rolls in.
    if (visible && entry.intersectionRatio >= 0.35 && arriveStart === Infinity) arriveStart = performance.now();
    if (visible) request();
  }, { threshold: 0.35 });
  io.observe(stage);
  const onVisibility = () => {
    // A tab in the background: the observer decides again when it's back.
    if (document.hidden) visible = false;
    else {
      io.unobserve(stage);
      io.observe(stage);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  stage.appendChild(canvas);
  resize();
  // First frame, then fade the canvas in over the still image.
  renderer.render(scene, camera);
  requestAnimationFrame(() => stage.classList.add("is-live"));
  request();

  // Regenerating the still images (public/models/s12-metro-poster.webp and
  // s12-track-poster.webp): open the 404 page with ?poster and run
  // __capturePoster() (the resting train) or __capturePoster(false) (the
  // track only) in the console. 1280×800 on a transparent background. See
  // assets-src/models/README.md.
  if (new URLSearchParams(window.location.search).has("poster")) {
    (window as Window & { __capturePoster?: (withTrain?: boolean) => string }).__capturePoster = (withTrain = true) => {
      train.position.x = restX;
      train.visible = withTrain;
      arriveStart = -Infinity;
      const { width, height } = stage.getBoundingClientRect();
      renderer.setPixelRatio(1);
      renderer.setSize(1280, 800, false);
      camera.aspect = 1280 / 800;
      camera.fov = 32;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const url = canvas.toDataURL("image/webp", 0.86);
      train.visible = true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      resize();
      return url;
    };
  }

  return {
    replay() {
      if (opts.reducedMotion) return;
      arriveStart = performance.now();
      request();
    },
    turn(azimuth: number, tilt: number) {
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new Vector3(0, 1, 0), azimuth);
      const axis = new Vector3().crossVectors(new Vector3(0, 1, 0), offset).normalize();
      const tilted = offset.clone().applyAxisAngle(axis, tilt);
      const polar = tilted.angleTo(new Vector3(0, 1, 0));
      move = null;
      camera.position.copy(controls.target).add(polar > controls.minPolarAngle && polar < controls.maxPolarAngle ? tilted : offset);
      interactingUntil = performance.now() + 600;
      request();
    },
    zoom(factor: number) {
      zoomBy(factor, true);
    },
    reset,
    setTheme(dark: boolean) {
      setTheme(dark);
      request();
    },
    dispose() {
      cancelAnimationFrame(frame);
      stage.removeEventListener("wheel", onWheel, { capture: true });
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      controls.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
