import { useMemo } from "react";
import * as THREE from "three";
import { fbm, mulberry32 } from "./noise";
import { makeTerrainTexture } from "./textures";
import type { TerrainKind } from "./state";

const SIZE = 90;
const SEGMENTS = 180;

function heightAt(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  const rough = (fbm(x * 0.05 + 10, z * 0.05 + 10, 5) - 0.5) * 6;
  const dunes = Math.sin(x * 0.06) * Math.cos(z * 0.05) * 0.8;
  const pad = THREE.MathUtils.smoothstep(d, 9, 16);
  return (rough + dunes) * pad;
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
    t.repeat.set(4, 4);
    return t;
  }, [kind]);

  const color = kind === "moon" ? "#9a958d" : "#a85e3c";

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial map={texture} color={color} roughness={1} metalness={0} />
    </mesh>
  );
}

export function Rocks({ kind }: { kind: TerrainKind }) {
  const { positions, count } = useMemo(() => {
    const rnd = mulberry32(kind === "moon" ? 7 : 99);
    const arr: { p: THREE.Vector3; s: number; r: number }[] = [];

    for (let i = 0; i < 140; i += 1) {
      const angle = rnd() * Math.PI * 2;
      const radius = 14 + rnd() * 30;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const s = 0.15 + rnd() * (rnd() > 0.9 ? 2.2 : 0.7);
      arr.push({
        p: new THREE.Vector3(x, heightAt(x, z) + s * 0.3, z),
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
        color: kind === "moon" ? "#6f6b64" : "#7c4028",
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
      dummy.scale.set(o.s, o.s, o.s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });

    inst.instanceMatrix.needsUpdate = true;
    return inst;
  }, [geo, mat, positions, count]);

  return <primitive object={instanced} />;
}