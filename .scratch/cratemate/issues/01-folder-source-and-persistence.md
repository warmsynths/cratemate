# 01 - Folder Source Discovery & IndexedDB Handle Persistence

Type: task
Status: resolved
Blocked by:

## Question

How should CrateMate discover audio files recursively across user-selected local directories via the File System Access API (`showDirectoryPicker`), persist directory handles in IndexedDB across browser reloads, handle permission re-querying gracefully, and skip scanning/analyzing files that are already indexed?

## Answer

Implemented via `ScannerService` (`src/services/scanner.ts`) and `StorageService` (`src/services/storage.ts`):
1. User invokes `showDirectoryPicker()` on a button click, returning a `FileSystemDirectoryHandle`.
2. The directory handle is persisted directly in IndexedDB via `idb-keyval` under key `cratemate_handle_<folderId>`, while serializable metadata (name, stats, custom host OS path prefix) is stored in the folder record.
3. On return visits, `handle.queryPermission({ mode: 'read' })` checks if the handle is still valid. If `prompt`, a "Re-link Handle" button is presented to request permission on user gesture.
4. During recursive traversal, each file path is checked against `storage.isSampleIndexed(sampleId)`. Already-indexed samples are counted in `skipped` and their audio is neither re-read nor re-decoded.
