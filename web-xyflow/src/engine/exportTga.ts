import type { TextureBuffer } from './pixelEngine';

/**
 * Encode an RGBA TextureBuffer directly into uncompressed 32-bit Truevision TGA binary format.
 * Standard for 3ds Max, Maya, Unreal Engine, and Marmoset pipelines.
 */
export function encodeTGA(buffer: TextureBuffer): Blob {
  const width = buffer.width;
  const height = buffer.height;
  const headerSize = 18;
  const pixelBytes = width * height * 4;
  const totalBytes = headerSize + pixelBytes;

  const out = new Uint8Array(totalBytes);

  // 18-byte Truevision TGA Header
  out[0] = 0; // ID Length: 0 (no identification field)
  out[1] = 0; // Color Map Type: 0 (no color map)
  out[2] = 2; // Image Type: 2 (Uncompressed, True-color Image)
  out[3] = 0; // Color Map Spec (5 bytes unused)
  out[4] = 0;
  out[5] = 0;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0; // X Origin: 0
  out[9] = 0;
  out[10] = 0; // Y Origin: 0
  out[11] = 0;
  out[12] = width & 0xff; // Width (Little-endian 16-bit)
  out[13] = (width >> 8) & 0xff;
  out[14] = height & 0xff; // Height (Little-endian 16-bit)
  out[15] = (height >> 8) & 0xff;
  out[16] = 32; // Bits per pixel (32-bit BGRA)
  out[17] = 0x20; // Image Descriptor: Top-to-bottom, Left-to-right (0x20), 8-bit alpha

  // Convert RGBA -> BGRA in uncompressed TGA byte order
  const src = buffer.data;
  let dstIdx = headerSize;
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const srcIdx = i * 4;
    out[dstIdx + 0] = src[srcIdx + 2]; // Blue
    out[dstIdx + 1] = src[srcIdx + 1]; // Green
    out[dstIdx + 2] = src[srcIdx + 0]; // Red
    out[dstIdx + 3] = src[srcIdx + 3]; // Alpha
    dstIdx += 4;
  }

  return new Blob([out], { type: 'image/x-tga' });
}
