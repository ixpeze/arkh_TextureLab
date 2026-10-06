/**
 * ARKH TextureLab - Viewer Display Renderer & 128px Node Thumbnail Generator (P4-D4, P4-D5)
 */

import type { ProgramManager, GpuProgram } from './programs';
import type { ReadbackManager } from './readback';
import { DISPLAY_FRAG } from './shaders/displayOps';

export interface ViewerDisplaySettings {
  compareMode?: number; // 0=None, 1=Wipe, 2=SideBySide, 3=Difference
  wipePos?: number;
  diffGain?: number;
  tiling?: { x: number; y: number };
  channel?: number; // 0=RGB, 1=R, 2=G, 3=B, 4=A, 5=RGBA over checker
  srgbView?: boolean;
}

export class ViewerRenderer {
  private gl: WebGL2RenderingContext;
  private programs: ProgramManager;
  private readback: ReadbackManager;
  private displayProg: GpuProgram | null = null;

  constructor(gl: WebGL2RenderingContext, programs: ProgramManager, readback: ReadbackManager) {
    this.gl = gl;
    this.programs = programs;
    this.readback = readback;
  }

  private getProgram(): GpuProgram {
    if (!this.displayProg) {
      this.displayProg = this.programs.getOrCreateProgram('display', DISPLAY_FRAG);
    }
    return this.displayProg;
  }

  public render(
    targetCanvas: HTMLCanvasElement | OffscreenCanvas,
    texA: WebGLTexture,
    texB?: WebGLTexture | null,
    settings: ViewerDisplaySettings = {}
  ): void {
    const gl = this.gl;
    const prog = this.getProgram();

    // Bind default framebuffer (the canvas)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, targetCanvas.width, targetCanvas.height);

    prog.use();
    prog.uniforms.setTexture('u_texA', 0, texA);

    const hasCompare = Boolean(texB && settings.compareMode && settings.compareMode > 0);
    prog.uniforms.setInt('u_hasCompare', hasCompare ? 1 : 0);
    if (hasCompare && texB) {
      prog.uniforms.setTexture('u_texB', 1, texB);
      prog.uniforms.setInt('u_compareMode', settings.compareMode || 0);
      prog.uniforms.setFloat('u_wipePos', settings.wipePos ?? 0.5);
      prog.uniforms.setFloat('u_diffGain', settings.diffGain ?? 1.0);
    }

    const tiling = settings.tiling ?? { x: 1, y: 1 };
    prog.uniforms.setVec2('u_tiling', tiling.x, tiling.y);
    prog.uniforms.setInt('u_channel', settings.channel ?? 0);
    prog.uniforms.setInt('u_srgbView', settings.srgbView ? 1 : 0);

    this.programs.drawFullscreen();
  }

  public probePixel(
    texture: WebGLTexture,
    x: number,
    y: number
  ): { r: number; g: number; b: number; a: number } {
    const res = this.readback.readTextureSync(texture, { x, y, width: 1, height: 1 }, 'RGBA8');
    const d = res.data as Uint8Array;
    return {
      r: d[0],
      g: d[1],
      b: d[2],
      a: d[3],
    };
  }

  public renderThumbnail(
    destCanvas: HTMLCanvasElement,
    srcTexture: WebGLTexture
  ): void {
    const gl = this.gl;
    destCanvas.width = 128;
    destCanvas.height = 128;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, 128, 128);

    const prog = this.getProgram();
    prog.use();
    prog.uniforms.setTexture('u_texA', 0, srcTexture);
    prog.uniforms.setInt('u_hasCompare', 0);
    prog.uniforms.setVec2('u_tiling', 1, 1);
    prog.uniforms.setInt('u_channel', 0);
    prog.uniforms.setInt('u_srgbView', 0);

    this.programs.drawFullscreen();
  }
}
