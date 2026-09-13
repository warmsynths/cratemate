# 02 - Client-Side In-Memory ZIP Archive Bundler

Type: research
Status: resolved
Blocked by:

## Question

How should client-side `.zip` archive generation be implemented in CrateMate to package directories, WAV files, and text files into a single downloadable archive with zero external library overhead or via a minimal browser-friendly zip encoder?

## Answer

Implemented via a lightweight, zero-dependency browser-native `ZipBuilder` utility using the standard PKWARE ZIP specification:

1. **Storage-Mode Encoding (Method 0 - Store)**:
   - Audio files (WAV linear PCM) do not compress efficiently under DEFLATE (< 2-3% savings at heavy CPU penalty).
   - Compression Method `0` (Store) directly copies raw uncompressed bytes, executing in under 20ms for a complete 8-sample kit.
   - Supported natively by Windows Explorer, macOS Finder, Archive Utility, Linux, Android, and hardware SD card loaders.

2. **ZIP Binary Structure**:
   - **Local File Header** (`0x04034b50`): 30 bytes + UTF-8 filename + file bytes. Flag `0x0800` set for standard UTF-8 path support.
   - **Fast CRC-32**: Precomputed 256-entry table IEEE 802.3 polynomial (`0xEDB88320`) for integrity verification.
   - **Central Directory Header** (`0x02014b50`): 46 bytes + UTF-8 filename, referencing the exact local header byte offset.
   - **End of Central Directory Record** (`0x06054b50`): 22 bytes storing total entry count, central directory size, and offset.

3. **Browser File Triggering**:
   - Compiles all chunks into a single `Uint8Array` / `Blob([buffer], { type: 'application/zip' })`.
   - Generates an ephemeral `URL.createObjectURL(blob)` and triggers download via an anchor element (`<a download="[KitName].zip">`).
   - Clean, lightweight (~100 lines of pure TypeScript), avoiding bloated third-party dependencies (like JSZip).

