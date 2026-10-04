// Precomputed CRC32 Table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function computeCRC32(data: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Fast client-side ZIP generator in pure TypeScript.
 * Creates standard PKZip uncompressed (Store) archives without external dependencies.
 */
export async function createZip(files: { filename: string; blob: Blob }[]): Promise<Blob> {
  const fileEntries: {
    filenameBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc32: number;
    offset: number;
  }[] = [];

  let currentOffset = 0;
  const parts: Uint8Array[] = [];

  for (const f of files) {
    const dataBytes = new Uint8Array(await f.blob.arrayBuffer());
    const encoder = new TextEncoder();
    const filenameBytes = encoder.encode(f.filename);
    const crc = computeCRC32(dataBytes);

    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(localHeader.buffer);

    // Local File Header Signature: 0x04034b50
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true); // Version needed to extract: 2.0
    view.setUint16(6, 0, true); // General purpose bit flag
    view.setUint16(8, 0, true); // Compression method: 0 (Store)
    view.setUint16(10, 0, true); // Last mod file time
    view.setUint16(12, 0, true); // Last mod file date
    view.setUint32(14, crc, true); // CRC-32
    view.setUint32(18, dataBytes.length, true); // Compressed size
    view.setUint32(22, dataBytes.length, true); // Uncompressed size
    view.setUint16(26, filenameBytes.length, true); // File name length
    view.setUint16(28, 0, true); // Extra field length
    localHeader.set(filenameBytes, 30);

    parts.push(localHeader);
    parts.push(dataBytes);

    fileEntries.push({
      filenameBytes,
      dataBytes,
      crc32: crc,
      offset: currentOffset,
    });

    currentOffset += localHeader.length + dataBytes.length;
  }

  // Build Central Directory
  const centralDirOffset = currentOffset;
  let centralDirSize = 0;

  for (const entry of fileEntries) {
    const cdh = new Uint8Array(46 + entry.filenameBytes.length);
    const view = new DataView(cdh.buffer);

    // Central Directory Header Signature: 0x02014b50
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true); // Version made by
    view.setUint16(6, 20, true); // Version needed
    view.setUint16(8, 0, true); // Flags
    view.setUint16(10, 0, true); // Compression: 0
    view.setUint16(12, 0, true); // Time
    view.setUint16(14, 0, true); // Date
    view.setUint32(16, entry.crc32, true); // CRC
    view.setUint32(20, entry.dataBytes.length, true); // Compressed size
    view.setUint32(24, entry.dataBytes.length, true); // Uncompressed size
    view.setUint16(28, entry.filenameBytes.length, true); // Filename length
    view.setUint16(30, 0, true); // Extra field length
    view.setUint16(32, 0, true); // File comment length
    view.setUint16(34, 0, true); // Disk number start
    view.setUint16(36, 0, true); // Internal file attributes
    view.setUint32(38, 0, true); // External file attributes
    view.setUint32(42, entry.offset, true); // Relative offset of local header
    cdh.set(entry.filenameBytes, 46);

    parts.push(cdh);
    centralDirSize += cdh.length;
  }

  // End of Central Directory Record (EOCD): 22 bytes
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  // Signature: 0x06054b50
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true); // Disk number
  eocdView.setUint16(6, 0, true); // Start disk
  eocdView.setUint16(8, fileEntries.length, true); // Total entries this disk
  eocdView.setUint16(10, fileEntries.length, true); // Total entries
  eocdView.setUint32(12, centralDirSize, true); // Size of central dir
  eocdView.setUint32(16, centralDirOffset, true); // Offset of central dir
  eocdView.setUint16(20, 0, true); // Comment length
  parts.push(eocd);

  return new Blob(parts as BlobPart[], { type: 'application/zip' });
}
