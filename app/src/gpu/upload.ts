/**
 * ARKH TextureLab - Exact GPU Texture Upload (P4-B2)
 * Disables alpha premultiplication, color conversion, and row padding.
 */

import type { TexturePool, PooledTexture } from './texturePool';
import type { DecodedImage } from '../io/decode';

export interface UploadOptions {
  gl: WebGL2RenderingContext;
  pool: TexturePool;
  image: DecodedImage;
  highPrecision?: boolean;
}

export function uploadTexture(options: UploadOptions): PooledTexture {
  const { gl, pool, image, highPrecision = false } = options;
  const { width, height, bitDepth, data } = image;

  // Exact data texture unpacking settings
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  if (bitDepth === 16) {
    const data16 = data as Uint16Array;
    if (highPrecision) {
      // Widened to RGBA16F (Float32Array normalized to 0.0..1.0 for upload)
      const totalElements = width * height * 4;
      const float32 = new Float32Array(totalElements);
      for (let i = 0; i < totalElements; i++) {
        float32[i] = data16[i] / 65535.0;
      }

      const pooled = pool.acquire(width, height, 'RGBA16F');
      gl.bindTexture(gl.TEXTURE_2D, pooled.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        width,
        height,
        0,
        gl.RGBA,
        gl.FLOAT,
        float32
      );
      gl.bindTexture(gl.TEXTURE_2D, null);
      return pooled;
    }

    // 16-bit rounded to 8-bit
    const totalElements = width * height * 4;
    const uint8 = new Uint8Array(totalElements);
    for (let i = 0; i < totalElements; i++) {
      uint8[i] = Math.round(data16[i] / 257);
    }

    const pooled = pool.acquire(width, height, 'RGBA8');
    gl.bindTexture(gl.TEXTURE_2D, pooled.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      uint8
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    return pooled;
  }

  // Standard 8-bit upload
  const uint8 = data as Uint8Array;
  const pooled = pool.acquire(width, height, 'RGBA8');
  gl.bindTexture(gl.TEXTURE_2D, pooled.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    uint8
  );
  gl.bindTexture(gl.TEXTURE_2D, null);
  return pooled;
}
