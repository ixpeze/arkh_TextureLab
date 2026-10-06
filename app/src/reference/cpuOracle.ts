/**
 * Client-Side Pixel Processing Engine
 * Offscreen Canvas2D / Web Worker pipeline for live PBR multiplexing, proxy rendering, and channel isolation.
 */

export interface TextureBuffer {
  width: number;
  height: number;
  data: any; // Uint8ClampedArray | Uint8Array | Uint16Array | Float32Array
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

export interface WorkerResponsePayload {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  histogram?: HistogramData;
  min?: number;
  max?: number;
  avg?: number;
  error?: string;
}

export class PixelEngine {
  private static offscreenCanvas: HTMLCanvasElement | null = null;
  private static offscreenCtx: CanvasRenderingContext2D | null = null;
  private static workerCallbacks = new Map<number, (res: WorkerResponsePayload) => void>();
  private static workerReqId = 0;

  private static getContext(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    if (typeof document === 'undefined') {
      return {
        canvas: {
          width,
          height,
          toDataURL: () => 'data:image/png;base64,mock',
        } as unknown as HTMLCanvasElement,
        ctx: {
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: () => {},
        } as unknown as CanvasRenderingContext2D,
      };
    }
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
    throw new Error('Web Worker removed in Phase 4; use GPU pipeline');
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
        const { ctx } = this.getContext(img.width, img.height);
        ctx.clearRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);

        // Create interactive downsampled proxy buffer first for fast previews
        const proxy = this.createDownsampledProxy({ width: img.width, height: img.height, data: imgData.data }, 512);

        const fullBuffer: TextureBuffer = {
          width: img.width,
          height: img.height,
          data: imgData.data,
          dataUrl: proxy.dataUrl,
          proxy,
        };

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

    // Direct pixel step subsampling: 0 memory allocations, 0 canvas operations for the 4K buffer!
    const proxyData = new Uint8ClampedArray(pw * ph * 4);
    const srcData = source.data;
    const srcW = source.width;
    const srcH = source.height;
    const stepX = srcW / pw;
    const stepY = srcH / ph;

