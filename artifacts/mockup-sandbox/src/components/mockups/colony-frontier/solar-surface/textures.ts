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

export function makeDustTexture(kind: "moon" | "mars", size = 512) {
  /*
   * Physical-looking dust layer: broad irregular accumulation + medium clumps
   * + fine powder + sparse individual grains. The alpha channel exposes the
   * solar-cell texture through gaps, avoiding the "colour changed in spots" look.
   */
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);

  const base =
    kind === "mars"
      ? { r: 178, g: 106, b: 67 }
      : { r: 172, g: 168, b: 160 };

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const hash = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;

      const broadA = fbm(nx * 2.7 + 11, ny * 3.1 + 7, 5);
      const broadB = fbm(nx * 6.0 + 31, ny * 4.2 + 19, 4);
      const wind = fbm(nx * 2.0 + ny * 5.5, ny * 15.0 + nx * 1.8, 4);

      const mediumA = fbm(nx * 17.0 + 41, ny * 15.0 + 13, 3);
      const mediumB = fbm(nx * 31.0 + 73, ny * 28.0 + 29, 2);

      const fine = fbm(nx * 72.0 + 101, ny * 68.0 + 47, 2);
      const grain = hash(Math.floor(nx * size * 0.72), Math.floor(ny * size * 0.72));

      const broad = clamp01((broadA * 0.58 + broadB * 0.18 + wind * 0.24 - 0.43) / 0.40);
      const brokenMedium = clamp01((mediumA * 0.62 + mediumB * 0.38 - 0.50) / 0.28);

      const coverage = clamp01(
        broad * 0.72 +
        broad * brokenMedium * 0.34 +
        Math.max(0, fine - 0.54) * 0.62 +
        Math.max(0, grain - 0.72) * 0.18,
      );

      const powder = Math.pow(coverage, 0.82);
      const localShade =
        (mediumA - 0.5) * 18 +
        (fine - 0.5) * 13 +
        (grain - 0.5) * 9;
      const warmShift = kind === "mars" ? (mediumB - 0.5) * 12 : 0;

      const r = clamp01((base.r + localShade + warmShift) / 255) * 255;
      const g = clamp01((base.g + localShade * 0.82 + warmShift * 0.52) / 255) * 255;
      const b = clamp01((base.b + localShade * 0.70 + warmShift * 0.34) / 255) * 255;

      const i = (y * size + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = Math.round(powder * 255);
    }
  }

  ctx.putImageData(image, 0, 0);

  // Sparse individual grains add fine physical texture at normal viewing distance.
  ctx.globalCompositeOperation = "source-over";
  const grainCount = kind === "mars" ? 4200 : 3600;
  for (let i = 0; i < grainCount; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 0.35 + Math.random() * 1.7;
    const alpha = 0.025 + Math.random() * 0.11;
    const tone = kind === "mars"
      ? `rgba(205, 139, 96, ${alpha})`
      : `rgba(204, 201, 193, ${alpha})`;

    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      radius * (0.7 + Math.random() * 0.9),
      radius * (0.45 + Math.random() * 0.7),
      Math.random() * Math.PI,
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