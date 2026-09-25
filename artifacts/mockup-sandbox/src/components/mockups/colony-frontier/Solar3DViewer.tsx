import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Maximize2, MousePointer2, Rotate3D, X, ZoomIn } from "lucide-react";
import { tierMeta, type Tier } from "./_shared/gameData";

type Vec3 = { x: number; y: number; z: number };
type Mat4 = number[];

type SolarComponent = {
  id: number;
  name: string;
  short: string;
  function: string;
  principle: string;
  detail: string;
  realBasis: string;
  anchor: Vec3;
  color: [number, number, number];
};

type DrawObject = {
  geometry: Geometry;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: [number, number, number];
  componentId: number;
};

type Geometry = {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
};

const COMPONENTS: SolarComponent[] = [
  {
    id: 1,
    name: "Roll-Out Photovoltaic Wing",
    short: "PV ARRAY",
    function: "Converts sunlight into electrical power.",
    principle: "Photovoltaic effect",
    detail: "This wing represents a high-performance deployable spacecraft solar array. The blue cells are arranged in strings and sub-panels, with structural members underneath maintaining the deployed geometry. Real deployable arrays trade packed launch volume against deployed area, structural stiffness and pointing accuracy.",
    realBasis: "ROSA / iROSA deployable solar-array architecture; III-V multi-junction space cells.",
    anchor: { x: -330, y: 0, z: 0 },
    color: [0.18, 0.52, 0.72],
  },
  {
    id: 2,
    name: "Roll-Out Photovoltaic Wing",
    short: "PV ARRAY",
    function: "Provides the second independent generation wing.",
    principle: "Solar incidence + electrical series/parallel connection",
    detail: "The second wing is deliberately modeled as an independent power-generating branch. Redundant generation improves resilience and gives the power system another source if a branch or deployment mechanism becomes unavailable.",
    realBasis: "ISS iROSA dual-wing augmentation concept and modern spacecraft array redundancy.",
    anchor: { x: 330, y: 0, z: 0 },
    color: [0.18, 0.52, 0.72],
  },
  {
    id: 3,
    name: "Array Deployment Boom",
    short: "DEPLOYMENT BOOM",
    function: "Supports and deploys the solar blanket.",
    principle: "Elastic structural deployment",
    detail: "The long boom carries the blanket during launch, deployment and operation. Roll-out array systems use stored strain energy and controlled mechanisms to move from a compact stowed package to a large deployed collecting area.",
    realBasis: "NASA / Boeing ROSA and iROSA technology demonstrations.",
    anchor: { x: -180, y: 12, z: 0 },
    color: [0.64, 0.69, 0.68],
  },
  {
    id: 4,
    name: "Rotary Deployment Joint",
    short: "ARRAY GIMBAL",
    function: "Changes array orientation relative to the Sun.",
    principle: "Angular kinematics",
    detail: "A controlled rotary joint changes the array normal so sunlight strikes the cells from a more favorable direction. The joint also carries deployment and operational loads through the root of the wing.",
    realBasis: "Spacecraft solar-array drive assemblies and ISS solar-array pointing hardware.",
    anchor: { x: -108, y: 0, z: 0 },
    color: [0.82, 0.48, 0.22],
  },
  {
    id: 5,
    name: "Power Processing Unit",
    short: "PPU",
    function: "Regulates photovoltaic output for the electrical bus.",
    principle: "DC power conversion + maximum-power-point control",
    detail: "The power-processing electronics convert the changing electrical output of the solar array into a controlled bus supply. The system can regulate voltage, limit current and operate the array near its useful power-producing point.",
    realBasis: "Spacecraft electrical power systems and photovoltaic power conditioning electronics.",
    anchor: { x: 54, y: 38, z: 82 },
    color: [0.83, 0.59, 0.30],
  },
  {
    id: 6,
    name: "Rechargeable Battery Pack",
    short: "BATTERY",
    function: "Stores energy for eclipse and peak-demand periods.",
    principle: "Electrochemical energy storage",
    detail: "The battery sits inside the protected power bus architecture. It absorbs surplus generation and returns energy when the solar wings are shadowed or the load exceeds instantaneous generation.",
    realBasis: "Aerospace lithium-ion battery packs and spacecraft battery-management architectures.",
    anchor: { x: -8, y: 38, z: 8 },
    color: [0.49, 0.70, 0.50],
  },
  {
    id: 7,
    name: "Thermal Radiator",
    short: "RADIATOR",
    function: "Rejects waste heat to space.",
    principle: "Thermal radiation",
    detail: "Power electronics and batteries produce waste heat. In vacuum there is essentially no atmospheric convection, so a radiator presents a controlled high-emissivity surface that radiates thermal energy to space.",
    realBasis: "Spacecraft radiator panels and pumped thermal-control systems.",
    anchor: { x: 15, y: 8, z: -86 },
    color: [0.30, 0.65, 0.73],
  },
  {
    id: 8,
    name: "Power & Avionics Controller",
    short: "AVIONICS",
    function: "Monitors array health and coordinates the power system.",
    principle: "Feedback control + fault management",
    detail: "Voltage, current, temperature, deployment position and other measurements are fed into the controller. It can command pointing, isolate faults and keep healthy branches operating when another component degrades.",
    realBasis: "Distributed spacecraft avionics, electrical power management and fault-detection systems.",
    anchor: { x: 72, y: 82, z: 30 },
    color: [0.61, 0.48, 0.78],
  },
  {
    id: 9,
    name: "Electrical Harness & Wing Interface",
    short: "HARNESS",
    function: "Carries generated power between the wings and the spacecraft bus.",
    principle: "Electrical conduction + mechanical strain relief",
    detail: "Flexible electrical paths cross the deployment interface while allowing the wing to move. Real space harnesses must manage insulation, vibration, thermal cycling, current capacity and mechanical strain.",
    realBasis: "Spacecraft power harnesses, rotary electrical interfaces and solar-array electrical routing.",
    anchor: { x: -72, y: 45, z: 30 },
    color: [0.75, 0.30, 0.17],
  },
];

