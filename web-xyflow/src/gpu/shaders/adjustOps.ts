/**
 * ARKH TextureLab - Shader: Levels, Invert, NormalFlip, Normalize (P4-C4)
 */

export const LEVELS_FRAG = `
uniform sampler2D u_tex;
uniform int u_channel; // 0=all, 1=r, 2=g, 3=b, 4=a
uniform float u_inBlack;
uniform float u_inWhite;
uniform float u_gamma;
uniform float u_outBlack;
uniform float u_outWhite;

float applyLevels(float v) {
  if (u_inWhite <= u_inBlack) return u_outBlack;
  float norm = clamp01((v - u_inBlack) / max(u_inWhite - u_inBlack, 1e-6));
  float safeG = clamp(u_gamma, 0.01, 5.0);
  float powered = safePow(norm, 1.0 / safeG);
  return clamp01(u_outBlack + powered * (u_outWhite - u_outBlack));
}

void main() {
  vec4 c = texture(u_tex, v_uv);
  if (u_channel == 0) {
    fragColor = vec4(
      applyLevels(c.r),
      applyLevels(c.g),
      applyLevels(c.b),
      c.a
    );
  } else if (u_channel == 1) {
    fragColor = vec4(applyLevels(c.r), c.g, c.b, c.a);
  } else if (u_channel == 2) {
    fragColor = vec4(c.r, applyLevels(c.g), c.b, c.a);
  } else if (u_channel == 3) {
    fragColor = vec4(c.r, c.g, applyLevels(c.b), c.a);
  } else if (u_channel == 4) {
    fragColor = vec4(c.r, c.g, c.b, applyLevels(c.a));
  } else {
    fragColor = c;
  }
}
`;

export const INVERT_FRAG = `
uniform sampler2D u_tex;
uniform int u_invertAlpha;

void main() {
  vec4 c = texture(u_tex, v_uv);
  fragColor = vec4(
    1.0 - c.r,
    1.0 - c.g,
    1.0 - c.b,
    u_invertAlpha == 1 ? 1.0 - c.a : c.a
  );
}
`;

export const NORMAL_FLIP_FRAG = `
uniform sampler2D u_tex;
uniform int u_flipGreen;
uniform int u_flipRed;

void main() {
  vec4 c = texture(u_tex, v_uv);
  float r = u_flipRed == 1 ? 1.0 - c.r : c.r;
  float g = u_flipGreen == 1 ? 1.0 - c.g : c.g;
  fragColor = vec4(r, g, c.b, c.a);
}
`;

export const NORMALIZE_FRAG = `
uniform sampler2D u_tex;

void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 n = c.rgb * 2.0 - 1.0;
  float len = length(n);
  vec3 norm = len > 1e-6 ? normalize(n) : vec3(0.0, 0.0, 1.0);
  fragColor = vec4(norm * 0.5 + 0.5, c.a);
}
`;
