import * as THREE from "./vendor/three.module.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

import { EffectComposer } from "./vendor/EffectComposer.js";
import { RenderPass } from "./vendor/RenderPass.js";
import { UnrealBloomPass } from "./vendor/UnrealBloomPass.js";

const ENABLE_STAR   = true;   // 顶部星星

// 终局调色旋钮（可调）
const FINAL_GRADE = {
  exposure: 1.0,           // 0.9 ~ 1.2
  envIntensity: 0.7,       // 0.4 ~ 1.2
  bloomStrength: 1.1,      // 0.8 ~ 1.4
  bloomRadius: 0.4,        // 0.2 ~ 0.6
  bloomThreshold: 0.4,     // 0.25 ~ 0.55
  fogDensity: 0.024,       // 0.015 ~ 0.04
  bgTop: 0x1a0b3d,
  bgBottom: 0x0b2a6f
};

// Bloom 参数（可调）
const BLOOM_PARAMS = {
  strength: FINAL_GRADE.bloomStrength,
  radius: FINAL_GRADE.bloomRadius,
  threshold: FINAL_GRADE.bloomThreshold
};

// 发光强度分档
const EMISSIVE_STRONG = 1.5;
const EMISSIVE_SOFT = 0.35;

// 照片挂饰样式（可调）
const ORNAMENT_STYLE = {
  cornerRadius: 28,          // 圆角像素（基于原图尺寸）
  frameThickness: 0.12,      // 边框厚度（宽高方向）
  frameDepth: 0.08,          // 边框厚度（Z 方向）
  glassOffset: 0.02,         // 玻璃层相对照片层的偏移
  frameEmissiveIntensity: EMISSIVE_SOFT
};
const CARD_LONG = 1.6;
const MIN_SHORT = 0.75;
const MAX_LONG = 1.8;


/** Step 4：改这里：写你 photos/ 目录下的图片文件名（建议png/jpg/webp） */
const PHOTO_FILES = [
  "xmas01.JPG",
  "xmas02.JPG",
  "xmas03.JPG",
  "xmas04.JPG",
  "xmas05.JPG",
  "xmas06.JPG",
  "xmas07.JPG",
  "xmas08.JPG",
  "xmas09.JPG",
  "xmas10.JPG"
];

const PHOTO_DIR = "./photos/";
const BG_COLOR = 0x0b2a6f;

// 背景氛围（可调）
const GRADIENT_TOP = FINAL_GRADE.bgTop;
const GRADIENT_BOTTOM = FINAL_GRADE.bgBottom;
const SKY_RADIUS = 100;
const STAR_COUNT = 1400;
const STAR_RADIUS_MIN = 35;
const STAR_RADIUS_MAX = 90;
const STAR_SIZE = 0.35;
const STAR_TWINKLE_SPEED = 0.2;
const FOG_COLOR = 0x151a3b;
const FOG_DENSITY = FINAL_GRADE.fogDensity; // 0.015 ~ 0.04

// 雪花参数（可调）
const FAR_SNOW_COUNT = 1200;
const NEAR_SNOW_COUNT = 500;
const FAR_SIZE = 0.12;
const NEAR_SIZE = 0.28;
const FAR_SPEED_RANGE = [0.2, 0.45];
const NEAR_SPEED_RANGE = [0.5, 1.0];
const WIND_XZ_RANGE = 0.15;
const SNOW_BOUNDS = {
  radius: 22,
  yTop: 18,
  yBottom: -2
};

// 动画参数（可调）
const ORNAMENT_SWAY = {
  ampX: [0.02, 0.06],
  ampZ: [0.02, 0.08],
  speed: [0.6, 1.2],
  lerp: 0.08
};
const BELL_SWAY = {
  ampX: [0.01, 0.03],
  ampZ: [0.01, 0.04],
  speed: [0.5, 0.9],
  lerp: 0.06
};
const WAVE = { speed: 0.18, width: 0.10, base: 0.6, peak: 1.8, secondary: 0.25 };
const SPIRAL_NOISE = { yAmp: 0.26, rAmp: 0.32, freqY: 10.0, freqR: 8.0, minInset: 0.18 };
const SPARKLE = { perMin: 3, perMax: 6, radiusMin: 0.15, radiusMax: 0.35, maxTotal: 150 };
const LAYOUT = {
  photo: { minAngle: 0.22, minY: 0.45, minR: 0.5, weight: 2.0 },
  bulb: { minAngle: 0.12, minY: 0.25, minR: 0.35, weight: 1.0 },
  bell: { minAngle: 0.16, minY: 0.35, minR: 0.4, weight: 1.2 },
  candy: { minAngle: 0.14, minY: 0.32, minR: 0.35, weight: 1.1 }
};
let scene, camera, renderer, controls;
let t0 = performance.now();
let lastTime = performance.now();
let composer, bloomPass;
let starMaterial;
let snowSystem;
let envMap;
const ornaments = [];
const bulbs = [];
const bells = [];
const occupiedSlots = [];
const sparkles = [];
let sparkleCount = 0;

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 6, 16);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = FINAL_GRADE.exposure;
  renderer.physicallyCorrectLights = true;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 5, 0);

  envMap = createEnvironmentMap(renderer);
  scene.environment = envMap;

  // 光
  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(6, 10, 6);
  scene.add(dir);

  // 轻微背光，让玻璃层有高光
  const rim = new THREE.DirectionalLight(0xbfd9ff, 0.45);
  rim.position.set(-6, 6, -8);
  scene.add(rim);

  addSkyDome(scene);
  addStarfield(scene);
  snowSystem = createSnow(scene);

  // Step 5-3：后期 Bloom
  composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    BLOOM_PARAMS.strength,
    BLOOM_PARAMS.radius,
    BLOOM_PARAMS.threshold
  );
  composer.addPass(bloomPass);


  // 树（你现在已有的树干+圆锥，这里给一个稳定版本）
  const tree = new THREE.Group();
  scene.add(tree);

  // 树干
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.8, 3.2, 24),
    new THREE.MeshStandardMaterial({
      color: 0x6b3e1e,
      roughness: 0.85,
      metalness: 0.1,
      envMapIntensity: FINAL_GRADE.envIntensity * 0.3
    })
  );
  trunk.position.y = 1.6;
  tree.add(trunk);

  const foliageLayers = buildFoliage(tree);

  // Step4：挂照片（卡片）
  if (PHOTO_FILES.length === 0) {
    console.warn("PHOTO_FILES 为空：请把 photos/ 里的图片文件名填进 PHOTO_FILES");
  } else {
    const spiral = addSpiralCable(tree, foliageLayers);
    addSpiralBulbs(tree, spiral.curve, foliageLayers);
    addPhotoOrnaments(tree, foliageLayers);
    addCandies(tree, foliageLayers, ornaments);
    addBells(tree, foliageLayers);
    if (ENABLE_STAR) addStar(tree);
  }

  window.addEventListener("resize", onResize);
}

