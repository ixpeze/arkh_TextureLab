import { describe, it, expect, vi } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { compileGraph } from '../../graph/compile';
import { GpuScheduler } from '../../gpu/scheduler';
import { TexturePool } from '../../gpu/texturePool';
import { ProgramManager } from '../../gpu/programs';
import { FboManager } from '../../gpu/fbo';

describe('Sub-phase 4D: Compiler & Scheduler (TC-450..472)', () => {
  const dummyNodes: Node[] = [
    { id: 'n_in', type: 'textureInput', data: { colorSpace: 'linear' }, position: { x: 0, y: 0 } },
    { id: 'n_levels', type: 'levels', data: { gamma: 1.5 }, position: { x: 200, y: 0 } },
    { id: 'n_invert', type: 'invert', data: {}, position: { x: 400, y: 0 } },
    { id: 'n_unrelated', type: 'constantColor', data: { color: '#ff0000' }, position: { x: 0, y: 200 } },
  ];

  const dummyEdges: Edge[] = [
    { id: 'e1', source: 'n_in', target: 'n_levels', sourceHandle: 'rgba', targetHandle: 'input' },
    { id: 'e2', source: 'n_levels', target: 'n_invert', sourceHandle: 'rgba', targetHandle: 'input' },
  ];

  it('TC-450: compileGraph orders passes topologically and hashes nodes', () => {
    const plan = compileGraph({
      nodes: dummyNodes,
      edges: dummyEdges,
      demandNodeIds: new Set(['n_invert']),
      workingRes: 1024,
    });

    expect(plan.passes.length).toBe(3);
    expect(plan.passes[0].nodeId).toBe('n_in');
    expect(plan.passes[1].nodeId).toBe('n_levels');
    expect(plan.passes[2].nodeId).toBe('n_invert');

    // TC-454: Liveness analysis
    expect(plan.livenessLastConsumer.get('n_in')).toBe('n_levels');
    expect(plan.livenessLastConsumer.get('n_levels')).toBe('n_invert');
  });

  it('TC-451: changing unrelated branch generates 0 passes for viewed node', () => {
    // Initial compile
    const planA = compileGraph({
      nodes: dummyNodes,
      edges: dummyEdges,
      demandNodeIds: new Set(['n_invert']),
      workingRes: 1024,
    });

    // Update only n_unrelated
    const modifiedNodes = dummyNodes.map((n) =>
      n.id === 'n_unrelated' ? { ...n, data: { color: '#00ff00' } } : n
    );

    const planB = compileGraph({
      nodes: modifiedNodes,
      edges: dummyEdges,
      demandNodeIds: new Set(['n_invert']),
      cachedHashes: planA.allHashes,
      workingRes: 1024,
    });

    // n_invert branch has 0 dirty passes
    expect(planB.dirtyPasses.length).toBe(0);
  });

  it('TC-450: modifying upstream node marks only itself and downstream dirty', () => {
    const planA = compileGraph({
      nodes: dummyNodes,
      edges: dummyEdges,
      demandNodeIds: new Set(['n_invert']),
      workingRes: 1024,
    });

    // Modify gamma on n_levels
    const modifiedNodes = dummyNodes.map((n) =>
      n.id === 'n_levels' ? { ...n, data: { gamma: 2.2 } } : n
    );

    const planB = compileGraph({
      nodes: modifiedNodes,
      edges: dummyEdges,
      demandNodeIds: new Set(['n_invert']),
      cachedHashes: planA.allHashes,
      workingRes: 1024,
    });

    expect(planB.dirtyPasses.length).toBe(2);
    expect(planB.dirtyPasses.map((p) => p.nodeId)).toEqual(['n_levels', 'n_invert']);
  });

  it('TC-453: cycle-safe topological sorting', () => {
    const cycleNodes: Node[] = [
      { id: 'a', type: 'math', data: {}, position: { x: 0, y: 0 } },
      { id: 'b', type: 'math', data: {}, position: { x: 100, y: 0 } },
    ];
    const cycleEdges: Edge[] = [
      { id: 'e_ab', source: 'a', target: 'b' },
      { id: 'e_ba', source: 'b', target: 'a' },
    ];

    expect(() =>
      compileGraph({
        nodes: cycleNodes,
        edges: cycleEdges,
        demandNodeIds: new Set(['a', 'b']),
      })
    ).not.toThrow();
  });

  it('TC-457: scheduler generation cancellation stops stale runs', async () => {
    const gl = {
      FRAMEBUFFER: 0x8d40,
      COLOR_ATTACHMENT0: 0x8ce0,
      FRAMEBUFFER_COMPLETE: 0x8cd5,
      createTexture: vi.fn(() => ({})),
      deleteTexture: vi.fn(),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      createFramebuffer: vi.fn(() => ({})),
      deleteFramebuffer: vi.fn(),
      bindFramebuffer: vi.fn(),
      framebufferTexture2D: vi.fn(),
      checkFramebufferStatus: vi.fn(() => 0x8cd5),
      viewport: vi.fn(),
    } as unknown as WebGL2RenderingContext;

    const pool = new TexturePool({ gl });
    const programs = {} as unknown as ProgramManager;
    const fbo = new FboManager(gl);

    const executePass = vi.fn();
    const scheduler = new GpuScheduler({
      gl,
      pool,
      programs,
      fbo,
      executePass,
      maxPassesPerFrame: 1, // yield every pass
    });

    const plan = compileGraph({
      nodes: dummyNodes,
      edges: dummyEdges,
      demandNodeIds: new Set(['n_invert']),
    });

    // Start first run
    const p1 = scheduler.schedule(plan);
    // Immediately cancel / rapid slider scrub
    scheduler.cancelPending();

    const result1 = await p1;
    expect(result1).toBe(false); // Run was cancelled!

    // Fresh run completes
    const p2 = scheduler.schedule(plan);
    const result2 = await p2;
    expect(result2).toBe(true);
    expect(executePass).toHaveBeenCalled();

    scheduler.dispose();
  });

  it('TC-463: refine timer triggers after 120 ms idle', async () => {
    vi.useFakeTimers();
    const gl = {
      createTexture: vi.fn(() => ({})),
      deleteTexture: vi.fn(),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      createFramebuffer: vi.fn(() => ({})),
      deleteFramebuffer: vi.fn(),
    } as unknown as WebGL2RenderingContext;

    const scheduler = new GpuScheduler({
      gl,
      pool: new TexturePool({ gl }),
      programs: {} as unknown as ProgramManager,
      fbo: new FboManager(gl),
      executePass: vi.fn(),
    });

    const onRefine = vi.fn();
    scheduler.scheduleRefine(onRefine, 120);

    vi.advanceTimersByTime(50);
    expect(onRefine).not.toHaveBeenCalled();

    vi.advanceTimersByTime(80);
    expect(onRefine).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
