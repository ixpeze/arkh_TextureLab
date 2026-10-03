/**
 * Batch Engine: Orchestrates folder ingestion, texture set grouping,
 * for-each graph execution, progress tracking, cancellation, and batch export.
 */

import { LexicalNormalizer } from './normalizer';
import type { TextureBuffer } from './pixelEngine';
import type { TextureCollection, TextureItem, CollisionPolicy } from '../types/export';

export interface BatchProgressCallback {
  (progress: {
    phase: string;
    current: number;
    total: number;
    percent: number;
    currentItem?: string;
    errors: { item: string; error: string }[];
  }): void;
}

export class BatchEngine {
  private static activeCancellation = new Set<string>();

  public static cancelBatch(batchId: string): void {
    this.activeCancellation.add(batchId);
  }

  public static isBatchCancelled(batchId: string): boolean {
    return this.activeCancellation.has(batchId);
  }

  public static clearCancellation(batchId: string): void {
    this.activeCancellation.delete(batchId);
  }

  /**
   * Scan HTML5 FileList from folder drag-and-drop or webkitdirectory input.
   */
  public static async scanFiles(
    files: FileList | File[],
    options: { recursive?: boolean; filterExtensions?: string[]; cleanup?: boolean; flipGreenOnGL?: boolean } = {}
  ): Promise<TextureCollection> {
    const exts = new Set(
      (options.filterExtensions || ['.png', '.jpg', '.jpeg', '.tga', '.exr', '.webp', '.tif', '.tiff']).map((e) =>
        e.toLowerCase()
      )
    );

    const fileList = Array.from(files);
    const validFiles: { name: string; path?: string; mtime?: number; file: File }[] = [];

    for (const file of fileList) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (exts.has(ext)) {
        const fullPath = (file as any).webkitRelativePath || file.name;
        validFiles.push({
          name: file.name,
          path: fullPath,
          mtime: file.lastModified,
          file,
        });
      }
    }

    // Process through TextureLAB Normalizer rules
    const batchResult = LexicalNormalizer.processTextureBatch(validFiles, {
      cleanup: options.cleanup ?? true,
      flipGreenOnGL: options.flipGreenOnGL ?? true,
    });

    // Map into TextureItems
    const items: TextureItem[] = batchResult.items.map((entry) => {
      return {
        id: entry.id,
        originalPath: entry.originalPath,
        filename: entry.originalName,
        stem: entry.cleanStem,
        ext: entry.suffix ? `.${entry.originalName.split('.').pop()}` : '',
        setName: entry.cleanStem,
        mapType: entry.mapType,
        canonicalSuffix: entry.suffix,
        orientation: entry.orientation,
        variantNum: entry.variantNum,
        mtime: entry.mtime,
        status: entry.status,
        action: entry.action,
        buffer: undefined,
        dataUrl: undefined,
        isExcluded: entry.action.startsWith('delete_'),
      };
    });

    const folderName = validFiles[0]?.path?.split('/')[0] || 'Textures';

    return {
      id: `col_${Date.now()}`,
      name: folderName,
      folder: folderName,
      items,
      createdAt: Date.now(),
    };
  }

  /**
   * Execute For-Each processing across a texture collection.
   */
  public static async executeForEach(
    batchId: string,
    collection: TextureCollection,
    processFn: (item: TextureItem, index: number) => Promise<TextureBuffer | null>,
    onProgress?: BatchProgressCallback
  ): Promise<{
    results: { item: TextureItem; outputBuffer: TextureBuffer | null }[];
    errors: { item: string; error: string }[];
    isCancelled: boolean;
  }> {
    this.clearCancellation(batchId);
    const activeItems = collection.items.filter((i) => !i.isExcluded);
    const total = activeItems.length;
    const results: { item: TextureItem; outputBuffer: TextureBuffer | null }[] = [];
    const errors: { item: string; error: string }[] = [];

    for (let i = 0; i < total; i++) {
      if (this.isBatchCancelled(batchId)) {
        this.clearCancellation(batchId);
        return { results, errors, isCancelled: true };
      }

      const item = activeItems[i];
      onProgress?.({
        phase: 'Processing Items',
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        currentItem: item.filename,
        errors,
      });

      try {
        const outBuf = await processFn(item, i);
        results.push({ item, outputBuffer: outBuf });
      } catch (err: any) {
        errors.push({ item: item.filename, error: err?.message || String(err) });
        results.push({ item, outputBuffer: null });
      }
    }

    this.clearCancellation(batchId);
    return { results, errors, isCancelled: false };
  }

  /**
   * Resolve collisions among exported filenames according to CollisionPolicy.
   */
  public static resolveCollisions(
    filenames: string[],
    policy: CollisionPolicy = 'rename'
  ): { resolved: string[]; collisions: string[]; collisionsDetected: number } {
    const seen = new Map<string, number>();
    const resolved: string[] = [];
    const collisions: string[] = [];

    for (const fn of filenames) {
      const lower = fn.toLowerCase();
      if (!seen.has(lower)) {
        seen.set(lower, 1);
        resolved.push(fn);
      } else {
        collisions.push(fn);
        const count = seen.get(lower)!;
        seen.set(lower, count + 1);

        if (policy === 'skip') {
          // Excluded / blank marker
          resolved.push('');
        } else if (policy === 'overwrite') {
          resolved.push(fn);
        } else {
          // Rename: insert _count before file extension
          const dot = fn.lastIndexOf('.');
          const stem = dot !== -1 ? fn.substring(0, dot) : fn;
          const ext = dot !== -1 ? fn.substring(dot) : '';
          resolved.push(`${stem}_${count}${ext}`);
        }
      }
    }

    return { resolved, collisions, collisionsDetected: collisions.length };
  }
}