function buildFoliage(treeGroup) {
  const layers = [];
  const layerCount = THREE.MathUtils.randInt(18, 28);
  const rBottom = 3.9;
  const rTop = 0.65;
  const yBottom = 2.3;
  const yTop = 10.2;
  const radiusEasePow = 2.0;
  const twistTotal = Math.PI * 1.1;
  const lowFreq = THREE.MathUtils.randInt(5, 9);
  const lowPhase = Math.random() * Math.PI * 2;
  const yStep = (yTop - yBottom) / (layerCount - 1);
  const needleCountRange = [80, 220];
  const needleLenBottom = [0.28, 0.38];
  const needleLenTop = [0.12, 0.22];
  const needleMaxOut = 0.35;
  const needleTilt = [0.35, 0.85];
  const ringSlots = [
    THREE.MathUtils.lerp(yBottom, yTop, 0.18),
    THREE.MathUtils.lerp(yBottom, yTop, 0.48),
    THREE.MathUtils.lerp(yBottom, yTop, 0.78)
  ];
  const insetAtY = (y) => {
    let inset = 0;
    for (let i = 0; i < ringSlots.length; i++) {
      const d = Math.abs(y - ringSlots[i]);
      if (d < 0.35) inset = Math.max(inset, 0.35 * (1 - d / 0.35));
    }
    return inset;
  };

  const baseColor = new THREE.Color(0x165c34);
  const topColor = new THREE.Color(0x2aa163);

  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1);
    const tE = Math.pow(t, radiusEasePow);
    let y = yBottom + yStep * i;
    const jitter = THREE.MathUtils.randFloatSpread(yStep * 0.35);
    y = (i === 0) ? yBottom : Math.min(yTop, Math.max(yBottom, y + jitter));
    if (i > 0) {
      y = Math.max(y, layers[i - 1].y + yStep * 0.55);
    }
    const baseR = THREE.MathUtils.lerp(rBottom, rTop, tE);
    const wave = 1 + 0.04 * Math.sin(t * lowFreq * Math.PI * 2 + lowPhase);
    const jitterR = THREE.MathUtils.randFloatSpread(0.06) * (1 - t);
    const r = Math.max(0.4, baseR * wave + jitterR - insetAtY(y));
    const hThin = THREE.MathUtils.lerp(0.25, 0.15, t);
    const topR = r * 0.38;

    const geom = createStarRingGeometry(12, r, r * 0.55, hThin);
    const pos = geom.attributes.position;
    const droop = (1 - t) * 0.18;

    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const z = pos.getZ(v);
      const yv = pos.getY(v);
      const radial = Math.sqrt(x * x + z * z);
      const edge = radial / r;
      const noise = (Math.random() - 0.5) * 0.12 * r;

      if (edge > 0.65) {
        pos.setX(v, x + (x / radial) * noise);
        pos.setZ(v, z + (z / radial) * noise);
        pos.setY(v, yv - droop * edge * edge);
      } else {
        pos.setX(v, x + (Math.random() - 0.5) * 0.02 * r);
        pos.setZ(v, z + (Math.random() - 0.5) * 0.02 * r);
      }
    }

    pos.needsUpdate = true;
    geom.computeVertexNormals();

    const layerColor = baseColor.clone().lerp(topColor, t * 0.9 + 0.1);
    const mat = new THREE.MeshStandardMaterial({
      color: layerColor,
      roughness: 0.9,
      metalness: 0.02,
      envMapIntensity: FINAL_GRADE.envIntensity * 0.2
    });

    const ring = new THREE.Mesh(geom, mat);
    ring.position.y = y;
    ring.rotation.y = t * twistTotal + THREE.MathUtils.randFloatSpread(0.25);
    ring.rotation.x = THREE.MathUtils.randFloat(-0.05, 0.05);
    ring.rotation.z = THREE.MathUtils.randFloat(-0.05, 0.05);
    treeGroup.add(ring);

    const needleMat = new THREE.MeshStandardMaterial({
      color: layerColor.clone().offsetHSL(0, 0, THREE.MathUtils.randFloat(-0.06, 0.06)),
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    const needleCount = Math.floor(THREE.MathUtils.lerp(needleCountRange[0], needleCountRange[1], Math.sqrt(r / rBottom)));
    const lenRange = [
      THREE.MathUtils.lerp(needleLenBottom[0], needleLenTop[0], t),
      THREE.MathUtils.lerp(needleLenBottom[1], needleLenTop[1], t)
    ];
    const needleGeo = new THREE.PlaneGeometry(0.1, lenRange[1]);
    const needles = new THREE.InstancedMesh(needleGeo, needleMat, needleCount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    for (let n = 0; n < needleCount; n++) {
      const a = (n / needleCount) * Math.PI * 2;
      const starR = starRadiusAtAngle(12, r, r * 0.55, a);
      const baseR = starR * THREE.MathUtils.lerp(0.88, 0.98, Math.random());
      const outMax = Math.min(r + needleMaxOut, r + 0.08 * r);
      const finalR = Math.min(outMax, baseR + Math.random() * 0.04);
      const x = Math.cos(a) * finalR;
      const z = Math.sin(a) * finalR;
      const yN = y + THREE.MathUtils.randFloatSpread(0.03);

      const len = THREE.MathUtils.lerp(lenRange[0], lenRange[1], Math.random());
      s.set(1, len / lenRange[1], 1);

      const out = new THREE.Vector3(x, 0, z).normalize();
      const yaw = Math.atan2(out.x, out.z);
      const tilt = THREE.MathUtils.lerp(needleTilt[0], needleTilt[1], Math.random());
      const roll = THREE.MathUtils.randFloatSpread(0.4);
      q.setFromEuler(new THREE.Euler(-tilt, yaw + THREE.MathUtils.randFloatSpread(0.2), roll));

      m.compose(new THREE.Vector3(x, yN, z), q, s);
      needles.setMatrixAt(n, m);
    }
    needles.instanceMatrix.needsUpdate = true;
    needles.rotation.copy(ring.rotation);
    treeGroup.add(needles);

    layers.push({ r, h: hThin, y });
  }

  const budMat = new THREE.MeshStandardMaterial({
    color: topColor,
    roughness: 0.85,
    metalness: 0.05,
    envMapIntensity: FINAL_GRADE.envIntensity * 0.25
  });
  const bud = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 24), budMat);
  bud.position.y = yTop + 0.55;
  treeGroup.add(bud);

  return layers;
}

