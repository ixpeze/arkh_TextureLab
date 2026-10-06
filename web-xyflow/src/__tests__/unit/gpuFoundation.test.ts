import { describe, it, expect, vi } from 'vitest';
import { queryGpuCapabilities, createGpuContext } from '../../gpu/context';
import { TexturePool, type PooledTexture } from '../../gpu/texturePool';
import { ProgramManager } from '../../gpu/programs';
import { FboManager } from '../../gpu/fbo';
import { ReadbackManager } from '../../gpu/readback';

describe('Sub-phase 4A: GPU Foundation', () => {
  // Mock WebGL2 context helper
  function createMockGl(overrides: Record<string, unknown> = {}) {
    const gl = {
      MAX_TEXTURE_SIZE: 0x0d33,
      MAX_RENDERBUFFER_SIZE: 0x84e8,
      RENDERER: 0x1f01,
      VENDOR: 0x1f00,
      TEXTURE_2D: 0x0de1,
      TEXTURE_WRAP_S: 0x2802,
      TEXTURE_WRAP_T: 0x2803,
      CLAMP_TO_EDGE: 0x812f,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_MAG_FILTER: 0x2800,
      NEAREST: 0x2600,
      RGBA8: 0x8058,
      RGBA16F: 0x881a,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      HALF_FLOAT: 0x140b,
      FLOAT: 0x1406,
      FRAMEBUFFER: 0x8d40,
      COLOR_ATTACHMENT0: 0x8ce0,
      FRAMEBUFFER_COMPLETE: 0x8cd5,
      VERTEX_SHADER: 0x8b31,
      FRAGMENT_SHADER: 0x8b30,
      COMPILE_STATUS: 0x8b81,
      LINK_STATUS: 0x8b82,
      PIXEL_PACK_BUFFER: 0x88eb,
      STREAM_READ: 0x88e1,
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      ALREADY_SIGNALED: 0x911a,
      getParameter: vi.fn((param) => {
        if (param === 0x0d33) return 8192;
        if (param === 0x84e8) return 8192;
        if (param === 0x1f01) return 'ANGLE (NVIDIA RTX 3050 Direct3D11)';
        if (param === 0x1f00) return 'Google Inc. (NVIDIA)';
        return 0;
      }),
      getExtension: vi.fn((name) => {
        if (name === 'EXT_color_buffer_float') return {};
        if (name === 'OES_texture_float_linear') return {};
        if (name === 'EXT_float_blend') return {};
        if (name === 'WEBGL_debug_renderer_info') {
          return {
            UNMASKED_RENDERER_WEBGL: 0x9246,
            UNMASKED_VENDOR_WEBGL: 0x9245,
          };
        }
        return null;
      }),
      isContextLost: vi.fn(() => false),
      createTexture: vi.fn(() => ({ id: Math.random() })),
      deleteTexture: vi.fn(),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      createFramebuffer: vi.fn(() => ({ id: Math.random() })),
      deleteFramebuffer: vi.fn(),
      bindFramebuffer: vi.fn(),
      framebufferTexture2D: vi.fn(),
      checkFramebufferStatus: vi.fn(() => 0x8cd5),
      viewport: vi.fn(),
      createVertexArray: vi.fn(() => ({ id: Math.random() })),
      deleteVertexArray: vi.fn(),
      bindVertexArray: vi.fn(),
      createShader: vi.fn(() => ({ id: Math.random() })),
      deleteShader: vi.fn(),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      getShaderInfoLog: vi.fn(() => ''),
      createProgram: vi.fn(() => ({ id: Math.random() })),
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
      drawArrays: vi.fn(),
      readPixels: vi.fn((_x, _y, w, h, _fmt, _type, out) => {
        if (out instanceof Uint8Array || out instanceof Float32Array) {
          out.fill(128);
        }
      }),
      createBuffer: vi.fn(() => ({ id: Math.random() })),
      deleteBuffer: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      fenceSync: vi.fn(() => ({ id: Math.random() })),
      deleteSync: vi.fn(),
      clientWaitSync: vi.fn(() => 0x911a), // ALREADY_SIGNALED
      getBufferSubData: vi.fn((_target, _srcByteOffset, dst) => {
        if (dst instanceof Uint8Array || dst instanceof Float32Array) {
          dst.fill(42);
        }
      }),
      flush: vi.fn(),
      ...overrides,
    };
    return gl as unknown as WebGL2RenderingContext;
  }

  describe('P4-A1: Context & Capabilities (TC-401..404)', () => {
    it('TC-401: throws friendly error when WebGL2 is not available', () => {
      const mockCanvas = {
        getContext: vi.fn(() => null),
      } as unknown as HTMLCanvasElement;

      expect(() => createGpuContext({ canvas: mockCanvas })).toThrow(/WebGL2 is not supported/i);
    });

    it('TC-403: detects software renderer (SwiftShader / llvmpipe)', () => {
      const mockGl = createMockGl({
        getParameter: (param: number) => {
          if (param === 0x9246) return 'Google SwiftShader (Subzero)';
          return 'Google Inc.';
        },
      });

      const caps = queryGpuCapabilities(mockGl);
      expect(caps.isSoftware).toBe(true);
      expect(caps.renderer).toContain('SwiftShader');
    });

    it('TC-404: correctly queries hardware limits and float extensions', () => {
      const mockGl = createMockGl();
      const caps = queryGpuCapabilities(mockGl);

      expect(caps.maxTextureSize).toBe(8192);
      expect(caps.hasColorBufferFloat).toBe(true);
      expect(caps.hasTextureFloatLinear).toBe(true);
      expect(caps.hasFloatBlend).toBe(true);
      expect(caps.isSoftware).toBe(false);
    });
  });

  describe('P4-A2: Texture Pool (TC-405..409)', () => {
    it('TC-405: acquires, leases, and releases textures back to the pool', () => {
      const gl = createMockGl();
      const pool = new TexturePool({ gl, budgetBytes: 1024 * 1024 });

      const tex1 = pool.acquire(256, 256, 'RGBA8');
      expect(tex1.width).toBe(256);
      expect(tex1.height).toBe(256);
      expect(tex1.byteSize).toBe(256 * 256 * 4); // 262144 bytes

      let stats = pool.getStats();
      expect(stats.leasedCount).toBe(1);
      expect(stats.pooledCount).toBe(0);

      // Release back to pool
      pool.release(tex1);
      stats = pool.getStats();
      expect(stats.leasedCount).toBe(0);
      expect(stats.pooledCount).toBe(1);

      // Re-acquiring exact same format & dimensions reuses cached texture
      const tex2 = pool.acquire(256, 256, 'RGBA8');
      expect(tex2.texture).toBe(tex1.texture);
      expect(pool.getStats().leasedCount).toBe(1);
      expect(pool.getStats().pooledCount).toBe(0);

      pool.dispose();
      expect(gl.deleteTexture).toHaveBeenCalled();
    });

    it('TC-406: allocates RGBA16F with 8 bytes/pixel', () => {
      const gl = createMockGl();
      const pool = new TexturePool({ gl });

      const tex = pool.acquire(128, 128, 'RGBA16F');
      expect(tex.byteSize).toBe(128 * 128 * 8); // 131072 bytes
      pool.release(tex);
      pool.dispose();
    });

    it('TC-407: evicts unleased textures via LRU when budget is exceeded', () => {
      const gl = createMockGl();
      const evicted: PooledTexture[] = [];
      // Budget allows only one 256x256 RGBA8 texture (262144 B)
      const pool = new TexturePool({
        gl,
        budgetBytes: 300000,
        onEvict: (t) => evicted.push(t),
      });

      const texA = pool.acquire(256, 256, 'RGBA8');
      pool.release(texA); // texA is in pool

      // Acquiring texB requires another 262144 B, exceeding 300000 B
      const texB = pool.acquire(256, 256, 'RGBA8');
      expect(texB.texture).toBe(texA.texture); // Reused texA since it matched exactly!

      // Now allocate a different size that requires eviction of texB if texB were pooled
      pool.release(texB);
      const texC = pool.acquire(512, 128, 'RGBA8'); // different key: 512x128
      expect(evicted.length).toBe(1);
      expect(evicted[0].texture).toBe(texA.texture);

      pool.release(texC);
      pool.dispose();
    });
  });

  describe('P4-A3: Program Manager & Shader Compilation (TC-410)', () => {
    it('TC-410: compiles and caches program, and formats syntax errors cleanly', () => {
      const gl = createMockGl();
      const pm = new ProgramManager(gl);

      const fragShader = `
        void main() {
          fragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
      `;

      const prog1 = pm.getOrCreateProgram('test_red', fragShader, { OP: 1 });
      expect(gl.createProgram).toHaveBeenCalledTimes(1);

      // Second request with same defines uses cache
      const prog2 = pm.getOrCreateProgram('test_red', fragShader, { OP: 1 });
      expect(prog1.program).toBe(prog2.program);
      expect(gl.createProgram).toHaveBeenCalledTimes(1);

      // Test uniform setting
      prog1.use();
      prog1.uniforms.setInt('u_mode', 2);
      expect(gl.uniform1i).toHaveBeenCalledWith({ name: 'u_mode' }, 2);

      // Test compilation failure reporting
      const failingGl = createMockGl({
        getShaderParameter: vi.fn(() => false),
        getShaderInfoLog: vi.fn(() => 'ERROR: 0:5: Syntax error near token'),
      });
      const failingPm = new ProgramManager(failingGl);

      expect(() => failingPm.getOrCreateProgram('bad', 'invalid syntax')).toThrow(
        /Shader compilation failed/i
      );

      pm.dispose();
    });
  });

  describe('P4-A4: Readback Manager (TC-411)', () => {
    it('TC-411: performs synchronous readback of RGBA8 data', () => {
      const gl = createMockGl();
      const fbo = new FboManager(gl);
      const rm = new ReadbackManager(gl, fbo);

      const dummyTex = { id: 1 } as unknown as WebGLTexture;
      const result = rm.readTextureSync(dummyTex, { width: 16, height: 16 }, 'RGBA8');

      expect(result.width).toBe(16);
      expect(result.height).toBe(16);
      expect(result.data.length).toBe(16 * 16 * 4);
      expect(result.data[0]).toBe(128);

      rm.dispose();
      fbo.dispose();
    });

    it('TC-411: performs asynchronous readback via PBO and sync fences', async () => {
      const gl = createMockGl();
      const fbo = new FboManager(gl);
      const rm = new ReadbackManager(gl, fbo);

      const dummyTex = { id: 2 } as unknown as WebGLTexture;
      const result = await rm.readTextureAsync(dummyTex, { width: 8, height: 8 }, 'RGBA8');

      expect(result.width).toBe(8);
      expect(result.height).toBe(8);
      expect(result.data.length).toBe(8 * 8 * 4);
      expect(result.data[0]).toBe(42);

      rm.dispose();
      fbo.dispose();
    });
  });
});
