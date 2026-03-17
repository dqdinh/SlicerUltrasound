/**
 * Input to the anonymizer — works with in-memory buffers for OHIF compatibility.
 */
export interface AnonymizeInput {
  /** Raw DICOM file bytes */
  dicomBuffer: ArrayBuffer;
  /** Original file path (used for keys.csv InputPath column, optional) */
  inputPath?: string;
}

/**
 * Result of anonymizing a single DICOM file.
 */
export interface AnonymizeResult {
  /** Anonymized DICOM file bytes */
  anonymizedBuffer: ArrayBuffer;
  /** Generated anonymized filename, e.g. "1234567890_12345678.dcm" */
  anonFilename: string;
  /** Anonymized DICOM header as a JSON-serializable dictionary */
  headerJson: Record<string, unknown>;
  /** Row data for keys.csv */
  metadata: KeysRecord;
}

/**
 * A row in the keys.csv mapping file.
 */
export interface KeysRecord {
  InputPath: string;
  OutputPath: string;
  AnonFilename: string;
  PatientUID: string;
  StudyUID: string;
  SeriesUID: string;
  InstanceUID: string;
  PhysicalDeltaX: number | null;
  PhysicalDeltaY: number | null;
  ContentDate: string;
  ContentTime: string;
  Patch: boolean;
  TransducerModel: string;
}

/**
 * A rule for matching DICOM metadata to determine the top_ratio value.
 * Each key in `match` is a DICOM tag keyword; the value is a case-insensitive
 * substring pattern to match against the tag's value.
 */
export interface TopRatioRule {
  match: Record<string, string>;
  topRatio: number;
}

/**
 * Full anonymization configuration.
 */
export interface AnonymizeConfig {
  /** Fallback top_ratio if no rule matches (default: 0 = no masking) */
  defaultTopRatio: number;
  /** Ordered list of rules; first match wins */
  rules: TopRatioRule[];
  /** Whether to hash the patient ID using SHA-256 (default: true) */
  hashPatientId: boolean;
  /** Whether to skip single-frame DICOM files (default: false) */
  skipSingleFrame: boolean;
  /** Whether to preserve directory structure in output (default: true) */
  preserveDirectoryStructure: boolean;
}

/**
 * Extracted DICOM metadata used throughout the anonymization pipeline.
 */
export interface DicomMetadata {
  PatientID: string;
  PatientName: string;
  PatientBirthDate: string;
  StudyInstanceUID: string;
  SeriesInstanceUID: string;
  SOPInstanceUID: string;
  SOPClassUID: string;
  Modality: string;
  Manufacturer: string;
  ManufacturerModelName: string;
  TransducerType: string;
  StudyDate: string;
  SeriesDate: string;
  ContentDate: string;
  StudyTime: string;
  SeriesTime: string;
  ContentTime: string;
  ReferringPhysicianName: string;
  AccessionNumber: string;
  NumberOfFrames: number;
  Rows: number;
  Columns: number;
  SamplesPerPixel: number;
  BitsAllocated: number;
  BitsStored: number;
  HighBit: number;
  PixelRepresentation: number;
  PhotometricInterpretation: string;
  PlanarConfiguration: number;
  PatientAge: string;
  PatientSex: string;
  SeriesNumber: string;
  StationName: string;
  StudyDescription: string;
  TransducerType_raw: string;
  PhysicalDeltaX: number | null;
  PhysicalDeltaY: number | null;
}

/**
 * Pixel data dimensions for a DICOM image.
 */
export interface PixelDimensions {
  numFrames: number;
  height: number;
  width: number;
  channels: number;
  /** Bits allocated per sample (default: 8). Used to compute bytes per pixel. */
  bitsAllocated: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: AnonymizeConfig = {
  defaultTopRatio: 0,
  rules: [],
  hashPatientId: true,
  skipSingleFrame: false,
  preserveDirectoryStructure: true,
};

/**
 * Error thrown when a DICOM file is intentionally skipped (not a failure).
 */
export class SkippedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkippedError';
  }
}

/** Allowed DICOM file extensions (lowercase) */
export const DICOM_EXTENSIONS = new Set(['.dcm', '.dicom']);

/** Length of the hashed patient ID in digits */
export const PATIENT_ID_HASH_LENGTH = 10;

/** Length of the hashed instance ID in digits */
export const INSTANCE_ID_HASH_LENGTH = 8;

/**
 * DICOM tags to copy from source to anonymized dataset.
 */
export const DICOM_TAGS_TO_COPY = [
  'BitsAllocated',
  'BitsStored',
  'HighBit',
  'ManufacturerModelName',
  'PatientAge',
  'PatientSex',
  'PixelRepresentation',
  'SeriesNumber',
  'StationName',
  'StudyDate',
  'StudyDescription',
  'StudyTime',
  'TransducerType',
  'Manufacturer',
] as const;