    for (let y = 0; y < ph; y++) {
      const srcY = Math.min(srcH - 1, Math.floor(y * stepY));
      const srcRowOffset = srcY * srcW * 4;
      const dstRowOffset = y * pw * 4;

      for (let x = 0; x < pw; x++) {
        const srcX = Math.min(srcW - 1, Math.floor(x * stepX));
        const srcIdx = srcRowOffset + srcX * 4;
        const dstIdx = dstRowOffset + x * 4;

        proxyData[dstIdx + 0] = srcData[srcIdx + 0];
        proxyData[dstIdx + 1] = srcData[srcIdx + 1];
        proxyData[dstIdx + 2] = srcData[srcIdx + 2];
        proxyData[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }

    // Only create a small 512x512 canvas for the dataUrl preview (super fast, < 2ms)
    const { canvas: proxyCanvas, ctx: proxyCtx } = this.getContext(pw, ph);
    let dataUrl = '';
    if (proxyCtx) {
      const imgData = proxyCtx.createImageData(pw, ph);
      imgData.data.set(proxyData);
      proxyCtx.putImageData(imgData, 0, 0);
      dataUrl = proxyCanvas.toDataURL('image/png');
    }

    return {
      width: pw,
      height: ph,
      data: proxyData,
      dataUrl,
    };
  }

  /**
   * Bilinear resampling for TextureBuffer
   */
  public static resampleBuffer(buffer: TextureBuffer, newWidth: number, newHeight: number): TextureBuffer {
    if (buffer.width === newWidth && buffer.height === newHeight) {
      return buffer;
    }
    if (buffer.width === 1 && buffer.height === 1) {
      return this.createSolid(newWidth, newHeight, buffer.data[0], buffer.data[1], buffer.data[2], buffer.data[3]);
    }

    const srcData = buffer.data;
    const srcW = buffer.width;
    const srcH = buffer.height;
    const dstData = new Uint8ClampedArray(newWidth * newHeight * 4);

    const xRatio = srcW > 1 ? (srcW - 1) / (newWidth > 1 ? newWidth - 1 : 1) : 0;
    const yRatio = srcH > 1 ? (srcH - 1) / (newHeight > 1 ? newHeight - 1 : 1) : 0;

    for (let y = 0; y < newHeight; y++) {
      const srcY = y * yRatio;
      const yLow = Math.floor(srcY);
      const yHigh = Math.min(yLow + 1, srcH - 1);
      const yWeight = srcY - yLow;

      for (let x = 0; x < newWidth; x++) {
        const srcX = x * xRatio;
        const xLow = Math.floor(srcX);
        const xHigh = Math.min(xLow + 1, srcW - 1);
        const xWeight = srcX - xLow;

        const dstIdx = (y * newWidth + x) * 4;

        const idx00 = (yLow * srcW + xLow) * 4;
        const idx10 = (yLow * srcW + xHigh) * 4;
        const idx01 = (yHigh * srcW + xLow) * 4;
        const idx11 = (yHigh * srcW + xHigh) * 4;

        for (let c = 0; c < 4; c++) {
          const top = srcData[idx00 + c] * (1 - xWeight) + srcData[idx10 + c] * xWeight;
          const bottom = srcData[idx01 + c] * (1 - xWeight) + srcData[idx11 + c] * xWeight;
          dstData[dstIdx + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
        }
      }
    }

    const res: TextureBuffer = { width: newWidth, height: newHeight, data: dstData };
    res.proxy = this.createDownsampledProxy(res, 512);
    res.dataUrl = res.proxy.dataUrl;
    return res;
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
   * Multiplex separate R, G, B, A buffers into a single packed RGBA texture.
   * Supports both TextureBuffer and { buffer, channel } channel source inputs.
   */
  public static combineChannels(
    rInput?: TextureBuffer | { buffer?: TextureBuffer; channel?: number },
    gInput?: TextureBuffer | { buffer?: TextureBuffer; channel?: number },
    bInput?: TextureBuffer | { buffer?: TextureBuffer; channel?: number },
    aInput?: TextureBuffer | { buffer?: TextureBuffer; channel?: number },
    targetDim?: number,
    fallbacks?: { r?: number; g?: number; b?: number; a?: number }
  ): TextureBuffer {
    const unpack = (
      input?: TextureBuffer | { buffer?: TextureBuffer; channel?: number },
      defaultCh = 0
    ): { buf?: TextureBuffer; ch: number } => {
      if (!input) return { ch: defaultCh };
      if ('data' in input) return { buf: input, ch: defaultCh };
      return { buf: input.buffer, ch: input.channel ?? defaultCh };
    };

    const r = unpack(rInput, 0);
    const g = unpack(gInput, 1);
    const b = unpack(bInput, 2);
    const a = unpack(aInput, 3);

    const bufs = [r.buf, g.buf, b.buf, a.buf].filter((b): b is TextureBuffer => !!b);
    let w = targetDim;
    let h = targetDim;

    if (!w || !h) {
      if (bufs.length > 0) {
        let maxArea = 0;
        let maxBuf: TextureBuffer | null = null;
        for (const b of bufs) {
          const area = b.width * b.height;
          if (area > maxArea) {
            maxArea = area;
            maxBuf = b;
          }
        }
        if (maxBuf && maxArea > 1) {
          w = maxBuf.width;
          h = maxBuf.height;
        } else {
          w = 512;
          h = 512;
        }
      } else {
        w = 512;
        h = 512;
      }
    }

    const defR = fallbacks?.r ?? 255;
    const defG = fallbacks?.g ?? 128;
    const defB = fallbacks?.b ?? 0;
    const defA = fallbacks?.a ?? 255;

    const outData = new Uint8ClampedArray(w * h * 4);

    const sameDim =
      (!r.buf || (r.buf.width === w && r.buf.height === h)) &&
      (!g.buf || (g.buf.width === w && g.buf.height === h)) &&
      (!b.buf || (b.buf.width === w && b.buf.height === h)) &&
      (!a.buf || (a.buf.width === w && a.buf.height === h));

    if (sameDim) {
      // Ultra-fast path: flat sequential loop, direct memory access (12ms for 4K)
      const rData = r.buf?.data;
      const gData = g.buf?.data;
      const bData = b.buf?.data;
      const aData = a.buf?.data;
      const rCh = r.ch;
      const gCh = g.ch;
      const bCh = b.ch;
      const aCh = a.ch;

      for (let i = 0, px = 0; i < outData.length; i += 4, px++) {
        const srcOffset = px * 4;
        outData[i + 0] = rData ? (rData[srcOffset + rCh] ?? defR) : defR;
        outData[i + 1] = gData ? (gData[srcOffset + gCh] ?? defG) : defG;
        outData[i + 2] = bData ? (bData[srcOffset + bCh] ?? defB) : defB;
        outData[i + 3] = aData ? (aData[srcOffset + aCh] ?? defA) : defA;
      }
    } else {
      // Resolution mismatch path: normalized UV sampling with bilinear interpolation
      const sampleChannel = (buf: TextureBuffer | undefined, defaultVal: number, chIdx: number, x: number, y: number): number => {
        if (!buf || !buf.data || buf.data.length === 0) return defaultVal;
        if (buf.width === 1 && buf.height === 1) {
          return buf.data[chIdx] !== undefined ? buf.data[chIdx] : defaultVal;
        }

        const u = (x + 0.5) / w;
        const v = (y + 0.5) / h;
        const srcX = Math.max(0, Math.min(buf.width - 1, u * buf.width - 0.5));
        const srcY = Math.max(0, Math.min(buf.height - 1, v * buf.height - 0.5));
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(buf.width - 1, x0 + 1);
        const y1 = Math.min(buf.height - 1, y0 + 1);
        const fx = srcX - x0;
        const fy = srcY - y0;

        const d00 = buf.data[(y0 * buf.width + x0) * 4 + chIdx];
        const d10 = buf.data[(y0 * buf.width + x1) * 4 + chIdx];
        const d01 = buf.data[(y1 * buf.width + x0) * 4 + chIdx];
        const d11 = buf.data[(y1 * buf.width + x1) * 4 + chIdx];

        const top = d00 * (1 - fx) + d10 * fx;
        const bot = d01 * (1 - fx) + d11 * fx;
        return Math.round(top * (1 - fy) + bot * fy);
      };

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const outIdx = (y * w + x) * 4;
          outData[outIdx + 0] = sampleChannel(r.buf, defR, r.ch, x, y);
          outData[outIdx + 1] = sampleChannel(g.buf, defG, g.ch, x, y);
          outData[outIdx + 2] = sampleChannel(b.buf, defB, b.ch, x, y);
          outData[outIdx + 3] = sampleChannel(a.buf, defA, a.ch, x, y);
        }
      }
    }

    const buf: TextureBuffer = { width: w, height: h, data: outData };
    const proxy = this.createDownsampledProxy(buf, 512);
    buf.proxy = proxy;
    buf.dataUrl = proxy.dataUrl;
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
    const proxy = this.createDownsampledProxy(buf, 512);
    buf.proxy = proxy;
    buf.dataUrl = proxy.dataUrl;
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
    const proxy = this.createDownsampledProxy(buf, 512);
    buf.proxy = proxy;
    buf.dataUrl = proxy.dataUrl;
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
    const safeGamma = Math.max(0.01, Math.min(5.0, gamma || 1.0));

    // Precompute LUT for instant execution
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let normalized = (i - blackPoint) / inRange;
      normalized = Math.min(1.0, Math.max(0.0, normalized));
      const adjusted = Math.pow(normalized, 1.0 / safeGamma);
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
    const proxy = this.createDownsampledProxy(buf, 512);
    buf.proxy = proxy;
    buf.dataUrl = proxy.dataUrl;
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

    const safeOpacity = Math.max(0.0, Math.min(1.0, opacity ?? 1.0));
    const sameDim = bufB.width === w && bufB.height === h && (!maskBuf || (maskBuf.width === w && maskBuf.height === h));

    if (sameDim) {
      for (let i = 0; i < dataA.length; i += 4) {
        const aR = dataA[i + 0] / 255;
        const aG = dataA[i + 1] / 255;
        const aB = dataA[i + 2] / 255;

        const bR = (dataB[i + 0] ?? 0) / 255;
        const bG = (dataB[i + 1] ?? 0) / 255;
        const bB = (dataB[i + 2] ?? 0) / 255;

        const m = (maskData ? (maskData[i + 0] ?? 255) / 255 : 1.0) * safeOpacity;
        const invM = 1.0 - m;

        outData[i + 0] = Math.round((aR * invM + blendChannel(aR, bR) * m) * 255);
        outData[i + 1] = Math.round((aG * invM + blendChannel(aG, bG) * m) * 255);
        outData[i + 2] = Math.round((aB * invM + blendChannel(aB, bB) * m) * 255);
        outData[i + 3] = dataA[i + 3] ?? 255;
      }
    } else {
      // Resolution mismatch: sample B and Mask with normalized UV coordinates
      for (let y = 0; y < h; y++) {
        const by = Math.min(bufB.height - 1, Math.max(0, Math.floor((y / h) * bufB.height)));
        const my = maskBuf ? Math.min(maskBuf.height - 1, Math.max(0, Math.floor((y / h) * maskBuf.height))) : 0;

        for (let x = 0; x < w; x++) {
          const outIdx = (y * w + x) * 4;
          const aR = dataA[outIdx + 0] / 255;
          const aG = dataA[outIdx + 1] / 255;
          const aB = dataA[outIdx + 2] / 255;

          const bx = Math.min(bufB.width - 1, Math.max(0, Math.floor((x / w) * bufB.width)));
          const bIdx = (by * bufB.width + bx) * 4;
          const bR = (dataB[bIdx + 0] ?? 0) / 255;
          const bG = (dataB[bIdx + 1] ?? 0) / 255;
          const bB = (dataB[bIdx + 2] ?? 0) / 255;

          let m = safeOpacity;
          if (maskBuf && maskData) {
            const mx = Math.min(maskBuf.width - 1, Math.max(0, Math.floor((x / w) * maskBuf.width)));
            const mIdx = (my * maskBuf.width + mx) * 4;
            m *= (maskData[mIdx + 0] ?? 255) / 255;
          }
          const invM = 1.0 - m;

          outData[outIdx + 0] = Math.round((aR * invM + blendChannel(aR, bR) * m) * 255);
          outData[outIdx + 1] = Math.round((aG * invM + blendChannel(aG, bG) * m) * 255);
          outData[outIdx + 2] = Math.round((aB * invM + blendChannel(aB, bB) * m) * 255);
          outData[outIdx + 3] = dataA[outIdx + 3] ?? 255;
        }
      }
    }

    const buf: TextureBuffer = { width: w, height: h, data: outData };
    const proxy = this.createDownsampledProxy(buf, 512);
    buf.proxy = proxy;
    buf.dataUrl = proxy.dataUrl;
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
    const safeDetailStrength = Math.max(0.0, Math.min(5.0, detailStrength ?? 1.0));
    const sameDim = detailBuf.width === w && detailBuf.height === h;

    if (sameDim) {
      for (let i = 0; i < baseData.length; i += 4) {
        const n1x = ((baseData[i + 0] ?? 128) / 255) * 2.0 - 1.0;
        const n1y = ((baseData[i + 1] ?? 128) / 255) * 2.0 - 1.0;
        const n1z = ((baseData[i + 2] ?? 255) / 255) * 2.0 - 1.0;

        const n2x = (((detailData[i + 0] ?? 128) / 255) * 2.0 - 1.0) * safeDetailStrength;
        const n2y = (((detailData[i + 1] ?? 128) / 255) * 2.0 - 1.0) * safeDetailStrength;
        const rawZ = ((detailData[i + 2] ?? 255) / 255) * 2.0 - 1.0;
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
    } else {
      // Resolution mismatch: sample detail normal with normalized coordinates
      for (let y = 0; y < h; y++) {
        const dy = Math.min(detailBuf.height - 1, Math.max(0, Math.floor((y / h) * detailBuf.height)));
        for (let x = 0; x < w; x++) {
          const outIdx = (y * w + x) * 4;
          const n1x = ((baseData[outIdx + 0] ?? 128) / 255) * 2.0 - 1.0;
          const n1y = ((baseData[outIdx + 1] ?? 128) / 255) * 2.0 - 1.0;
          const n1z = ((baseData[outIdx + 2] ?? 255) / 255) * 2.0 - 1.0;

          const dx = Math.min(detailBuf.width - 1, Math.max(0, Math.floor((x / w) * detailBuf.width)));
          const dIdx = (dy * detailBuf.width + dx) * 4;

          const n2x = (((detailData[dIdx + 0] ?? 128) / 255) * 2.0 - 1.0) * safeDetailStrength;
          const n2y = (((detailData[dIdx + 1] ?? 128) / 255) * 2.0 - 1.0) * safeDetailStrength;
          const rawZ = ((detailData[dIdx + 2] ?? 255) / 255) * 2.0 - 1.0;
          const n2z = Math.max(0.001, rawZ);

          const tx = n1x + n2x;
          const ty = n1y + n2y;
          const tz = n1z * n2z;

          const lenVec = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1.0;
          const rx = tx / lenVec;
          const ry = ty / lenVec;
          const rz = tz / lenVec;

          outData[outIdx + 0] = Math.min(255, Math.max(0, Math.round((rx * 0.5 + 0.5) * 255)));
          outData[outIdx + 1] = Math.min(255, Math.max(0, Math.round((ry * 0.5 + 0.5) * 255)));
          outData[outIdx + 2] = Math.min(255, Math.max(0, Math.round((rz * 0.5 + 0.5) * 255)));
          outData[outIdx + 3] = 255;
        }
      }
    }

    const buf: TextureBuffer = { width: w, height: h, data: outData };
    const proxy = this.createDownsampledProxy(buf, 512);
    buf.proxy = proxy;
    buf.dataUrl = proxy.dataUrl;
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
    const proxy = this.createDownsampledProxy(buf, 512);
    buf.proxy = proxy;
    buf.dataUrl = proxy.dataUrl;
    return buf;
  }

  /**
   * Channel Mixer: Arbitrary routing, fan-out, combinations, and inline modifiers
   */
  public static mixChannels(
    buffer: TextureBuffer,
    routes?: Record<string, { sources: string[]; combineOp?: string; modifier?: string; modifierVal?: number }>,
    scalarValues?: Record<string, number>,
    fallbackRSrc = 'r',
    fallbackGSrc = 'g',
    fallbackBSrc = 'b',
    fallbackASrc = 'a'
  ): TextureBuffer {
    if (!routes) {
      return this.swizzleBuffer(buffer, fallbackRSrc, fallbackGSrc, fallbackBSrc, fallbackASrc);
    }

    const w = buffer.width;
    const h = buffer.height;
    const outData = new Uint8ClampedArray(w * h * 4);
    const data = buffer.data;

    const evalChannel = (
      route: { sources: string[]; combineOp?: string; modifier?: string; modifierVal?: number } | undefined,
      fallbackKey: string,
      r: number,
      g: number,
      b: number,
      a: number
    ): number => {
      if (!route || !route.sources || route.sources.length === 0) {
        return fallbackKey === 'r' ? r : fallbackKey === 'g' ? g : fallbackKey === 'b' ? b : a;
      }

      const getSrcVal = (src: string): number => {
        if (src === 'r') return r / 255;
        if (src === 'g') return g / 255;
        if (src === 'b') return b / 255;
        if (src === 'a') return a / 255;
        if (src === '0') return 0;
        if (src === '1') return 1;
        if (src.startsWith('1-')) {
          const sub = src.replace('1-', '');
          return 1.0 - getSrcVal(sub);
        }
        if (scalarValues && src in scalarValues) {
          return Math.max(0, Math.min(1.0, scalarValues[src]));
        }
        return 0;
      };

      // Combine multiple sources if present
      let combined = getSrcVal(route.sources[0]);
      for (let i = 1; i < route.sources.length; i++) {
        const val = getSrcVal(route.sources[i]);
        if (route.combineOp === 'multiply') {
          combined *= val;
        } else if (route.combineOp === 'min') {
          combined = Math.min(combined, val);
        } else if (route.combineOp === 'max') {
          combined = Math.max(combined, val);
        } else {
          // 'add'
          combined += val;
        }
      }

      // Apply inline modifier
      if (route.modifier === 'oneMinus') {
        combined = 1.0 - combined;
      } else if (route.modifier === 'add') {
        combined += (route.modifierVal ?? 0.2);
      } else if (route.modifier === 'multiply') {
        combined *= (route.modifierVal ?? 1.5);
      } else if (route.modifier === 'clamp' || route.modifier === 'saturate') {
        combined = Math.max(0.0, Math.min(1.0, combined));
      }

      return Math.max(0, Math.min(255, Math.round(combined * 255)));
    };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i + 0];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      outData[i + 0] = evalChannel(routes.r, fallbackRSrc, r, g, b, a);
      outData[i + 1] = evalChannel(routes.g, fallbackGSrc, r, g, b, a);
      outData[i + 2] = evalChannel(routes.b, fallbackBSrc, r, g, b, a);
      outData[i + 3] = evalChannel(routes.a, fallbackASrc, r, g, b, a);
    }

    const buf: TextureBuffer = { width: w, height: h, data: outData };
    const proxy = this.createDownsampledProxy(buf, 512);
    buf.proxy = proxy;
    buf.dataUrl = proxy.dataUrl;
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

  /* ========================================================================= */
  /* COMPOSABLE MATH OPERATORS (UE5 COMPATIBLE)                                */
  /* ========================================================================= */

  public static applyMath(
    op: 'lerp' | 'multiply' | 'add' | 'subtract' | 'divide' | 'clamp' | 'saturate' | 'power' | 'oneMinus' | 'min' | 'max' | 'abs',
    bufA?: TextureBuffer | null,
    bufB?: TextureBuffer | null,
    bufAlpha?: TextureBuffer | null,
    scalarA?: number,
    scalarB?: number,
    param1?: number,
    param2?: number
  ): TextureBuffer {
    const bufs = [bufA, bufB, bufAlpha].filter((b): b is TextureBuffer => !!b);
    let width = 512;
    let height = 512;

    if (bufs.length > 0) {
      let maxArea = 0;
      let maxBuf: TextureBuffer | null = null;
      for (const b of bufs) {
        const area = b.width * b.height;
        if (area > maxArea) {
          maxArea = area;
          maxBuf = b;
        }
      }
      if (maxBuf && maxArea > 1) {
        width = maxBuf.width;
        height = maxBuf.height;
      } else {
        width = 512;
        height = 512;
      }
    }

    const effectiveBufA = bufA && (bufA.width !== width || bufA.height !== height) ? this.resampleBuffer(bufA, width, height) : bufA;
    const effectiveBufB = bufB && (bufB.width !== width || bufB.height !== height) ? this.resampleBuffer(bufB, width, height) : bufB;
    const effectiveBufAlpha = bufAlpha && (bufAlpha.width !== width || bufAlpha.height !== height) ? this.resampleBuffer(bufAlpha, width, height) : bufAlpha;

    const outData = new Uint8ClampedArray(width * height * 4);

    const sA = scalarA ?? 0;
    const sB = scalarB ?? (op === 'multiply' || op === 'divide' ? 1.0 : 0.0);
    const alphaVal = param1 ?? 0.5;

    const dataA = effectiveBufA?.data;
    const dataB = effectiveBufB?.data;
    const dataAlpha = effectiveBufAlpha?.data;

    for (let i = 0; i < outData.length; i += 4) {
      const rA = dataA ? dataA[i] : sA;
      const gA = dataA ? dataA[i + 1] : sA;
      const bA = dataA ? dataA[i + 2] : sA;
      const aA = dataA ? dataA[i + 3] : 255;

      const rB = dataB ? dataB[i] : sB;
      const gB = dataB ? dataB[i + 1] : sB;
      const bB = dataB ? dataB[i + 2] : sB;
      const aB = dataB ? dataB[i + 3] : 255;

      const aAlpha = dataAlpha ? dataAlpha[i] / 255.0 : alphaVal;

      let ro = 0, go = 0, bo = 0, ao = 255;

      switch (op) {
        case 'lerp':
          ro = rA * (1 - aAlpha) + rB * aAlpha;
          go = gA * (1 - aAlpha) + gB * aAlpha;
          bo = bA * (1 - aAlpha) + bB * aAlpha;
          ao = aA * (1 - aAlpha) + aB * aAlpha;
          break;
        case 'multiply':
          ro = (rA * rB) / 255.0;
          go = (gA * gB) / 255.0;
          bo = (bA * bB) / 255.0;
          ao = (aA * aB) / 255.0;
          break;
        case 'add':
          ro = Math.min(255, rA + rB);
          go = Math.min(255, gA + gB);
          bo = Math.min(255, bA + bB);
          ao = Math.min(255, aA + aB);
          break;
        case 'subtract':
          ro = Math.max(0, rA - rB);
          go = Math.max(0, gA - gB);
          bo = Math.max(0, bA - bB);
          ao = Math.max(0, aA - aB);
          break;
        case 'divide':
          ro = rB <= 0.0001 ? 0 : Math.min(255, (rA / rB) * 255.0);
          go = gB <= 0.0001 ? 0 : Math.min(255, (gA / gB) * 255.0);
          bo = bB <= 0.0001 ? 0 : Math.min(255, (bA / bB) * 255.0);
          ao = aB <= 0.0001 ? 255 : Math.min(255, (aA / aB) * 255.0);
          break;
        case 'clamp': {
          const cMin = param1 ?? 0;
          const cMax = param2 ?? 255;
          ro = Math.max(cMin, Math.min(cMax, rA));
          go = Math.max(cMin, Math.min(cMax, gA));
          bo = Math.max(cMin, Math.min(cMax, bA));
          ao = Math.max(cMin, Math.min(cMax, aA));
          break;
        }
        case 'saturate':
          ro = Math.max(0, Math.min(255, rA));
          go = Math.max(0, Math.min(255, gA));
          bo = Math.max(0, Math.min(255, bA));
          ao = Math.max(0, Math.min(255, aA));
          break;
        case 'power': {
          const exp = param1 ?? 1.0;
          ro = Math.pow(Math.max(0, rA) / 255.0, exp) * 255.0;
          go = Math.pow(Math.max(0, gA) / 255.0, exp) * 255.0;
          bo = Math.pow(Math.max(0, bA) / 255.0, exp) * 255.0;
          ao = Math.pow(Math.max(0, aA) / 255.0, exp) * 255.0;
          break;
        }
        case 'oneMinus':
          ro = 255 - rA;
          go = 255 - gA;
          bo = 255 - bA;
          ao = aA;
          break;
        case 'min':
          ro = Math.min(rA, rB);
          go = Math.min(gA, gB);
          bo = Math.min(bA, bB);
          ao = Math.min(aA, aB);
          break;
        case 'max':
          ro = Math.max(rA, rB);
          go = Math.max(gA, gB);
          bo = Math.max(bA, bB);
          ao = Math.max(aA, aB);
          break;
        case 'abs':
          ro = Math.abs(rA);
          go = Math.abs(gA);
          bo = Math.abs(bA);
          ao = aA;
          break;
      }

      outData[i + 0] = Math.min(255, Math.max(0, Math.round(ro)));
      outData[i + 1] = Math.min(255, Math.max(0, Math.round(go)));
      outData[i + 2] = Math.min(255, Math.max(0, Math.round(bo)));
      outData[i + 3] = Math.min(255, Math.max(0, Math.round(ao)));
    }

    const outBuf: TextureBuffer = { width, height, data: outData };
    outBuf.dataUrl = this.toDataUrl(outBuf);
    outBuf.proxy = this.createDownsampledProxy(outBuf, 512);
    return outBuf;
  }

  public static async applyMathAsync(
    op: 'lerp' | 'multiply' | 'add' | 'subtract' | 'divide' | 'clamp' | 'saturate' | 'power' | 'oneMinus' | 'min' | 'max' | 'abs',
    bufA?: TextureBuffer | null,
    bufB?: TextureBuffer | null,
    bufAlpha?: TextureBuffer | null,
    scalarA?: number,
    scalarB?: number,
    param1?: number,
    param2?: number
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

      const width = bufA?.width || bufB?.width || 512;
      const height = bufA?.height || bufB?.height || 512;

      const copyA = bufA ? new Uint8ClampedArray(bufA.data) : undefined;
      const copyB = bufB ? new Uint8ClampedArray(bufB.data) : undefined;
      const copyAlpha = bufAlpha ? new Uint8ClampedArray(bufAlpha.data) : undefined;

      const transfers: Transferable[] = [];
      if (copyA) transfers.push(copyA.buffer);
      if (copyB) transfers.push(copyB.buffer);
      if (copyAlpha) transfers.push(copyAlpha.buffer);

      worker.postMessage(
        {
          reqId,
          action: 'math',
          op,
          width,
          height,
          dataA: copyA,
          dataB: copyB,
          dataAlpha: copyAlpha,
          scalarA,
          scalarB,
          param1,
          param2,
        },
        transfers
      );
    });
  }

