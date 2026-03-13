// Main API
export { anonymizeDicom, anonymizeBatch } from './anonymizer';

// Types
export type {
  AnonymizeInput,
  AnonymizeResult,
  AnonymizeConfig,
  KeysRecord,
  TopRatioRule,
  DicomMetadata,
  PixelDimensions,
} from './types';
export { DEFAULT_CONFIG, DICOM_EXTENSIONS } from './types';

// Config
export { loadConfig, mergeWithDefaults, resolveTopRatio } from './config-loader';

// Individual modules (for advanced usage)
export { readDicom, isUltrasound, getTransducerModel } from './dicom-reader';
export type { ParsedDicom } from './dicom-reader';
export { deidentifyMetadata, shiftDate, getSeededDateOffset } from './deidentifier';
export type { DeidentifiedFields } from './deidentifier';
export { generateAnonFilename, hashToDigits } from './filename-generator';
export { applyTopRedaction, applyTopRedactionInPlace } from './pixel-redactor';
export { writeAnonymizedDicom } from './dicom-writer';
export { exportHeader, buildKeysRecord, keysRecordsToCsv } from './header-exporter';
