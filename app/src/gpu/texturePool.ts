/**
 * ARKH TextureLab - GPU Texture Pool with Ref Counting and LRU Eviction
 */

export type TextureFormat = 'RGBA8' | 'RGBA16F';

export interface PooledTexture {
  id: number;
  texture: WebGLTexture;
  width: number;
  height: number;
  format: TextureFormat;
  byteSize: number;
  refCount: number;
  lastUsedTimestamp: number;
}

export interface TexturePoolStats {
  totalAllocatedBytes: number;
  leasedBytes: number;
  pooledBytes: number;
  totalCount: number;
  leasedCount: number;
  pooledCount: number;
}

export interface TexturePoolOptions {
  gl: WebGL2RenderingContext;
  budgetBytes?: number; // Default 1.5 GiB
  onEvict?: (tex: PooledTexture) => void;
}

export class TexturePool {
  private gl: WebGL2RenderingContext;
  private budgetBytes: number;
  private onEvict?: (tex: PooledTexture) => void;
  private nextId = 1;

  // Active leased textures
  private leased = new Map<WebGLTexture, PooledTexture>();

  // Inactive textures available for reuse, keyed by `${format}:${width}x${height}`
  private pool = new Map<string, PooledTexture[]>();

  // Accounting
  private allocatedBytes = 0;

  constructor(options: TexturePoolOptions) {
    this.gl = options.gl;
    this.budgetBytes = options.budgetBytes ?? 1.5 * 1024 * 1024 * 1024;
    this.onEvict = options.onEvict;
  }

  public static bytesPerPixel(format: TextureFormat): number {
    return format === 'RGBA16F' ? 8 : 4;
  }

  public getStats(): TexturePoolStats {
    let pooledBytes = 0;
    let pooledCount = 0;
    for (const list of this.pool.values()) {
      for (const item of list) {
        pooledBytes += item.byteSize;
        pooledCount++;
      }
    }

    let leasedBytes = 0;
    for (const item of this.leased.values()) {
      leasedBytes += item.byteSize;
    }

    return {
      totalAllocatedBytes: this.allocatedBytes,
      leasedBytes,
      pooledBytes,
      totalCount: this.leased.size + pooledCount,
      leasedCount: this.leased.size,
      pooledCount,
    };
  }

  public acquire(width: number, height: number, format: TextureFormat = 'RGBA8'): PooledTexture {
    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid texture dimensions: ${width}x${height}`);
    }

    const key = `${format}:${width}x${height}`;
    const list = this.pool.get(key);

    if (list && list.length > 0) {
      const tex = list.pop()!;
      tex.refCount = 1;
      tex.lastUsedTimestamp = Date.now();
      this.leased.set(tex.texture, tex);
      return tex;
    }

    const byteSize = width * height * TexturePool.bytesPerPixel(format);

    // Evict if exceeding budget
    if (this.allocatedBytes + byteSize > this.budgetBytes) {
      this.evictToFit(byteSize);
    }

    const glTex = this.createGlTexture(width, height, format);
    const pooled: PooledTexture = {
      id: this.nextId++,
      texture: glTex,
      width,
      height,
      format,
      byteSize,
      refCount: 1,
      lastUsedTimestamp: Date.now(),
    };

    this.allocatedBytes += byteSize;
    this.leased.set(glTex, pooled);
    return pooled;
  }

  public retain(pooled: PooledTexture): void {
    if (pooled.refCount <= 0) {
      throw new Error(`Cannot retain already freed texture ${pooled.id}`);
    }
    pooled.refCount++;
  }

  public release(pooled: PooledTexture): void {
    const existing = this.leased.get(pooled.texture);
    if (!existing) {
      return; // Already released
    }

    existing.refCount--;
    if (existing.refCount <= 0) {
      existing.refCount = 0;
      existing.lastUsedTimestamp = Date.now();
      this.leased.delete(existing.texture);

      const key = `${existing.format}:${existing.width}x${existing.height}`;
      let list = this.pool.get(key);
      if (!list) {
        list = [];
        this.pool.set(key, list);
      }
      list.push(existing);
    }
  }

  private evictToFit(bytesNeeded: number): void {
    // Collect all unleased textures across all pool buckets
    const candidates: { key: string; index: number; tex: PooledTexture }[] = [];
    for (const [key, list] of this.pool.entries()) {
      for (let i = 0; i < list.length; i++) {
        candidates.push({ key, index: i, tex: list[i] });
      }
    }

    // Sort by oldest lastUsedTimestamp
    candidates.sort((a, b) => a.tex.lastUsedTimestamp - b.tex.lastUsedTimestamp);

    let freed = 0;
    for (const c of candidates) {
      if (this.allocatedBytes + bytesNeeded <= this.budgetBytes) break;
      const list = this.pool.get(c.key);
      if (!list) continue;

      const idx = list.indexOf(c.tex);
      if (idx !== -1) {
        list.splice(idx, 1);
        this.destroyGlTexture(c.tex);
        this.allocatedBytes -= c.tex.byteSize;
        freed += c.tex.byteSize;
        this.onEvict?.(c.tex);
      }
    }
  }

  private createGlTexture(width: number, height: number, format: TextureFormat): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) {
      throw new Error('Failed to create WebGLTexture');
    }

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    if (format === 'RGBA16F') {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        width,
        height,
        0,
        gl.RGBA,
        gl.HALF_FLOAT,
        null
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  private destroyGlTexture(tex: PooledTexture): void {
    if (this.gl && tex.texture) {
      this.gl.deleteTexture(tex.texture);
    }
  }

  public dispose(): void {
    for (const item of this.leased.values()) {
      this.destroyGlTexture(item);
    }
    this.leased.clear();

    for (const list of this.pool.values()) {
      for (const item of list) {
        this.destroyGlTexture(item);
      }
    }
    this.pool.clear();
    this.allocatedBytes = 0;
  }
}
