/**
 * Client-Side Pixel Processing Engine
 * Offscreen Canvas2D / WebGL image processing for live PBR multiplexing and channel isolation.
 */

export interface TextureBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA 8-bit
  dataUrl?: string;
}

export class PixelEngine {
  private static offscreenCanvas: HTMLCanvasElement | null = null;
  private static offscreenCtx: CanvasRenderingContext2D | null = null;

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
   * Load texture image from URL into TextureBuffer
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
        resolve({
          width: img.width,
          height: img.height,
          data: imgData.data,
          dataUrl: canvas.toDataURL('image/png'),
        });
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
      const buf = await this.loadFromUrl(objectUrl);
      return buf;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Create solid color buffer
   */
  public static createSolid(width: number, height: number, r: number, g: number, b: number, a: number = 255): TextureBuffer {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 0] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = a;
    }
    return { width, height, data };
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
    targetDim?: number
  ): TextureBuffer {
    const w = targetDim || Math.max(rBuf?.width || 0, gBuf?.width || 0, bBuf?.width || 0, aBuf?.width || 0, 512);
    const h = targetDim || Math.max(rBuf?.height || 0, gBuf?.height || 0, bBuf?.height || 0, aBuf?.height || 0, 512);

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
        outData[outIdx + 0] = sampleChannel(rBuf, 255, 0, x, y); // R: AO (default white 255)
        outData[outIdx + 1] = sampleChannel(gBuf, 128, 1, x, y); // G: Roughness (default 128)
        outData[outIdx + 2] = sampleChannel(bBuf, 0, 2, x, y);   // B: Metallic (default 0)
        outData[outIdx + 3] = sampleChannel(aBuf, 255, 3, x, y); // A: Height / Alpha (default 255)
      }
    }

    const buf: TextureBuffer = { width: w, height: h, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
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
    return buf;
  }

  /**
   * Flip green channel for normal map conversion (DirectX <=> OpenGL)
   */
  public static flipGreenChannel(buffer: TextureBuffer): TextureBuffer {
    const outData = new Uint8ClampedArray(buffer.data);
    for (let i = 1; i < buffer.data.length; i += 4) {
      outData[i] = 255 - outData[i];
    }
    const buf: TextureBuffer = { width: buffer.width, height: buffer.height, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
    return buf;
  }

  /**
   * Apply Levels adjustment (Black Point, Midtone Gamma, White Point)
   */
  public static applyLevels(
    buffer: TextureBuffer,
    blackPoint: number = 0, // 0..255
    gamma: number = 1.0,    // 0.1..5.0
    whitePoint: number = 255 // 0..255
  ): TextureBuffer {
    const outData = new Uint8ClampedArray(buffer.data.length);
    const range = Math.max(1, whitePoint - blackPoint);

    // Precompute LUT for performance
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let normalized = (i - blackPoint) / range;
      normalized = Math.min(1.0, Math.max(0.0, normalized));
      const adjusted = Math.pow(normalized, 1.0 / gamma);
      lut[i] = Math.round(adjusted * 255);
    }

    for (let i = 0; i < buffer.data.length; i += 4) {
      outData[i + 0] = lut[buffer.data[i + 0]];
      outData[i + 1] = lut[buffer.data[i + 1]];
      outData[i + 2] = lut[buffer.data[i + 2]];
      outData[i + 3] = buffer.data[i + 3];
    }

    const buf: TextureBuffer = { width: buffer.width, height: buffer.height, data: outData };
    buf.dataUrl = this.toDataUrl(buf);
    return buf;
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