function addPhotoOrnaments(treeGroup, foliageLayers) {
  const loader = new THREE.TextureLoader();
  const baseMargin = 0.45;

  // 先把文件名循环分配到三层（简单平均）
  const photoLayers = [[], [], []];
  for (let i = 0; i < PHOTO_FILES.length; i++) {
    photoLayers[i % 3].push(PHOTO_FILES[i]);
  }

  const ringSlots = [
    Math.floor(foliageLayers.length * 0.18),
    Math.floor(foliageLayers.length * 0.48),
    Math.floor(foliageLayers.length * 0.78)
  ];

  // 每层挂一圈：相框（3D）+ 照片 + 玻璃
  photoLayers.forEach((files, layerIdx) => {
    if (files.length === 0) return;

    const c = foliageLayers[ringSlots[layerIdx]] || foliageLayers[0];
    const y = c.y + c.h * 0.05;         // 稍微偏上，别扎进圆锥里
    const count = files.length;

    for (let i = 0; i < count; i++) {
      const fname = files[i];
      const angle = (i / count) * Math.PI * 2;

      // 卡片大小：先给一个占位，贴图加载后按比例更新
      let w = CARD_LONG;
      let h = CARD_LONG * 0.7;

      const ornament = new THREE.Group();

      // 照片层（圆角贴图）
      const photoGeom = new THREE.PlaneGeometry(w, h);
      const photoMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6,
        metalness: 0.0,
        envMapIntensity: FINAL_GRADE.envIntensity * 0.15,
        side: THREE.DoubleSide
      });
      const photoLayer = new THREE.Mesh(photoGeom, photoMat);
      ornament.add(photoLayer);

      // 玻璃层
      const glassGeom = new THREE.PlaneGeometry(w, h);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        transmission: 1.0,
        thickness: 0.2,
        roughness: 0.06,
        metalness: 0.0,
        ior: 1.45,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: FINAL_GRADE.envIntensity * 1.1,
        side: THREE.DoubleSide
      });
      const glassLayer = new THREE.Mesh(glassGeom, glassMat);
      glassLayer.position.z = ORNAMENT_STYLE.glassOffset;
      ornament.add(glassLayer);

      // 装饰层：星形轮廓细带
      const photoRadius = Math.max(w, h) / 2;
      const decorRadius = Math.max(0.3, photoRadius - 0.5);
      const decorShape = createStarBandShape(decorRadius, 0.06, 5);
      const decorGeom = new THREE.ShapeGeometry(decorShape);
      const decorMat = new THREE.MeshStandardMaterial({
        color: 0xf6f0ff,
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
        opacity: 0.32,
        depthWrite: false
      });
      const decor = new THREE.Mesh(decorGeom, decorMat);
      decor.position.z = ORNAMENT_STYLE.glassOffset + 0.03;
      ornament.add(decor);

      // 3D 边框（四条盒子拼框）
      const frameGroup = new THREE.Group();
      const frameDepth = ORNAMENT_STYLE.frameDepth;
      const ft = ORNAMENT_STYLE.frameThickness;

      const frameMat = new THREE.MeshStandardMaterial({
        color: 0xded6cc,
        emissive: 0xffffff,
        emissiveIntensity: ORNAMENT_STYLE.frameEmissiveIntensity,
        roughness: 0.4,
        metalness: 0.3,
        envMapIntensity: FINAL_GRADE.envIntensity * 0.6
      });

      let horizontalGeom = new THREE.BoxGeometry(w + ft * 2, ft, frameDepth);
      let verticalGeom = new THREE.BoxGeometry(ft, h + ft * 2, frameDepth);

      const top = new THREE.Mesh(horizontalGeom, frameMat);
      top.position.y = h / 2 + ft / 2;
      const bottom = new THREE.Mesh(horizontalGeom, frameMat);
      bottom.position.y = -h / 2 - ft / 2;
      const left = new THREE.Mesh(verticalGeom, frameMat);
      left.position.x = -w / 2 - ft / 2;
      const right = new THREE.Mesh(verticalGeom, frameMat);
      right.position.x = w / 2 + ft / 2;

      frameGroup.add(top, bottom, left, right);
      frameGroup.position.z = ORNAMENT_STYLE.glassOffset + 0.01;
      ornament.add(frameGroup);

      const ringRadius = getTreeRadiusAtY(y, foliageLayers) + baseMargin + w * 0.15;
      // 位置：围绕树一圈
      ornament.position.set(
        Math.cos(angle) * ringRadius,
        y,
        Math.sin(angle) * ringRadius
      );
      ornament.userData.angle = angle;
      ornament.userData.y = y;
      const slot = registerSlot(angle, y, ringRadius, LAYOUT.photo.weight);
      ornament.userData.slot = slot;

      // 朝外：让卡片面向远离中心的方向
      ornament.lookAt(0, y, 0);
      ornament.rotateY(Math.PI); // 翻过来朝外
      ornament.translateZ(0.05);

      ornaments.push({
        group: ornament,
        baseRotX: ornament.rotation.x,
        baseRotZ: ornament.rotation.z,
        phase: Math.random() * Math.PI * 2,
        speed: THREE.MathUtils.lerp(ORNAMENT_SWAY.speed[0], ORNAMENT_SWAY.speed[1], Math.random()),
        ampX: THREE.MathUtils.lerp(ORNAMENT_SWAY.ampX[0], ORNAMENT_SWAY.ampX[1], Math.random()),
        ampZ: THREE.MathUtils.lerp(ORNAMENT_SWAY.ampZ[0], ORNAMENT_SWAY.ampZ[1], Math.random())
      });

      // 贴图加载 + 圆角裁切
      loader.load(
        PHOTO_DIR + fname,
        (tex) => {
          const imgW = tex.image.width || tex.image.naturalWidth;
          const imgH = tex.image.height || tex.image.naturalHeight;
          if (imgW && imgH) {
            const aspect = imgW / imgH;
            if (aspect >= 1) {
              w = CARD_LONG;
              h = CARD_LONG / aspect;
            } else {
              h = CARD_LONG;
              w = CARD_LONG * aspect;
            }

            let maxSide = Math.max(w, h);
            let minSide = Math.min(w, h);
            if (maxSide > MAX_LONG) {
              const s = MAX_LONG / maxSide;
              w *= s;
              h *= s;
            }
            maxSide = Math.max(w, h);
            minSide = Math.min(w, h);
            if (minSide < MIN_SHORT) {
              let s = MIN_SHORT / minSide;
              if (Math.max(w * s, h * s) > MAX_LONG) {
                s = MAX_LONG / maxSide;
              }
              w *= s;
              h *= s;
            }

            photoLayer.geometry.dispose();
            photoLayer.geometry = new THREE.PlaneGeometry(w, h);
            glassLayer.geometry.dispose();
            glassLayer.geometry = new THREE.PlaneGeometry(w, h);

            horizontalGeom.dispose();
            verticalGeom.dispose();
            horizontalGeom = new THREE.BoxGeometry(w + ft * 2, ft, frameDepth);
            verticalGeom = new THREE.BoxGeometry(ft, h + ft * 2, frameDepth);
            top.geometry = horizontalGeom;
            bottom.geometry = horizontalGeom;
            left.geometry = verticalGeom;
            right.geometry = verticalGeom;
            top.position.y = h / 2 + ft / 2;
            bottom.position.y = -h / 2 - ft / 2;
            left.position.x = -w / 2 - ft / 2;
            right.position.x = w / 2 + ft / 2;

            const nextRadius = Math.max(0.3, Math.max(w, h) / 2 - 0.5);
            decor.geometry.dispose();
            decor.geometry = new THREE.ShapeGeometry(createStarBandShape(nextRadius, 0.06, 5));

            const ry = ornament.userData.y;
            const ra = ornament.userData.angle;
            const rr = getTreeRadiusAtY(ry, foliageLayers) + baseMargin + w * 0.15;
            ornament.position.set(
              Math.cos(ra) * rr,
              ry,
              Math.sin(ra) * rr
            );
            if (ornament.userData.slot) {
              ornament.userData.slot.r = rr;
            }
          }
          const image = tex.image;
          const rounded = createRoundedTexture(image, ORNAMENT_STYLE.cornerRadius);
          photoMat.map = rounded;
          photoMat.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.error("贴图加载失败：", fname, err);
        }
      );

      treeGroup.add(ornament);
    }
  });
}

