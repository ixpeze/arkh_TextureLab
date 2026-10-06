/**
 * ARKH TextureLab - Shader: Resize and High-Quality Upscale (P4-C6)
 * Supports nearest, bilinear, and bicubic Catmull-Rom filtering with fit/pad/crop modes.
 */

export const RESIZE_FRAG = `
uniform sampler2D u_tex;
uniform int u_filter; // 0=nearest, 1=bilinear, 2=bicubic
uniform vec2 u_srcRes;
uniform vec2 u_dstRes;
uniform vec2 u_uvScale;
uniform vec2 u_uvOffset;
uniform vec4 u_padColor;

vec4 sampleBicubic(sampler2D tex, vec2 uv, vec2 res) {
  vec2 texelSize = 1.0 / res;
  vec2 coord = uv * res - 0.5;
  vec2 f = fract(coord);
  vec2 index = floor(coord);

  // Catmull-Rom weights
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);

  vec2 w12 = w1 + w2;
  vec2 tc12 = (index + w2 / w12) * texelSize;
  vec2 tc0 = (index - 1.0) * texelSize;
  vec2 tc3 = (index + 2.0) * texelSize;

  vec4 col = vec4(0.0);
  col += texture(tex, vec2(tc12.x, tc12.y)) * (w12.x * w12.y);
  col += texture(tex, vec2(tc0.x, tc12.y)) * (w0.x * w12.y);
  col += texture(tex, vec2(tc3.x, tc12.y)) * (w3.x * w12.y);
  col += texture(tex, vec2(tc12.x, tc0.y)) * (w12.x * w0.y);
  col += texture(tex, vec2(tc12.x, tc3.y)) * (w12.x * w3.y);

  return clamp01(col);
}

void main() {
  vec2 mappedUv = v_uv * u_uvScale + u_uvOffset;

  // Check out of bounds (padding)
  if (mappedUv.x < 0.0 || mappedUv.x > 1.0 || mappedUv.y < 0.0 || mappedUv.y > 1.0) {
    fragColor = u_padColor;
    return;
  }

  if (u_filter == 2) {
    fragColor = sampleBicubic(u_tex, mappedUv, u_srcRes);
  } else {
    fragColor = texture(u_tex, mappedUv);
  }
}
`;
