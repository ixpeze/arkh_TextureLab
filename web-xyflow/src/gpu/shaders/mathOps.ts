/**
 * ARKH TextureLab - Shader: 13 Math Operations with NaN/Zero Guards (P4-C3)
 */

export const MATH_OPS_FRAG = `
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform int u_hasTexA;
uniform int u_hasTexB;

uniform vec4 u_constA;
uniform vec4 u_constB;

uniform int u_op;
uniform float u_param1;
uniform float u_param2;
uniform int u_clampResult;

vec4 evalOp(vec4 a, vec4 b) {
  // 0: Add
  if (u_op == 0) return a + b;
  // 1: Subtract
  if (u_op == 1) return a - b;
  // 2: Multiply
  if (u_op == 2) return a * b;
  // 3: Divide (guard b == 0.0 -> 0.0)
  if (u_op == 3) {
    return vec4(
      safeDivide(a.r, b.r),
      safeDivide(a.g, b.g),
      safeDivide(a.b, b.b),
      safeDivide(a.a, b.a)
    );
  }
  // 4: Power (guard base <= 0.0 -> 0.0)
  if (u_op == 4) {
    float exp = u_hasTexB == 1 ? b.r : u_param1;
    return vec4(
      safePow(a.r, exp),
      safePow(a.g, exp),
      safePow(a.b, exp),
      safePow(a.a, exp)
    );
  }
  // 5: Min
  if (u_op == 5) return min(a, b);
  // 6: Max
  if (u_op == 6) return max(a, b);
  // 7: Clamp
  if (u_op == 7) {
    float minVal = u_param1;
    float maxVal = u_param2;
    return clamp(a, vec4(minVal), vec4(maxVal));
  }
  // 8: Absolute
  if (u_op == 8) return abs(a);
  // 9: Negate
  if (u_op == 9) return -a;
  // 10: Saturate
  if (u_op == 10) return clamp01(a);
  // 11: Lerp
  if (u_op == 11) {
    float alpha = u_param1;
    return mix(a, b, alpha);
  }
  // 12: Modulo
  if (u_op == 12) {
    vec4 safeB = vec4(
      abs(b.r) < 1e-7 ? 1.0 : b.r,
      abs(b.g) < 1e-7 ? 1.0 : b.g,
      abs(b.b) < 1e-7 ? 1.0 : b.b,
      abs(b.a) < 1e-7 ? 1.0 : b.a
    );
    return mod(a, safeB);
  }
  return a;
}

void main() {
  vec4 a = u_hasTexA == 1 ? texture(u_texA, v_uv) : u_constA;
  vec4 b = u_hasTexB == 1 ? texture(u_texB, v_uv) : u_constB;

  vec4 res = evalOp(a, b);
  res = safeVec4(res, vec4(0.0));

  if (u_clampResult == 1) {
    fragColor = clamp01(res);
  } else {
    fragColor = res;
  }
}
`;
