import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * The 404 page's 3D scene: an S1/S2 metro (retired in 2024) rolls up to the
 * buffer stop at the end of a track and settles with a small bump. Loaded
 * only after the page's text, and only where it can run well (see page.ts).
 * Draws a frame only while something moves, and not at all off screen.
 */

export interface SceneOptions {
  modelUrl: string;
  reducedMotion: boolean;
  dark: boolean;
  /** 0–1 while the model downloads, when the size is known. */
  onProgress?: (fraction: number) => void;
}

export interface SceneHandle {
  /** Let the train arrive again (no-op with reduced motion). */
  replay(): void;
  /** Turn the view by keyboard: azimuth and tilt steps in radians. */
  turn(azimuth: number, tilt: number): void;
  dispose(): void;
}

/** The five metro lines' colours, as on the map. */
const LINE_COLORS = ["#3CB44B", "#F58231", "#4363D8", "#E6194B", "#FFE119"];

const TRAIN_LENGTH = 10;
const ARRIVE_MS = 3600;
const BUMP_MS = 900;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

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

function buildTrack(dark: boolean): { group: Group; stopX: number } {
  const group = new Group();
  const ballast = new MeshStandardMaterial({ color: dark ? "#2a2f3a" : "#cfc6b4", roughness: 1 });
  const sleeperMat = new MeshStandardMaterial({ color: dark ? "#4a4237" : "#8a7458", roughness: 0.9 });
  const railMat = new MeshStandardMaterial({ color: "#9aa3ad", metalness: 0.8, roughness: 0.35 });

  const length = 40;
  const startX = -length + 2;
  const bed = new Mesh(new BoxGeometry(length, 0.3, 4.2), ballast);
  bed.position.set(startX + length / 2, -0.35, 0);
  group.add(bed);

  const sleepers = new InstancedMesh(new BoxGeometry(0.35, 0.12, 3.6), sleeperMat, 60);
  const m = new Matrix4();
  for (let i = 0; i < 60; i++) {
    m.makeTranslation(startX + 0.4 + i * (length / 60), -0.14, 0);
    sleepers.setMatrixAt(i, m);
  }
  group.add(sleepers);

  for (const z of [-0.72, 0.72]) {
    const rail = new Mesh(new BoxGeometry(length, 0.14, 0.12), railMat);
    rail.position.set(startX + length / 2, -0.02, z);
    group.add(rail);
  }

  // The five lines, as a strip along the far side of the track.
  LINE_COLORS.forEach((c, i) => {
    const stripe = new Mesh(
      new BoxGeometry(length * (1 - i * 0.08), 0.04, 0.16),
      new MeshStandardMaterial({ color: c, roughness: 0.6, emissive: new Color(c), emissiveIntensity: dark ? 0.35 : 0.05 }),
    );
    stripe.position.set(startX + (length * (1 - i * 0.08)) / 2, -0.18, -2.3 - i * 0.22);
    group.add(stripe);
  });

  // Buffer stop at the end of the line.
  const stopX = 1.2;
  const frame = new MeshStandardMaterial({ color: "#7b2132", roughness: 0.6 });
  const block = new Mesh(new BoxGeometry(0.5, 1.6, 3.4), frame);
  block.position.set(stopX + 0.9, 0.7, 0);
  group.add(block);
  const bufferMat = new MeshStandardMaterial({ color: "#d9d4c7", metalness: 0.4, roughness: 0.5 });
  for (const z of [-1.1, 1.1]) {
    const buffer = new Mesh(new CylinderGeometry(0.22, 0.22, 0.5, 20), bufferMat);
    buffer.rotation.z = Math.PI / 2;
    buffer.position.set(stopX + 0.45, 1.0, z);
    group.add(buffer);
  }
  const lamp = new Mesh(
    new CylinderGeometry(0.18, 0.18, 0.1, 20),
    new MeshStandardMaterial({ color: "#ff3b30", emissive: new Color("#ff3b30"), emissiveIntensity: 1.6 }),
  );
  lamp.rotation.z = Math.PI / 2;
  lamp.position.set(stopX + 0.62, 1.75, 0);
  group.add(lamp);

  return { group, stopX };
}