  /* ========================================================================= */
  /* PER-CHANNEL LEVELS                                                        */
  /* ========================================================================= */

  public static applyLevelsChannel(
    buffer: TextureBuffer,
    channel: 'all' | 'r' | 'g' | 'b' | 'a',
    blackPoint = 0,
    gamma = 1.0,
    whitePoint = 255,
    outBlack = 0,
    outWhite = 255
  ): TextureBuffer {
    const outData = new Uint8ClampedArray(buffer.data);
    const lut = new Uint8Array(256);
    const inRange = Math.max(1, whitePoint - blackPoint);
    const outRange = outWhite - outBlack;
    const invGamma = 1.0 / Math.max(0.01, gamma);

    for (let i = 0; i < 256; i++) {
      const normalizedIn = Math.max(0, Math.min(1.0, (i - blackPoint) / inRange));
      const curved = Math.pow(normalizedIn, invGamma);
      const scaledOut = Math.round(outBlack + curved * outRange);
      lut[i] = Math.max(0, Math.min(255, scaledOut));
    }

    for (let i = 0; i < outData.length; i += 4) {
      if (channel === 'all') {
        outData[i + 0] = lut[outData[i + 0]];
        outData[i + 1] = lut[outData[i + 1]];
        outData[i + 2] = lut[outData[i + 2]];
      } else if (channel === 'r') {
        outData[i + 0] = lut[outData[i + 0]];
      } else if (channel === 'g') {
        outData[i + 1] = lut[outData[i + 1]];
      } else if (channel === 'b') {
        outData[i + 2] = lut[outData[i + 2]];
      } else if (channel === 'a') {
        outData[i + 3] = lut[outData[i + 3]];
      }
    }

    const outBuf: TextureBuffer = { width: buffer.width, height: buffer.height, data: outData };
    outBuf.dataUrl = this.toDataUrl(outBuf);
    outBuf.proxy = this.createDownsampledProxy(outBuf, 512);
    return outBuf;
  }

