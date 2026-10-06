import { getPlatform } from '../platform/PlatformService';
import { queryGpuCapabilities } from '../gpu/context';

export interface DiagnosticData {
  timestamp: string;
  appVersion: string;
  platform: string;
  userAgent: string;
  gpu: {
    renderer: string;
    vendor: string;
    maxTextureSize: number;
    hasColorBufferFloat: boolean;
    isSoftware: boolean;
  };
  memory?: {
    usedJSHeapMB: number;
    totalJSHeapMB: number;
    jsHeapLimitMB: number;
  };
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    componentStack?: string;
  };
  recentLogs: string[];
}

export function redactPath(str: string): string {
  // Redact Windows and Unix username patterns
  return str
    .replace(/([\\/]users[\\/])[^\\/\s:]+/gi, '$1<user>')
    .replace(/([\\/]home[\\/])[^\\/\s:]+/gi, '$1<user>');
}

export async function gatherDiagnostics(
  error?: Error | null,
  componentStack?: string | null
): Promise<DiagnosticData> {
  const platformService = getPlatform();

  // Query GPU capabilities
  let gpu = {
    renderer: 'Unknown',
    vendor: 'Unknown',
    maxTextureSize: 0,
    hasColorBufferFloat: false,
    isSoftware: false,
  };

  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (gl) {
        const caps = queryGpuCapabilities(gl);
        gpu = {
          renderer: caps.renderer,
          vendor: caps.vendor,
          maxTextureSize: caps.maxTextureSize,
          hasColorBufferFloat: caps.hasColorBufferFloat,
          isSoftware: caps.isSoftware,
        };
      }
    }
  } catch {
    // ignore
  }

  // Memory
  let memory: DiagnosticData['memory'] | undefined;
  // oxlint-disable-next-line typescript/no-explicit-any
  const perfMem = typeof window !== 'undefined' ? (window.performance as any)?.memory : undefined;
  if (perfMem) {
    memory = {
      usedJSHeapMB: Number((perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(2)),
      totalJSHeapMB: Number((perfMem.totalJSHeapSize / (1024 * 1024)).toFixed(2)),
      jsHeapLimitMB: Number((perfMem.jsHeapSizeLimit / (1024 * 1024)).toFixed(2)),
    };
  }

  // Logs
  let recentLogs: string[] = [];
  try {
    recentLogs = await platformService.getRecentLogs(200);
  } catch {
    recentLogs = ['[WARN] Failed to fetch system logs'];
  }

  return {
    timestamp: new Date().toISOString(),
    appVersion: '1.0.0',
    platform: platformService.platform,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Test',
    gpu,
    memory,
    error: error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack ? redactPath(error.stack) : undefined,
          componentStack: componentStack ? redactPath(componentStack) : undefined,
        }
      : undefined,
    recentLogs: recentLogs.map((l) => redactPath(l)),
  };
}

export async function formatDiagnosticsText(
  error?: Error | null,
  componentStack?: string | null
): Promise<string> {
  const data = await gatherDiagnostics(error, componentStack);

  const lines: string[] = [
    '=== ARKH TextureLab Diagnostics Report ===',
    `Timestamp:   ${data.timestamp}`,
    `App Version: ${data.appVersion}`,
    `Platform:    ${data.platform}`,
    `User Agent:  ${data.userAgent}`,
    '',
    '--- GPU Capabilities ---',
    `Renderer:    ${data.gpu.renderer}`,
    `Vendor:      ${data.gpu.vendor}`,
    `Max Texture: ${data.gpu.maxTextureSize}px`,
    `Float FBO:   ${data.gpu.hasColorBufferFloat}`,
    `Software GL: ${data.gpu.isSoftware}`,
  ];

  if (data.memory) {
    lines.push(
      '',
      '--- Memory (V8 Heap) ---',
      `Used Heap:   ${data.memory.usedJSHeapMB} MB`,
      `Total Heap:  ${data.memory.totalJSHeapMB} MB`,
      `Heap Limit:  ${data.memory.jsHeapLimitMB} MB`
    );
  }

  if (data.error) {
    lines.push(
      '',
      '--- Error Details ---',
      `Error:       ${data.error.name || 'Error'}: ${data.error.message || 'Unknown error'}`,
      data.error.stack ? `Stack:\n${data.error.stack}` : '',
      data.error.componentStack ? `Component Stack:\n${data.error.componentStack}` : ''
    );
  }

  if (data.recentLogs.length > 0) {
    lines.push('', '--- Recent System Logs (Redacted) ---');
    lines.push(...data.recentLogs);
  }

  lines.push('', '=== End of Report ===');
  return lines.filter(Boolean).join('\n');
}