export async function mount(stage: HTMLElement, opts: SceneOptions): Promise<SceneHandle> {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.dark ? 1.15 : 1.0;
  const canvas = renderer.domElement;
  canvas.className = "stage-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 16 / 9, 0.1, 200);
  scene.add(new HemisphereLight(opts.dark ? "#c9d6ff" : "#ffffff", opts.dark ? "#1a1f2b" : "#b9ab90", opts.dark ? 1.6 : 1.9));
  const sun = new DirectionalLight("#fff4e0", opts.dark ? 1.6 : 2.4);
  sun.position.set(-6, 10, 8);
  scene.add(sun);
  const fill = new DirectionalLight("#bcd0ff", 0.6);
  fill.position.set(8, 4, -6);
  scene.add(fill);

  const { group: track, stopX } = buildTrack(opts.dark);
  scene.add(track);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(opts.modelUrl, (e) => {
    if (e.lengthComputable && e.total > 0) opts.onProgress?.(e.loaded / e.total);
  });
  const train = placeTrain(gltf.scene);
  scene.add(train);

  // A three-quarter view from the platform side, looking at the train's nose.
  const target = new Vector3(stopX - TRAIN_LENGTH * 0.32, 1.1, 0);
  camera.position.set(stopX + 3.6, 3.6, 10.2);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableZoom = false; // never take over the page's scrolling
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.45;
  controls.update();
  const home = { pos: camera.position.clone() };

  const restX = stopX;
  const startX = restX - TRAIN_LENGTH * 2.6;
  let arriveStart = opts.reducedMotion ? -Infinity : performance.now();
  train.position.x = opts.reducedMotion ? restX : startX;

  let frame = 0;
  let visible = true;
  let interactingUntil = 0;

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Narrow stages: step back so the whole train stays in view.
    camera.fov = camera.aspect < 1.2 ? 44 : 32;
    camera.updateProjectionMatrix();
    request();
  };

  function step(now: number): boolean {
    let moving = false;
    const t = now - arriveStart;
    if (t < ARRIVE_MS) {
      train.position.x = startX + (restX - startX) * easeOutCubic(Math.max(0, t) / ARRIVE_MS);
      moving = true;
    } else if (t < ARRIVE_MS + BUMP_MS) {
      // A small, damped bump against the buffers.
      const b = (t - ARRIVE_MS) / BUMP_MS;
      train.position.x = restX - 0.12 * Math.sin(b * Math.PI * 2.5) * (1 - b) ** 2;
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
    interactingUntil = Infinity;
    request();
  });
  controls.addEventListener("end", () => {
    interactingUntil = performance.now() + 1500; // let the damping settle
    request();
  });

  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && !document.hidden;
    if (visible) request();
  });
  io.observe(stage);
  const onVisibility = () => {
    visible = !document.hidden;
    if (visible) request();
  };
  document.addEventListener("visibilitychange", onVisibility);

  stage.appendChild(canvas);
  resize();
  // First frame, then fade the canvas in over the still image.
  renderer.render(scene, camera);
  requestAnimationFrame(() => stage.classList.add("is-live"));
  request();

  // Regenerating the still image (public/models/s12-metro-poster.webp):
  // open the 404 page with ?poster and run __capturePoster() in the
  // console. Renders the resting train at 1280×800 on a transparent
  // background. See assets-src/models/README.md.
  if (new URLSearchParams(window.location.search).has("poster")) {
    (window as Window & { __capturePoster?: () => string }).__capturePoster = () => {
      train.position.x = restX;
      arriveStart = -Infinity;
      const { width, height } = stage.getBoundingClientRect();
      renderer.setPixelRatio(1);
      renderer.setSize(1280, 800, false);
      camera.aspect = 1280 / 800;
      camera.fov = 32;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const url = canvas.toDataURL("image/webp", 0.86);
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
      camera.position.copy(controls.target).add(polar > controls.minPolarAngle && polar < controls.maxPolarAngle ? tilted : offset);
      interactingUntil = performance.now() + 600;
      request();
    },
    dispose() {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      controls.dispose();
      renderer.dispose();
      canvas.remove();
      camera.position.copy(home.pos);
    },
  };
}
