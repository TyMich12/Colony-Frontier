import { useMemo } from "react";
import * as THREE from "three";
import { fbm, mulberry32 } from "./noise";
import { makeTerrainTexture } from "./textures";
import type { TerrainKind } from "./state";

const SIZE = 220;
const SEGMENTS = 220;

// The settlement sits on a deliberately engineered, level foundation.
// Keep a generous exclusion zone around the entire built area so natural
// terrain and loose rocks can never visually overlap colony assets.
const FOUNDATION_X = 38;
const FOUNDATION_Z = 38;
const FOUNDATION_FADE = 46;
const FOUNDATION_TERRAIN_DEPTH = -0.32;

function heightAt(x: number, z: number): number {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const edge = Math.max(ax, az);

  // The natural terrain must sit below the engineered foundation, not pass
  // through its upper layers. Feather the depression into the terrain outside
  // the slab so the join remains smooth when the camera moves.
  const depression = 1 - THREE.MathUtils.smoothstep(edge, FOUNDATION_X, FOUNDATION_FADE);
  const rough = (fbm(x * 0.045 + 10, z * 0.045 + 10, 5) - 0.5) * 5.2;
  const dunes = Math.sin(x * 0.055) * Math.cos(z * 0.047) * 0.7;
  const outerBlend = THREE.MathUtils.smoothstep(edge, FOUNDATION_FADE, FOUNDATION_FADE + 8);
  const naturalHeight = (rough + dunes) * outerBlend;

  return THREE.MathUtils.lerp(naturalHeight, FOUNDATION_TERRAIN_DEPTH, depression);
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

export function Rocks({ kind }: { kind: TerrainKind }) {
  const { positions, count } = useMemo(() => {
    const rnd = mulberry32(kind === "moon" ? 7 : 99);
    const arr: { p: THREE.Vector3; s: number; r: number }[] = [];

    let attempts = 0;
    while (arr.length < 64 && attempts < 1024) {
      attempts += 1;
      const angle = rnd() * Math.PI * 2;
      const radius = 42 + rnd() * 31;
      const s = 0.12 + rnd() * (rnd() > 0.9 ? 1.9 : 0.65);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Reject diagonal rocks as well as those beside the straight edges:
      // polar samples near 45 degrees could otherwise land on the base corners.
      if (Math.abs(x) < 42 && Math.abs(z) < 42) continue;

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
