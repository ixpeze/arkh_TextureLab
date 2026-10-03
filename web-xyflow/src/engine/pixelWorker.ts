/**
 * Dedicated Web Worker for Asynchronous Texture Processing
 * Offloads 4K CPU pixel manipulation from the main UI thread.
 */

export interface WorkerCombinePayload {
  reqId?: number;
  action: 'combine';
  width: number;
  height: number;
  rData?: Uint8ClampedArray;
  gData?: Uint8ClampedArray;
  bData?: Uint8ClampedArray;
  aData?: Uint8ClampedArray;
  fallbacks?: { r?: number; g?: number; b?: number; a?: number };
}

export interface WorkerLevelsPayload {
  reqId?: number;
  action: 'levels';
  width: number;
  height: number;
  data: Uint8ClampedArray;
  blackPoint: number;
  gamma: number;
  whitePoint: number;
  outBlack?: number;
  outWhite?: number;
}

export interface WorkerInvertPayload {
  reqId?: number;
  action: 'invert';
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface WorkerNormalFlipPayload {
  reqId?: number;
  action: 'normalFlip';
  width: number;
  height: number;
  data: Uint8ClampedArray;
  strength?: number;
}

export interface WorkerBlendPayload {
  reqId?: number;
  action: 'blend';
  width: number;
  height: number;
  dataA: Uint8ClampedArray;
  dataB: Uint8ClampedArray;
  maskData?: Uint8ClampedArray;
  mode: 'lerp' | 'multiply' | 'screen' | 'overlay' | 'add' | 'min' | 'max';
  opacity: number;
}

export interface WorkerNormalBlendPayload {
  reqId?: number;
  action: 'normalBlend';
  width: number;
  height: number;
  baseData: Uint8ClampedArray;
  detailData: Uint8ClampedArray;
  detailStrength: number;
}

export interface WorkerSwizzlePayload {
  reqId?: number;
  action: 'swizzle';
  width: number;
  height: number;
  data: Uint8ClampedArray;
  rSrc: string; // 'r' | 'g' | 'b' | 'a' | '1-r' | '1-g' | '1-b' | '1-a' | '0' | '1'
  gSrc: string;
  bSrc: string;
  aSrc: string;
}

export interface WorkerHistogramPayload {
  reqId?: number;
  action: 'histogram';
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type WorkerMessage =
  | WorkerCombinePayload
  | WorkerLevelsPayload
  | WorkerInvertPayload
  | WorkerNormalFlipPayload
  | WorkerBlendPayload
  | WorkerNormalBlendPayload
  | WorkerSwizzlePayload
  | WorkerHistogramPayload;

const workerScope = self as unknown as {
  postMessage: (msg: any, transfer?: Transferable[]) => void;
  onmessage: ((e: MessageEvent<WorkerMessage>) => void) | null;
};

workerScope.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  const reqId = msg.reqId;

  // 1. Combine Channels with Unconnected Fallback Defaults
  if (msg.action === 'combine') {
    const { width: w, height: h, rData, gData, bData, aData, fallbacks } = msg;
    const defR = fallbacks?.r ?? 255;
    const defG = fallbacks?.g ?? 128;
    const defB = fallbacks?.b ?? 0;
    const defA = fallbacks?.a ?? 255;

    const outData = new Uint8ClampedArray(w * h * 4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const outIdx = (y * w + x) * 4;
        outData[outIdx + 0] = rData ? rData[outIdx + 0] : defR;
        outData[outIdx + 1] = gData ? gData[outIdx + 1] : defG;
        outData[outIdx + 2] = bData ? bData[outIdx + 2] : defB;
        outData[outIdx + 3] = aData ? aData[outIdx + 3] : defA;
      }
    }

