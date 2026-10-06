/**
 * ARKH TextureLab - Shared GLSL Boilerplate, Vertex Shader, and Utility Functions
 */

export const FULLSCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;

out vec2 v_uv;

void main() {
  float x = -1.0 + float((gl_VertexID & 1) << 2);
  float y = -1.0 + float((gl_VertexID & 2) << 1);
  v_uv = vec2(x * 0.5 + 0.5, y * 0.5 + 0.5);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

export const COMMON_GLSL_HEADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 fragColor;

// Guard against NaN and Inf
float safeFloat(float val, float fallback) {
  if (isnan(val) || isinf(val)) return fallback;
  return val;
}

vec4 safeVec4(vec4 val, vec4 fallback) {
  return vec4(
    safeFloat(val.r, fallback.r),
    safeFloat(val.g, fallback.g),
    safeFloat(val.b, fallback.b),
    safeFloat(val.a, fallback.a)
  );
}

float clamp01(float v) {
  return clamp(v, 0.0, 1.0);
}

vec3 clamp01(vec3 v) {
  return clamp(v, vec3(0.0), vec3(1.0));
}

vec4 clamp01(vec4 v) {
  return clamp(v, vec4(0.0), vec4(1.0));
}

float safeDivide(float a, float b) {
  if (abs(b) < 1e-7) return 0.0;
  float res = a / b;
  return safeFloat(res, 0.0);
}

float safePow(float base, float exp) {
  if (base <= 0.0) return 0.0;
  float res = pow(base, exp);
  return safeFloat(res, 0.0);
}

// Select channel: 0=R, 1=G, 2=B, 3=A, 4=Constant 0.0, 5=Constant 1.0
float selectChannel(vec4 col, int ch) {
  if (ch == 0) return col.r;
  if (ch == 1) return col.g;
  if (ch == 2) return col.b;
  if (ch == 3) return col.a;
  if (ch == 4) return 0.0;
  if (ch == 5) return 1.0;
  return 0.0;
}
`;
