/**
 * ARKH TextureLab - Shader Program Compilation, Caching, and Uniform Management
 */

import { FULLSCREEN_VERTEX_SHADER, COMMON_GLSL_HEADER } from './shaders/common';

export interface UniformHelper {
  setInt: (name: string, value: number) => void;
  setFloat: (name: string, value: number) => void;
  setVec2: (name: string, x: number, y: number) => void;
  setVec3: (name: string, x: number, y: number, z: number) => void;
  setVec4: (name: string, x: number, y: number, z: number, w: number) => void;
  setMat3: (name: string, values: Float32Array | number[]) => void;
  setTexture: (name: string, unit: number, texture: WebGLTexture | null) => void;
}

export interface GpuProgram {
  program: WebGLProgram;
  uniforms: UniformHelper;
  use: () => void;
}

export class ProgramManager {
  private gl: WebGL2RenderingContext;
  private cache = new Map<string, GpuProgram>();
  private vao: WebGLVertexArrayObject | null = null;
  private vertShader: WebGLShader | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.vao = gl.createVertexArray();
  }

  public getEmptyVao(): WebGLVertexArrayObject {
    if (!this.vao) {
      this.vao = this.gl.createVertexArray();
    }
    return this.vao!;
  }

  public getOrCreateProgram(
    shaderId: string,
    fragmentSource: string,
    defines: Record<string, string | number | boolean> = {}
  ): GpuProgram {
    const definesKey = Object.entries(defines)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(';');
    const cacheKey = `${shaderId}::${definesKey}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const compiled = this.compileProgram(fragmentSource, defines);
    this.cache.set(cacheKey, compiled);
    return compiled;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error(`Failed to create WebGL shader of type ${type}`);
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || 'Unknown compilation error';
      gl.deleteShader(shader);

      const lines = source.split('\n');
      const annotated = lines
        .map((line, idx) => `${String(idx + 1).padStart(4, ' ')}: ${line}`)
        .join('\n');

      throw new Error(
        `Shader compilation failed (${type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'}):\n${info}\n\nSource:\n${annotated}`
      );
    }

    return shader;
  }

  private getSharedVertexShader(): WebGLShader {
    if (!this.vertShader) {
      this.vertShader = this.compileShader(this.gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SHADER);
    }
    return this.vertShader;
  }

  private compileProgram(
    fragmentSource: string,
    defines: Record<string, string | number | boolean>
  ): GpuProgram {
    const gl = this.gl;
    const vert = this.getSharedVertexShader();

    let defineHeader = '';
    for (const [key, val] of Object.entries(defines)) {
      defineHeader += `#define ${key} ${val}\n`;
    }

    const fullFragSource = `${COMMON_GLSL_HEADER}\n${defineHeader}\n${fragmentSource}`;
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fullFragSource);

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(frag);
      throw new Error('Failed to create WebGLProgram');
    }

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) || 'Unknown linker error';
      gl.deleteShader(frag);
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${info}`);
    }

    // Shaders can be detached once linked
    gl.detachShader(program, vert);
    gl.detachShader(program, frag);
    gl.deleteShader(frag);

    const locationCache = new Map<string, WebGLUniformLocation | null>();
    const getLocation = (name: string): WebGLUniformLocation | null => {
      if (!locationCache.has(name)) {
        locationCache.set(name, gl.getUniformLocation(program, name));
      }
      return locationCache.get(name)!;
    };

    const uniforms: UniformHelper = {
      setInt: (name, val) => {
        const loc = getLocation(name);
        if (loc) gl.uniform1i(loc, val);
      },
      setFloat: (name, val) => {
        const loc = getLocation(name);
        if (loc) gl.uniform1f(loc, val);
      },
      setVec2: (name, x, y) => {
        const loc = getLocation(name);
        if (loc) gl.uniform2f(loc, x, y);
      },
      setVec3: (name, x, y, z) => {
        const loc = getLocation(name);
        if (loc) gl.uniform3f(loc, x, y, z);
      },
      setVec4: (name, x, y, z, w) => {
        const loc = getLocation(name);
        if (loc) gl.uniform4f(loc, x, y, z, w);
      },
      setMat3: (name, values) => {
        const loc = getLocation(name);
        if (loc) gl.uniformMatrix3fv(loc, false, values);
      },
      setTexture: (name, unit, tex) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        const loc = getLocation(name);
        if (loc) gl.uniform1i(loc, unit);
      },
    };

    return {
      program,
      uniforms,
      use: () => {
        gl.useProgram(program);
      },
    };
  }

  public drawFullscreen(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.getEmptyVao());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  public dispose(): void {
    const gl = this.gl;
    for (const item of this.cache.values()) {
      gl.deleteProgram(item.program);
    }
    this.cache.clear();

    if (this.vertShader) {
      gl.deleteShader(this.vertShader);
      this.vertShader = null;
    }
    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }
  }
}
