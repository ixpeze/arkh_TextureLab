/**
 * ARKH TextureLab - Shader: Constants, Pass-through & Type Coercion (P4-C1)
 */

export const CONSTANT_COLOR_FRAG = `
uniform vec4 u_color;

void main() {
  fragColor = u_color;
}
`;

export const CONSTANT_SCALAR_FRAG = `
uniform float u_value;

void main() {
  fragColor = vec4(u_value, u_value, u_value, 1.0);
}
`;

export const TEXTURE_INPUT_FRAG = `
uniform sampler2D u_tex;

void main() {
  fragColor = texture(u_tex, v_uv);
}
`;

export const COERCE_FRAG = `
uniform sampler2D u_tex;
uniform int u_mode; // 0=scalar to RGBA, 1=RGB to RGBA (A=1.0), 2=RGBA to Scalar (Red)

void main() {
  vec4 c = texture(u_tex, v_uv);
  if (u_mode == 0) {
    fragColor = vec4(c.r, c.r, c.r, c.r);
  } else if (u_mode == 1) {
    fragColor = vec4(c.rgb, 1.0);
  } else if (u_mode == 2) {
    fragColor = vec4(c.r, c.r, c.r, 1.0);
  } else {
    fragColor = c;
  }
}
`;
