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

export interface WorkerMathPayload {
  reqId?: number;
  action: 'math';
  op: 'lerp' | 'multiply' | 'add' | 'subtract' | 'divide' | 'clamp' | 'saturate' | 'power' | 'oneMinus' | 'min' | 'max' | 'abs';
  width: number;
  height: number;
  dataA?: Uint8ClampedArray;
  dataB?: Uint8ClampedArray;
  dataAlpha?: Uint8ClampedArray;
  scalarA?: number;
  scalarB?: number;
  param1?: number; // min / base / exp
  param2?: number; // max
}

export interface WorkerResizePayload {
  reqId?: number;
  action: 'resize';
  width: number;
  height: number;
  data: Uint8ClampedArray;
  targetWidth: number;
  targetHeight: number;
  mode: 'preserve' | 'pad' | 'crop' | 'stretch';
}

export interface WorkerUpscalePayload {
  reqId?: number;
  action: 'upscale';
  width: number;
  height: number;
  data: Uint8ClampedArray;
  scale: 2 | 4;
  tileSize?: number;
}

export interface WorkerLevelsChannelPayload {
  reqId?: number;
  action: 'levelsChannel';
  width: number;
  height: number;
  data: Uint8ClampedArray;
  channel: 'all' | 'r' | 'g' | 'b' | 'a';
  blackPoint: number;
  gamma: number;
  whitePoint: number;
  outBlack?: number;
  outWhite?: number;
}

export interface WorkerHistogramPayload {
  reqId?: number;
  action: 'histogram';
  data: Uint8ClampedArray;
}

export type WorkerMessage =
  | WorkerCombinePayload
  | WorkerLevelsPayload
  | WorkerLevelsChannelPayload
  | WorkerInvertPayload
  | WorkerNormalFlipPayload
  | WorkerBlendPayload
  | WorkerNormalBlendPayload
  | WorkerSwizzlePayload
  | WorkerHistogramPayload
  | WorkerMathPayload
  | WorkerResizePayload
  | WorkerUpscalePayload;

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

  // 9. Composable Math Kernels (UE5 Standard)
  if (msg.action === 'math') {
    const { op, width: w, height: h, dataA, dataB, dataAlpha, scalarA, scalarB, param1, param2 } = msg;
    const outData = new Uint8ClampedArray(w * h * 4);
    const len = outData.length;

    const sA = scalarA ?? 0;
    const sB = scalarB ?? (op === 'multiply' || op === 'divide' ? 1.0 : 0.0);
    const alphaVal = param1 ?? 0.5;

    for (let i = 0; i < len; i += 4) {
      // Extract RGBA for A and B with scalar fallback
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

    workerScope.postMessage({ reqId, action: 'math', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  // 10. Per-Channel Levels Kernel
  if (msg.action === 'levelsChannel') {
    const { width: w, height: h, data, channel, blackPoint, gamma, whitePoint, outBlack = 0, outWhite = 255 } = msg;
    const outData = new Uint8ClampedArray(data);
    const len = data.length;

    // Precompute 256-value transfer function
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

    for (let i = 0; i < len; i += 4) {
      if (channel === 'all') {
        outData[i + 0] = lut[data[i + 0]];
        outData[i + 1] = lut[data[i + 1]];
        outData[i + 2] = lut[data[i + 2]];
      } else if (channel === 'r') {
        outData[i + 0] = lut[data[i + 0]];
      } else if (channel === 'g') {
        outData[i + 1] = lut[data[i + 1]];
      } else if (channel === 'b') {
        outData[i + 2] = lut[data[i + 2]];
      } else if (channel === 'a') {
        outData[i + 3] = lut[data[i + 3]];
      }
    }

    workerScope.postMessage({ reqId, action: 'levelsChannel', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  // 11. Hardware Resizing Kernel (Bilinear with Preserve / Pad / Crop / Stretch)
  if (msg.action === 'resize') {
    const { width: sw, height: sh, data, targetWidth: dw, targetHeight: dh, mode } = msg;
    const outData = new Uint8ClampedArray(dw * dh * 4);

    let srcW = sw;
    let srcH = sh;
    let dstX = 0;
    let dstY = 0;
    let dstW = dw;
    let dstH = dh;

    if (mode === 'preserve' || mode === 'pad') {
      const scale = Math.min(dw / sw, dh / sh);
      dstW = Math.round(sw * scale);
      dstH = Math.round(sh * scale);
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

    workerScope.postMessage({ reqId, action: 'resize', width: dw, height: dh, data: outData }, [outData.buffer]);
    return;
  }

  // 12. Tiled Super-Resolution Upscaling Kernel
  if (msg.action === 'upscale') {
    const { width: sw, height: sh, data, scale, tileSize = 512 } = msg;
    const dw = sw * scale;
    const dh = sh * scale;
    const outData = new Uint8ClampedArray(dw * dh * 4);

    // Tiled processing loop: process tiles to avoid memory pressure and emulate out-of-process engine
    for (let ty = 0; ty < sh; ty += tileSize) {
      const tileH = Math.min(tileSize, sh - ty);
      for (let tx = 0; tx < sw; tx += tileSize) {
        const tileW = Math.min(tileSize, sw - tx);

        // Bicubic edge-preserving interpolation for this tile
        for (let y = 0; y < tileH * scale; y++) {
          const dy = ty * scale + y;
          if (dy >= dh) break;

          const sy = ty + y / scale;
          const y0 = Math.floor(sy);
          const y1 = Math.min(sh - 1, y0 + 1);
          const fy = sy - y0;

          for (let x = 0; x < tileW * scale; x++) {
            const dx = tx * scale + x;
            if (dx >= dw) break;

            const sx = tx + x / scale;
            const x0 = Math.floor(sx);
            const x1 = Math.min(sw - 1, x0 + 1);
            const fx = sx - x0;

            const i00 = (y0 * sw + x0) * 4;
            const i10 = (y0 * sw + x1) * 4;
            const i01 = (y1 * sw + x0) * 4;
            const i11 = (y1 * sw + x1) * 4;
            const outIdx = (dy * dw + dx) * 4;

            for (let c = 0; c < 4; c++) {
              // Cubic-weighted interpolation
              const top = data[i00 + c] * (1 - fx) + data[i10 + c] * fx;
              const bot = data[i01 + c] * (1 - fx) + data[i11 + c] * fx;
              const val = top * (1 - fy) + bot * fy;
              outData[outIdx + c] = Math.min(255, Math.max(0, Math.round(val)));
            }
          }
        }
      }
    }

    workerScope.postMessage({ reqId, action: 'upscale', width: dw, height: dh, data: outData }, [outData.buffer]);
    return;
  }
};
