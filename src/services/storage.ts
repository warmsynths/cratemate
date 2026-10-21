import { get, set, del, keys } from 'idb-keyval';
import { classifySampleRole } from './classifier.ts';
import type { FolderSource, SampleRecord, SampleRole, Kit, KitPreset } from '../types/index.ts';

const FOLDERS_KEY = 'cratemate_folder_sources';
const SAMPLES_PREFIX = 'cratemate_sample_';
const ACTIVE_KIT_KEY = 'cratemate_active_kit';
const FOLDER_HANDLES_PREFIX = 'cratemate_handle_';
const CUSTOM_PRESETS_KEY = 'cratemate_custom_presets';
const ACTIVE_PRESET_ID_KEY = 'cratemate_active_preset_id';
const CLASSIFIER_VERSION_KEY = 'cratemate_classifier_version';

/** Bump when classifier rules change so stored samples get re-labelled from their saved profiles. */
export const CLASSIFIER_VERSION = 2;

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
   * Alias for getFolderSources
   */
  async getFolders(): Promise<FolderSource[]> {
    return this.getFolderSources();
  }

  /**
   * Fast total count of indexed samples
   */
  async getSampleCount(): Promise<number> {
    const allKeys = await keys();
    return allKeys.filter(k => typeof k === 'string' && k.startsWith(SAMPLES_PREFIX)).length;
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
   * Get all custom user presets
   */
  async getCustomPresets(): Promise<KitPreset[]> {
    return (await get<KitPreset[]>(CUSTOM_PRESETS_KEY)) || [];
  }

  /**
   * Save or update a custom user preset
   */
  async saveCustomPreset(preset: KitPreset): Promise<void> {
    const presets = await this.getCustomPresets();
    const idx = presets.findIndex(p => p.id === preset.id);
    if (idx >= 0) {
      presets[idx] = preset;
    } else {
      presets.push(preset);
    }
    await set(CUSTOM_PRESETS_KEY, presets);
  }

  /**
   * Delete a custom preset by ID
   */
  async deleteCustomPreset(presetId: string): Promise<void> {
    const presets = await this.getCustomPresets();
    const filtered = presets.filter(p => p.id !== presetId);
    await set(CUSTOM_PRESETS_KEY, filtered);
  }

  /**
   * Get ID of last active preset
   */
  async getActivePresetId(): Promise<string | undefined> {
    return await get<string>(ACTIVE_PRESET_ID_KEY);
  }

  /**
   * Save ID of active preset
   */
  async saveActivePresetId(presetId: string): Promise<void> {
    await set(ACTIVE_PRESET_ID_KEY, presetId);
  }

  /**
   * Re-run role classification on stored samples when the classifier has changed.
   * Uses the saved acoustic profiles, so no audio is decoded. Returns how many roles changed.
   */
  async reclassifyIfOutdated(): Promise<number> {
    const version = (await get<number>(CLASSIFIER_VERSION_KEY)) ?? 1;
    if (version >= CLASSIFIER_VERSION) return 0;
    let changed = 0;
    for (const sample of await this.getAllSamples()) {
      const { role, tags } = classifySampleRole(sample.fileName, sample.acousticProfile, sample.relativePath);
      if (role !== sample.role) {
        await this.saveSample({ ...sample, role, tags });
        changed++;
      }
    }
    await set(CLASSIFIER_VERSION_KEY, CLASSIFIER_VERSION);
    return changed;
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
