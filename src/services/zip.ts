/**
 * Zero-dependency in-browser ZIP archive builder
 * Implements PKWARE ZIP Specification using Store (Method 0)
 * Optimized for audio WAVs and hardware file structures with full UTF-8 path support
 */

// Precompute CRC-32 IEEE 802.3 table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

export function computeCrc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

interface ZipEntry {
  path: string;
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

export class ZipBuilder {
  private entries: ZipEntry[] = [];
  private textEncoder = new TextEncoder();

  /**
   * Add a file to the ZIP archive.
   * Path should use forward slashes (e.g. "Samples/CrateMate/Kit/01_Kick.wav")
   */
  addFile(path: string, content: Uint8Array | string): void {
    const cleanPath = path.replace(/^\/+/, '');
    const nameBytes = this.textEncoder.encode(cleanPath);
    const data = typeof content === 'string' ? this.textEncoder.encode(content) : content;
    const crc = computeCrc32(data);

    this.entries.push({
      path: cleanPath,
      nameBytes,
      data,
      crc,
      offset: 0
    });
  }

  /**
   * Compile all entries into a complete ZIP binary Uint8Array
   */
  build(): Uint8Array {
    let localHeadersSize = 0;
    for (const entry of this.entries) {
      // 30 bytes fixed + filename length + uncompressed data length
      localHeadersSize += 30 + entry.nameBytes.length + entry.data.length;
    }

    let centralDirSize = 0;
    for (const entry of this.entries) {
      // 46 bytes fixed + filename length
      centralDirSize += 46 + entry.nameBytes.length;
    }

    const endOfCentralDirSize = 22;
    const totalSize = localHeadersSize + centralDirSize + endOfCentralDirSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    let offset = 0;

    // 1. Write Local File Headers and Data
    for (const entry of this.entries) {
      entry.offset = offset;

      // Local file header signature: 0x04034b50 ("PK\x03\x04")
      view.setUint32(offset, 0x04034b50, true);
      view.setUint16(offset + 4, 20, true);       // Version needed: 2.0
      view.setUint16(offset + 6, 0x0800, true);   // Flags: Bit 11 set (UTF-8 filename)
      view.setUint16(offset + 8, 0, true);        // Compression: 0 (Store)
      view.setUint16(offset + 10, 0, true);       // Mod time
      view.setUint16(offset + 12, 0, true);       // Mod date
      view.setUint32(offset + 14, entry.crc, true); // CRC-32
      view.setUint32(offset + 18, entry.data.length, true); // Compressed size
      view.setUint32(offset + 22, entry.data.length, true); // Uncompressed size
      view.setUint16(offset + 26, entry.nameBytes.length, true); // Filename length
      view.setUint16(offset + 28, 0, true);       // Extra field length

      offset += 30;

      // Filename bytes
      bytes.set(entry.nameBytes, offset);
      offset += entry.nameBytes.length;

      // File payload
      bytes.set(entry.data, offset);
      offset += entry.data.length;
    }

    const centralDirStartOffset = offset;

    // 2. Write Central Directory Headers
    for (const entry of this.entries) {
      // Central directory header signature: 0x02014b50 ("PK\x01\x02")
      view.setUint32(offset, 0x02014b50, true);
      view.setUint16(offset + 4, 20, true);       // Version made by: 2.0
      view.setUint16(offset + 6, 20, true);       // Version needed: 2.0
      view.setUint16(offset + 8, 0x0800, true);   // Flags: UTF-8
      view.setUint16(offset + 10, 0, true);       // Compression: 0 (Store)
      view.setUint16(offset + 12, 0, true);       // Mod time
      view.setUint16(offset + 14, 0, true);       // Mod date
      view.setUint32(offset + 16, entry.crc, true); // CRC-32
      view.setUint32(offset + 20, entry.data.length, true); // Compressed size
      view.setUint32(offset + 24, entry.data.length, true); // Uncompressed size
      view.setUint16(offset + 28, entry.nameBytes.length, true); // Filename length
      view.setUint16(offset + 30, 0, true);       // Extra field length
      view.setUint16(offset + 32, 0, true);       // Comment length
      view.setUint16(offset + 34, 0, true);       // Disk number start
      view.setUint16(offset + 36, 0, true);       // Internal file attributes
      view.setUint32(offset + 38, 0, true);       // External file attributes
      view.setUint32(offset + 42, entry.offset, true); // Relative offset of local header

      offset += 46;

      // Filename bytes
      bytes.set(entry.nameBytes, offset);
      offset += entry.nameBytes.length;
    }

    const centralDirLength = offset - centralDirStartOffset;

    // 3. Write End of Central Directory Record (EOCD)
    // Signature: 0x06054b50 ("PK\x05\x06")
    view.setUint32(offset, 0x06054b50, true);
    view.setUint16(offset + 4, 0, true); // Disk number
    view.setUint16(offset + 6, 0, true); // Disk with CD start
    view.setUint16(offset + 8, this.entries.length, true); // Total entries on disk
    view.setUint16(offset + 10, this.entries.length, true); // Total entries
    view.setUint32(offset + 12, centralDirLength, true); // Central directory size
    view.setUint32(offset + 16, centralDirStartOffset, true); // CD start offset
    view.setUint16(offset + 20, 0, true); // Comment length

    return bytes;
  }

  /**
   * Trigger immediate browser file download of the built ZIP
   */
  download(filename: string): void {
    const zipData = this.build();
    const blob = new Blob([zipData.buffer as ArrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
