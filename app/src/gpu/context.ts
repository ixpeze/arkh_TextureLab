/**
 * ARKH TextureLab - WebGL2 Context Management & Capabilities Detection
 */

export interface GpuCapabilities {
  maxTextureSize: number;
  maxRenderbufferSize: number;
  hasColorBufferFloat: boolean;
  hasTextureFloatLinear: boolean;
  hasFloatBlend: boolean;
  renderer: string;
  vendor: string;
  isSoftware: boolean;
}

export interface GpuContextOptions {
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  powerPreference?: WebGLPowerPreference;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export interface GpuContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  caps: GpuCapabilities;
  isLost: boolean;
  dispose: () => void;
}

const SOFTWARE_RENDERER_REGEX = /swiftshader|llvmpipe|softpipe|software|mesa\s+offscreen/i;

export function queryGpuCapabilities(gl: WebGL2RenderingContext): GpuCapabilities {
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
  const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 2048;

  const hasColorBufferFloat = Boolean(gl.getExtension('EXT_color_buffer_float'));
  const hasTextureFloatLinear = Boolean(gl.getExtension('OES_texture_float_linear'));
  const hasFloatBlend = Boolean(gl.getExtension('EXT_float_blend'));

  let renderer = 'Unknown WebGL2 Renderer';
  let vendor = 'Unknown Vendor';

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || renderer;
    vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || vendor;
  } else {
    renderer = gl.getParameter(gl.RENDERER) || renderer;
    vendor = gl.getParameter(gl.VENDOR) || vendor;
  }

  const isSoftware = SOFTWARE_RENDERER_REGEX.test(renderer) || SOFTWARE_RENDERER_REGEX.test(vendor);

  return {
    maxTextureSize,
    maxRenderbufferSize,
    hasColorBufferFloat,
    hasTextureFloatLinear,
    hasFloatBlend,
    renderer,
    vendor,
    isSoftware,
  };
}

export function createGpuContext(options: GpuContextOptions = {}): GpuContext {
  const canvas = options.canvas ?? (
    typeof document !== 'undefined'
      ? document.createElement('canvas')
      : new OffscreenCanvas(64, 64)
  );

  const contextAttributes: WebGLContextAttributes = {
    powerPreference: options.powerPreference ?? 'high-performance',
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    desynchronized: false,
  };

  const rawGl = canvas.getContext('webgl2', contextAttributes);
  if (!rawGl) {
    throw new Error(
      'WebGL2 is not supported or was blocked. TextureLab requires WebGL2 hardware acceleration to process textures.'
    );
  }
  const gl = rawGl as WebGL2RenderingContext;

  const caps = queryGpuCapabilities(gl);
  let isLost = gl.isContextLost();

  const handleLost = (e: Event) => {
    e.preventDefault();
    isLost = true;
    options.onContextLost?.();
  };

  const handleRestored = () => {
    isLost = false;
    options.onContextRestored?.();
  };

  if ('addEventListener' in canvas) {
    (canvas as HTMLCanvasElement).addEventListener('webglcontextlost', handleLost, false);
    (canvas as HTMLCanvasElement).addEventListener('webglcontextrestored', handleRestored, false);
  }

  const dispose = () => {
    if ('removeEventListener' in canvas) {
      (canvas as HTMLCanvasElement).removeEventListener('webglcontextlost', handleLost);
      (canvas as HTMLCanvasElement).removeEventListener('webglcontextrestored', handleRestored);
    }
  };

  return {
    gl,
    canvas,
    caps,
    get isLost() {
      return isLost;
    },
    dispose,
  };
}
