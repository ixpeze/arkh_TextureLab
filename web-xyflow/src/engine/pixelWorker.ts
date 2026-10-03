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
  | WorkerHistogramPayload;

const workerScope = self as unknown as {
  postMessage: (msg: any, transfer?: Transferable[]) => void;
  onmessage: ((e: MessageEvent<WorkerMessage>) => void) | null;
};

workerScope.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  const reqId = msg.reqId;

  if (msg.action === 'combine') {
    const { width: w, height: h, rData, gData, bData, aData } = msg;
    const outData = new Uint8ClampedArray(w * h * 4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const outIdx = (y * w + x) * 4;
        outData[outIdx + 0] = rData ? rData[outIdx + 0] : 255;
        outData[outIdx + 1] = gData ? gData[outIdx + 1] : 128;
        outData[outIdx + 2] = bData ? bData[outIdx + 2] : 0;
        outData[outIdx + 3] = aData ? aData[outIdx + 3] : 255;
      }
    }

    workerScope.postMessage({ reqId, action: 'combine', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

  if (msg.action === 'levels') {
    const { width: w, height: h, data, blackPoint, gamma, whitePoint } = msg;
    const outData = new Uint8ClampedArray(data.length);
    const range = Math.max(1, whitePoint - blackPoint);

    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      let norm = (i - blackPoint) / range;
      norm = Math.min(1.0, Math.max(0.0, norm));
      const adjusted = Math.pow(norm, 1.0 / gamma);
      lut[i] = Math.round(adjusted * 255);
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

  if (msg.action === 'normalFlip') {
    const { width: w, height: h, data } = msg;
    const outData = new Uint8ClampedArray(data);
    for (let i = 1; i < data.length; i += 4) {
      outData[i] = 255 - outData[i];
    }
    workerScope.postMessage({ reqId, action: 'normalFlip', width: w, height: h, data: outData }, [outData.buffer]);
    return;
  }

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
