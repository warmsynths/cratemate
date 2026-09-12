import { storage } from './storage.ts';
import { audioEngine } from './audio-engine.ts';
import { classifySampleRole } from './classifier.ts';
import type { FolderSource, SampleRecord, ScanProgress } from '../types/index.ts';

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.aiff', '.aif', '.flac', '.ogg']);

export type ProgressCallback = (progress: ScanProgress) => void;

export class ScannerService {
  private progressListeners: Set<ProgressCallback> = new Set();
  private isScanning = false;
  private shouldAbort = false;

  onProgress(callback: ProgressCallback): () => void {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  private notifyProgress(progress: ScanProgress) {
    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch (err) {
        console.error('Error in progress listener:', err);
      }
    }
  }

  /**
   * Request user to pick a local folder via File System Access API
   */
  async pickAndAddFolder(pathPrefix?: string): Promise<FolderSource> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API is not supported in this browser. Please use Chrome, Edge, or a Chromium-based browser.');
    }

    // Must be invoked from user gesture
    const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    const folderId = 'folder_' + Math.random().toString(36).substring(2, 9);
    
    const folder: FolderSource = {
      id: folderId,
      name: handle.name,
      pathPrefix: pathPrefix || '',
      handle,
      hasHandle: true,
      permissionGranted: true,
      totalFiles: 0,
      analyzedFiles: 0,
      skippedFiles: 0
    };

    await storage.saveFolderSource(folder);
    return folder;
  }

  /**
   * Re-check or request permission for an existing stored folder handle
   */
  async verifyFolderPermission(folder: FolderSource, promptIfNecessary = true): Promise<boolean> {
    let handle = folder.handle;
    if (!handle) {
      handle = await storage.getFolderHandle(folder.id);
      if (handle) folder.handle = handle;
    }

    if (!handle) {
      folder.permissionGranted = false;
      return false;
    }

    try {
      const queryResult = await (handle as any).queryPermission({ mode: 'read' });
      if (queryResult === 'granted') {
        folder.permissionGranted = true;
        await storage.saveFolderSource(folder);
        return true;
      }

      if (promptIfNecessary) {
        const requestResult = await (handle as any).requestPermission({ mode: 'read' });
        const granted = requestResult === 'granted';
        folder.permissionGranted = granted;
        await storage.saveFolderSource(folder);
        return granted;
      }
    } catch (err) {
      console.warn('Failed to verify folder permission:', err);
    }

    folder.permissionGranted = false;
    return false;
  }

  /**
   * Scan a folder source recursively
   */
  async scanFolder(folder: FolderSource): Promise<void> {
    if (this.isScanning) {
      throw new Error('A scan is already in progress.');
    }

    let handle = folder.handle;
    if (!handle) {
      handle = await storage.getFolderHandle(folder.id);
      if (handle) folder.handle = handle;
    }

    if (!handle) {
      throw new Error('No directory handle available for folder ' + folder.name);
    }

    const hasPermission = await this.verifyFolderPermission(folder, true);
    if (!hasPermission) {
      throw new Error(`Permission denied for folder "${folder.name}". Please grant permission.`);
    }

    this.isScanning = true;
    this.shouldAbort = false;

    let totalFound = 0;
    let analyzed = 0;
    let skipped = 0;

    const progressState: ScanProgress = {
      isScanning: true,
      folderId: folder.id,
      folderName: folder.name,
      totalFound: 0,
      analyzed: 0,
      skipped: 0
    };
    this.notifyProgress(progressState);

    try {
      // Traverse directory tree
      await this.traverseDirectory(handle, folder, '', async (file, relativePath) => {
        if (this.shouldAbort) return;

        totalFound++;
        const sampleId = `${folder.id}:${relativePath}`;
        const isIndexed = await storage.isSampleIndexed(sampleId);

        if (isIndexed) {
          skipped++;
          progressState.totalFound = totalFound;
          progressState.skipped = skipped;
          this.notifyProgress(progressState);
          return;
        }

        // New audio file: analyze in background
        progressState.currentFile = file.name;
        progressState.totalFound = totalFound;
        this.notifyProgress(progressState);

        try {
          const profile = await audioEngine.analyzeAudioFile(file);
          const { role, tags } = classifySampleRole(file.name, profile, relativePath);

          const sampleRecord: SampleRecord = {
            id: sampleId,
            folderId: folder.id,
            folderName: folder.name,
            fileName: file.name,
            relativePath,
            fileSize: file.size,
            lastModified: file.lastModified,
            role,
            acousticProfile: profile,
            tags
          };

          await storage.saveSample(sampleRecord);
          analyzed++;
          progressState.analyzed = analyzed;
          this.notifyProgress(progressState);
        } catch (fileErr) {
          console.warn(`Failed to decode/analyze file ${file.name}:`, fileErr);
        }
      });

      // Update folder source statistics
      folder.totalFiles = totalFound;
      folder.analyzedFiles = (folder.analyzedFiles || 0) + analyzed;
      folder.skippedFiles = skipped;
      folder.lastScannedAt = Date.now();
      await storage.saveFolderSource(folder);

    } finally {
      this.isScanning = false;
      progressState.isScanning = false;
      progressState.currentFile = undefined;
      this.notifyProgress(progressState);
    }
  }

  /**
   * Cancel in-progress scan
   */
  abortScan(): void {
    this.shouldAbort = true;
  }

  /**
   * Recursive directory iterator
   */
  private async traverseDirectory(
    dirHandle: FileSystemDirectoryHandle,
    folder: FolderSource,
    currentPath: string,
    fileCallback: (file: File, relativePath: string) => Promise<void>
  ): Promise<void> {
    if (this.shouldAbort) return;

    for await (const entry of (dirHandle as any).values()) {
      if (this.shouldAbort) return;

      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        const ext = '.' + entry.name.split('.').pop()?.toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          const fileHandle = entry as FileSystemFileHandle;
          try {
            const file = await fileHandle.getFile();
            await fileCallback(file, entryPath);
          } catch (err) {
            console.warn(`Could not read file ${entryPath}:`, err);
          }
        }
      } else if (entry.kind === 'directory') {
        // Skip hidden or system folders
        if (entry.name.startsWith('.') || entry.name === 'System Volume Information' || entry.name === 'node_modules') {
          continue;
        }
        const subDir = entry as FileSystemDirectoryHandle;
        await this.traverseDirectory(subDir, folder, entryPath, fileCallback);
      }
    }
  }

  /**
   * Retrieve native File object for a sample from its folder handle
   */
  async getFileForSample(sample: SampleRecord): Promise<File | undefined> {
    const handle = await storage.getFolderHandle(sample.folderId);
    if (!handle) return undefined;

    try {
      const parts = sample.relativePath.split('/');
      let currentDir = handle;

      for (let i = 0; i < parts.length - 1; i++) {
        currentDir = await (currentDir as any).getDirectoryHandle(parts[i]);
      }

      const fileName = parts[parts.length - 1];
      const fileHandle = await (currentDir as any).getFileHandle(fileName);
      return await fileHandle.getFile();
    } catch (err) {
      console.warn(`Could not retrieve File for ${sample.relativePath}:`, err);
      return undefined;
    }
  }

  /**
   * Export all kit samples into a target destination directory picked by the user
   */
  async exportKitToFolder(kitName: string, samples: SampleRecord[]): Promise<number> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API required for export');
    }

    const targetDirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    const kitSubDir = await (targetDirHandle as any).getDirectoryHandle(kitName, { create: true });

    let exportedCount = 0;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      try {
        const file = await this.getFileForSample(sample);
        if (file) {
          const paddedIndex = String(i + 1).padStart(2, '0');
          const safeRole = sample.role.replace('/', '_');
          const exportFileName = `Pad${paddedIndex}_${safeRole}_${sample.fileName}`;
          
          const newFileHandle = await (kitSubDir as any).getFileHandle(exportFileName, { create: true });
          const writable = await (newFileHandle as any).createWritable();
          await writable.write(await file.arrayBuffer());
          await writable.close();
          exportedCount++;
        }
      } catch (err) {
        console.error(`Failed to export sample ${sample.fileName}:`, err);
      }
    }

    return exportedCount;
  }
}

export const scanner = new ScannerService();