    workerScope.postMessage({ reqId, action: 'combine', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  // 2. Levels with In/Out Range Remapping
  if (msg.action === 'levels') {
    const { width: w, height: h, data, blackPoint, gamma, whitePoint, outBlack = 0, outWhite = 255 } = msg;
    const outData = new Uint8ClampedArray(data.length);
    const inRange = Math.max(1, whitePoint - blackPoint);
    const outRange = outWhite - outBlack;

    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let norm = (i - blackPoint) / inRange;
      norm = Math.min(1.0, Math.max(0.0, norm));
      const adjusted = Math.pow(norm, 1.0 / gamma);
      const remapped = Math.round(outBlack + adjusted * outRange);
      lut[i] = Math.min(255, Math.max(0, remapped));
    }

    for (let i = 0; i < data.length; i += 4) {
      outData[i + 0] = lut[data[i + 0]];
      outData[i + 1] = lut[data[i + 1]];
      outData[i + 2] = lut[data[i + 2]];
      outData[i + 3] = data[i + 3];
    }

    workerScope.postMessage({ reqId, action: 'levels', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  // 3. Invert (1 - x)
  if (msg.action === 'invert') {
    const { width: w, height: h, data } = msg;
    const outData = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      outData[i + 0] = 255 - data[i + 0];
      outData[i + 1] = 255 - data[i + 1];
      outData[i + 2] = 255 - data[i + 2];
      outData[i + 3] = data[i + 3];
    }
    workerScope.postMessage({ reqId, action: 'invert', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  // 4. Normal Green Flip & Strength Scaling
  if (msg.action === 'normalFlip') {
    const { width: w, height: h, data, strength = 1.0 } = msg;
    const outData = new Uint8ClampedArray(data);

    for (let i = 0; i < data.length; i += 4) {
      // Invert Green for DirectX <=> OpenGL
      let g = 255 - data[i + 1];

      if (strength !== 1.0) {
        // Adjust normal strength (scale X and Y around 128 mid-point)
        let r = data[i + 0];
        let nr = (r - 128) * strength + 128;
        let ng = (g - 128) * strength + 128;
        outData[i + 0] = Math.min(255, Math.max(0, Math.round(nr)));
        outData[i + 1] = Math.min(255, Math.max(0, Math.round(ng)));
      } else {
        outData[i + 1] = g;
      }
    }
    workerScope.postMessage({ reqId, action: 'normalFlip', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  // 5. PBR Blend / Mix Kernel
  if (msg.action === 'blend') {
    const { width: w, height: h, dataA, dataB, maskData, mode, opacity } = msg;
    const outData = new Uint8ClampedArray(w * h * 4);
    const len = dataA.length;

    for (let i = 0; i < len; i += 4) {
      const aR = dataA[i + 0] / 255;
      const aG = dataA[i + 1] / 255;
      const aB = dataA[i + 2] / 255;

      const bR = dataB[i + 0] / 255;
      const bG = dataB[i + 1] / 255;
      const bB = dataB[i + 2] / 255;

      // Compute blend for RGB
      const blendChannel = (a: number, b: number): number => {
        switch (mode) {
          case 'multiply':
            return a * b;
          case 'screen':
            return 1 - (1 - a) * (1 - b);
          case 'overlay':
            return a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
          case 'add':
            return Math.min(1.0, a + b);
          case 'min':
            return Math.min(a, b);
          case 'max':
            return Math.max(a, b);
          case 'lerp':
          default:
            return b;
        }
      };

      const m = (maskData ? maskData[i + 0] / 255 : 1.0) * opacity;
      const invM = 1.0 - m;

      outData[i + 0] = Math.round((aR * invM + blendChannel(aR, bR) * m) * 255);
      outData[i + 1] = Math.round((aG * invM + blendChannel(aG, bG) * m) * 255);
      outData[i + 2] = Math.round((aB * invM + blendChannel(aB, bB) * m) * 255);
      outData[i + 3] = dataA[i + 3]; // Preserve A or blend
    }

    workerScope.postMessage({ reqId, action: 'blend', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  // 6. Reoriented Normal Mapping (RNM) Kernel
  if (msg.action === 'normalBlend') {
    const { width: w, height: h, baseData, detailData, detailStrength } = msg;
    const outData = new Uint8ClampedArray(w * h * 4);
    const len = baseData.length;

    for (let i = 0; i < len; i += 4) {
      // Unpack base normal [-1..1]
      const n1x = (baseData[i + 0] / 255) * 2.0 - 1.0;
      const n1y = (baseData[i + 1] / 255) * 2.0 - 1.0;
      const n1z = (baseData[i + 2] / 255) * 2.0 - 1.0;

      // Unpack detail normal with strength scaling
      const n2x = ((detailData[i + 0] / 255) * 2.0 - 1.0) * detailStrength;
      const n2y = ((detailData[i + 1] / 255) * 2.0 - 1.0) * detailStrength;
      const rawZ = (detailData[i + 2] / 255) * 2.0 - 1.0;
      const n2z = Math.max(0.001, rawZ);

      // Reoriented Normal Blend formula (Unreal Engine / Colin Barré-Brisebois)
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

    workerScope.postMessage({ reqId, action: 'normalBlend', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  // 7. Channel Swizzle Matrix Kernel
  if (msg.action === 'swizzle') {
    const { width: w, height: h, data, rSrc, gSrc, bSrc, aSrc } = msg;
    const outData = new Uint8ClampedArray(w * h * 4);
    const len = data.length;

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
        default: return r;
      }
    };

    for (let i = 0; i < len; i += 4) {
      const r = data[i + 0];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      outData[i + 0] = resolveChannel(rSrc, r, g, b, a);
      outData[i + 1] = resolveChannel(gSrc, r, g, b, a);
      outData[i + 2] = resolveChannel(bSrc, r, g, b, a);
      outData[i + 3] = resolveChannel(aSrc, r, g, b, a);
    }

    workerScope.postMessage({ reqId, action: 'swizzle', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  // 8. Histogram Waveform Computation
  if (msg.action === 'histogram') {
    const { data } = msg;
    const rHist = new Uint32Array(256);
    const gHist = new Uint32Array(256);
    const bHist = new Uint32Array(256);
    const lumHist = new Uint32Array(256);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i + 0];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

      rHist[r]++;
      gHist[g]++;
      bHist[b]++;
      lumHist[lum]++;
    }

    workerScope.postMessage({
      reqId,
      action: 'histogram',
      rHist: Array.from(rHist),
      gHist: Array.from(gHist),
      bHist: Array.from(bHist),
      lumHist: Array.from(lumHist),
    });
    return;
  }
};
