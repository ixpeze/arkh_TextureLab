/**
 * ARKH TextureLab - Texture Buffer Data Structure
 */

export interface TextureBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array | Uint16Array | Float32Array;
  dataUrl?: string;
}
