# 07 - Sample Path Copy & Kit Export Pipeline

Type: task
Status: resolved
Blocked by: 06

## Question

How should CrateMate facilitate export workflows given browser security restrictions (which conceal native drive roots from FileSystemFileHandle): copying reconstructed/configured paths to clipboard, downloading individual samples, and batch-exporting the entire kit to a designated local folder using the File System Access API?

## Answer

Implemented in `src/components/sample-pad.ts` and `src/services/scanner.ts`:
1. **Copy Path**: Uses `navigator.clipboard.writeText()`. Prepend optional user-configured "Host OS Path Prefix" (e.g. `E:\Audio\Packs\Kits`), resulting in full native paths ready for DAW samplers and search bars (e.g. `E:\Audio\Packs\Kits\Drums\Kick.wav`). Defaults to relative path if no prefix is configured.
2. **Export Kit Folder**: Uses `showDirectoryPicker()` to request a destination directory on any drive, creates a kit subfolder, retrieves native `File` objects for each pad sample via handle traversal, and writes sequentially numbered files (`Pad01_Kick_Low_...`, `Pad02_Snare_Snap_...`).