function createRoundedTexture(image, radiusPx) {
  const canvas = document.createElement("canvas");
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  const r = Math.min(radiusPx, Math.min(w, h) / 2);

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  drawRoundedRect(ctx, 0, 0, w, h, r);
  ctx.clip();
  ctx.drawImage(image, 0, 0, w, h);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createStarBandShape(outerR, bandWidth, points) {
  const innerOuter = Math.max(outerR - bandWidth, 0.05);
  const shape = createStarShape(outerR, outerR * 0.5, points);
  const hole = createStarShape(innerOuter, innerOuter * 0.5, points);
  shape.holes.push(hole);
  return shape;
}

function createStarShape(outerR, innerR, points) {
  const shape = new THREE.Shape();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = (i % 2 === 0) ? outerR : innerR;
    const a = i * step - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

function createStarRingGeometry(points, outerR, innerR, height) {
  const outer = createStarShape(outerR, outerR * 0.5, points);
  const inner = createStarShape(innerR, innerR * 0.5, points);
  outer.holes.push(inner);
  const geom = new THREE.ExtrudeGeometry(outer, {
    depth: height,
    bevelEnabled: false
  });
  geom.rotateX(Math.PI / 2);
  geom.translate(0, 0, -height / 2);
  return geom;
}

function starRadiusAtAngle(points, outerR, innerR, angle) {
  const step = Math.PI / points;
  const a = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const seg = Math.floor(a / step);
  const local = (a - seg * step) / step;
  const r0 = (seg % 2 === 0) ? outerR : innerR;
  const r1 = (seg % 2 === 0) ? innerR : outerR;
  return THREE.MathUtils.lerp(r0, r1, local);
}

function getTreeRadiusAtY(y, foliageLayers) {
  const topLayer = foliageLayers[foliageLayers.length - 1];
  const bottomLayer = foliageLayers[0];
  if (y >= topLayer.y) return topLayer.r;
  if (y <= bottomLayer.y) return bottomLayer.r;
  for (let i = 0; i < foliageLayers.length - 1; i++) {
    const a = foliageLayers[i];
    const b = foliageLayers[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return THREE.MathUtils.lerp(a.r, b.r, t);
    }
  }
  return bottomLayer.r;
}

function addSpiralCable(treeGroup, foliageLayers) {
  const topLayer = foliageLayers[foliageLayers.length - 1];
  const bottomLayer = foliageLayers[0];
  const yBottom = bottomLayer.y - bottomLayer.h / 2 + 0.15;
  const yTop = topLayer.y + topLayer.h / 2 - 0.1;
  const turns = 8;
  const points = [];
  const samples = 260;
  const inset = 0.25;
  const phase = Math.random() * Math.PI * 2;
  const noiseSeed = Math.random() * Math.PI * 2;

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    let y = THREE.MathUtils.lerp(yBottom, yTop, t);
    const yNoise = smoothNoise(t, SPIRAL_NOISE.freqY, SPIRAL_NOISE.yAmp, noiseSeed);
    y += yNoise;
    const maxR = getTreeRadiusAtY(y, foliageLayers) - SPIRAL_NOISE.minInset;
    let baseR = Math.max(0.3, maxR - (inset - SPIRAL_NOISE.minInset));
    const rNoise = smoothNoise(t, SPIRAL_NOISE.freqR, SPIRAL_NOISE.rAmp, noiseSeed + 13.7);
    baseR += rNoise;
    baseR = Math.min(baseR, maxR);
    baseR = Math.max(baseR, maxR - 0.35);
    const angle = t * turns * Math.PI * 2 + phase;
    const x = Math.cos(angle) * baseR;
    const z = Math.sin(angle) * baseR;
    points.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeom = new THREE.TubeGeometry(curve, samples * 2, 0.02, 8, false);
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    roughness: 0.9,
    metalness: 0.05,
    depthWrite: false
  });
  const cable = new THREE.Mesh(tubeGeom, cableMat);
  cable.renderOrder = -1;
  treeGroup.add(cable);
  return { curve, cableMesh: cable };
}

