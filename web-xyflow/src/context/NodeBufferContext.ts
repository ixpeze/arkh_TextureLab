import { createContext, useContext } from 'react';
import type { TextureBuffer } from '../types/buffer';

export interface NodeBufferContextType {
  evaluatedBuffers: Record<string, TextureBuffer>;
  sourceBuffers: Record<string, TextureBuffer>;
  setSourceBuffer: (nodeId: string, buffer: TextureBuffer) => void;
  onUpdateNodeData: (nodeId: string, patch: any) => void;
}

export const NodeBufferContext = createContext<NodeBufferContextType>({
  evaluatedBuffers: {},
  sourceBuffers: {},
  setSourceBuffer: () => {},
  onUpdateNodeData: () => {},
});

export const useNodeBuffers = () => useContext(NodeBufferContext);