const SOLAR_REFERENCE = "https://www.nasa.gov/missions/station/new-solar-arrays-to-power-nasas-international-space-station-research/";

function identity(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      for (let k = 0; k < 4; k += 1) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
    }
  }
  return out;
}

function perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ];
}

function translation(x: number, y: number, z: number): Mat4 {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function scaling(x: number, y: number, z: number): Mat4 {
  const out = identity();
  out[0] = x;
  out[5] = y;
  out[10] = z;
  return out;
}

function rotationX(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

function rotationY(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

function rotationZ(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function modelMatrix(position: Vec3, rotation: Vec3, scale: Vec3): Mat4 {
  return multiply(
    translation(position.x, position.y, position.z),
    multiply(
      rotationZ(rotation.z),
      multiply(rotationY(rotation.y), multiply(rotationX(rotation.x), scaling(scale.x, scale.y, scale.z))),
    ),
  );
}

function lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  const dx = center.x - eye.x;
  const dy = center.y - eye.y;
  const dz = center.z - eye.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  const fx = dx / length, fy = dy / length, fz = dz / length;
  const sx = fy * up.z - fz * up.y;
  const sy = fz * up.x - fx * up.z;
  const sz = fx * up.y - fy * up.x;
  const sl = Math.hypot(sx, sy, sz) || 1;
  const rx = sx / sl, ry = sy / sl, rz = sz / sl;
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;
  return [
    rx, ux, -fx, 0,
    ry, uy, -fy, 0,
    rz, uz, -fz, 0,
    -(rx * eye.x + ry * eye.y + rz * eye.z),
    -(ux * eye.x + uy * eye.y + uz * eye.z),
    fx * eye.x + fy * eye.y + fz * eye.z,
    1,
  ];
}

function transformPoint(m: Mat4, p: Vec3) {
  const x = p.x, y = p.y, z = p.z;
  return {
    x: m[0] * x + m[4] * y + m[8] * z + m[12],
    y: m[1] * x + m[5] * y + m[9] * z + m[13],
    z: m[2] * x + m[6] * y + m[10] * z + m[14],
    w: m[3] * x + m[7] * y + m[11] * z + m[15],
  };
}

function makeBox(): Geometry {
  const p = [
    -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
    -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,
  ];
  const n = [
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
  ];
  const vertices = new Float32Array([
    -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
    -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,
    -1,-1,-1, -1,1,-1, -1,1,1, -1,-1,1,
    1,-1,-1, 1,-1,1, 1,1,1, 1,1,-1,
    -1,-1,-1, -1,-1,1, 1,-1,1, 1,-1,-1,
    -1,1,-1, 1,1,-1, 1,1,1, -1,1,1,
  ]);
  const normals = new Float32Array(n);
  const indices = new Uint16Array(Array.from({ length: 6 }, (_, face) => {
    const o = face * 4;
    return [o, o + 1, o + 2, o, o + 2, o + 3];
  }).flat());
  return { vertices, normals, indices };
}

function makeCylinder(segments = 24): Geometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = i * Math.PI * 2 / segments;
    const x = Math.cos(a), z = Math.sin(a);
    vertices.push(x, -1, z, x, 1, z);
    normals.push(x, 0, z, x, 0, z);
  }
  const topCenter = vertices.length / 3;
  vertices.push(0, 1, 0); normals.push(0, 1, 0);
  const bottomCenter = vertices.length / 3;
  vertices.push(0, -1, 0); normals.push(0, -1, 0);
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const b = i * 2;
    const n = next * 2;
    indices.push(b, n, b + 1, n, n + 1, b + 1);
    indices.push(topCenter, b + 1, n + 1);
    indices.push(bottomCenter, n, b);
  }
  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

function makeSphere(segments = 20, rings = 12): Geometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= rings; y += 1) {
    const v0 = y / rings;
    const phi = v0 * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x <= segments; x += 1) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const st = Math.sin(theta), ct = Math.cos(theta);
      vertices.push(sp * ct, cp, sp * st);
      normals.push(sp * ct, cp, sp * st);
    }
  }
  for (let y = 0; y < rings; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

function buildSolarObjects(geometries: { box: Geometry; cylinder: Geometry; sphere: Geometry }): DrawObject[] {
  const objects: DrawObject[] = [];
  const add = (
    componentId: number,
    position: Vec3,
    scale: Vec3,
    color: [number, number, number],
    geometry: Geometry,
    rotation: Vec3 = { x: 0, y: 0, z: 0 },
  ) => objects.push({ geometry, position, rotation, scale, color, componentId });

  // Spacecraft bus / protected central power system.
  add(5, { x: 0, y: 28, z: 5 }, { x: 58, y: 46, z: 48 }, [0.50, 0.54, 0.53], geometries.box);
  add(6, { x: -8, y: 18, z: -4 }, { x: 39, y: 26, z: 32 }, [0.22, 0.38, 0.29], geometries.box);
  add(8, { x: 72, y: 32, z: 12 }, { x: 20, y: 20, z: 24 }, [0.33, 0.24, 0.48], geometries.box);
  add(5, { x: 56, y: 52, z: 52 }, { x: 25, y: 18, z: 15 }, [0.85, 0.60, 0.29], geometries.box);

  // Radiator and thermal backplane.
  add(7, { x: 0, y: 6, z: -86 }, { x: 78, y: 43, z: 2.5 }, [0.20, 0.54, 0.64], geometries.box);
  for (let i = -5; i <= 5; i += 1) {
    add(7, { x: i * 13, y: 6, z: -83 }, { x: 0.7, y: 39, z: 1 }, [0.72, 0.83, 0.82], geometries.box);
  }

  // Left / right deployment booms.
  add(3, { x: -155, y: 10, z: 0 }, { x: 92, y: 4.5, z: 4.5 }, [0.64, 0.69, 0.68], geometries.box);
  add(3, { x: 155, y: 10, z: 0 }, { x: 92, y: 4.5, z: 4.5 }, [0.64, 0.69, 0.68], geometries.box);

  // Array drive joints.
  add(4, { x: -94, y: 10, z: 0 }, { x: 13, y: 13, z: 13 }, [0.82, 0.48, 0.22], geometries.cylinder, { x: 0, y: 0, z: Math.PI / 2 });
  add(4, { x: 94, y: 10, z: 0 }, { x: 13, y: 13, z: 13 }, [0.82, 0.48, 0.22], geometries.cylinder, { x: 0, y: 0, z: Math.PI / 2 });

  // Electrical harness runs.
  add(9, { x: -55, y: 40, z: 30 }, { x: 38, y: 1.5, z: 1.5 }, [0.72, 0.23, 0.13], geometries.box);
  add(9, { x: 55, y: 40, z: 30 }, { x: 38, y: 1.5, z: 1.5 }, [0.72, 0.23, 0.13], geometries.box);

  // Each wing is built from a rigid frame plus many individual photovoltaic cells.
  for (const side of [-1, 1]) {
    const startX = side * 115;
    for (let col = 0; col < 8; col += 1) {
      for (let row = 0; row < 6; row += 1) {
        const x = startX + side * col * 32;
        const y = -36 + row * 16;
        add(side < 0 ? 1 : 2, { x, y, z: 0 }, { x: 14, y: 6.2, z: 7 }, [0.10, 0.29 + row * 0.006, 0.47 + col * 0.006], geometries.box);
        add(side < 0 ? 1 : 2, { x, y: y + 0.1, z: 7.3 }, { x: 12.5, y: 0.5, z: 0.6 }, [0.73, 0.79, 0.80], geometries.box);
      }
    }
    // Outer rails and cross members.
    add(side < 0 ? 1 : 2, { x: side * 242, y: 5, z: 0 }, { x: 3, y: 55, z: 3 }, [0.67, 0.72, 0.71], geometries.box);
    for (let row = -2; row <= 2; row += 1) {
      add(side < 0 ? 1 : 2, { x: side * 235, y: row * 28, z: 0 }, { x: 5, y: 1.8, z: 50 }, [0.68, 0.72, 0.72], geometries.box);
    }
  }

  // Advanced array-control electronics and redundant interface housings.
  add(8, { x: -73, y: 72, z: 44 }, { x: 18, y: 12, z: 18 }, [0.45, 0.34, 0.62], geometries.box);
  add(8, { x: 73, y: 72, z: 44 }, { x: 18, y: 12, z: 18 }, [0.45, 0.34, 0.62], geometries.box);
  add(4, { x: -106, y: 10, z: 19 }, { x: 8, y: 8, z: 12 }, [0.82, 0.48, 0.22], geometries.cylinder);
  add(4, { x: 106, y: 10, z: 19 }, { x: 8, y: 8, z: 12 }, [0.82, 0.48, 0.22], geometries.cylinder);

  // A compact sensor package gives the model an actual spacecraft-instrument feel.
  add(8, { x: 0, y: 76, z: -6 }, { x: 10, y: 10, z: 10 }, [0.72, 0.74, 0.77], geometries.sphere);

  return objects;
}

function projectScreen(point: Vec3, state: { yaw: number; pitch: number; distance: number }, width: number, height: number) {
  const camera = {
    x: Math.sin(state.yaw) * Math.cos(state.pitch) * state.distance,
    y: Math.sin(state.pitch) * state.distance,
    z: Math.cos(state.yaw) * Math.cos(state.pitch) * state.distance,
  };
  const view = lookAt(camera, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  const projection = perspective(Math.PI / 4.2, Math.max(1, width / height), 20, 4000);
  const clip = transformPoint(multiply(projection, view), point);
  if (!clip.w) return null;
  return {
    x: width * (clip.x / clip.w + 1) / 2,
    y: height * (1 - clip.y / clip.w) / 2,
    depth: clip.z / clip.w,
  };
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create WebGL shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Shader compilation failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, \`
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uMVP;
    uniform mat4 uModel;
    varying vec3 vNormal;
    varying float vDepth;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vNormal = mat3(uModel) * aNormal;
      vDepth = -world.z;
      gl_Position = uMVP * vec4(aPosition, 1.0);
    }
  \`);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, \`
    precision mediump float;
    uniform vec3 uColor;
    uniform float uSelected;
    varying vec3 vNormal;
    varying float vDepth;
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightA = normalize(vec3(0.6, 0.8, 0.35));
      vec3 lightB = normalize(vec3(-0.35, -0.2, 0.7));
      float diffuse = max(dot(normal, lightA), 0.0) * 0.72 + max(dot(normal, lightB), 0.0) * 0.25;
      float rim = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
      vec3 lit = uColor * (0.22 + diffuse) + vec3(0.12, 0.16, 0.17) * rim;
      if (uSelected > 0.5) lit += vec3(0.26, 0.22, 0.06);
      gl_FragColor = vec4(lit, 1.0);
    }
  \`);
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create WebGL program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "WebGL program link failed");
  }
  return program;
}

function SolarCanvas({
  selected,
  setSelected,
}: {
  selected: number;
  setSelected: (id: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    yaw: -0.52,
    pitch: -0.18,
    distance: 730,
    dragging: false,
    moved: false,
    lastX: 0,
    lastY: 0,
  });

  const anchors = useMemo(() => COMPONENTS.map((component) => ({ id: component.id, point: component.anchor })), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) return;

    let program: WebGLProgram;
    try {
      program = createProgram(gl);
    } catch {
      return;
    }

    const box = makeBox();
    const cylinder = makeCylinder();
    const sphere = makeSphere();
    const objects = buildSolarObjects({ box, cylinder, sphere });

    const posLocation = gl.getAttribLocation(program, "aPosition");
    const normalLocation = gl.getAttribLocation(program, "aNormal");
    const mvpLocation = gl.getUniformLocation(program, "uMVP");
    const modelLocation = gl.getUniformLocation(program, "uModel");
    const colorLocation = gl.getUniformLocation(program, "uColor");
    const selectedLocation = gl.getUniformLocation(program, "uSelected");

    const buffers = new Map<Geometry, { position: WebGLBuffer; normal: WebGLBuffer; index: WebGLBuffer }>();

    for (const geometry of [box, cylinder, sphere]) {
      const position = gl.createBuffer();
      const normal = gl.createBuffer();
      const index = gl.createBuffer();
      if (!position || !normal || !index) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, position);
      gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, normal);
      gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
      buffers.set(geometry, { position, normal, index });
    }

    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const setSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      return { width: rect.width, height: rect.height };
    };

    const project = (point: Vec3, width: number, height: number) => {
      const s = state.current;
      const camera = {
        x: Math.sin(s.yaw) * Math.cos(s.pitch) * s.distance,
        y: Math.sin(s.pitch) * s.distance,
        z: Math.cos(s.yaw) * Math.cos(s.pitch) * s.distance,
      };
      const view = lookAt(camera, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
      const proj = perspective(Math.PI / 4.2, Math.max(1, width / height), 20, 4000);
      const clip = transformPoint(multiply(proj, view), point);
      if (clip.w === 0) return null;
      const nx = clip.x / clip.w;
      const ny = clip.y / clip.w;
      return { x: width * (nx + 1) / 2, y: height * (1 - ny) / 2, z: clip.z / clip.w };
    };

    let frameId = 0;
    const draw = () => {
      const { width, height } = setSize();
      const s = state.current;
      const camera = {
        x: Math.sin(s.yaw) * Math.cos(s.pitch) * s.distance,
        y: Math.sin(s.pitch) * s.distance,
        z: Math.cos(s.yaw) * Math.cos(s.pitch) * s.distance,
      };
      const view = lookAt(camera, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
      const projection = perspective(Math.PI / 4.2, Math.max(1, width / height), 20, 4000);

      gl.clearColor(0.015, 0.037, 0.046, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);

      const ordered = [...objects].sort((a, b) => {
        const aZ = transformPoint(view, a.position).z;
        const bZ = transformPoint(view, b.position).z;
        return aZ - bZ;
      });

      for (const object of ordered) {
        const buffersForObject = buffers.get(object.geometry);
        if (!buffersForObject) continue;
        const model = modelMatrix(object.position, object.rotation, object.scale);
        const mvp = multiply(projection, multiply(view, model));

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersForObject.position);
        gl.enableVertexAttribArray(posLocation);
        gl.vertexAttribPointer(posLocation, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersForObject.normal);
        gl.enableVertexAttribArray(normalLocation);
        gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersForObject.index);
        gl.uniformMatrix4fv(mvpLocation, false, new Float32Array(mvp));
        gl.uniformMatrix4fv(modelLocation, false, new Float32Array(model));
        gl.uniform3fv(colorLocation, new Float32Array(object.color));
        gl.uniform1f(selectedLocation, object.componentId === selected ? 1 : 0);
        gl.drawElements(gl.TRIANGLES, object.geometry.indices.length, gl.UNSIGNED_SHORT, 0);
      }

      frameId = window.requestAnimationFrame(draw);
    };

    const resizeObserver = new ResizeObserver(() => setSize());
    resizeObserver.observe(canvas);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      // Normal browser direction: wheel up zooms in, wheel down zooms out.
      state.current.distance = Math.max(360, Math.min(1200, state.current.distance + event.deltaY * 0.9));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    frameId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      for (const entry of buffers.values()) {
        gl.deleteBuffer(entry.position);
        gl.deleteBuffer(entry.normal);
        gl.deleteBuffer(entry.index);
      }
      gl.deleteProgram(program);
    };
  }, [selected, setSelected, anchors]);

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    state.current.dragging = true;
    state.current.moved = false;
    state.current.lastX = event.clientX;
    state.current.lastY = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!state.current.dragging) return;
    const dx = event.clientX - state.current.lastX;
    const dy = event.clientY - state.current.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 4) state.current.moved = true;
    state.current.yaw += dx * 0.008;
    state.current.pitch = Math.max(-1.1, Math.min(1.1, state.current.pitch + dy * 0.006));
    state.current.lastX = event.clientX;
    state.current.lastY = event.clientY;
  }

  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    state.current.dragging = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!state.current.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const projected = anchors
        .map((anchor) => ({
          id: anchor.id,
          point: projectScreen(anchor.point, state.current, rect.width, rect.height),
        }))
        .filter((item) => item.point !== null)
        .map((item) => ({
          id: item.id,
          point: item.point as { x: number; y: number; depth: number },
          distance: Math.hypot((item.point as { x: number; y: number }).x - x, (item.point as { x: number; y: number }).y - y),
        }))
        .sort((a, b) => a.distance - b.distance);

      const hit = projected.find((item) => item.distance < 58);
      if (hit) setSelected(hit.id);
    }
  }

  return (
    <div className="relative h-[620px] overflow-hidden border border-[#2c4b50] bg-[#03090e]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,#173943_0%,#0a1d25_42%,#02070b_78%)]" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      />

      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
        <span className="border border-[#46625f] bg-[#071218]/90 px-3 py-2 text-[8px] font-bold uppercase tracking-[.18em] text-[#d6e4df] backdrop-blur-sm">
          ADVANCED SOLAR POWER SYSTEM · REAL 3D
        </span>
        <span className="border border-[#46625f] bg-[#071218]/90 px-3 py-2 text-[8px] uppercase tracking-[.15em] text-[#79b9c7] backdrop-blur-sm">
          ONE INTEGRATED REFERENCE MODEL
        </span>
      </div>

      <div className="absolute bottom-4 left-4 border border-[#3c5659] bg-[#061016]/90 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.14em] text-[#92aaa3]">
          <MousePointer2 className="h-3.5 w-3.5 text-[#efb658]" />
          Drag to rotate
        </div>
        <div className="mt-1 flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.14em] text-[#92aaa3]">
          <ZoomIn className="h-3.5 w-3.5 text-[#efb658]" />
          Wheel up / down to zoom
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ component, tier, onClose }: { component: SolarComponent; tier: Tier; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#010609]/95 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto border border-[#526d68] bg-[#091820] shadow-[0_35px_120px_rgba(0,0,0,.9)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#29434a] bg-[#0c2027] p-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.2em]" style={{ color: tierMeta[tier].color }}>Solar component {String(component.id).padStart(2, "0")} · deep technical view</p>
            <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[.09em] text-[#eef3e7]">{component.name}</h2>
            <p className="mt-2 text-sm text-[#72b9d4]">{component.function}</p>
          </div>
          <button type="button" onClick={onClose} className="border border-[#435d5a] p-2 text-[#b8cbc4] hover:border-[#efb658]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-2">
          <section className="border border-[#3d5b50] bg-[#0d2028] p-5">
            <p className="text-[9px] font-bold uppercase tracking-[.19em]" style={{ color: tierMeta[tier].color }}>Engineering principle</p>
            <h3 className="mt-2 text-xl font-semibold text-[#e8eee8]">{component.principle}</h3>
            <p className="mt-4 text-sm leading-7 text-[#b8c9c2]">{component.detail}</p>
          </section>

          <section className="border border-[#29434a] bg-[#0b1a21] p-5">
            <p className="text-[9px] font-bold uppercase tracking-[.19em]" style={{ color: tierMeta[tier].color }}>Real-world basis</p>
            <p className="mt-3 text-sm leading-7 text-[#aabdb6]">{component.realBasis}</p>
            <a href={SOLAR_REFERENCE} target="_blank" rel="noreferrer" className="mt-5 inline-flex border border-[#536d61] bg-[#11252a] px-4 py-3 text-[9px] font-bold uppercase tracking-[.16em] text-[#cfe1d7] hover:border-[#efb658]">
              NASA reference
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}

export function Solar3DViewer({ tier }: { tier: Tier }) {
  const [selected, setSelected] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const component = COMPONENTS.find((item) => item.id === selected) ?? COMPONENTS[0];

  return (
    <div className="space-y-4">
      <SolarCanvas selected={selected} setSelected={setSelected} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="border border-[#29434a] bg-[#0a181f] p-4">
          <div className="flex items-center gap-2">
            <Rotate3D className="h-4 w-4" style={{ color: tierMeta[tier].color }} />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[.19em] text-[#e2ebe5]">Clickable system anatomy</p>
              <p className="mt-1 text-[8px] uppercase tracking-[.13em] text-[#718b85]">Select any component to study its physical function.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {COMPONENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={"border px-3 py-3 text-left transition-colors " +
                  (selected === item.id ? "border-[#efb658] bg-[#172a30]" : "border-[#29434a] bg-[#08141a] hover:border-[#4d6c68]")}
              >
                <p className="text-[8px] font-bold uppercase tracking-[.16em]" style={{ color: tierMeta[tier].color }}>COMPONENT {String(item.id).padStart(2, "0")}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.05em] text-[#dce7df]">{item.name}</p>
              </button>
            ))}
          </div>
        </div>

        <aside className="border border-[#3d5b50] bg-[#0d2028] p-5">
          <p className="text-[9px] font-bold uppercase tracking-[.19em]" style={{ color: tierMeta[tier].color }}>Selected component</p>
          <h3 className="mt-2 text-xl font-semibold uppercase tracking-[.07em] text-[#eef3e7]">{component.name}</h3>
          <p className="mt-2 text-xs uppercase tracking-[.12em] text-[#72b9d4]">{component.short} · {component.function}</p>
          <div className="mt-4 border-l-2 border-[#efb658] bg-[#15262b] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#efb658]">{component.principle}</p>
            <p className="mt-2 text-sm leading-6 text-[#b8c8c0]">{component.detail}</p>
          </div>
          <button type="button" onClick={() => setDetailOpen(true)} className="mt-4 flex w-full items-center justify-between border border-[#536d61] bg-[#11252a] px-4 py-3 text-left text-[9px] font-bold uppercase tracking-[.16em] text-[#cfe1d7] hover:border-[#efb658]">
            <span className="flex items-center gap-2"><Maximize2 className="h-4 w-4 text-[#efb658]" />Inspect this component</span>
          </button>
        </aside>
      </div>

      <div className="border border-[#29434a] bg-[#08151b] p-4 text-[9px] leading-5 uppercase tracking-[.11em] text-[#718b86]">
        This is one integrated advanced solar-power reference model rather than separate tier models. It combines conventional flight-proven architecture with advanced deployable-array, high-efficiency photovoltaic, autonomous control and thermal-management concepts so the Solar technology can be studied as one coherent machine.
      </div>

      {detailOpen && <DetailPanel component={component} tier={tier} onClose={() => setDetailOpen(false)} />}
    </div>
  );
}

export default Solar3DViewer;