function addSpiralBulbs(treeGroup, curve, foliageLayers) {
  const bulbCount = 200;
  const bulbGeo = new THREE.SphereGeometry(0.075, 16, 16);
  const colors = [0xff4d4d, 0x4dff88, 0x4da6ff, 0xffe04d, 0xff4dff];
  const warmWhite = 0xfff2cc;
  const up = new THREE.Vector3(0, 1, 0);
  const offset = -0.12;

  const yBottom = foliageLayers[0].y;
  const yTop = foliageLayers[foliageLayers.length - 1].y;
  const ringSlots = [
    THREE.MathUtils.lerp(yBottom, yTop, 0.18),
    THREE.MathUtils.lerp(yBottom, yTop, 0.48),
    THREE.MathUtils.lerp(yBottom, yTop, 0.78)
  ];

  for (let i = 0; i < bulbCount; i++) {
    const u = i / (bulbCount - 1);
    const pos = curve.getPointAt(u);
    const angle = Math.atan2(pos.z, pos.x);

    let skip = false;
    for (let k = 0; k < ringSlots.length; k++) {
      if (Math.abs(pos.y - ringSlots[k]) < 0.25) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    if (!isSlotFree({ angle, y: pos.y, r: pos.length() }, LAYOUT.bulb)) continue;

    const tangent = curve.getTangentAt(u).normalize();
    let normal = new THREE.Vector3().copy(up).cross(tangent).normalize();
    if (normal.lengthSq() < 1e-4) normal = new THREE.Vector3(1, 0, 0);
    pos.add(normal.multiplyScalar(offset));

    const isWarm = i % 9 === 0;
    const color = isWarm ? warmWhite : colors[i % colors.length];
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: EMISSIVE_STRONG,
      roughness: 0.35,
      metalness: 0.0,
      envMapIntensity: FINAL_GRADE.envIntensity * 0.35
    });

    const bulb = new THREE.Mesh(bulbGeo, mat);
    bulb.position.copy(pos);
    bulb.renderOrder = -1;
    bulb.userData.u = u;
    bulbs.push(bulb);
    treeGroup.add(bulb);
    registerSlot(angle, pos.y, pos.length(), LAYOUT.bulb.weight);

    if (i % 14 === 0) {
      const p = new THREE.PointLight(color, 0.25, 5, 2);
      p.position.copy(bulb.position);
      treeGroup.add(p);
    }
  }
}

