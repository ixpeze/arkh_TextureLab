/**
 * ARKH TextureLab - Sync & Async GPU Readback (PBO + fenceSync)
 */

import type { TextureFormat } from './texturePool';
import type { FboManager } from './fbo';

export interface ReadbackRect {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface ReadbackResult {
  width: number;
  height: number;
  format: TextureFormat;
  data: Uint8Array | Float32Array;
}

export class ReadbackManager {
  private gl: WebGL2RenderingContext;
  private fbo: FboManager;
  private maxConcurrentPbos: number;
  private pboPool: WebGLBuffer[] = [];
  private activePbos = 0;

  constructor(gl: WebGL2RenderingContext, fbo: FboManager, maxConcurrentPbos = 4) {
    this.gl = gl;
    this.fbo = fbo;
    this.maxConcurrentPbos = maxConcurrentPbos;
  }

  public readTextureSync(
    texture: WebGLTexture,
    rect: ReadbackRect,
    format: TextureFormat = 'RGBA8'
  ): ReadbackResult {
    const gl = this.gl;
    const x = rect.x ?? 0;
    const y = rect.y ?? 0;
    const w = rect.width;
    const h = rect.height;

    this.fbo.bindRenderTarget(texture, w, h);

    if (format === 'RGBA16F') {
      const data = new Float32Array(w * h * 4);
      gl.readPixels(x, y, w, h, gl.RGBA, gl.FLOAT, data);
      this.fbo.unbind();
      return { width: w, height: h, format, data };
    }

    const data = new Uint8Array(w * h * 4);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    this.fbo.unbind();
    return { width: w, height: h, format, data };
  }

  public async readTextureAsync(
    texture: WebGLTexture,
    rect: ReadbackRect,
    format: TextureFormat = 'RGBA8'
  ): Promise<ReadbackResult> {
    const gl = this.gl;
    const x = rect.x ?? 0;
    const y = rect.y ?? 0;
    const w = rect.width;
    const h = rect.height;

    // Wait if max concurrent PBOs reached
    while (this.activePbos >= this.maxConcurrentPbos) {
      await new Promise((r) => setTimeout(r, 8));
    }

    this.activePbos++;
    const pbo = this.acquirePbo();
    const byteLength = w * h * (format === 'RGBA16F' ? 16 : 4);

    try {
      this.fbo.bindRenderTarget(texture, w, h);

      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, byteLength, gl.STREAM_READ);

      if (format === 'RGBA16F') {
        gl.readPixels(x, y, w, h, gl.RGBA, gl.FLOAT, 0);
      } else {
        gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0);
      }

      this.fbo.unbind();

      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();

      // Poll sync completion
      await this.waitForSync(sync);
      if (sync) gl.deleteSync(sync);

      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
      if (format === 'RGBA16F') {
        const out = new Float32Array(w * h * 4);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        return { width: w, height: h, format, data: out };
      } else {
        const out = new Uint8Array(w * h * 4);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        return { width: w, height: h, format, data: out };
      }
    } finally {
      this.releasePbo(pbo);
      this.activePbos--;
    }
  }

  private acquirePbo(): WebGLBuffer {
    if (this.pboPool.length > 0) {
      return this.pboPool.pop()!;
    }
    const buf = this.gl.createBuffer();
    if (!buf) throw new Error('Failed to create PBO');
    return buf;
  }

  private releasePbo(pbo: WebGLBuffer): void {
    if (this.pboPool.length < this.maxConcurrentPbos) {
      this.pboPool.push(pbo);
    } else {
      this.gl.deleteBuffer(pbo);
    }
  }

  private waitForSync(sync: WebGLSync | null): Promise<void> {
    const gl = this.gl;
    if (!sync) return Promise.resolve();

    return new Promise((resolve) => {
      const check = () => {
        const res = gl.clientWaitSync(sync, 0, 0);
        if (
          res === gl.ALREADY_SIGNALED ||
          res === gl.CONDITION_SATISFIED ||
          res === gl.WAIT_FAILED
        ) {
          resolve();
        } else {
          setTimeout(check, 4);
        }
      };
      check();
    });
  }

  public dispose(): void {
    const gl = this.gl;
    for (const pbo of this.pboPool) {
      gl.deleteBuffer(pbo);
    }
    this.pboPool = [];
  }
}
