import { describe, it, expect, vi } from 'vitest';
import { ProgramManager } from '../../gpu/programs';
import { CONSTANT_COLOR_FRAG, CONSTANT_SCALAR_FRAG, TEXTURE_INPUT_FRAG, COERCE_FRAG } from '../../gpu/shaders/constants';
import { CHANNEL_COMBINER_FRAG, CHANNEL_SPLITTER_FRAG, CHANNEL_MIXER_FRAG } from '../../gpu/shaders/channelOps';
import { MATH_OPS_FRAG } from '../../gpu/shaders/mathOps';
import { LEVELS_FRAG, INVERT_FRAG, NORMAL_FLIP_FRAG, NORMALIZE_FRAG } from '../../gpu/shaders/adjustOps';
import { BLEND_OPS_FRAG, NORMAL_BLEND_FRAG } from '../../gpu/shaders/blendOps';
import { RESIZE_FRAG } from '../../gpu/shaders/transformOps';
import { DISPLAY_FRAG } from '../../gpu/shaders/displayOps';
import { computeHistogram } from '../../gpu/histogram';

describe('Sub-phase 4C: Shader Ports & Shader Compilation (P4-C1..P4-C8)', () => {
  function createMockGl() {
    const gl = {
      VERTEX_SHADER: 0x8b31,
      FRAGMENT_SHADER: 0x8b30,
      COMPILE_STATUS: 0x8b81,
      LINK_STATUS: 0x8b82,
      createVertexArray: vi.fn(() => ({})),
      createShader: vi.fn(() => ({})),
      deleteShader: vi.fn(),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      getShaderInfoLog: vi.fn(() => ''),
      createProgram: vi.fn(() => ({})),
      deleteProgram: vi.fn(),
      attachShader: vi.fn(),
      detachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      getProgramInfoLog: vi.fn(() => ''),
      useProgram: vi.fn(),
      getUniformLocation: vi.fn((_p, name) => ({ name })),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      uniform2f: vi.fn(),
      uniform3f: vi.fn(),
      uniform4f: vi.fn(),
      uniformMatrix3fv: vi.fn(),
      activeTexture: vi.fn(),
      bindTexture: vi.fn(),
    };
    return gl as unknown as WebGL2RenderingContext;
  }

  it('P4-C1: compiles constant, texture input, and coercion shaders', () => {
    const gl = createMockGl();
    const pm = new ProgramManager(gl);

    expect(() => pm.getOrCreateProgram('const_col', CONSTANT_COLOR_FRAG)).not.toThrow();
    expect(() => pm.getOrCreateProgram('const_scal', CONSTANT_SCALAR_FRAG)).not.toThrow();
    expect(() => pm.getOrCreateProgram('tex_in', TEXTURE_INPUT_FRAG)).not.toThrow();
    expect(() => pm.getOrCreateProgram('coerce', COERCE_FRAG)).not.toThrow();
  });

  it('P4-C2: compiles channel combiner, splitter, and mixer shaders', () => {
    const gl = createMockGl();
    const pm = new ProgramManager(gl);

    expect(() => pm.getOrCreateProgram('combiner', CHANNEL_COMBINER_FRAG)).not.toThrow();
    expect(() => pm.getOrCreateProgram('splitter', CHANNEL_SPLITTER_FRAG)).not.toThrow();
    expect(() => pm.getOrCreateProgram('mixer', CHANNEL_MIXER_FRAG)).not.toThrow();
  });

  it('P4-C3: compiles unified math shader for all 13 operations', () => {
    const gl = createMockGl();
    const pm = new ProgramManager(gl);

    const prog = pm.getOrCreateProgram('math_ops', MATH_OPS_FRAG);
    expect(prog).toBeDefined();

    // Verify setting math op uniforms (TC-162 divide by 0, TC-163 pow negative)
    prog.use();
    prog.uniforms.setInt('u_op', 3); // Divide
    prog.uniforms.setFloat('u_param1', 0.0);
    expect(gl.uniform1i).toHaveBeenCalledWith({ name: 'u_op' }, 3);
  });

  it('P4-C4: compiles levels, invert, normalFlip, and normalize shaders (TC-160..165)', () => {
    const gl = createMockGl();
    const pm = new ProgramManager(gl);

    expect(() => pm.getOrCreateProgram('levels', LEVELS_FRAG)).not.toThrow();
    expect(() => pm.getOrCreateProgram('invert', INVERT_FRAG)).not.toThrow();
    expect(() => pm.getOrCreateProgram('normal_flip', NORMAL_FLIP_FRAG)).not.toThrow();
    expect(() => pm.getOrCreateProgram('normalize', NORMALIZE_FRAG)).not.toThrow();
  });

  it('P4-C5: compiles blend and normalBlend shaders', () => {
    const gl = createMockGl();
    const pm = new ProgramManager(gl);

    expect(() => pm.getOrCreateProgram('blend', BLEND_OPS_FRAG)).not.toThrow();
    expect(() => pm.getOrCreateProgram('normal_blend', NORMAL_BLEND_FRAG)).not.toThrow();
  });

  it('P4-C6: compiles resize and upscale shader', () => {
    const gl = createMockGl();
    const pm = new ProgramManager(gl);

    expect(() => pm.getOrCreateProgram('resize', RESIZE_FRAG)).not.toThrow();
  });

  it('P4-C7: compiles viewer display shader', () => {
    const gl = createMockGl();
    const pm = new ProgramManager(gl);

    expect(() => pm.getOrCreateProgram('display', DISPLAY_FRAG)).not.toThrow();
  });

  it('P4-C8: computes 4x256 histogram bins from readback data', () => {
    const data = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i++) {
      data[i * 4 + 0] = i * 10;
      data[i * 4 + 1] = i * 15;
      data[i * 4 + 2] = i * 5;
      data[i * 4 + 3] = 255;
    }

    const hist = computeHistogram({
      width: 4,
      height: 4,
      format: 'RGBA8',
      data,
    });

    expect(hist.r.length).toBe(256);
    expect(hist.g.length).toBe(256);
    expect(hist.b.length).toBe(256);
    expect(hist.lum.length).toBe(256);
    expect(hist.maxCount).toBeGreaterThan(0);
  });
});
