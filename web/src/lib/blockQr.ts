// Klick block QR: a building-block city whose top-down footprint is the QR code.
// Ported from Sivasurya's klick-qr integration kit into a root-scoped factory so the
// My QR screen can mount, update and fully dispose it. The kit's invariants are kept:
// - blocks never rearrange; only the camera moves between isometric and top view
// - error correction H with a four-module quiet zone
// - every destination is verified with jsQR before the code counts as scannable
// - top view is static (no orbit, no shimmer); reduced motion turns both off
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import QRCode from "qrcode";
import jsQR from "jsqr";

export type BlockQrView = "isometric" | "top";
export interface BlockQrState {
  view: BlockQrView;
  viewReady: boolean;
  verified: boolean;
  reducedMotion: boolean;
}
export interface BlockQr {
  setDestination(url: string): boolean;
  setView(view: BlockQrView): void;
  toggle(): void;
  getState(): BlockQrState;
  dispose(): void;
}

const quietZone = 4;
const pitch = 0.32;
const towerPalette = {
  base: ["#315c9f", "#237451", "#a54945", "#8d690f"].map((c) => new THREE.Color(c)),
  bands: ["#27865d", "#dc625c", "#d19a27", "#3568d4"].map((c) => new THREE.Color(c)),
  topLeftBands: ["#d19a27", "#dc625c", "#3568d4", "#27865d"].map((c) => new THREE.Color(c)),
};

function seeded(index: number) {
  const x = Math.sin(index * 9283.13 + 17.1) * 43758.5453;
  return x - Math.floor(x);
}

function finderTowerHeight(localCol: number, localRow: number, baseHeight: number, seedOffset: number) {
  const isRaisedCore = localCol >= 2 && localCol <= 4 && localRow >= 2 && localRow <= 4;
  const variation = seeded(localRow * 7 + localCol + seedOffset);
  const reduction = isRaisedCore ? (variation > 0.78 ? 1 : 0) : variation > 0.82 ? 2 : variation > 0.48 ? 1 : 0;
  return baseHeight + (isRaisedCore ? 2 : 0) - reduction;
}

