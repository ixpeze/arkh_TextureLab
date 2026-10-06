/**
 * ARKH TextureLab - Demand-Driven GPU Scheduler with Cancellation and Liveness Management (P4-D2, P4-D3)
 */

import type { TexturePool, PooledTexture } from './texturePool';
import type { ProgramManager } from './programs';
import type { FboManager } from './fbo';
import type { CompilationPlan, RenderPass } from '../graph/compile';

export type PassExecutor = (
  pass: RenderPass,
  inputTextures: Record<string, WebGLTexture>,
  outputTexture: WebGLTexture
) => void;

export interface SchedulerOptions {
  gl: WebGL2RenderingContext;
  pool: TexturePool;
  programs: ProgramManager;
  fbo: FboManager;
  executePass: PassExecutor;
  maxPassesPerFrame?: number; // Default 6
  onWorkingResChange?: (newRes: number) => void;
}

export class GpuScheduler {
  private pool: TexturePool;
  private fbo: FboManager;
  private executePass: PassExecutor;
  private maxPassesPerFrame: number;

  private currentGeneration = 0;
  private renderedCache = new Map<string, PooledTexture>(); // contentHash -> PooledTexture
  private nodeToHash = new Map<string, string>(); // nodeId -> latest contentHash

  // Adaptive working resolution governor
  private workingRes = 1024;
  private latencyHistory: number[] = [];
  private onWorkingResChange?: (newRes: number) => void;

  // Refine timer
  private refineTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SchedulerOptions) {
    this.pool = options.pool;
    this.fbo = options.fbo;
    this.executePass = options.executePass;
    this.maxPassesPerFrame = options.maxPassesPerFrame ?? 6;
    this.onWorkingResChange = options.onWorkingResChange;
  }

  public getWorkingResolution(): number {
    return this.workingRes;
  }

  public setWorkingResolution(res: number): void {
    this.workingRes = Math.max(512, res);
  }

  public getRenderedTexture(contentHash: string): WebGLTexture | null {
    const pooled = this.renderedCache.get(contentHash);
    return pooled ? pooled.texture : null;
  }

  public getTextureForNode(nodeId: string): WebGLTexture | null {
    const hash = this.nodeToHash.get(nodeId);
    return hash ? this.getRenderedTexture(hash) : null;
  }

  public cancelPending(): void {
    this.currentGeneration++;
    if (this.refineTimer) {
      clearTimeout(this.refineTimer);
      this.refineTimer = null;
    }
  }

  public async schedule(
    plan: CompilationPlan,
    onProgress?: (completed: number, total: number) => void
  ): Promise<boolean> {
    const generation = ++this.currentGeneration;
    const startTime = performance.now();

    const dirty = plan.dirtyPasses;
    let completedPasses = 0;

    for (let i = 0; i < dirty.length; i += this.maxPassesPerFrame) {
      if (generation !== this.currentGeneration) {
        return false; // Cancelled
      }

      const chunk = dirty.slice(i, i + this.maxPassesPerFrame);
      for (const pass of chunk) {
        if (generation !== this.currentGeneration) return false;

        // Resolve input textures from rendered cache
        const inputTexMap: Record<string, WebGLTexture> = {};
        for (const inputRef of pass.inputs) {
          const upHash = plan.allHashes.get(inputRef.sourceNodeId);
          if (upHash) {
            const upTex = this.renderedCache.get(upHash);
            if (upTex) {
              inputTexMap[inputRef.targetHandle] = upTex.texture;
            }
          }
        }

        // Acquire output texture from pool
        const fmt = pass.highPrecision ? 'RGBA16F' : 'RGBA8';
        const outPooled = this.pool.acquire(pass.resolution.width, pass.resolution.height, fmt);

        // Bind and execute
        this.fbo.bindRenderTarget(outPooled.texture, pass.resolution.width, pass.resolution.height);
        this.executePass(pass, inputTexMap, outPooled.texture);
        this.fbo.unbind();

        // Cache output
        this.renderedCache.set(pass.contentHash, outPooled);
        this.nodeToHash.set(pass.nodeId, pass.contentHash);
        completedPasses++;

        // Liveness cleanup: if an upstream input reached its last consumer and is not a demand target
        for (const inputRef of pass.inputs) {
          const lastConsumerId = plan.livenessLastConsumer.get(inputRef.sourceNodeId);
          if (lastConsumerId === pass.nodeId) {
            const upPass = plan.passes.find((p) => p.nodeId === inputRef.sourceNodeId);
            if (upPass && !upPass.isDemandTarget) {
              const upPooled = this.renderedCache.get(upPass.contentHash);
              if (upPooled) {
                this.renderedCache.delete(upPass.contentHash);
                this.pool.release(upPooled);
              }
            }
          }
        }
      }

      onProgress?.(completedPasses, dirty.length);

      // Yield frame if more passes remain
      if (i + this.maxPassesPerFrame < dirty.length) {
        await new Promise((r) =>
          typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(r) : setTimeout(r, 0)
        );
      }
    }

    const duration = performance.now() - startTime;
    this.recordLatency(duration);

    return true;
  }

  private recordLatency(ms: number): void {
    this.latencyHistory.push(ms);
    if (this.latencyHistory.length > 30) {
      this.latencyHistory.shift();
    }

    // Auto governor: if > 24 ms for 10 frames, step down. If < 8 ms for 30 frames, step up.
    if (this.latencyHistory.length >= 10) {
      const recent10 = this.latencyHistory.slice(-10);
      const isSlow = recent10.every((t) => t > 24);
      if (isSlow && this.workingRes > 512) {
        const nextRes = this.workingRes === 2048 ? 1024 : 512;
        this.workingRes = nextRes;
        this.latencyHistory = [];
        this.onWorkingResChange?.(nextRes);
        return;
      }
    }

    if (this.latencyHistory.length >= 30) {
      const isFast = this.latencyHistory.every((t) => t < 8);
      if (isFast && this.workingRes < 2048) {
        const nextRes = this.workingRes === 512 ? 1024 : 2048;
        this.workingRes = nextRes;
        this.latencyHistory = [];
        this.onWorkingResChange?.(nextRes);
      }
    }
  }

  public scheduleRefine(onRefine: () => void, delayMs = 120): void {
    if (this.refineTimer) {
      clearTimeout(this.refineTimer);
    }
    this.refineTimer = setTimeout(() => {
      this.refineTimer = null;
      onRefine();
    }, delayMs);
  }

  public dispose(): void {
    this.cancelPending();
    for (const pooled of this.renderedCache.values()) {
      this.pool.release(pooled);
    }
    this.renderedCache.clear();
    this.nodeToHash.clear();
  }
}
