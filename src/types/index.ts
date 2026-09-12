export type SampleRole = 
  | 'Kick/Low' 
  | 'Snare/Snap' 
  | 'Hat/Air' 
  | 'Tonal/Melodic' 
  | 'Texture/Wildcard';

export interface FrequencyEnergyBalance {
  low: number;   // < 250 Hz (ratio 0-1)
  mid: number;   // 250 - 4000 Hz (ratio 0-1)
  high: number;  // > 4000 Hz (ratio 0-1)
}

export interface AcousticProfile {
  duration: number; // in seconds
  transientSharpness: number; // attack score 0-100 (combination of rise time and crest factor)
  attackRiseMs: number; // time in ms from onset to 90% peak
  crestFactorDb: number; // peak-to-RMS in dB
  energyBalance: FrequencyEnergyBalance;
  rootPitchHz?: number; // fundamental frequency f0
  rootKey?: string; // e.g. "C3", "F#2"
  camelotKey?: string; // e.g. "8A" (Am), "8B" (C)
  pitchConfidence: number; // 0-1
  isMelodic: boolean;
  waveformBins: number[]; // 64-128 normalized peak values (0-1) for mini waveform rendering
}

export interface SampleRecord {
  id: string; // unique hash or `${folderId}:${relativePath}`
  folderId: string;
  folderName: string;
  fileName: string;
  relativePath: string; // path relative to folder source
  fileSize: number;
  lastModified: number;
  role: SampleRole;
  acousticProfile: AcousticProfile;
  tags: string[];
}

export interface FolderSource {
  id: string;
  name: string;
  pathPrefix?: string; // optional host OS prefix, e.g. "E:\Audio\Packs"
  handle?: FileSystemDirectoryHandle;
  hasHandle: boolean;
  permissionGranted: boolean;
  totalFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  lastScannedAt?: number;
}

export interface PadSlot {
  index: number; // 0-indexed
  keybind: string; // e.g. "1" or "Q"
  role: SampleRole;
  sample?: SampleRecord;
  locked: boolean;
  isPlaying: boolean;
  isLoading?: boolean;
}

export interface RoleAcousticTarget {
  durationMin?: number; // in seconds (e.g., 0.04s for hats, 0.2s for kicks)
  durationMax?: number; // in seconds (e.g., 0.25s for hats, 2.0s for kicks)
  sharpnessTarget?: 'any' | 'punchy' | 'moderate' | 'soft';
  minSharpness?: number; // 0-100
  maxSharpness?: number; // 0-100
  preferredBand?: 'low' | 'mid' | 'high';
  minBandEnergy?: number; // threshold (0-1), e.g. low >= 0.45
  keywords?: string[]; // positive keywords (e.g. ['808', 'sub', 'punch'])
  negativeKeywords?: string[]; // negative keywords (e.g. ['acoustic', 'vintage'])
}

export interface AcousticCriteria {
  durationMin?: number; // fallback min duration in seconds
  durationMax?: number; // fallback max duration in seconds
  sharpnessTarget?: 'any' | 'punchy' | 'moderate' | 'soft';
  frequencyBias?: 'any' | 'warm-sub' | 'mid-focused' | 'bright-air';
  folderIds?: string[]; // if set, only select samples from these folder IDs
  keyLockMode?: 'auto' | 'strict' | 'any';
  lockedCamelotKey?: string; // e.g. "8A"
  roleTemplates?: Partial<Record<4 | 6 | 8, SampleRole[]>>;
  roleProfiles?: Partial<Record<SampleRole, RoleAcousticTarget>>;
  macroPunch?: number; // 0-100 (scales transient targets)
  macroLength?: number; // 0-100 (scales duration targets)
  macroTone?: 'neutral' | 'warm' | 'bright';
  genreKeywords?: string[]; // global preset genre keywords
  genreAffinityStrength?: number; // 0-100 (weight of keyword boost)
  antiMaskingEnabled?: boolean; // prevent sub-bass frequency clash
  packAffinityEnabled?: boolean; // bias towards same pack/recording session
}

export interface KitPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  isFactory: boolean;
  criteria: AcousticCriteria;
}

export interface Kit {
  id: string;
  name: string;
  padCount: 4 | 6 | 8;
  pads: PadSlot[];
  dominantKey?: string; // harmonic key if tonal samples exist
  dominantCamelot?: string;
  generatedAt: number;
  presetId?: string;
  presetName?: string;
  criteria?: AcousticCriteria;
  fallbackNotices?: string[];
}

export interface ScanProgress {
  isScanning: boolean;
  folderId: string;
  folderName: string;
  totalFound: number;
  analyzed: number;
  skipped: number;
  currentFile?: string;
  error?: string;
}
