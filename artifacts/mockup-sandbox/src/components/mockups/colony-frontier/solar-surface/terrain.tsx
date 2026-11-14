import { useMemo } from "react";
import * as THREE from "three";
import { fbm, mulberry32 } from "./noise";
import { makeTerrainTexture } from "./textures";
import type { TerrainKind } from "./state";

const SIZE = 300;
const SEGMENTS = 300;
const CRATER_RIM_RADIUS = 100;

// The settlement sits on a deliberately engineered, level foundation.
// Keep a generous exclusion zone around the entire built area so natural
// terrain and loose rocks can never visually overlap colony assets.
const FOUNDATION_RADIUS = 44;
const FOUNDATION_FADE = 50;
const FOUNDATION_TERRAIN_DEPTH = -0.32;

function heightAt(x: number, z: number): number {
  const radius = Math.hypot(x, z);

  // The natural terrain must sit below the engineered foundation, not pass
  // through its upper layers. Feather the depression into the terrain outside
  // the slab so the join remains smooth when the camera moves.
  const depression = 1 - THREE.MathUtils.smoothstep(radius, FOUNDATION_RADIUS, FOUNDATION_FADE);
  const rough = (fbm(x * 0.045 + 10, z * 0.045 + 10, 5) - 0.5) * 5.2;
  const dunes = Math.sin(x * 0.055) * Math.cos(z * 0.047) * 0.7;
  const outerBlend = THREE.MathUtils.smoothstep(radius, FOUNDATION_FADE, FOUNDATION_FADE + 8);
  const naturalHeight = (rough + dunes) * outerBlend;
  const bowlRise = THREE.MathUtils.smoothstep(radius, FOUNDATION_FADE + 8, CRATER_RIM_RADIUS - 14) * 7.5;
  const craterApron = 1 - THREE.MathUtils.smoothstep(radius, CRATER_RIM_RADIUS + 10, CRATER_RIM_RADIUS + 20);

  return THREE.MathUtils.lerp(naturalHeight, FOUNDATION_TERRAIN_DEPTH, depression) + bowlRise * craterApron;
}

export function terrainHeight(x: number, z: number) {
  return heightAt(x, z);
}

export function Terrain({ kind }: { kind: TerrainKind }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
    }

    geo.computeVertexNormals();
    return geo;
  }, []);

  const texture = useMemo(() => {
    const t = makeTerrainTexture(kind);
    t.repeat.set(8, 8);
    t.anisotropy = 4;
    return t;
  }, [kind]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        map={texture}
        color={kind === "moon" ? "#9a958d" : "#a85e3c"}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

export function CraterRim({ kind }: { kind: TerrainKind }) {
  const geometry = useMemo(() => createCraterRimGeometry(), []);
  const texture = useMemo(() => {
    const map = makeTerrainTexture(kind);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1, 1);
    map.anisotropy = 4;
    return map;
  }, [kind]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow frustumCulled={false}>
      <meshStandardMaterial
        map={texture}
        color={kind === "moon" ? "#aaa397" : "#b2765e"}
        roughness={1}
        flatShading
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function createCraterRimGeometry() {
  const segments = 256;
  const ringOffsets = [-14, -12, -9, -6, -3, -1, 0, 2, 4, 7, 10, 13, 16, 19, 20];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring < ringOffsets.length; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const ridgeVariation = Math.sin(angle * 3 + 0.6) * 3.1
        + Math.sin(angle * 7 - 0.8) * 1.45
        + Math.sin(angle * 17 + 0.2) * 0.65;
      const progress = ring / (ringOffsets.length - 1);
      const contour = ridgeVariation * (0.2 + Math.sin(progress * Math.PI) * 0.8);
      const radius = CRATER_RIM_RADIUS + ringOffsets[ring] + contour;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const terrain = heightAt(x, z);
      const peak = 34
        + Math.sin(angle * 4 + 0.3) * 3.5
        + Math.sin(angle * 11 + 0.4) * 1.8
        + Math.sin(angle * 23 - 0.2) * 0.8;
      const heights = [
        terrain,
        terrain + 0.5,
        terrain + 1.8,
        terrain + 4.8,
        terrain + 11,
        peak - 7,
        peak,
        peak - 1.5,
        peak - 5,
        peak - 11,
        peak - 17,
        peak - 23,
        peak - 28,
        terrain + 1.2,
        terrain,
      ];

      positions.push(x, heights[ring], z);
      uvs.push((segment / segments) * 18, ring * 1.2);
    }
  }

  for (let ring = 0; ring < ringOffsets.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const inner = ring * segments + segment;
      const innerNext = ring * segments + next;
      const outer = (ring + 1) * segments + segment;
      const outerNext = (ring + 1) * segments + next;
      indices.push(inner, innerNext, outer, innerNext, outerNext, outer);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function Rocks({ kind }: { kind: TerrainKind }) {
  const { positions, count } = useMemo(() => {
    const rnd = mulberry32(kind === "moon" ? 7 : 99);
    const arr: { p: THREE.Vector3; s: number; r: number }[] = [];

    let attempts = 0;
    while (arr.length < 64 && attempts < 1024) {
      attempts += 1;
      const angle = rnd() * Math.PI * 2;
      const radius = 31 + rnd() * 31;
      const s = 0.12 + rnd() * (rnd() > 0.9 ? 1.9 : 0.65);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Reject diagonal rocks as well as those beside the straight edges:
      // polar samples near 45 degrees could otherwise land on the base corners.
      if (Math.abs(x) < 45 && Math.abs(z) < 45) continue;

      arr.push({
        p: new THREE.Vector3(x, heightAt(x, z) + s * 0.32, z),
        s,
        r: rnd() * Math.PI,
      });
    }

    return { positions: arr, count: arr.length };
  }, [kind]);

  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: kind === "moon" ? "#706c65" : "#7c4028",
        roughness: 1,
        metalness: 0,
        flatShading: true,
      }),
    [kind],
  );

  const instanced = useMemo(() => {
    const dummy = new THREE.Object3D();
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.castShadow = true;
    inst.receiveShadow = true;

    positions.forEach((o, i) => {
      dummy.position.copy(o.p);
      dummy.rotation.set(o.r, o.r * 1.7, o.r * 0.5);
      dummy.scale.setScalar(o.s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });

    inst.instanceMatrix.needsUpdate = true;
    return inst;
  }, [geo, mat, positions, count]);

  return <primitive object={instanced} />;
}
