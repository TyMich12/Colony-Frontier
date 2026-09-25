import * as THREE from "three";

type DustAwareUserData = {
  dustUniform?: { value: number };
};

export type DustAwareMaterial = THREE.MeshStandardMaterial & {
  userData: DustAwareUserData;
};

export function makeDustAwareMaterial(
  params: THREE.MeshStandardMaterialParameters,
  dustTexture: THREE.Texture,
  dustColor: string,
): DustAwareMaterial {
  const material = new THREE.MeshStandardMaterial(params) as DustAwareMaterial;
  const dustUniform = { value: 0 };
  material.userData.dustUniform = dustUniform;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDustMap = { value: dustTexture };
    shader.uniforms.uDustStrength = dustUniform;
    shader.uniforms.uDustColor = { value: new THREE.Color(dustColor) };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vDustWorldPosition;\nvarying vec3 vDustWorldNormal;",
      )
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nvDustWorldNormal = normalize(mat3(modelMatrix) * objectNormal);",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvDustWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vDustWorldPosition;\nvarying vec3 vDustWorldNormal;\nuniform sampler2D uDustMap;\nuniform float uDustStrength;\nuniform vec3 uDustColor;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n" +
          "float dustScale = 0.18;\n" +
          "vec3 dustPos = vDustWorldPosition * dustScale;\n" +
          "vec3 dustNormal = abs(normalize(vDustWorldNormal));\n" +
          "float maskX = texture2D(uDustMap, dustPos.yz).a;\n" +
          "float maskY = texture2D(uDustMap, dustPos.xz).a;\n" +
          "float maskZ = texture2D(uDustMap, dustPos.xy).a;\n" +
          "float dustMask = maskX * dustNormal.x + maskY * dustNormal.y + maskZ * dustNormal.z;\n" +
          "dustMask = smoothstep(0.08, 0.78, dustMask);\n" +
          "float dustMix = clamp(dustMask * uDustStrength * 1.18, 0.0, 1.0);\n" +
          "diffuseColor.rgb = mix(diffuseColor.rgb, uDustColor, dustMix);",
      );
  };

  material.customProgramCacheKey = () => "dust-aware-" + dustColor;
  return material;
}

export function updateDustStrength(material: THREE.Material, dust: number) {
  const dustAware = material as DustAwareMaterial;
  if (dustAware.userData.dustUniform) {
    dustAware.userData.dustUniform.value =
      Math.min(1.25, Math.pow(Math.max(0, dust / 100), 0.52) * 1.12);
  }
}