function addCandies(treeGroup, foliageLayers, ornamentList) {
  const candyCount = THREE.MathUtils.randInt(20, 40);
  const yBottom = foliageLayers[0].y + 1.2;
  const yTop = foliageLayers[foliageLayers.length - 1].y - 1.2;
  const innerInset = 0.4;
  const stripeTex = createCandyStripeTexture();

  const caneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: stripeTex,
    roughness: 0.5,
    metalness: 0.0,
    envMapIntensity: FINAL_GRADE.envIntensity * 0.2
  });

  const roundColors = [0xff6b6b, 0xffd166, 0x6bd0ff, 0x9b5cff, 0x7cffc4];

  for (let i = 0; i < candyCount; i++) {
    const placement = samplePlacement({
      yRange: [yBottom, yTop],
      rFunc: (y) => Math.max(0.4, getTreeRadiusAtY(y, foliageLayers) - innerInset),
      minAngleGap: LAYOUT.candy.minAngle,
      minYGap: LAYOUT.candy.minY,
      minRGap: LAYOUT.candy.minR,
      tries: 16,
      weight: LAYOUT.candy.weight
    });
    if (!placement) continue;
    const { angle, y, r } = placement;
    const pos = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);

    if (Math.random() < 0.45) {
      const cane = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.46, 14), caneMat);
      stick.position.y = 0.23;
      cane.add(stick);

      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 10, 20, Math.PI * 1.25), caneMat);
      hook.position.y = 0.48;
      hook.position.x = -0.11;
      hook.rotation.z = -Math.PI / 2 + Math.PI / 2.5;
      cane.add(hook);

      cane.position.copy(pos);
      cane.lookAt(0, y, 0);
      cane.rotateY(Math.PI);
      cane.rotateX(Math.random() * Math.PI * 2);
      cane.rotateZ(Math.random() * Math.PI * 2);
      treeGroup.add(cane);
      addSparklesAt(treeGroup, pos);
    } else {
      const color = roundColors[i % roundColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        roughness: 0.35,
        metalness: 0.0,
        envMapIntensity: FINAL_GRADE.envIntensity * 0.25
      });
      const candy = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), mat);
      candy.position.copy(pos);
      candy.lookAt(0, y, 0);
      candy.rotateY(Math.PI);
      candy.rotateX(Math.random() * Math.PI * 2);
      candy.rotateZ(Math.random() * Math.PI * 2);
      treeGroup.add(candy);
      addSparklesAt(treeGroup, pos);
    }
  }
}

function addSparklesAt(treeGroup, basePos) {
  if (sparkleCount >= SPARKLE.maxTotal) return;
  const count = Math.min(
    THREE.MathUtils.randInt(SPARKLE.perMin, SPARKLE.perMax),
    SPARKLE.maxTotal - sparkleCount
  );
  if (count <= 0) return;

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = THREE.MathUtils.lerp(SPARKLE.radiusMin, SPARKLE.radiusMax, Math.random());
    const a = Math.random() * Math.PI * 2;
    const h = THREE.MathUtils.randFloatSpread(0.16);
    positions[i * 3] = basePos.x + Math.cos(a) * r;
    positions[i * 3 + 1] = basePos.y + h;
    positions[i * 3 + 2] = basePos.z + Math.sin(a) * r;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff6e6,
    size: 0.06,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geom, mat);
  points.renderOrder = -2;
  treeGroup.add(points);

  sparkleCount += count;
  sparkles.push({
    material: mat,
    phase: Math.random() * Math.PI * 2,
    speed: THREE.MathUtils.lerp(1.0, 1.8, Math.random()),
    base: 0.22,
    amp: 0.18
  });
}

