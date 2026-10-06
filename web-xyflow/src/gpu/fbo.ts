/**
 * ARKH TextureLab - GPU Framebuffer (FBO) Target Helper
 */

export class FboManager {
  private gl: WebGL2RenderingContext;
  private fbo: WebGLFramebuffer | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.fbo = gl.createFramebuffer();
  }

  public bindRenderTarget(texture: WebGLTexture, width: number, height: number): void {
    const gl = this.gl;
    if (!this.fbo) {
      this.fbo = gl.createFramebuffer();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete status: 0x${status.toString(16)}`);
    }

    gl.viewport(0, 0, width, height);
  }

  public unbind(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  public dispose(): void {
    if (this.fbo) {
      this.gl.deleteFramebuffer(this.fbo);
      this.fbo = null;
    }
  }
}