// True when this browser can draw WebGL; otherwise the screen shows the flat code.
export function canUseWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function createBlockQr(opts: {
  stage: HTMLElement;
  threeCanvas: HTMLCanvasElement;
  qrCanvas: HTMLCanvasElement;
  onChange?: (s: BlockQrState) => void;
}): BlockQr {
  const { stage, threeCanvas, qrCanvas, onChange } = opts;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.1, 50);
  const cameraStart = new THREE.Vector3(8.8, 6.4, 10.8);
  const cameraEnd = new THREE.Vector3(0, 14, 0.001);
  const endDummy = new THREE.PerspectiveCamera();
  endDummy.position.copy(cameraEnd);
  endDummy.up.set(0, 0, -1);
  endDummy.lookAt(0, 0, 0);
  const cameraEndQ = endDummy.quaternion.clone();
  const orbitAxis = new THREE.Vector3(0, 1, 0);
  const autoOrbitSpeed = 0.052;
  const orbitPosition = cameraStart.clone();
  const orbitDummy = new THREE.PerspectiveCamera();

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb7c0cc, 2.25);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 4.8);
  key.position.set(-3, 12, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9db8ff, 1.35);
  fill.position.set(8, 5, -7);
  scene.add(fill);

  const bodyGeometry = new RoundedBoxGeometry(0.94, 0.3, 0.94, 2, 0.07);
  const studGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 18);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.34, metalness: 0, clearcoat: 0.42, clearcoatRoughness: 0.26 });
  const studMaterial = bodyMaterial.clone();
  const surfaceMaterial = new THREE.MeshStandardMaterial({ color: "#f9fbff", roughness: 0.82, metalness: 0 });
  const dummy = new THREE.Object3D();

  let bodies: THREE.InstancedMesh | null = null;
  let studs: THREE.InstancedMesh | null = null;
  let surface: THREE.Mesh | null = null;
  let bodyBaseColors: THREE.Color[] = [];
  let bodyShimmerPositions: THREE.Vector3[] = [];
  let bodyShimmerJitters: number[] = [];
  let studBaseColors: THREE.Color[] = [];
  let studShimmerPositions: THREE.Vector3[] = [];
  let studShimmerJitters: number[] = [];
  let shimmerWasActive = false;
  const shimmerColor = new THREE.Color();
  const projected = new THREE.Vector3();
  let progress = 0;
  let velocity = 0;
  let target = 0;
  let isTopView = false;
  let viewReady = true;
  let verified = false;
  let destination = "";
  let lastTime = performance.now();
  const sceneStartedAt = lastTime;
  let gridWorldSize = 12;
  let stageAspect = 1;
  let orbitAngle = 0;
  let targetOrbitAngle = 0;
  let activePointerId: number | null = null;
  let lastPointerX = 0;
  let draggedPixels = 0;
  let ignoreNextClick = false;
  let frame = 0;
  let disposed = false;

  const state = (): BlockQrState => ({ view: isTopView ? "top" : "isometric", viewReady, verified, reducedMotion });
  const emit = () => onChange?.(state());

  function drawVerificationQr(matrix: Uint8Array, size: number) {
    const full = size + quietZone * 2;
    const scale = 12;
    qrCanvas.width = full * scale;
    qrCanvas.height = full * scale;
    const ctx = qrCanvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, qrCanvas.width, qrCanvas.height);
    ctx.fillStyle = "#17241e";
    for (let row = 0; row < size; row += 1)
      for (let col = 0; col < size; col += 1)
        if (matrix[row * size + col]) ctx.fillRect((col + quietZone) * scale, (row + quietZone) * scale, scale, scale);
    const image = ctx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
    const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
    verified = decoded?.data === destination;
  }

  function disposeSceneObjects() {
    if (bodies) {
      scene.remove(bodies);
      bodies.dispose();
    }
    if (studs) {
      scene.remove(studs);
      studs.dispose();
    }
    if (surface) {
      scene.remove(surface);
      surface.geometry.dispose();
    }
  }

  function buildQr(value: string) {
    const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
    const size = qr.modules.size;
    const matrix = qr.modules.data;
    const full = size + quietZone * 2;
    const mid = (size - 1) / 2;
    const columns: Array<{ col: number; row: number; height: number; baseOffset: number; bandOffset: number; isTopLeftTower: boolean }> = [];
    let bodyCount = 0;
    bodyBaseColors = [];
    bodyShimmerPositions = [];
    bodyShimmerJitters = [];
    studBaseColors = [];
    studShimmerPositions = [];
    studShimmerJitters = [];
    shimmerWasActive = false;
    appliedDarken = -1;

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!matrix[row * size + col]) continue;
        let height = 1;
        const inTopLeftFinder = col < 7 && row < 7;
        const inTopRightFinder = col >= size - 7 && row < 7;
        const inBottomLeftFinder = col < 7 && row >= size - 7;
        const centerHalfSpan = Math.max(3, Math.round(size * 0.1));
        const inCenterTower = Math.abs(col - mid) <= centerHalfSpan && Math.abs(row - mid) <= centerHalfSpan;
        const isMajorTower = inTopLeftFinder || inTopRightFinder || inBottomLeftFinder || inCenterTower;
        const districtSeed = seeded(Math.floor(row / 2) * size + Math.floor(col / 2) + 307);
        const baseOffset = Math.floor(districtSeed * towerPalette.base.length);
        let bandOffset = 0;

        if (inTopLeftFinder) height = finderTowerHeight(col, row, 5, 11);
        if (inBottomLeftFinder) height = finderTowerHeight(col, row - (size - 7), 6, 37);
        if (inTopRightFinder) height = finderTowerHeight(col - (size - 7), row, 7, 71);
        if (inCenterTower) {
          const centerDistance = Math.max(Math.abs(col - mid), Math.abs(row - mid));
          const variation = seeded(row * size + col + 151);
          const reduction = variation > 0.9 ? 2 : variation > 0.58 ? 1 : 0;
          height = Math.min(24, 9 + (centerHalfSpan - centerDistance) * 6) - reduction;
        }
        if (!isMajorTower) {
          if (districtSeed > 0.84) height = 3;
          else if (districtSeed > 0.64) height = 2;
          bandOffset = Math.floor(districtSeed * towerPalette.bands.length);
        }
        columns.push({ col, row, height, baseOffset, bandOffset, isTopLeftTower: inTopLeftFinder });
        bodyCount += height;
      }
    }

    disposeSceneObjects();
    const b = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, bodyCount);
    const s = new THREE.InstancedMesh(studGeometry, studMaterial, columns.length);
    b.castShadow = true;
    b.receiveShadow = true;
    s.castShadow = true;

    let bodyIndex = 0;
    columns.forEach((column, columnIndex) => {
      const x = (column.col - mid) * pitch;
      const z = (column.row - mid) * pitch;
      const bands = column.isTopLeftTower ? towerPalette.topLeftBands : towerPalette.bands;
      for (let layer = 0; layer < column.height; layer += 1) {
        const bandIndex = (Math.floor(Math.max(layer - 1, 0) / 2) + column.bandOffset) % bands.length;
        const layerColor = layer === 0 ? towerPalette.base[column.baseOffset] : bands[bandIndex];
        dummy.position.set(x, 0.13 + layer * 0.255, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.326, 0.82, 0.326);
        dummy.updateMatrix();
        b.setMatrixAt(bodyIndex, dummy.matrix);
        const bodyColor = layerColor.clone();
        b.setColorAt(bodyIndex, bodyColor);
        bodyBaseColors.push(bodyColor);
        bodyShimmerPositions.push(dummy.position.clone());
        bodyShimmerJitters.push((seeded(bodyIndex + 503) - 0.5) * 0.035);
        bodyIndex += 1;
      }
      dummy.position.set(x, 0.27 + (column.height - 1) * 0.255, z);
      dummy.scale.setScalar(0.29);
      dummy.updateMatrix();
      s.setMatrixAt(columnIndex, dummy.matrix);
      const topBandIndex = (Math.floor(Math.max(column.height - 2, 0) / 2) + column.bandOffset) % bands.length;
      const studColor = (column.height > 1 ? bands[topBandIndex] : towerPalette.base[column.baseOffset]).clone();
      s.setColorAt(columnIndex, studColor);
      studBaseColors.push(studColor);
      studShimmerPositions.push(dummy.position.clone());
      studShimmerJitters.push((seeded(columnIndex + 911) - 0.5) * 0.035);
    });

    b.instanceMatrix.needsUpdate = true;
    s.instanceMatrix.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
    if (s.instanceColor) s.instanceColor.needsUpdate = true;
    scene.add(b, s);
    bodies = b;
    studs = s;

    gridWorldSize = full * pitch;
    surface = new THREE.Mesh(new RoundedBoxGeometry(gridWorldSize, 0.16, gridWorldSize, 3, 0.12), surfaceMaterial);
    surface.position.y = -0.105;
    surface.castShadow = true;
    surface.receiveShadow = true;
    scene.add(surface);

    drawVerificationQr(matrix as unknown as Uint8Array, size);
    resize();
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    stageAspect = Math.max(rect.width / rect.height, 0.1);
  }

  function updateProjection(t: number) {
    // The kit framed a wide desktop stage at 0.46; this stage is nearly square, so the
    // isometric view gets more room or the base's corners clip as it turns.
    let span = THREE.MathUtils.lerp(gridWorldSize * 0.58, gridWorldSize * 0.56, t);
    if (stageAspect < 1) span /= stageAspect * THREE.MathUtils.lerp(0.78, 0.96, t);
    camera.left = -span * stageAspect;
    camera.right = span * stageAspect;
    camera.top = span;
    camera.bottom = -span;
    camera.updateProjectionMatrix();
  }

  function setMode(topView: boolean) {
    if (topView === isTopView) return;
    isTopView = topView;
    target = topView ? 1 : 0;
    viewReady = false;
    if (reducedMotion) {
      progress = target;
      velocity = 0;
      viewReady = true;
    }
    emit();
  }

  // Scan contrast: phone cameras need dark modules on a light ground, and the bright yellow
  // and coral bands read as "light". As the camera reaches the top, every block deepens to a
  // dark shade of its own colour, so the code stays Klick-coloured but scans reliably.
  let appliedDarken = -1;
  const darkTarget = new THREE.Color();
  function applyScanContrast(t: number) {
    if (!bodies || !studs || Math.abs(t - appliedDarken) < 0.01) return;
    appliedDarken = t;
    const k = THREE.MathUtils.lerp(1, 0.2, t);
    // Softer light from above too, so top faces and shadows don't wash the modules out.
    key.intensity = THREE.MathUtils.lerp(4.8, 1.2, t);
    hemi.intensity = THREE.MathUtils.lerp(2.25, 1.6, t);
    // Tower shadows would fall across the quiet gaps and finder rings, so drop them near the top.
    key.castShadow = t < 0.5;
    const pass = (mesh: THREE.InstancedMesh, base: THREE.Color[]) => {
      base.forEach((c, i) => mesh.setColorAt(i, darkTarget.copy(c).multiplyScalar(k)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    pass(bodies, bodyBaseColors);
    pass(studs, studBaseColors);
  }

  function updateBlockShimmer(now: number) {
    if (!bodies || !studs) return;
    const elapsed = (now - sceneStartedAt) / 1000 - 4.5;
    const cycle = elapsed >= 0 ? elapsed % 9 : -1;
    const isActive = !reducedMotion && !isTopView && cycle >= 0 && cycle < 2.6;
    if (isActive) {
      const t = cycle / 2.6;
      // Phase comes from projected screen x, so the shimmer always runs right to left.
      const pass = (mesh: THREE.InstancedMesh, base: THREE.Color[], pos: THREE.Vector3[], jit: number[], width: number, gain: number) => {
        base.forEach((color, i) => {
          projected.copy(pos[i]).project(camera);
          const phase = THREE.MathUtils.clamp((1 - projected.x) * 0.5 + jit[i], 0.02, 0.98);
          const d = Math.abs(t - phase);
          const pulse = d < width ? 0.5 + 0.5 * Math.cos((Math.PI * d) / width) : 0;
          shimmerColor.copy(color).multiplyScalar(1 + pulse * gain);
          mesh.setColorAt(i, shimmerColor);
        });
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      };
      pass(bodies, bodyBaseColors, bodyShimmerPositions, bodyShimmerJitters, 0.11, 0.28);
      pass(studs, studBaseColors, studShimmerPositions, studShimmerJitters, 0.12, 0.46);
      shimmerWasActive = true;
      return;
    }
    if (!shimmerWasActive) return;
    bodyBaseColors.forEach((c, i) => bodies!.setColorAt(i, c));
    studBaseColors.forEach((c, i) => studs!.setColorAt(i, c));
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    if (studs.instanceColor) studs.instanceColor.needsUpdate = true;
    shimmerWasActive = false;
  }

  function animate(now: number) {
    if (disposed) return;
    const dt = Math.min((now - lastTime) / 1000, 0.034);
    lastTime = now;
    if (!reducedMotion) {
      velocity += ((target - progress) * 48 - velocity * 14) * dt;
      progress = THREE.MathUtils.clamp(progress + velocity * dt, 0, 1);
      if (Math.abs(target - progress) < 0.0001 && Math.abs(velocity) < 0.001) {
        progress = target;
        velocity = 0;
      }
      if (Math.abs(target - progress) < 0.006 && !viewReady) {
        viewReady = true;
        emit();
      }
    }
    const cameraT = progress * progress * (3 - 2 * progress);
    if (!reducedMotion && !isTopView && activePointerId === null) targetOrbitAngle += autoOrbitSpeed * dt;
    orbitAngle += (targetOrbitAngle - orbitAngle) * Math.min(1, dt * 10);
    orbitPosition.copy(cameraStart).applyAxisAngle(orbitAxis, orbitAngle);
    orbitDummy.position.copy(orbitPosition);
    orbitDummy.lookAt(0, 0.8, 0);
    updateProjection(cameraT);
    camera.position.lerpVectors(orbitPosition, cameraEnd, cameraT);
    camera.quaternion.slerpQuaternions(orbitDummy.quaternion, cameraEndQ, cameraT);
    if (cameraT > 0.001 || appliedDarken > 0) applyScanContrast(cameraT);
    else updateBlockShimmer(now);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }

  // Horizontal drag orbits the camera in isometric view; a tap (or Enter/Space) toggles the view.
  const onDown = (e: PointerEvent) => {
    if (isTopView || e.button !== 0) return;
    activePointerId = e.pointerId;
    lastPointerX = e.clientX;
    draggedPixels = 0;
    stage.dataset.dragging = "true";
    stage.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    const dx = e.clientX - lastPointerX;
    lastPointerX = e.clientX;
    draggedPixels += Math.abs(dx);
    targetOrbitAngle -= dx * 0.007;
    if (draggedPixels > 4) ignoreNextClick = true;
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    stage.releasePointerCapture?.(e.pointerId);
    activePointerId = null;
    delete stage.dataset.dragging;
  };
  const onClick = () => {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }
    setMode(!isTopView);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setMode(!isTopView);
    }
  };
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
  stage.addEventListener("click", onClick);
  stage.addEventListener("keydown", onKey);
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  frame = requestAnimationFrame(animate);

  return {
    setDestination(url: string) {
      const next = url.trim();
      const parsed = new URL(next);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Destination must use http or https.");
      destination = next;
      buildQr(next);
      emit();
      return verified;
    },
    setView: (view) => setMode(view === "top"),
    toggle: () => setMode(!isTopView),
    getState: state,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("click", onClick);
      stage.removeEventListener("keydown", onKey);
      disposeSceneObjects();
      bodyGeometry.dispose();
      studGeometry.dispose();
      bodyMaterial.dispose();
      studMaterial.dispose();
      surfaceMaterial.dispose();
      renderer.dispose();
    },
  };
}
