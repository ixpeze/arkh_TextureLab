import { describe, it, expect, vi } from 'vitest';
import { sniffFormat, decodeImage } from '../../io/decode';
import { encodeImage } from '../../io/encode';
import { decodeTga, encodeTga } from '../../io/tga';
import { uploadTexture } from '../../gpu/upload';
import { TexturePool } from '../../gpu/texturePool';

describe('Sub-phase 4B: Exact I/O & Alpha Round-Trip (TC-420..449, TC-004)', () => {
  it('TC-420 & TC-004: byte-exact round-trip preservation across all 256 alpha levels', async () => {
    const width = 16;
    const height = 16;
    const totalPixels = width * height; // 256 pixels, one per alpha level 0..255
    const original = new Uint8Array(totalPixels * 4);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      original[idx + 0] = (i * 7) % 256;  // R
      original[idx + 1] = (i * 13) % 256; // G
      original[idx + 2] = (i * 19) % 256; // B
      original[idx + 3] = i;              // A: exactly 0 to 255
    }

    // Encode with pure-JS PNG encoder
    const encoded = await encodeImage({
      width,
      height,
      data: original,
      format: 'png',
      bitDepth: 8,
    });
    expect(encoded.mimeType).toBe('image/png');
    expect(encoded.data.length).toBeGreaterThan(0);

    // Decode with pure-JS PNG decoder
    const decoded = await decodeImage(encoded.data, 'test.png');
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.bitDepth).toBe(8);
    expect(decoded.channels).toBe(4);

    // Check zero difference across all 256 alpha levels
    let diffCount = 0;
    const decodedData = decoded.data as Uint8Array;
    for (let i = 0; i < original.length; i++) {
      if (original[i] !== decodedData[i]) {
        diffCount++;
      }
    }

    expect(diffCount).toBe(0);
  });

  it('TC-421: 16-bit PNG round-trip preservation', async () => {
    const width = 4;
    const height = 4;
    const original = new Uint16Array(width * height * 4);
    for (let i = 0; i < original.length; i++) {
      original[i] = (i * 1234) % 65536;
    }

    const encoded = await encodeImage({
      width,
      height,
      data: original,
      format: 'png',
      bitDepth: 16,
    });

    const decoded = await decodeImage(encoded.data, 'test16.png');
    expect(decoded.bitDepth).toBe(16);
    expect(decoded.data.length).toBe(original.length);

    const decodedData = decoded.data as Uint16Array;
    let diffCount = 0;
    for (let i = 0; i < original.length; i++) {
      if (original[i] !== decodedData[i]) diffCount++;
    }
    expect(diffCount).toBe(0);
  });

  it('TC-426: TGA 24-bit and 32-bit encode/decode with bottom-left and top-left origins', () => {
    const width = 4;
    const height = 4;
    const original = new Uint8Array(width * height * 4);
    for (let i = 0; i < original.length; i++) {
      original[i] = (i * 37) % 256;
    }

    // 32-bit TGA
    const tga32 = encodeTga({ width, height, data: original, channels: 4 });
    const dec32 = decodeTga(tga32);
    expect(dec32.width).toBe(width);
    expect(dec32.height).toBe(height);
    expect(dec32.channels).toBe(4);
    expect(dec32.data).toEqual(original);

    // 24-bit TGA (Alpha is reset to 255)
    const tga24 = encodeTga({ width, height, data: original, channels: 3 });
    const dec24 = decodeTga(tga24);
    expect(dec24.width).toBe(width);
    expect(dec24.height).toBe(height);
    for (let i = 0; i < width * height; i++) {
      expect(dec24.data[i * 4 + 0]).toBe(original[i * 4 + 0]);
      expect(dec24.data[i * 4 + 1]).toBe(original[i * 4 + 1]);
      expect(dec24.data[i * 4 + 2]).toBe(original[i * 4 + 2]);
      expect(dec24.data[i * 4 + 3]).toBe(255);
    }
  });

  it('TC-427: handles 0-byte, truncated, or unknown formats gracefully', async () => {
    await expect(decodeImage(new Uint8Array(0), 'empty.png')).rejects.toThrow(
      /file is empty/i
    );

    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(decodeImage(garbage, 'bad.png')).rejects.toThrow(
      /unrecognized or unsupported image format/i
    );
  });

  it('TC-433: rejects EXR and TIFF with clear v1.1 deferral message', async () => {
    const tiffHeader = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x00, 0x00]);
    await expect(decodeImage(tiffHeader, 'map.tif')).rejects.toThrow(
      /TIFF format is not supported in v1\.0/i
    );

    const exrHeader = new Uint8Array([0x76, 0x2f, 0x31, 0x01]);
    await expect(decodeImage(exrHeader, 'map.exr')).rejects.toThrow(
      /EXR format is not supported in v1\.0/i
    );
  });

  it('sniffFormat detects formats by magic bytes', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(sniffFormat(png)).toBe('png');
    expect(sniffFormat(jpg)).toBe('jpeg');
  });

  it('TC-434: uploadTexture sets WebGL unpack flags and uploads 8-bit & 16-bit data', () => {
    const gl = {
      UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
      UNPACK_COLORSPACE_CONVERSION_WEBGL: 0x9243,
      UNPACK_FLIP_Y_WEBGL: 0x9240,
      UNPACK_ALIGNMENT: 0x0cf5,
      NONE: 0,
      TEXTURE_2D: 0x0de1,
      RGBA8: 0x8058,
      RGBA16F: 0x881a,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      FLOAT: 0x1406,
      pixelStorei: vi.fn(),
      bindTexture: vi.fn(),
      texImage2D: vi.fn(),
      createTexture: vi.fn(() => ({})),
      texParameteri: vi.fn(),
    } as unknown as WebGL2RenderingContext;

    const pool = new TexturePool({ gl });

    const tex8 = uploadTexture({
      gl,
      pool,
      image: {
        width: 4,
        height: 4,
        channels: 4,
        bitDepth: 8,
        data: new Uint8Array(4 * 4 * 4),
        format: 'png',
      },
    });

    expect(gl.pixelStorei).toHaveBeenCalledWith(0x9241, false); // UNPACK_PREMULTIPLY_ALPHA_WEBGL = false
    expect(gl.pixelStorei).toHaveBeenCalledWith(0x9243, 0);     // UNPACK_COLORSPACE_CONVERSION_WEBGL = NONE
    expect(tex8.format).toBe('RGBA8');

    // 16-bit high-precision mode
    const tex16 = uploadTexture({
      gl,
      pool,
      image: {
        width: 4,
        height: 4,
        channels: 4,
        bitDepth: 16,
        data: new Uint16Array(4 * 4 * 4),
        format: 'png',
      },
      highPrecision: true,
    });

    expect(tex16.format).toBe('RGBA16F');
  });
});
