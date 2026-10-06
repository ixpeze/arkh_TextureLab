/**
 * ARKH TextureLab - Pure-JS TGA (TARGA) Decoder and Encoder
 * Supports uncompressed & RLE, 8/24/32-bit, all 4 origin orientations.
 */

export interface TgaImage {
  width: number;
  height: number;
  channels: number;
  bitDepth: number;
  data: Uint8Array; // Always normalized to RGBA (4 bytes per pixel)
}

export function decodeTga(buffer: ArrayBuffer | Uint8Array): TgaImage {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 18) {
    throw new Error('Invalid TGA: file size is less than 18 bytes header');
  }

  const idLength = bytes[0];
  const colorMapType = bytes[1];
  const imageType = bytes[2];
  const width = bytes[12] | (bytes[13] << 8);
  const height = bytes[14] | (bytes[15] << 8);
  const pixelDepth = bytes[16];
  const descriptor = bytes[17];

  if (colorMapType !== 0) {
    throw new Error('Color-mapped TGA is not supported');
  }

  const isRle = imageType === 10 || imageType === 11;
  const isGrayscale = imageType === 3 || imageType === 11;
  const isTrueColor = imageType === 2 || imageType === 10;

  if (!isGrayscale && !isTrueColor) {
    throw new Error(`Unsupported TGA image type: ${imageType}`);
  }

  if (pixelDepth !== 8 && pixelDepth !== 24 && pixelDepth !== 32) {
    throw new Error(`Unsupported TGA pixel depth: ${pixelDepth} bits`);
  }

  const bytesPerPixel = pixelDepth >> 3;
  const rightOrigin = (descriptor & 0x10) !== 0;
  const topOrigin = (descriptor & 0x20) !== 0;

  let offset = 18 + idLength;
  const totalPixels = width * height;
  const rawPixels = new Uint8Array(totalPixels * bytesPerPixel);

  if (isRle) {
    let pixelCount = 0;
    while (pixelCount < totalPixels && offset < bytes.length) {
      const packet = bytes[offset++];
      const count = (packet & 0x7f) + 1;
      const isRun = (packet & 0x80) !== 0;

      if (isRun) {
        const pixelBytes = bytes.subarray(offset, offset + bytesPerPixel);
        offset += bytesPerPixel;
        for (let i = 0; i < count; i++) {
          rawPixels.set(pixelBytes, (pixelCount + i) * bytesPerPixel);
        }
      } else {
        const chunk = bytes.subarray(offset, offset + count * bytesPerPixel);
        offset += count * bytesPerPixel;
        rawPixels.set(chunk, pixelCount * bytesPerPixel);
      }
      pixelCount += count;
    }
  } else {
    const needed = totalPixels * bytesPerPixel;
    if (bytes.length < offset + needed) {
      throw new Error('Invalid TGA: truncated pixel data');
    }
    rawPixels.set(bytes.subarray(offset, offset + needed));
  }

  // Convert to canonical top-left RGBA (4 bytes/pixel)
  const rgba = new Uint8Array(totalPixels * 4);

  for (let y = 0; y < height; y++) {
    // TGA default origin is bottom-left (topOrigin === false)
    const srcY = topOrigin ? y : height - 1 - y;

    for (let x = 0; x < width; x++) {
      const srcX = rightOrigin ? width - 1 - x : x;
      const srcIdx = (srcY * width + srcX) * bytesPerPixel;
      const dstIdx = (y * width + x) * 4;

      if (bytesPerPixel === 1) {
        const v = rawPixels[srcIdx];
        rgba[dstIdx + 0] = v;
        rgba[dstIdx + 1] = v;
        rgba[dstIdx + 2] = v;
        rgba[dstIdx + 3] = 255;
      } else if (bytesPerPixel === 3) {
        // BGR -> RGBA
        rgba[dstIdx + 0] = rawPixels[srcIdx + 2];
        rgba[dstIdx + 1] = rawPixels[srcIdx + 1];
        rgba[dstIdx + 2] = rawPixels[srcIdx + 0];
        rgba[dstIdx + 3] = 255;
      } else if (bytesPerPixel === 4) {
        // BGRA -> RGBA
        rgba[dstIdx + 0] = rawPixels[srcIdx + 2];
        rgba[dstIdx + 1] = rawPixels[srcIdx + 1];
        rgba[dstIdx + 2] = rawPixels[srcIdx + 0];
        rgba[dstIdx + 3] = rawPixels[srcIdx + 3];
      }
    }
  }

  return {
    width,
    height,
    channels: 4,
    bitDepth: 8,
    data: rgba,
  };
}

export interface EncodeTgaOptions {
  width: number;
  height: number;
  data: Uint8Array; // Top-left RGBA
  channels?: 3 | 4; // 3 for 24-bit BGR, 4 for 32-bit BGRA
}

export function encodeTga(options: EncodeTgaOptions): Uint8Array {
  const { width, height, data, channels = 4 } = options;
  const is32 = channels === 4;
  const bytesPerPixel = is32 ? 4 : 3;
  const headerSize = 18;
  const pixelBytes = width * height * bytesPerPixel;
  const out = new Uint8Array(headerSize + pixelBytes);

  // 18-byte Header
  out[0] = 0; // idLength
  out[1] = 0; // colorMapType
  out[2] = 2; // uncompressed true-color
  out[12] = width & 0xff;
  out[13] = (width >> 8) & 0xff;
  out[14] = height & 0xff;
  out[15] = (height >> 8) & 0xff;
  out[16] = bytesPerPixel * 8; // 24 or 32
  out[17] = 0x20 | (is32 ? 8 : 0); // top-left origin (bit 5 = 1)

  let dstOffset = headerSize;
  for (let i = 0; i < width * height; i++) {
    const srcIdx = i * 4;
    // RGBA -> BGR or BGRA
    out[dstOffset++] = data[srcIdx + 2]; // B
    out[dstOffset++] = data[srcIdx + 1]; // G
    out[dstOffset++] = data[srcIdx + 0]; // R
    if (is32) {
      out[dstOffset++] = data[srcIdx + 3]; // A
    }
  }

  return out;
}
