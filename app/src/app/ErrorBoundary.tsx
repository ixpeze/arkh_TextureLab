import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, Trash2 } from 'lucide-react';
import { formatDiagnosticsText } from './diagnostics';

interface RootErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<RootErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[RootErrorBoundary] Caught unhandled React error:', error, errorInfo);
  }

  handleCopyDiagnostics = async () => {
    try {
      const report = await formatDiagnosticsText(this.state.error, this.state.errorInfo?.componentStack);
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy diagnostics:', err);
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            backgroundColor: 'var(--bg-canvas, #111215)',
            color: 'var(--text-main, #ECE8E1)',
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '640px',
              width: '100%',
              backgroundColor: 'var(--bg-surface, #181A1F)',
              border: '1px solid var(--border-subtle, #2C3038)',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertTriangle size={24} color="var(--accent, #FFB02E)" />
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                TextureLab Encountered an Unhandled Error
              </h2>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted, #8E94A0)' }}>
              A component crashed unexpectedly. You can copy the diagnostic report for troubleshooting
              or reload the interface to restore state.
            </p>

            {this.state.error && (
              <pre
                style={{
                  margin: '0 0 20px 0',
                  padding: '12px',
                  backgroundColor: 'var(--bg-canvas, #111215)',
                  border: '1px solid var(--border-subtle, #2C3038)',
                  borderRadius: '4px',
                  color: '#F08A8A',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono, monospace)',
                  overflowX: 'auto',
                  maxHeight: '140px',
                }}
              >
                {this.state.error.name}: {this.state.error.message}
                {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
              </pre>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: 'var(--accent, #FFB02E)',
                  color: '#111215',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} />
                Reload UI
              </button>

              <button
                type="button"
                onClick={this.handleCopyDiagnostics}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-main, #ECE8E1)',
                  border: '1px solid var(--border-subtle, #2C3038)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {this.state.copied ? <Check size={14} color="#6FD08C" /> : <Copy size={14} />}
                {this.state.copied ? 'Diagnostics Copied!' : 'Copy Diagnostics'}
              </button>

              <button
                type="button"
                onClick={this.handleResetStorage}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted, #8E94A0)',
                  border: '1px solid var(--border-subtle, #2C3038)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                <Trash2 size={14} />
                Reset & Clear Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface NodeErrorBoundaryProps {
  children: ReactNode;
  nodeId?: string;
  nodeTitle?: string;
}

interface NodeErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class NodeErrorBoundary extends Component<NodeErrorBoundaryProps, NodeErrorBoundaryState> {
  constructor(props: NodeErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<NodeErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[NodeErrorBoundary] Node ${this.props.nodeId ?? 'unknown'} threw:`, error, errorInfo);
  }

  handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const report = await formatDiagnosticsText(this.state.error);
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // ignore
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="node-error-fallback"
          style={{
            padding: '12px',
            backgroundColor: 'var(--bg-surface, #181A1F)',
            border: '1px solid #F08A8A',
            borderRadius: '6px',
            color: 'var(--text-main, #ECE8E1)',
            minWidth: '180px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <AlertTriangle size={14} color="#F08A8A" />
            <strong style={{ color: '#F08A8A' }}>
              {this.props.nodeTitle ? `${this.props.nodeTitle} Error` : 'Node Error'}
            </strong>
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: '10px', color: 'var(--text-muted, #8E94A0)' }}>
            {this.state.error?.message || 'Render failed'}
          </p>
          <button
            type="button"
            onClick={this.handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: 'transparent',
              color: 'var(--text-main, #ECE8E1)',
              border: '1px solid var(--border-subtle, #2C3038)',
              borderRadius: '4px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            {this.state.copied ? <Check size={10} color="#6FD08C" /> : <Copy size={10} />}
            {this.state.copied ? 'Copied' : 'Copy Diagnostics'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

