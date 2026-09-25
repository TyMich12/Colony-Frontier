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
          "float dustStrength = clamp(uDustStrength, 0.0, 1.0);\n" +
          "vec3 dustNormal = normalize(vDustWorldNormal);\n" +
          "vec3 dustWeights = abs(dustNormal);\n" +
          "float weightSum = max(dustWeights.x + dustWeights.y + dustWeights.z, 0.0001);\n" +
          "dustWeights /= weightSum;\n" +
          "float dustScale = 0.23;\n" +
          "float detailScale = 0.58;\n" +
          "vec3 dustPos = vDustWorldPosition * dustScale;\n" +
          "vec3 detailPos = vDustWorldPosition * detailScale + vec3(2.7, 5.1, 1.9);\n" +
          "float coarseX = texture2D(uDustMap, dustPos.yz).a;\n" +
          "float coarseY = texture2D(uDustMap, dustPos.xz).a;\n" +
          "float coarseZ = texture2D(uDustMap, dustPos.xy).a;\n" +
          "float detailX = texture2D(uDustMap, detailPos.yz).a;\n" +
          "float detailY = texture2D(uDustMap, detailPos.xz).a;\n" +
          "float detailZ = texture2D(uDustMap, detailPos.xy).a;\n" +
          "float coarseMask = coarseX * dustWeights.x + coarseY * dustWeights.y + coarseZ * dustWeights.z;\n" +
          "float detailMask = detailX * dustWeights.x + detailY * dustWeights.y + detailZ * dustWeights.z;\n" +
          "float dustPattern = clamp(coarseMask * 0.82 + detailMask * 0.18, 0.0, 1.0);\n" +
          "float threshold = mix(0.34, 0.11, dustStrength);\n" +
          "float edge = mix(0.045, 0.075, dustStrength);\n" +
          "float patchMask = smoothstep(threshold - edge, threshold + edge, dustPattern);\n" +
          "float surfaceExposure = 0.70 + 0.30 * smoothstep(-0.15, 0.75, dustNormal.y);\n" +
          "float dustMix = clamp(patchMask * dustStrength * surfaceExposure, 0.0, 0.92);\n" +
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
