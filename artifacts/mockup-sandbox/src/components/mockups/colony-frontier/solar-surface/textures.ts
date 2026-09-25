import * as THREE from "three";
import { fbm } from "./noise";

export function makeSolarCellTexture(cols = 8, rows = 4) {
  const cell = 128;
  const gap = 10;
  const w = cols * cell;
  const h = rows * cell;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a0c14";
  ctx.fillRect(0, 0, w, h);

  for (let cy = 0; cy < rows; cy += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      const x = cx * cell;
      const y = cy * cell;
      const grad = ctx.createLinearGradient(x, y, x + cell, y + cell);
      grad.addColorStop(0, "#16306b");
      grad.addColorStop(0.45, "#1d3f8f");
      grad.addColorStop(0.5, "#3358c0");
      grad.addColorStop(0.55, "#1d3f8f");
      grad.addColorStop(1, "#0f2350");
      ctx.fillStyle = grad;
      ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);

      ctx.strokeStyle = "rgba(200,210,225,0.55)";
      ctx.lineWidth = 2;
      for (let b = 1; b <= 2; b += 1) {
        const bx = x + (cell * b) / 3;
        ctx.beginPath();
        ctx.moveTo(bx, y + gap / 2);
        ctx.lineTo(bx, y + cell - gap / 2);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(150,170,200,0.18)";
      ctx.lineWidth = 1;
      for (let g = 1; g < 10; g += 1) {
        const gy = y + (cell * g) / 10;
        ctx.beginPath();
        ctx.moveTo(x + gap / 2, gy);
        ctx.lineTo(x + cell - gap / 2, gy);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeCellEmissiveTexture(cols = 8, rows = 4) {
  const cell = 128;
  const gap = 10;
  const w = cols * cell;
  const h = rows * cell;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  for (let cy = 0; cy < rows; cy += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      const x = cx * cell;
      const y = cy * cell;
      const g = ctx.createRadialGradient(
        x + cell / 2,
        y + cell / 2,
        4,
        x + cell / 2,
        y + cell / 2,
        cell * 0.7,
      );
      g.addColorStop(0, "#2748b0");
      g.addColorStop(1, "#01030a");
      ctx.fillStyle = g;
      ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
    }
  }

  return new THREE.CanvasTexture(canvas);
}

const PALETTES = {
  moon: { base: [138, 134, 128], dark: [70, 68, 66], light: [186, 182, 176] },
  mars: { base: [150, 82, 52], dark: [86, 44, 30], light: [196, 122, 84] },
} as const;

export function makeTerrainTexture(kind: "moon" | "mars", size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  const palette = PALETTES[kind];
  const scale = 6;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / size) * scale;
      const ny = (y / size) * scale;
      let n = fbm(nx, ny, 6);
      const grain = fbm(nx * 12, ny * 12, 3);
      n = n * 0.8 + grain * 0.2;

      let red: number;
      let green: number;
      let blue: number;

      if (n < 0.4) {
        const t = n / 0.4;
        red = palette.dark[0] + (palette.base[0] - palette.dark[0]) * t;
        green = palette.dark[1] + (palette.base[1] - palette.dark[1]) * t;
        blue = palette.dark[2] + (palette.base[2] - palette.dark[2]) * t;
      } else {
        const t = (n - 0.4) / 0.6;
        red = palette.base[0] + (palette.light[0] - palette.base[0]) * t;
        green = palette.base[1] + (palette.light[1] - palette.base[1]) * t;
        blue = palette.base[2] + (palette.light[2] - palette.base[2]) * t;
      }

      const speck = fbm(nx * 30 + 100, ny * 30 + 100, 2);
      if (speck > 0.78) {
        red *= 0.6;
        green *= 0.6;
        blue *= 0.6;
      }

      const i = (y * size + x) * 4;
      image.data[i] = red;
      image.data[i + 1] = green;
      image.data[i + 2] = blue;
      image.data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function makeDustTexture(kind: "moon" | "mars", size = 512, seedInput?: number) {
  /*
   * Dense particulate dust layer.
   *
   * The texture deliberately avoids a uniform colour wash: it combines
   * large irregular deposits, medium clumps, wind streaks, fine powder and
   * individual grains. A seeded RNG keeps each terrain deterministic while
   * still making every patch spatially unpredictable.
   */
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);

  const base =
    kind === "mars"
      ? { r: 177, g: 101, b: 63 }
      : { r: 171, g: 167, b: 158 };

  // Keep the hub deterministic, while panel arrays can request a fresh seed.
  let seed = Math.floor(
    seedInput ?? (kind === "mars" ? 0x4f1bbcdc : 0x91e2a5d7),
  ) | 0;
  if (seed === 0) seed = 0x6d2b79f5;
  const random = () => {
    seed |= 0;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const phase = {
    ax: random() * 90,
    ay: random() * 90,
    bx: random() * 90,
    by: random() * 90,
    cx: random() * 90,
    cy: random() * 90,
    wx: random() * 90,
    wy: random() * 90,
    vx: random() * 90,
    vy: random() * 90,
    mx: random() * 90,
    my: random() * 90,
    fx: random() * 90,
    fy: random() * 90,
    qx: random() * 90,
    qy: random() * 90,
  };
  const hash = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + (kind === "mars" ? 17.3 : 41.9)) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;

      const broadA = fbm(nx * 2.2 + 3.7 + phase.ax, ny * 2.7 + 11.4 + phase.ay, 5);
      const broadB = fbm(nx * 4.9 + 37.0 + phase.bx, ny * 3.6 + 23.0 + phase.by, 4);
      const broadC = fbm(nx * 9.5 + 71.0 + phase.cx, ny * 7.0 + 5.0 + phase.cy, 3);

      const windA = fbm(nx * 2.5 + ny * 7.0 + 101 + phase.wx, ny * 18.0 + nx * 1.2 + 19 + phase.wy, 4);
      const windB = fbm(nx * 4.0 + ny * 13.0 + 211 + phase.vx, ny * 32.0 + nx * 2.0 + 31 + phase.vy, 3);

      const mediumA = fbm(nx * 16.0 + 43 + phase.mx, ny * 14.0 + 17 + phase.my, 3);
      const mediumB = fbm(nx * 31.0 + 83 + phase.fx, ny * 27.0 + 29 + phase.fy, 2);
      const fine = fbm(nx * 78.0 + 109 + phase.qx, ny * 72.0 + 53 + phase.qy, 2);
      const micro = fbm(nx * 170.0 + 401 + phase.cx + phase.qx, ny * 145.0 + 197 + phase.cy + phase.qy, 1);
      const grain = hash(Math.floor(nx * size * 0.75), Math.floor(ny * size * 0.75));

      const broadField = clamp01(
        (broadA * 0.45 + broadB * 0.25 + broadC * 0.30 - 0.39) / 0.42,
      );

      // Broken bands create wind-swept ribbons rather than smooth blobs.
      const streakField = clamp01(
        (windA * 0.58 + windB * 0.42 - 0.48) / 0.26,
      );

      const clumpField = clamp01(
        (mediumA * 0.58 + mediumB * 0.42 - 0.50) / 0.24,
      );

      const powder = clamp01(
        broadField * 0.62 +
          streakField * 0.30 +
          broadField * clumpField * 0.48 +
          Math.max(0, fine - 0.43) * 0.68 +
          Math.max(0, micro - 0.50) * 0.20 +
          Math.max(0, grain - 0.69) * 0.14,
      );

      // Keep the layer particulate: strong density changes create visible
      // islands, feathered edges and thin translucent gaps instead of a flat tint.
      const density = Math.pow(powder, 0.92);
      const localShade =
        (mediumA - 0.5) * 30 +
        (mediumB - 0.5) * 24 +
        (fine - 0.5) * 18 +
        (micro - 0.5) * 10;

      const warmShift =
        kind === "mars"
          ? (broadB - 0.5) * 22 + (windB - 0.5) * 10
          : (broadB - 0.5) * 10;

      const r = Math.round(clamp01((base.r + localShade + warmShift) / 255) * 255);
      const g = Math.round(clamp01((base.g + localShade * 0.78 + warmShift * 0.48) / 255) * 255);
      const b = Math.round(clamp01((base.b + localShade * 0.62 + warmShift * 0.28) / 255) * 255);

      // At full dust this can become visually dense, but the floor keeps
      // tiny gaps between grains so the panel never becomes a solid paint layer.
      const alpha = Math.round(
        (0.008 + Math.pow(density, 1.05) * 0.965) * 255,
      );

      const i = (y * size + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = alpha;
    }
  }

  ctx.putImageData(image, 0, 0);

  // Large, irregular dust islands.
  const clumpCount = kind === "mars" ? 380 : 320;
  for (let i = 0; i < clumpCount; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const rx = 3 + random() * (kind === "mars" ? 28 : 24);
    const ry = 2 + random() * (kind === "mars" ? 18 : 16);
    const rotation = random() * Math.PI;
    const alpha = 0.055 + random() * 0.22;
    const tone = kind === "mars"
      ? 192 + Math.floor(random() * 22)
      : 184 + Math.floor(random() * 22);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    gradient.addColorStop(0, kind === "mars"
      ? `rgba(${tone}, ${Math.max(105, tone - 75)}, ${Math.max(67, tone - 118)}, ${alpha})`
      : `rgba(${tone}, ${tone - 4}, ${tone - 12}, ${alpha})`);
    gradient.addColorStop(0.45, kind === "mars"
      ? `rgba(${tone - 12}, ${Math.max(90, tone - 90)}, ${Math.max(58, tone - 125)}, ${alpha * 0.66})`
      : `rgba(${tone - 12}, ${tone - 14}, ${tone - 20}, ${alpha * 0.66})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Wind-driven streaks with broken opacity.
  const streakCount = kind === "mars" ? 260 : 220;
  for (let i = 0; i < streakCount; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const length = 8 + random() * 46;
    const width = 0.7 + random() * 3.5;
    const angle = (random() - 0.5) * Math.PI;
    const alpha = 0.045 + random() * 0.13;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = kind === "mars"
      ? `rgba(205, 132, 88, ${alpha})`
      : `rgba(205, 200, 190, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = "round";

    ctx.beginPath();
    const segments = 2 + Math.floor(random() * 4);
    for (let s = 0; s < segments; s += 1) {
      const start = (s / segments) * length + random() * 2;
      const end = Math.min(length, start + length / segments * (0.45 + random() * 0.8));
      if (end <= start) continue;
      ctx.moveTo(start, (random() - 0.5) * width * 0.6);
      ctx.lineTo(end, (random() - 0.5) * width);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Thousands of distinct grains make the surface read as accumulated particles
  // rather than a material recolour.
  const grainCount = kind === "mars" ? 11500 : 9800;
  for (let i = 0; i < grainCount; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 0.25 + random() * (kind === "mars" ? 1.85 : 1.55);
    const alpha = 0.035 + random() * 0.16;
    const tone = kind === "mars"
      ? `rgba(${190 + Math.floor(random() * 35)}, ${118 + Math.floor(random() * 32)}, ${78 + Math.floor(random() * 26)}, ${alpha})`
      : `rgba(${190 + Math.floor(random() * 28)}, ${186 + Math.floor(random() * 27)}, ${178 + Math.floor(random() * 25)}, ${alpha})`;

    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      radius * (0.55 + random() * 1.35),
      radius * (0.45 + random() * 0.95),
      random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