  /* ========================================================================= */
  /* RESIZING & POWER-OF-TWO ENFORCEMENT                                       */
  /* ========================================================================= */

  public static toPowerOfTwo(val: number, mode: 'nearest' | 'up' | 'down' = 'nearest'): number {
    if (val <= 0) return 512;
    const log2 = Math.log2(val);
    if (mode === 'up') return Math.pow(2, Math.ceil(log2));
    if (mode === 'down') return Math.pow(2, Math.max(0, Math.floor(log2)));
    const down = Math.pow(2, Math.floor(log2));
    const up = Math.pow(2, Math.ceil(log2));
    return val - down <= up - val ? down : up;
  }

  public static resizeBuffer(
    buffer: TextureBuffer,
    targetWidth: number,
    targetHeight: number,
    mode: 'preserve' | 'pad' | 'crop' | 'stretch' = 'stretch'
  ): TextureBuffer {
    const sw = buffer.width;
    const sh = buffer.height;
    const dw = targetWidth;
    const dh = targetHeight;
    const data = buffer.data;
    const outData = new Uint8ClampedArray(dw * dh * 4);

    let srcW = sw;
    let srcH = sh;
    let dstX = 0;
    let dstY = 0;
    let dstW = dw;
    let dstH = dh;

    if (mode === 'preserve' || mode === 'pad') {
      const scale = Math.min(dw / sw, dh / sh);
      dstW = Math.max(1, Math.round(sw * scale));
      dstH = Math.max(1, Math.round(sh * scale));
      dstX = Math.floor((dw - dstW) / 2);
      dstY = Math.floor((dh - dstH) / 2);
    } else if (mode === 'crop') {
      const scale = Math.max(dw / sw, dh / sh);
      srcW = Math.round(dw / scale);
      srcH = Math.round(dh / scale);
    }

    const scaleX = (mode === 'crop' ? srcW : sw) / dstW;
    const scaleY = (mode === 'crop' ? srcH : sh) / dstH;
    const srcOffsetX = mode === 'crop' ? Math.floor((sw - srcW) / 2) : 0;
    const srcOffsetY = mode === 'crop' ? Math.floor((sh - srcH) / 2) : 0;

    for (let dy = 0; dy < dstH; dy++) {
      const py = dstY + dy;
      if (py < 0 || py >= dh) continue;

      const sy = srcOffsetY + dy * scaleY;
      const y0 = Math.floor(sy);
      const y1 = Math.min(sh - 1, y0 + 1);
      const fy = sy - y0;

      for (let dx = 0; dx < dstW; dx++) {
        const px = dstX + dx;
        if (px < 0 || px >= dw) continue;

        const sx = srcOffsetX + dx * scaleX;
        const x0 = Math.floor(sx);
        const x1 = Math.min(sw - 1, x0 + 1);
        const fx = sx - x0;

        const i00 = (y0 * sw + x0) * 4;
        const i10 = (y0 * sw + x1) * 4;
        const i01 = (y1 * sw + x0) * 4;
        const i11 = (y1 * sw + x1) * 4;
        const outIdx = (py * dw + px) * 4;

        for (let c = 0; c < 4; c++) {
          const top = data[i00 + c] * (1 - fx) + data[i10 + c] * fx;
          const bot = data[i01 + c] * (1 - fx) + data[i11 + c] * fx;
          outData[outIdx + c] = Math.round(top * (1 - fy) + bot * fy);
        }
      }
    }

    const outBuf: TextureBuffer = { width: dw, height: dh, data: outData };
    outBuf.dataUrl = this.toDataUrl(outBuf);
    outBuf.proxy = this.createDownsampledProxy(outBuf, 512);
    return outBuf;
  }

