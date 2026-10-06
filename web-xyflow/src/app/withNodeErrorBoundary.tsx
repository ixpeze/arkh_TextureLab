import React from 'react';
import { NodeErrorBoundary } from './ErrorBoundary';

export function withNodeErrorBoundary<P extends { id: string }>(
  Component: React.ComponentType<P>,
  nodeTitle?: string
): React.FC<P> {
  const WrappedNode: React.FC<P> = (props) => (
    <NodeErrorBoundary nodeId={props.id} nodeTitle={nodeTitle}>
      <Component {...props} />
    </NodeErrorBoundary>
  );
  WrappedNode.displayName = `WithErrorBoundary(${Component.displayName || Component.name || 'Node'})`;
  return WrappedNode;
}
