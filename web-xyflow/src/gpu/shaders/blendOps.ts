/**
 * ARKH TextureLab - Shader: 7 Blend Modes (+ Mask) and RNM Normal Blend (P4-C5)
 */

export const BLEND_OPS_FRAG = `
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform sampler2D u_texMask;
uniform int u_hasMask;
uniform int u_mode;
uniform float u_opacity;

float blendChannel(float a, float b, int mode) {
  // 0: Normal
  if (mode == 0) return b;
  // 1: Add
  if (mode == 1) return a + b;
  // 2: Multiply
  if (mode == 2) return a * b;
  // 3: Subtract
  if (mode == 3) return a - b;
  // 4: Screen
  if (mode == 4) return 1.0 - (1.0 - a) * (1.0 - b);
  // 5: Overlay
  if (mode == 5) {
    return a < 0.5 ? 2.0 * a * b : 1.0 - 2.0 * (1.0 - a) * (1.0 - b);
  }
  // 6: Hard Light
  if (mode == 6) {
    return b < 0.5 ? 2.0 * a * b : 1.0 - 2.0 * (1.0 - a) * (1.0 - b);
  }
  return b;
}

vec3 blendRgb(vec3 a, vec3 b, int mode) {
  return vec3(
    blendChannel(a.r, b.r, mode),
    blendChannel(a.g, b.g, mode),
    blendChannel(a.b, b.b, mode)
  );
}

void main() {
  vec4 base = texture(u_texA, v_uv);
  vec4 blend = texture(u_texB, v_uv);

  vec3 blendedRgb = clamp01(blendRgb(base.rgb, blend.rgb, u_mode));
  float maskVal = u_hasMask == 1 ? texture(u_texMask, v_uv).r : 1.0;
  float alpha = clamp01(u_opacity * maskVal);

  vec3 outRgb = mix(base.rgb, blendedRgb, alpha);
  fragColor = vec4(outRgb, base.a);
}
`;

export const NORMAL_BLEND_FRAG = `
uniform sampler2D u_texBase;
uniform sampler2D u_texDetail;
uniform float u_strength;

void main() {
  vec3 n1 = texture(u_texBase, v_uv).rgb * 2.0 - 1.0;
  vec3 n2 = texture(u_texDetail, v_uv).rgb * 2.0 - 1.0;

  n2.xy *= u_strength;

  // Reoriented Normal Mapping (RNM)
  vec3 t = n1 + vec3(0.0, 0.0, 1.0);
  vec3 u = n2 * vec3(-1.0, -1.0, 1.0);
  vec3 r = t * dot(t, u) - u * t.z;

  float len = length(r);
  vec3 blended = len > 1e-6 ? normalize(r) : vec3(0.0, 0.0, 1.0);

  fragColor = vec4(blended * 0.5 + 0.5, 1.0);
}
`;