  /* ========================================================================= */
  /* UPSCALING                                                                 */
  /* ========================================================================= */

  public static async upscaleBufferAsync(
    buffer: TextureBuffer,
    scale: 2 | 4 = 2,
    tileSize = 512
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

      const copyData = new Uint8ClampedArray(buffer.data);
      worker.postMessage(
        {
          reqId,
          action: 'upscale',
          width: buffer.width,
          height: buffer.height,
          data: copyData,
          scale,
          tileSize,
        },
        [copyData.buffer]
      );
    });
  }

  /* ========================================================================= */
  /* INSPECTION: COMPARE & SEAM CHECK                                          */
  /* ========================================================================= */

  public static createCompareBuffer(
    bufA: TextureBuffer,
    bufB: TextureBuffer,
    mode: 'wipe' | 'sideBySide' | 'difference' = 'wipe',
    wipeProgress = 0.5,
    diffGain = 1.0
  ): TextureBuffer {
    const w = bufA.width;
    const h = bufA.height;
    // Resample B to match A if dimensions differ
    const targetB = (bufB.width !== w || bufB.height !== h)
      ? this.resizeBuffer(bufB, w, h, 'stretch')
      : bufB;

    const dataA = bufA.data;
    const dataB = targetB.data;
    const outData = new Uint8ClampedArray(w * h * 4);

    const wipeX = Math.round(w * wipeProgress);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;

        if (mode === 'wipe') {
          // Draw thin 1px dividing hairline
          if (x === wipeX) {
            outData[idx + 0] = 56;
            outData[idx + 1] = 189;
            outData[idx + 2] = 248;
            outData[idx + 3] = 255;
          } else if (x < wipeX) {
            outData[idx + 0] = dataA[idx + 0];
            outData[idx + 1] = dataA[idx + 1];
            outData[idx + 2] = dataA[idx + 2];
            outData[idx + 3] = dataA[idx + 3];
          } else {
            outData[idx + 0] = dataB[idx + 0];
            outData[idx + 1] = dataB[idx + 1];
            outData[idx + 2] = dataB[idx + 2];
            outData[idx + 3] = dataB[idx + 3];
          }
        } else if (mode === 'sideBySide') {
          const midX = Math.floor(w / 2);
          if (x < midX) {
            const srcIdx = (y * w + Math.floor((x / midX) * w)) * 4;
            outData[idx + 0] = dataA[srcIdx + 0];
            outData[idx + 1] = dataA[srcIdx + 1];
            outData[idx + 2] = dataA[srcIdx + 2];
            outData[idx + 3] = dataA[srcIdx + 3];
          } else {
            const srcIdx = (y * w + Math.floor(((x - midX) / midX) * w)) * 4;
            outData[idx + 0] = dataB[srcIdx + 0];
            outData[idx + 1] = dataB[srcIdx + 1];
            outData[idx + 2] = dataB[srcIdx + 2];
            outData[idx + 3] = dataB[srcIdx + 3];
          }
        } else {
          // Difference mode
          const dr = Math.abs(dataA[idx + 0] - dataB[idx + 0]) * diffGain;
          const dg = Math.abs(dataA[idx + 1] - dataB[idx + 1]) * diffGain;
          const db = Math.abs(dataA[idx + 2] - dataB[idx + 2]) * diffGain;
          outData[idx + 0] = Math.min(255, Math.round(dr));
          outData[idx + 1] = Math.min(255, Math.round(dg));
          outData[idx + 2] = Math.min(255, Math.round(db));
          outData[idx + 3] = 255;
        }
      }
    }

    const outBuf: TextureBuffer = { width: w, height: h, data: outData };
    outBuf.dataUrl = this.toDataUrl(outBuf);
    outBuf.proxy = this.createDownsampledProxy(outBuf, 512);
    return outBuf;
  }

  public static createSeamCheckBuffer(
    buffer: TextureBuffer,
    repeats: 2 | 3 | 4 = 2,
    showBorders = true
  ): TextureBuffer {
    const sw = buffer.width;
    const sh = buffer.height;
    const dw = Math.min(2048, sw * repeats);
    const dh = Math.min(2048, sh * repeats);
    const outData = new Uint8ClampedArray(dw * dh * 4);
    const data = buffer.data;

    const tileW = dw / repeats;
    const tileH = dh / repeats;

    for (let dy = 0; dy < dh; dy++) {
      const sy = Math.floor((dy % tileH) * (sh / tileH));
      const isHBorder = showBorders && (Math.abs(dy % tileH) < 1 || Math.abs((dy + 1) % tileH) < 1);

      for (let dx = 0; dx < dw; dx++) {
        const sx = Math.floor((dx % tileW) * (sw / tileW));
        const isVBorder = showBorders && (Math.abs(dx % tileW) < 1 || Math.abs((dx + 1) % tileW) < 1);

        const outIdx = (dy * dw + dx) * 4;
        const srcIdx = (sy * sw + sx) * 4;

        if (isHBorder || isVBorder) {
          // Yellow-orange boundary hairline overlay
          outData[outIdx + 0] = 245;
          outData[outIdx + 1] = 158;
          outData[outIdx + 2] = 11;
          outData[outIdx + 3] = 255;
        } else {
          outData[outIdx + 0] = data[srcIdx + 0];
          outData[outIdx + 1] = data[srcIdx + 1];
          outData[outIdx + 2] = data[srcIdx + 2];
          outData[outIdx + 3] = data[srcIdx + 3];
        }
      }
    }

    const outBuf: TextureBuffer = { width: dw, height: dh, data: outData };
    outBuf.dataUrl = this.toDataUrl(outBuf);
    outBuf.proxy = this.createDownsampledProxy(outBuf, 512);
    return outBuf;
  }

  public static samplePixel(
    buffer: TextureBuffer,
    x: number,
    y: number
  ): { r: number; g: number; b: number; a: number } {
    const cx = Math.max(0, Math.min(buffer.width - 1, Math.floor(x)));
    const cy = Math.max(0, Math.min(buffer.height - 1, Math.floor(y)));
    const idx = (cy * buffer.width + cx) * 4;
    return {
      r: buffer.data[idx + 0],
      g: buffer.data[idx + 1],
      b: buffer.data[idx + 2],
      a: buffer.data[idx + 3],
    };
  }
}

