/**
 * Client-Side Pixel Processing Engine
 * Offscreen Canvas2D / Web Worker pipeline for live PBR multiplexing, proxy rendering, and channel isolation.
 */

export interface TextureBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA 8-bit
  dataUrl?: string;
  proxy?: TextureBuffer; // Downsampled 512px interactive proxy for 60 FPS slider dragging
}

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  lum: number[];
  maxCount: number;
}

export class PixelEngine {
  private static offscreenCanvas: HTMLCanvasElement | null = null;
  private static offscreenCtx: CanvasRenderingContext2D | null = null;
  private static worker: Worker | null = null;
  private static workerCallbacks = new Map<number, (res: any) => void>();
  private static workerReqId = 0;

  private static getContext(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    return { canvas: this.offscreenCanvas, ctx: this.offscreenCtx! };
  }

  /**
   * Lazily initialize Web Worker
   */
  public static getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./pixelWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        const { reqId, ...result } = e.data;
        if (reqId !== undefined) {
          const cb = this.workerCallbacks.get(reqId);
          if (cb) {
            this.workerCallbacks.delete(reqId);
            cb(result);
          }
        }
      };
    }
    return this.worker;
  }

  /**
   * Run Levels on Web Worker (Non-blocking 4K execution)
   */
  public static async applyLevelsAsync(
    buffer: TextureBuffer,
    blackPoint = 0,
    gamma = 1.0,
    whitePoint = 255,
    outBlack = 0,
    outWhite = 255
  ): Promise<TextureBuffer> {
    return new Promise((resolve) => {
      const worker = this.getWorker();
      const reqId = ++this.workerReqId;
      this.workerCallbacks.set(reqId, (result) => {
        const outBuf: TextureBuffer = {
          width: result.width,
          height: result.height,
          data: result.data,
        };
        outBuf.dataUrl = this.toDataUrl(outBuf);
        outBuf.proxy = this.createDownsampledProxy(outBuf, 512);
        resolve(outBuf);
      });

      // Clone data array for worker transfer
      const dataCopy = new Uint8ClampedArray(buffer.data);
      worker.postMessage(
        {
          reqId,
          action: 'levels',
          width: buffer.width,
          height: buffer.height,
          data: dataCopy,
          blackPoint,
          gamma,
          whitePoint,
          outBlack,
          outWhite,
        },
        [dataCopy.buffer]
      );
    });
  }

  /**
   * Run PBR Texture Blend on Web Worker
   */
  public static async applyBlendAsync(
    bufA: TextureBuffer,
    bufB: TextureBuffer,
    maskBuf?: TextureBuffer,
    mode: 'lerp' | 'multiply' | 'screen' | 'overlay' | 'add' | 'min' | 'max' = 'lerp',
    opacity = 1.0
  ): Promise<TextureBuffer> {
    return new Promise((resolve) => {
      const worker = this.getWorker();
      const reqId = ++this.workerReqId;
      this.workerCallbacks.set(reqId, (result) => {
        const outBuf: TextureBuffer = {
          width: result.width,
          height: result.height,
          data: result.data,
        };
        outBuf.dataUrl = this.toDataUrl(outBuf);
        outBuf.proxy = this.createDownsampledProxy(outBuf, 512);
        resolve(outBuf);
      });

      const copyA = new Uint8ClampedArray(bufA.data);
      const copyB = new Uint8ClampedArray(bufB.data);
      const copyMask = maskBuf ? new Uint8ClampedArray(maskBuf.data) : undefined;

      const transfers: Transferable[] = [copyA.buffer, copyB.buffer];
      if (copyMask) transfers.push(copyMask.buffer);

      worker.postMessage(
        {
          reqId,
          action: 'blend',
          width: bufA.width,
          height: bufA.height,
          dataA: copyA,
          dataB: copyB,
          maskData: copyMask,
          mode,
          opacity,
        },
        transfers
      );
    });
  }

  /**
   * Run Reoriented Normal Mapping (RNM) on Web Worker
   */
  public static async applyNormalBlendAsync(
    baseBuf: TextureBuffer,
    detailBuf: TextureBuffer,
    detailStrength = 1.0
  ): Promise<TextureBuffer> {
    return new Promise((resolve) => {
      const worker = this.getWorker();
      const reqId = ++this.workerReqId;
      this.workerCallbacks.set(reqId, (result) => {
        const outBuf: TextureBuffer = {
          width: result.width,
          height: result.height,
          data: result.data,
        };
        outBuf.dataUrl = this.toDataUrl(outBuf);
        outBuf.proxy = this.createDownsampledProxy(outBuf, 512);
        resolve(outBuf);
      });

      const copyBase = new Uint8ClampedArray(baseBuf.data);
      const copyDetail = new Uint8ClampedArray(detailBuf.data);

      worker.postMessage(
        {
          reqId,
          action: 'normalBlend',
          width: baseBuf.width,
          height: baseBuf.height,
          baseData: copyBase,
          detailData: copyDetail,
          detailStrength,
        },
        [copyBase.buffer, copyDetail.buffer]
      );
    });
  }

  /**
   * Run Channel Swizzle on Web Worker
   */
  public static async applySwizzleAsync(
    buffer: TextureBuffer,
    rSrc = 'r',
    gSrc = 'g',
    bSrc = 'b',
    aSrc = 'a'
  ): Promise<TextureBuffer> {
    return new Promise((resolve) => {
      const worker = this.getWorker();
      const reqId = ++this.workerReqId;
      this.workerCallbacks.set(reqId, (result) => {
        const outBuf: TextureBuffer = {
          width: result.width,
          height: result.height,
          data: result.data,
        };
        outBuf.dataUrl = this.toDataUrl(outBuf);
        outBuf.proxy = this.createDownsampledProxy(outBuf, 512);
        resolve(outBuf);
      });

      const dataCopy = new Uint8ClampedArray(buffer.data);
      worker.postMessage(
        {
          reqId,
          action: 'swizzle',
          width: buffer.width,
          height: buffer.height,
          data: dataCopy,
          rSrc,
          gSrc,
          bSrc,
          aSrc,
        },
        [dataCopy.buffer]
      );
    });
  }

  /**
   * Load texture image from URL into TextureBuffer with automatic 512px proxy generation
   */
  public static async loadFromUrl(url: string): Promise<TextureBuffer> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const { canvas, ctx } = this.getContext(img.width, img.height);
        ctx.clearRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);

        const fullBuffer: TextureBuffer = {
          width: img.width,
          height: img.height,
          data: imgData.data,
          dataUrl: canvas.toDataURL('image/png'),
        };

        // Create interactive proxy
        fullBuffer.proxy = this.createDownsampledProxy(fullBuffer, 512);

        resolve(fullBuffer);
      };
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  }

  /**
   * Load texture from local File object (drag-and-drop)
   */
  public static async loadFromFile(file: File): Promise<TextureBuffer> {
    const objectUrl = URL.createObjectURL(file);
    try {
      return await this.loadFromUrl(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Create interactive downsampled proxy buffer (e.g. 512x512) for ultra-fast 60 FPS response
   */
  public static createDownsampledProxy(source: TextureBuffer, maxDim = 512): TextureBuffer {
    if (source.width <= maxDim && source.height <= maxDim) {
      return source;
    }

    const scale = Math.min(maxDim / source.width, maxDim / source.height);
    const pw = Math.max(64, Math.round(source.width * scale));
    const ph = Math.max(64, Math.round(source.height * scale));

    const { canvas: srcCanvas, ctx: srcCtx } = this.getContext(source.width, source.height);
    const srcImgData = srcCtx.createImageData(source.width, source.height);
    srcImgData.data.set(source.data);
    srcCtx.putImageData(srcImgData, 0, 0);

    // Downscale onto a temporary offscreen canvas
    const proxyCanvas = document.createElement('canvas');
    proxyCanvas.width = pw;
    proxyCanvas.height = ph;
    const proxyCtx = proxyCanvas.getContext('2d', { willReadFrequently: true });
    if (!proxyCtx) {
      return source;
    }

    proxyCtx.imageSmoothingEnabled = true;
    proxyCtx.imageSmoothingQuality = 'medium';
    proxyCtx.drawImage(srcCanvas, 0, 0, pw, ph);

    const proxyImgData = proxyCtx.getImageData(0, 0, pw, ph);
    const proxyBuf: TextureBuffer = {
      width: pw,
      height: ph,
      data: proxyImgData.data,
      dataUrl: proxyCanvas.toDataURL('image/png'),
    };

    return proxyBuf;
  }

  /**
   * Create solid color buffer
   */
  public static createSolid(width: number, height: number, r: number, g: number, b: number, a = 255): TextureBuffer {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 0] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = a;
    }
    const buf: TextureBuffer = { width, height, data };
    buf.dataUrl = this.toDataUrl(buf);
    buf.proxy = buf;
    return buf;
  }

  /**
   * Convert TextureBuffer to dataUrl for <img> tags
   */
  public static toDataUrl(buffer: TextureBuffer): string {
    const { canvas, ctx } = this.getContext(buffer.width, buffer.height);
    const imgData = ctx.createImageData(buffer.width, buffer.height);
    imgData.data.set(buffer.data);
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /**
   * Extract isolated channel as grayscale display (channel: 0=R, 1=G, 2=B, 3=A)
   */
  public static getIsolatedChannel(buffer: TextureBuffer, channel: 0 | 1 | 2 | 3): TextureBuffer {
    const outData = new Uint8ClampedArray(buffer.width * buffer.height * 4);
    const inData = buffer.data;

    for (let i = 0; i < buffer.width * buffer.height; i++) {
      const val = inData[i * 4 + channel];
      outData[i * 4 + 0] = val;
      outData[i * 4 + 1] = val;
      outData[i * 4 + 2] = val;
      outData[i * 4 + 3] = 255;
    }

    return {
      width: buffer.width,
      height: buffer.height,
      data: outData,
    };
  }

  /**
   * Multiplex separate R, G, B, A buffers into a single packed RGBA texture
   */
  public static combineChannels(
    rBuf?: TextureBuffer,
    gBuf?: TextureBuffer,
    bBuf?: TextureBuffer,
    aBuf?: TextureBuffer,
    targetDim?: number,
    fallbacks?: { r?: number; g?: number; b?: number; a?: number }
  ): TextureBuffer {
    const w = targetDim || Math.max(rBuf?.width || 0, gBuf?.width || 0, bBuf?.width || 0, aBuf?.width || 0, 512);
    const h = targetDim || Math.max(rBuf?.height || 0, gBuf?.height || 0, bBuf?.height || 0, aBuf?.height || 0, 512);

    const defR = fallbacks?.r ?? 255;
    const defG = fallbacks?.g ?? 128;
    const defB = fallbacks?.b ?? 0;
    const defA = fallbacks?.a ?? 255;

    const outData = new Uint8ClampedArray(w * h * 4);

    const sampleChannel = (buf: TextureBuffer | undefined, defaultVal: number, chIdx: number, x: number, y: number): number => {
      if (!buf) return defaultVal;
      const bx = Math.floor((x / w) * buf.width);
      const by = Math.floor((y / h) * buf.height);
      const idx = (by * buf.width + bx) * 4 + chIdx;
      return buf.data[idx] !== undefined ? buf.data[idx] : defaultVal;
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const outIdx = (y * w + x) * 4;
        outData[outIdx + 0] = sampleChannel(rBuf, defR, 0, x, y); // R (AO default 255)
        outData[outIdx + 1] = sampleChannel(gBuf, defG, 1, x, y); // G (Roughness default 128)
        outData[outIdx + 2] = sampleChannel(bBuf, defB, 2, x, y); // B (Metallic default 0)
        outData[outIdx + 3] = sampleChannel(aBuf, defA, 3, x, y); // A (Height/Alpha default 255)
      }
    }

    const buf: TextureBuffer = { width: w, height: h, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
    buf.proxy = this.createDownsampledProxy(buf, 512);
    return buf;
  }

  /**
   * Split a packed RGBA texture into 4 separate single-channel grayscale buffers
   */
  public static splitChannels(buffer: TextureBuffer): {
    r: TextureBuffer;
    g: TextureBuffer;
    b: TextureBuffer;
    a: TextureBuffer;
  } {
    return {
      r: this.getIsolatedChannel(buffer, 0),
      g: this.getIsolatedChannel(buffer, 1),
      b: this.getIsolatedChannel(buffer, 2),
      a: this.getIsolatedChannel(buffer, 3),
    };
  }

  /**
   * Invert channel values (1 - x)
   */
  public static invertBuffer(buffer: TextureBuffer): TextureBuffer {
    const outData = new Uint8ClampedArray(buffer.data.length);
    for (let i = 0; i < buffer.data.length; i += 4) {
      outData[i + 0] = 255 - buffer.data[i + 0];
      outData[i + 1] = 255 - buffer.data[i + 1];
      outData[i + 2] = 255 - buffer.data[i + 2];
      outData[i + 3] = buffer.data[i + 3];
    }
    const buf: TextureBuffer = { width: buffer.width, height: buffer.height, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
    buf.proxy = this.createDownsampledProxy(buf, 512);
    return buf;
  }

  /**
   * Flip green channel for normal map conversion (DirectX <=> OpenGL) with optional normal strength
   */
  public static flipGreenChannel(buffer: TextureBuffer, strength = 1.0): TextureBuffer {
    const outData = new Uint8ClampedArray(buffer.data);
    for (let i = 0; i < buffer.data.length; i += 4) {
      const g = 255 - buffer.data[i + 1];
      if (strength !== 1.0) {
        const r = buffer.data[i + 0];
        const nr = (r - 128) * strength + 128;
        const ng = (g - 128) * strength + 128;
        outData[i + 0] = Math.min(255, Math.max(0, Math.round(nr)));
        outData[i + 1] = Math.min(255, Math.max(0, Math.round(ng)));
      } else {
        outData[i + 1] = g;
      }
    }
    const buf: TextureBuffer = { width: buffer.width, height: buffer.height, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
    buf.proxy = this.createDownsampledProxy(buf, 512);
    return buf;
  }

  /**
   * Apply Levels adjustment with range remapping (Input Black/White -> Output Black/White)
   */
  public static applyLevels(
    buffer: TextureBuffer,
    blackPoint = 0, // 0..255
    gamma = 1.0,    // 0.1..5.0
    whitePoint = 255, // 0..255
    outBlack = 0,   // 0..255
    outWhite = 255  // 0..255
  ): TextureBuffer {
    const outData = new Uint8ClampedArray(buffer.data.length);
    const inRange = Math.max(1, whitePoint - blackPoint);
    const outRange = outWhite - outBlack;

    // Precompute LUT for instant execution
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let normalized = (i - blackPoint) / inRange;
      normalized = Math.min(1.0, Math.max(0.0, normalized));
      const adjusted = Math.pow(normalized, 1.0 / gamma);
      const remapped = Math.round(outBlack + adjusted * outRange);
      lut[i] = Math.min(255, Math.max(0, remapped));
    }

    for (let i = 0; i < buffer.data.length; i += 4) {
      outData[i + 0] = lut[buffer.data[i + 0]];
      outData[i + 1] = lut[buffer.data[i + 1]];
      outData[i + 2] = lut[buffer.data[i + 2]];
      outData[i + 3] = buffer.data[i + 3];
    }

    const buf: TextureBuffer = { width: buffer.width, height: buffer.height, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
    buf.proxy = this.createDownsampledProxy(buf, 512);
    return buf;
  }

  /**
   * PBR Blend / Mix Buffers
   */
  public static blendBuffers(
    bufA: TextureBuffer,
    bufB: TextureBuffer,
    maskBuf?: TextureBuffer,
    mode: 'lerp' | 'multiply' | 'screen' | 'overlay' | 'add' | 'min' | 'max' = 'lerp',
    opacity = 1.0
  ): TextureBuffer {
    const w = bufA.width;
    const h = bufA.height;
    const outData = new Uint8ClampedArray(w * h * 4);
    const dataA = bufA.data;
    const dataB = bufB.data;
    const maskData = maskBuf?.data;

    const blendChannel = (a: number, b: number): number => {
      switch (mode) {
        case 'multiply': return a * b;
        case 'screen': return 1 - (1 - a) * (1 - b);
        case 'overlay': return a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
        case 'add': return Math.min(1.0, a + b);
        case 'min': return Math.min(a, b);
        case 'max': return Math.max(a, b);
        case 'lerp':
        default: return b;
      }
    };

    for (let i = 0; i < dataA.length; i += 4) {
      const aR = dataA[i + 0] / 255;
      const aG = dataA[i + 1] / 255;
      const aB = dataA[i + 2] / 255;

      const bR = dataB[i + 0] / 255;
      const bG = dataB[i + 1] / 255;
      const bB = dataB[i + 2] / 255;

      const m = (maskData ? maskData[i + 0] / 255 : 1.0) * opacity;
      const invM = 1.0 - m;

      outData[i + 0] = Math.round((aR * invM + blendChannel(aR, bR) * m) * 255);
      outData[i + 1] = Math.round((aG * invM + blendChannel(aG, bG) * m) * 255);
      outData[i + 2] = Math.round((aB * invM + blendChannel(aB, bB) * m) * 255);
      outData[i + 3] = dataA[i + 3];
    }

    const buf: TextureBuffer = { width: w, height: h, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
    buf.proxy = this.createDownsampledProxy(buf, 512);
    return buf;
  }

  /**
   * Reoriented Normal Mapping (RNM)
   */
  public static blendNormalRNM(
    baseBuf: TextureBuffer,
    detailBuf: TextureBuffer,
    detailStrength = 1.0
  ): TextureBuffer {
    const w = baseBuf.width;
    const h = baseBuf.height;
    const outData = new Uint8ClampedArray(w * h * 4);
    const baseData = baseBuf.data;
    const detailData = detailBuf.data;

    for (let i = 0; i < baseData.length; i += 4) {
      const n1x = (baseData[i + 0] / 255) * 2.0 - 1.0;
      const n1y = (baseData[i + 1] / 255) * 2.0 - 1.0;
      const n1z = (baseData[i + 2] / 255) * 2.0 - 1.0;

      const n2x = ((detailData[i + 0] / 255) * 2.0 - 1.0) * detailStrength;
      const n2y = ((detailData[i + 1] / 255) * 2.0 - 1.0) * detailStrength;
      const rawZ = (detailData[i + 2] / 255) * 2.0 - 1.0;
      const n2z = Math.max(0.001, rawZ);

      const tx = n1x + n2x;
      const ty = n1y + n2y;
      const tz = n1z * n2z;

      const lenVec = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1.0;
      const rx = tx / lenVec;
      const ry = ty / lenVec;
      const rz = tz / lenVec;

      outData[i + 0] = Math.min(255, Math.max(0, Math.round((rx * 0.5 + 0.5) * 255)));
      outData[i + 1] = Math.min(255, Math.max(0, Math.round((ry * 0.5 + 0.5) * 255)));
      outData[i + 2] = Math.min(255, Math.max(0, Math.round((rz * 0.5 + 0.5) * 255)));
      outData[i + 3] = 255;
    }

    const buf: TextureBuffer = { width: w, height: h, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
    buf.proxy = this.createDownsampledProxy(buf, 512);
    return buf;
  }

  /**
   * Channel Swizzle
   */
  public static swizzleBuffer(
    buffer: TextureBuffer,
    rSrc = 'r',
    gSrc = 'g',
    bSrc = 'b',
    aSrc = 'a'
  ): TextureBuffer {
    const w = buffer.width;
    const h = buffer.height;
    const outData = new Uint8ClampedArray(w * h * 4);
    const data = buffer.data;

    const resolveChannel = (src: string, r: number, g: number, b: number, a: number): number => {
      switch (src) {
        case 'r': return r;
        case 'g': return g;
        case 'b': return b;
        case 'a': return a;
        case '1-r': return 255 - r;
        case '1-g': return 255 - g;
        case '1-b': return 255 - b;
        case '1-a': return 255 - a;
        case '0': return 0;
        case '1': return 255;
        default: return 0;
      }
    };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i + 0];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      outData[i + 0] = resolveChannel(rSrc, r, g, b, a);
      outData[i + 1] = resolveChannel(gSrc, r, g, b, a);
      outData[i + 2] = resolveChannel(bSrc, r, g, b, a);
      outData[i + 3] = resolveChannel(aSrc, r, g, b, a);
    }

    const buf: TextureBuffer = { width: w, height: h, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
    buf.proxy = this.createDownsampledProxy(buf, 512);
    return buf;
  }

  /**
   * Compute RGB and Luminance Histograms (256 bins)
   */
  public static computeHistogram(buffer: TextureBuffer): HistogramData {
    // Fast path: use proxy buffer for histogram if available to avoid 16M pixel iterations
    const target = buffer.proxy || buffer;
    const data = target.data;
    const r = new Array(256).fill(0);
    const g = new Array(256).fill(0);
    const b = new Array(256).fill(0);
    const lum = new Array(256).fill(0);

    let maxCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const rv = data[i + 0];
      const gv = data[i + 1];
      const bv = data[i + 2];
      const lv = Math.round(0.2126 * rv + 0.7152 * gv + 0.0722 * bv);

      r[rv]++;
      g[gv]++;
      b[bv]++;
      lum[lv]++;

      if (r[rv] > maxCount) maxCount = r[rv];
      if (g[gv] > maxCount) maxCount = g[gv];
      if (b[bv] > maxCount) maxCount = b[bv];
      if (lum[lv] > maxCount) maxCount = lum[lv];
    }

    return { r, g, b, lum, maxCount: Math.max(1, maxCount) };
  }

  /**
   * Direct Browser File Download
   */
  public static downloadBuffer(buffer: TextureBuffer, filename: string) {
    const { canvas, ctx } = this.getContext(buffer.width, buffer.height);
    const imgData = ctx.createImageData(buffer.width, buffer.height);
    imgData.data.set(buffer.data);
    ctx.putImageData(imgData, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
}
