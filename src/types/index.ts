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
}

export interface Kit {
  id: string;
  name: string;
  padCount: 4 | 6 | 8;
  pads: PadSlot[];
  dominantKey?: string; // harmonic key if tonal samples exist
  dominantCamelot?: string;
  generatedAt: number;
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