function addBells(treeGroup, foliageLayers) {
  const bellCount = THREE.MathUtils.randInt(10, 18);
  const yBottom = foliageLayers[0].y + 0.6;
  const yTop = foliageLayers[foliageLayers.length - 1].y - 1.8;
  const bands = [
    THREE.MathUtils.lerp(yBottom, yTop, 0.15),
    THREE.MathUtils.lerp(yBottom, yTop, 0.38),
    THREE.MathUtils.lerp(yBottom, yTop, 0.6),
    THREE.MathUtils.lerp(yBottom, yTop, 0.78)
  ];
  const innerMargin = 0.55;

  const bellMat = new THREE.MeshStandardMaterial({
    color: 0xd8a349,
    roughness: 0.25,
    metalness: 0.85,
    envMapIntensity: FINAL_GRADE.envIntensity * 1.2
  });
  const clapperMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a12,
    roughness: 0.6,
    metalness: 0.1,
    envMapIntensity: FINAL_GRADE.envIntensity * 0.4
  });

  for (let i = 0; i < bellCount; i++) {
    const placement = samplePlacement({
      yRange: [yBottom, yTop],
      rFunc: (y) => Math.max(0.4, getTreeRadiusAtY(y, foliageLayers) - innerMargin),
      minAngleGap: LAYOUT.bell.minAngle,
      minYGap: LAYOUT.bell.minY,
      minRGap: LAYOUT.bell.minR,
      tries: 16,
      weight: LAYOUT.bell.weight,
      yBias: bands
    });
    if (!placement) continue;
    const { angle, y, r } = placement;
    const pos = new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);

    const bell = new THREE.Group();

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), bellMat);
    body.scale.set(1, 1.15, 1);
    body.position.y = 0.06;
    bell.add(body);

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.18, 20), bellMat);
    skirt.position.y = -0.06;
    bell.add(skirt);

    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), clapperMat);
    clapper.position.y = -0.16;
    bell.add(clapper);

    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 16), bellMat);
    hook.position.y = 0.22;
    hook.rotation.x = Math.PI / 2;
    bell.add(hook);

    bell.position.copy(pos);
    bell.lookAt(0, y, 0);
    bell.rotateY(Math.PI);
    bell.renderOrder = -2;

    bells.push({
      group: bell,
      baseRotX: bell.rotation.x,
      baseRotZ: bell.rotation.z,
      phase: Math.random() * Math.PI * 2,
      speed: THREE.MathUtils.lerp(BELL_SWAY.speed[0], BELL_SWAY.speed[1], Math.random()),
      ampX: THREE.MathUtils.lerp(BELL_SWAY.ampX[0], BELL_SWAY.ampX[1], Math.random()),
      ampZ: THREE.MathUtils.lerp(BELL_SWAY.ampZ[0], BELL_SWAY.ampZ[1], Math.random())
    });

    treeGroup.add(bell);
    addSparklesAt(treeGroup, pos);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  if (bloomPass) bloomPass.setSize(window.innerWidth, window.innerHeight);
}


function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const t = (now - t0) * 0.001;
  const dt = Math.min(0.05, (now - lastTime) * 0.001);
  lastTime = now;

  for (let i = 0; i < ornaments.length; i++) {
    const o = ornaments[i];
    const targetZ = o.baseRotZ + Math.sin(t * o.speed + o.phase) * o.ampZ;
    const targetX = o.baseRotX + Math.sin(t * o.speed * 0.7 + o.phase * 1.3) * o.ampX;
    o.group.rotation.z = THREE.MathUtils.lerp(o.group.rotation.z, targetZ, ORNAMENT_SWAY.lerp);
    o.group.rotation.x = THREE.MathUtils.lerp(o.group.rotation.x, targetX, ORNAMENT_SWAY.lerp);
  }

  for (let i = 0; i < bells.length; i++) {
    const b = bells[i];
    const targetZ = b.baseRotZ + Math.sin(t * b.speed + b.phase) * b.ampZ;
    const targetX = b.baseRotX + Math.sin(t * b.speed * 0.7 + b.phase * 1.3) * b.ampX;
    b.group.rotation.z = THREE.MathUtils.lerp(b.group.rotation.z, targetZ, BELL_SWAY.lerp);
    b.group.rotation.x = THREE.MathUtils.lerp(b.group.rotation.x, targetX, BELL_SWAY.lerp);
  }

  const p = (t * WAVE.speed) % 1.0;
  for (let i = 0; i < bulbs.length; i++) {
    const b = bulbs[i];
    const u = b.userData.u || 0;
    const d = Math.abs(u - p);
    const ringD = Math.min(d, 1 - d);
    const w = Math.exp(-(ringD * ringD) / (2 * WAVE.width * WAVE.width));
    const hash = (Math.sin(u * 1234.5) * 43758.5453) % 1;
    const intensity = (WAVE.base + WAVE.peak * w + WAVE.secondary * Math.sin(t * 2 + u * 12.0)) * (0.9 + 0.2 * Math.abs(hash));
    b.material.emissiveIntensity = intensity;
  }

  for (let i = 0; i < sparkles.length; i++) {
    const s = sparkles[i];
    s.material.opacity = s.base + s.amp * Math.sin(t * s.speed + s.phase);
  }


  controls.update();
  if (starMaterial) {
    starMaterial.opacity = 0.7 + 0.25 * Math.sin(t * STAR_TWINKLE_SPEED);
  }
  if (snowSystem) snowSystem.update(dt);
  composer.render();
}

function addStar(treeGroup) {
  // 一个简单“金色星星”：用 Icosahedron + 发光材质（先不做 bloom）
  const star = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0xffc107,
      emissiveIntensity: EMISSIVE_STRONG,
      roughness: 0.18,
      metalness: 0.7,
      envMapIntensity: FINAL_GRADE.envIntensity * 1.1
    })
  );
  star.position.set(0, 10.8, 0);
  treeGroup.add(star);

  // 给星星加一点点点光源（更亮）
  const starLight = new THREE.PointLight(0xfff2b0, 1.8, 25, 2);
  starLight.position.copy(star.position);
  treeGroup.add(starLight);
}


function addSkyDome(targetScene) {
  const geom = new THREE.SphereGeometry(SKY_RADIUS, 48, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(GRADIENT_TOP) },
      bottomColor: { value: new THREE.Color(GRADIENT_BOTTOM) }
    },
    vertexShader: `
      varying float vY;
      void main() {
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying float vY;
      void main() {
        float h = clamp( (vY / ${SKY_RADIUS.toFixed(1)} + 1.0) * 0.5, 0.0, 1.0 );
        vec3 col = mix( bottomColor, topColor, h );
        gl_FragColor = vec4( col, 1.0 );
      }
    `,
    side: THREE.BackSide,
    depthWrite: false
  });

  const dome = new THREE.Mesh(geom, mat);
  targetScene.add(dome);
}

