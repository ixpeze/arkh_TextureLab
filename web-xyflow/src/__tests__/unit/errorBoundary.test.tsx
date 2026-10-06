import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RootErrorBoundary, NodeErrorBoundary } from '../../app/ErrorBoundary';
import { formatDiagnosticsText, gatherDiagnostics, redactPath } from '../../app/diagnostics';

describe('P6-T4: Error Boundaries and Diagnostics (TC-601)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts user path names in error diagnostics (Windows & POSIX)', () => {
    const winPath = 'C:\\Users\\xpeze\\AppData\\Local\\TextureLab\\main.log';
    const posixPath = '/home/xpeze/textures/project.tlab';

    expect(redactPath(winPath)).toBe('C:\\Users\\<user>\\AppData\\Local\\TextureLab\\main.log');
    expect(redactPath(posixPath)).toBe('/home/<user>/textures/project.tlab');
  });

  it('gatherDiagnostics compiles structured environment and error data', async () => {
    const testErr = new Error('Shader compilation fault in C:\\Users\\johndoe\\src\\main.ts');
    const diag = await gatherDiagnostics(testErr, 'at Node (C:\\Users\\johndoe\\Node.tsx:10)');

    expect(diag.appVersion).toBe('1.0.0');
    expect(diag.error?.name).toBe('Error');
    expect(diag.error?.message).toContain('Shader compilation fault');
    expect(diag.error?.stack).not.toContain('johndoe');
    expect(diag.error?.componentStack).not.toContain('johndoe');
    expect(Array.isArray(diag.recentLogs)).toBe(true);
  });

  it('formatDiagnosticsText outputs human-readable report string', async () => {
    const report = await formatDiagnosticsText(new Error('Test failure'));
    expect(report).toContain('=== ARKH TextureLab Diagnostics Report ===');
    expect(report).toContain('App Version: 1.0.0');
    expect(report).toContain('--- GPU Capabilities ---');
    expect(report).toContain('--- Error Details ---');
    expect(report).toContain('Test failure');
  });

  it('TC-601: NodeErrorBoundary renders error card when in error state, preserves surrounding app', () => {
    const boundary = new NodeErrorBoundary({
      nodeId: 'node-test-1',
      nodeTitle: 'Faulty Levels',
      children: <div>Normal Content</div>,
    });

    // Healthy state renders children
    expect(boundary.render()).toBeDefined();

    // Trigger error state
    boundary.state = {
      hasError: true,
      error: new Error('Invalid LUT calculation in node-test-1'),
      copied: false,
    };

    const renderedHtml = renderToString(boundary.render() as React.ReactElement);
    expect(renderedHtml).toContain('Faulty Levels Error');
    expect(renderedHtml).toContain('Invalid LUT calculation in node-test-1');
    expect(renderedHtml).toContain('Copy Diagnostics');
    expect(renderedHtml).toContain('role="alert"');
  });

  it('RootErrorBoundary renders recovery screen on fatal crash', () => {
    const rootBoundary = new RootErrorBoundary({
      children: <div>Main App Workbench</div>,
    });

    rootBoundary.state = {
      hasError: true,
      error: new Error('Fatal WebGL device memory crash'),
      errorInfo: { componentStack: 'at Workbench (App.tsx:50)' },
      copied: false,
    };

    const html = renderToString(rootBoundary.render() as React.ReactElement);
    expect(html).toContain('TextureLab Encountered an Unhandled Error');
    expect(html).toContain('Fatal WebGL device memory crash');
    expect(html).toContain('Reload UI');
    expect(html).toContain('Copy Diagnostics');
    expect(html).toContain('Reset &amp; Clear Cache');
  });
});
