import { get, set, del, keys } from 'idb-keyval';
import type { FolderSource, SampleRecord, SampleRole, Kit } from '../types/index.ts';

const FOLDERS_KEY = 'cratemate_folder_sources';
const SAMPLES_PREFIX = 'cratemate_sample_';
const ACTIVE_KIT_KEY = 'cratemate_active_kit';
const FOLDER_HANDLES_PREFIX = 'cratemate_handle_';

export class StorageService {
  /**
   * Load all saved folder sources
   */
  async getFolderSources(): Promise<FolderSource[]> {
    const folders = (await get<FolderSource[]>(FOLDERS_KEY)) || [];
    // Re-attach handles if stored separately
    for (const folder of folders) {
      const handle = await get<FileSystemDirectoryHandle>(`${FOLDER_HANDLES_PREFIX}${folder.id}`);
      if (handle) {
        folder.handle = handle;
        folder.hasHandle = true;
      }
    }
    return folders;
  }

  /**
   * Save or update folder sources list
   */
  async saveFolderSource(folder: FolderSource): Promise<void> {
    const folders = await this.getFolderSources();
    const existingIndex = folders.findIndex(f => f.id === folder.id);

    // Save handle in IDB directly
    if (folder.handle) {
      await set(`${FOLDER_HANDLES_PREFIX}${folder.id}`, folder.handle);
    }

    // Clone folder object without non-serializable handle for the array list
    const folderRecord: FolderSource = {
      ...folder,
      handle: undefined, // handles are loaded via FOLDER_HANDLES_PREFIX
      hasHandle: !!folder.handle
    };

    if (existingIndex >= 0) {
      folders[existingIndex] = folderRecord;
    } else {
      folders.push(folderRecord);
    }

    await set(FOLDERS_KEY, folders);
  }

  /**
   * Remove a folder source and its indexed samples
   */
  async removeFolderSource(folderId: string): Promise<void> {
    const folders = await this.getFolderSources();
    const filtered = folders.filter(f => f.id !== folderId);
    await set(FOLDERS_KEY, filtered);
    await del(`${FOLDER_HANDLES_PREFIX}${folderId}`);

    // Remove associated samples
    const allKeys = await keys();
    const sampleKeysToRemove = allKeys.filter(k => 
      typeof k === 'string' && k.startsWith(`${SAMPLES_PREFIX}${folderId}:`)
    );
    for (const k of sampleKeysToRemove) {
      await del(k);
    }
  }

  /**
   * Retrieve handle for a folder source
   */
  async getFolderHandle(folderId: string): Promise<FileSystemDirectoryHandle | undefined> {
    return await get<FileSystemDirectoryHandle>(`${FOLDER_HANDLES_PREFIX}${folderId}`);
  }

  /**
   * Check if a sample has already been analyzed and saved
   */
  async isSampleIndexed(sampleId: string): Promise<boolean> {
    const val = await get(`${SAMPLES_PREFIX}${sampleId}`);
    return !!val;
  }

  /**
   * Save an analyzed sample record
   */
  async saveSample(sample: SampleRecord): Promise<void> {
    await set(`${SAMPLES_PREFIX}${sample.id}`, sample);
  }

  /**
   * Save multiple sample records in batch
   */
  async saveSamplesBatch(samples: SampleRecord[]): Promise<void> {
    for (const sample of samples) {
      await set(`${SAMPLES_PREFIX}${sample.id}`, sample);
    }
  }

  /**
   * Get a single sample by its unique id
   */
  async getSample(sampleId: string): Promise<SampleRecord | undefined> {
    return await get<SampleRecord>(`${SAMPLES_PREFIX}${sampleId}`);
  }

  /**
   * Get all indexed samples across all folders
   */
  async getAllSamples(): Promise<SampleRecord[]> {
    const allKeys = await keys();
    const sampleKeys = allKeys.filter(k => 
      typeof k === 'string' && k.startsWith(SAMPLES_PREFIX)
    );
    const samples: SampleRecord[] = [];
    for (const k of sampleKeys) {
      const s = await get<SampleRecord>(k);
      if (s) samples.push(s);
    }
    return samples;
  }

  /**
   * Get all samples belonging to a specific role
   */
  async getSamplesByRole(role: SampleRole): Promise<SampleRecord[]> {
    const all = await this.getAllSamples();
    return all.filter(s => s.role === role);
  }

  /**
   * Save active kit
   */
  async saveActiveKit(kit: Kit): Promise<void> {
    await set(ACTIVE_KIT_KEY, kit);
  }

  /**
   * Load active kit
   */
  async getActiveKit(): Promise<Kit | undefined> {
    return await get<Kit>(ACTIVE_KIT_KEY);
  }

  /**
   * Clear all indexed sample data and folders (factory reset)
   */
  async clearAll(): Promise<void> {
    const allKeys = await keys();
    for (const k of allKeys) {
      if (typeof k === 'string' && (k.startsWith('cratemate_'))) {
        await del(k);
      }
    }
  }
}

export const storage = new StorageService();
