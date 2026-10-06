/**
 * ARKH TextureLab - Shader: Channel Combiner, Splitter, and Mixer (P4-C2)
 */

export const CHANNEL_COMBINER_FRAG = `
uniform sampler2D u_texR;
uniform sampler2D u_texG;
uniform sampler2D u_texB;
uniform sampler2D u_texA;

uniform int u_hasR;
uniform int u_hasG;
uniform int u_hasB;
uniform int u_hasA;

uniform int u_srcChR;
uniform int u_srcChG;
uniform int u_srcChB;
uniform int u_srcChA;

uniform vec4 u_fallback;

void main() {
  float r = u_hasR == 1 ? selectChannel(texture(u_texR, v_uv), u_srcChR) : u_fallback.r;
  float g = u_hasG == 1 ? selectChannel(texture(u_texG, v_uv), u_srcChG) : u_fallback.g;
  float b = u_hasB == 1 ? selectChannel(texture(u_texB, v_uv), u_srcChB) : u_fallback.b;
  float a = u_hasA == 1 ? selectChannel(texture(u_texA, v_uv), u_srcChA) : u_fallback.a;

  fragColor = vec4(r, g, b, a);
}
`;

export const CHANNEL_SPLITTER_FRAG = `
uniform sampler2D u_tex;
uniform int u_ch; // 0=R, 1=G, 2=B, 3=A

void main() {
  vec4 c = texture(u_tex, v_uv);
  float val = selectChannel(c, u_ch);
  fragColor = vec4(val, val, val, 1.0);
}
`;

export const CHANNEL_MIXER_FRAG = `
uniform sampler2D u_tex;
uniform mat4 u_matrix;
uniform vec4 u_bias;

void main() {
  vec4 c = texture(u_tex, v_uv);
  vec4 outCol = u_matrix * c + u_bias;
  fragColor = clamp01(outCol);
}
`;