function addStarfield(targetScene) {
  const positions = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = THREE.MathUtils.lerp(STAR_RADIUS_MIN, STAR_RADIUS_MAX, Math.random());

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  starMaterial = new THREE.PointsMaterial({
    color: 0xf8f2ff,
    size: STAR_SIZE,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });

  const stars = new THREE.Points(geom, starMaterial);
  targetScene.add(stars);
}

function createEnvironmentMap(rendererRef) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#1a2742");
  grad.addColorStop(1, "#4a3a62");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const blobs = [
    { x: 0.2, y: 0.35, r: 120, c: "rgba(255,236,210,0.35)" },
    { x: 0.75, y: 0.4, r: 140, c: "rgba(210,225,255,0.3)" },
    { x: 0.5, y: 0.7, r: 90, c: "rgba(255,205,180,0.2)" }
  ];
  blobs.forEach((b) => {
    const cx = b.x * canvas.width;
    const cy = b.y * canvas.height;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r);
    g.addColorStop(0, b.c);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, b.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(rendererRef);
  const envRT = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();

  return envRT.texture;
}

function createSnow(targetScene) {
  const texture = createSnowTexture();

  const makeLayer = (count, size, speedRange, opacity) => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const drifts = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const r = SNOW_BOUNDS.radius * Math.sqrt(Math.random());
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = THREE.MathUtils.lerp(SNOW_BOUNDS.yBottom, SNOW_BOUNDS.yTop, Math.random());
      positions[i * 3 + 2] = Math.sin(angle) * r;

      speeds[i] = THREE.MathUtils.lerp(speedRange[0], speedRange[1], Math.random());
      drifts[i * 2] = THREE.MathUtils.randFloatSpread(WIND_XZ_RANGE);
      drifts[i * 2 + 1] = THREE.MathUtils.randFloatSpread(WIND_XZ_RANGE);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      map: texture,
      size,
      transparent: true,
      opacity,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.NormalBlending
    });

    const points = new THREE.Points(geom, mat);

    return { points, positions, speeds, drifts, count };
  };

  const farLayer = makeLayer(FAR_SNOW_COUNT, FAR_SIZE, FAR_SPEED_RANGE, 0.55);
  const nearLayer = makeLayer(NEAR_SNOW_COUNT, NEAR_SIZE, NEAR_SPEED_RANGE, 0.85);

  targetScene.add(farLayer.points);
  targetScene.add(nearLayer.points);

  const updateLayer = (layer, dt) => {
    const pos = layer.positions;
    for (let i = 0; i < layer.count; i++) {
      const idx = i * 3;
      const driftIdx = i * 2;
      pos[idx + 1] -= layer.speeds[i] * dt;
      pos[idx] += layer.drifts[driftIdx] * dt;
      pos[idx + 2] += layer.drifts[driftIdx + 1] * dt;

      if (pos[idx + 1] < SNOW_BOUNDS.yBottom) {
        const r = SNOW_BOUNDS.radius * Math.sqrt(Math.random());
        const angle = Math.random() * Math.PI * 2;
        pos[idx] = Math.cos(angle) * r;
        pos[idx + 1] = SNOW_BOUNDS.yTop;
        pos[idx + 2] = Math.sin(angle) * r;
      }
    }
    layer.points.geometry.attributes.position.needsUpdate = true;
  };

  return {
    update(dt) {
      updateLayer(farLayer, dt);
      updateLayer(nearLayer, dt);
    }
  };
}

function createSnowTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function smoothNoise(t, freq, amp, seed = 0) {
  return Math.sin(t * freq + seed) * amp
    + Math.sin(t * freq * 0.7 + seed * 2.1) * amp * 0.5;
}

function createCandyStripeTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const stripeW = 26;
  ctx.strokeStyle = "#d92323";
  ctx.lineWidth = stripeW;
  for (let x = -size; x < size * 2; x += stripeW * 2.6) {
    ctx.beginPath();
    ctx.moveTo(x, -size);
    ctx.lineTo(x + size * 1.5, size * 1.5);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 1.2);
  return tex;
}

function registerSlot(angle, y, r, weight) {
  const slot = { angle, y, r, weight };
  occupiedSlots.push(slot);
  return slot;
}

function angleDistance(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, Math.PI * 2 - d);
}

function isSlotFree(candidate, rule) {
  for (let i = 0; i < occupiedSlots.length; i++) {
    const s = occupiedSlots[i];
    const w = s.weight ?? 1;
    if (
      angleDistance(candidate.angle, s.angle) < rule.minAngleGap * w &&
      Math.abs(candidate.y - s.y) < rule.minYGap * w &&
      Math.abs(candidate.r - s.r) < rule.minRGap * w
    ) {
      return false;
    }
  }
  return true;
}

function samplePlacement({ yRange, rFunc, minAngleGap, minYGap, minRGap, tries, weight, yBias }) {
  for (let i = 0; i < tries; i++) {
    const angle = Math.random() * Math.PI * 2;
    let y;
    if (yBias && yBias.length) {
      const band = yBias[i % yBias.length];
      y = band + THREE.MathUtils.randFloatSpread(0.25);
      y = THREE.MathUtils.clamp(y, yRange[0], yRange[1]);
    } else {
      y = THREE.MathUtils.lerp(yRange[0], yRange[1], Math.random());
    }
    const r = rFunc(y);
    const candidate = { angle, y, r };
    if (isSlotFree(candidate, { minAngleGap, minYGap, minRGap })) {
      registerSlot(angle, y, r, weight);
      return candidate;
    }
  }
  return null;
}

