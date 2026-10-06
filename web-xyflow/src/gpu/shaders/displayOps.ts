/**
 * ARKH TextureLab - Shader: Interactive Viewer Display Shader (P4-C7)
 * Implements A/B compare (wipe, difference), tiling/seam check, channel isolation, checkerboard, sRGB view.
 */

export const DISPLAY_FRAG = `
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform int u_hasCompare;

uniform int u_compareMode; // 0=None, 1=Wipe, 2=SideBySide, 3=Difference
uniform float u_wipePos;   // 0.0 .. 1.0
uniform float u_diffGain;  // typically 1.0 .. 10.0

uniform vec2 u_tiling;     // 1.0 .. 4.0 repeats
uniform int u_channel;     // 0=RGB, 1=R, 2=G, 3=B, 4=A, 5=RGBA over checker
uniform int u_srgbView;    // 0=Raw/Linear, 1=sRGB Gamma display

vec4 sampleColor(sampler2D tex, vec2 uv) {
  vec2 tiledUv = fract(uv * u_tiling);
  return texture(tex, tiledUv);
}

vec3 getCheckerboard(vec2 coord) {
  vec2 cell = floor(coord / 16.0);
  float pattern = mod(cell.x + cell.y, 2.0);
  return pattern > 0.5 ? vec3(0.22, 0.22, 0.24) : vec3(0.14, 0.14, 0.16);
}

void main() {
  vec4 colA = sampleColor(u_texA, v_uv);
  vec4 col = colA;

  if (u_hasCompare == 1) {
    vec4 colB = sampleColor(u_texB, v_uv);
    if (u_compareMode == 1) {
      // Wipe
      float dist = v_uv.x - u_wipePos;
      if (abs(dist) < 0.0015) {
        fragColor = vec4(1.0, 0.67, 0.0, 1.0); // Amber divider line
        return;
      }
      col = dist < 0.0 ? colA : colB;
    } else if (u_compareMode == 2) {
      // Side by Side
      col = v_uv.x < 0.5 ? sampleColor(u_texA, vec2(v_uv.x * 2.0, v_uv.y)) : sampleColor(u_texB, vec2((v_uv.x - 0.5) * 2.0, v_uv.y));
    } else if (u_compareMode == 3) {
      // Difference
      vec3 diff = abs(colA.rgb - colB.rgb) * u_diffGain;
      col = vec4(diff, 1.0);
    }
  }

  vec3 outRgb = col.rgb;

  // Channel isolate
  if (u_channel == 1) {
    outRgb = vec3(col.r);
  } else if (u_channel == 2) {
    outRgb = vec3(col.g);
  } else if (u_channel == 3) {
    outRgb = vec3(col.b);
  } else if (u_channel == 4) {
    outRgb = vec3(col.a);
  } else if (u_channel == 5) {
    // RGBA with checkerboard
    vec3 checker = getCheckerboard(gl_FragCoord.xy);
    outRgb = mix(checker, col.rgb, col.a);
  }

  // sRGB conversion toggle
  if (u_srgbView == 1) {
    outRgb = pow(clamp01(outRgb), vec3(1.0 / 2.2));
  }

  fragColor = vec4(outRgb, 1.0);
}
`;
