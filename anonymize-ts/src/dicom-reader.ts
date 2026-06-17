import dcmjs from 'dcmjs';
import { DicomMetadata, PixelDimensions } from './types';

const { DicomMessage, DicomMetaDictionary } = dcmjs.data;

/**
 * Parsed DICOM file containing the raw dict, naturalized metadata, and pixel data.
 */
export interface ParsedDicom {
  /** The raw dcmjs DicomDict (for writing back) */
  dicomDict: any;
  /** Naturalized (keyword-keyed) dataset */
  dataset: Record<string, any>;
  /** Extracted metadata fields */
  metadata: DicomMetadata;
  /** Pixel dimensions */
  dimensions: PixelDimensions;
  /** Transfer syntax UID from file meta */
  transferSyntaxUID: string;
}

/**
 * Read and parse a DICOM file from an ArrayBuffer.
 */
export function readDicom(buffer: ArrayBuffer): ParsedDicom {
  const dicomDict = DicomMessage.readFile(buffer);
  const dataset = DicomMetaDictionary.naturalizeDataset(dicomDict.dict);

  const metadata = extractMetadata(dataset);
  const dimensions = extractDimensions(metadata);

  // Get transfer syntax from file meta info
  const metaDataset = DicomMetaDictionary.naturalizeDataset(dicomDict.meta);
  const transferSyntaxUID = metaDataset.TransferSyntaxUID || '1.2.840.10008.1.2.1';

  return {
    dicomDict,
    dataset,
    metadata,
    dimensions,
    transferSyntaxUID,
  };
}

/**
 * Extract structured metadata from a naturalized dataset.
 */
function extractMetadata(dataset: Record<string, any>): DicomMetadata {
  const spacing = extractSpacingInfo(dataset);

  return {
    PatientID: dataset.PatientID || '',
    PatientName: dataset.PatientName?.Alphabetic || dataset.PatientName || '',
    PatientBirthDate: dataset.PatientBirthDate || '',
    StudyInstanceUID: dataset.StudyInstanceUID || '',
    SeriesInstanceUID: dataset.SeriesInstanceUID || '',
    SOPInstanceUID: dataset.SOPInstanceUID || '',
    SOPClassUID: dataset.SOPClassUID || '',
    Modality: dataset.Modality || '',
    Manufacturer: dataset.Manufacturer || '',
    ManufacturerModelName: dataset.ManufacturerModelName || '',
    TransducerType: Array.isArray(dataset.TransducerType)
      ? dataset.TransducerType.join(',')
      : dataset.TransducerType || '',
    StudyDate: dataset.StudyDate || '19000101',
    SeriesDate: dataset.SeriesDate || '19000101',
    ContentDate: dataset.ContentDate || '19000101',
    StudyTime: dataset.StudyTime || '',
    SeriesTime: dataset.SeriesTime || '',
    ContentTime: dataset.ContentTime || '',
    ReferringPhysicianName:
      dataset.ReferringPhysicianName?.Alphabetic || dataset.ReferringPhysicianName || '',
    AccessionNumber: dataset.AccessionNumber || '',
    NumberOfFrames: safeParseInt(dataset.NumberOfFrames, 1),
    Rows: dataset.Rows ?? 0,
    Columns: dataset.Columns ?? 0,
    SamplesPerPixel: dataset.SamplesPerPixel ?? 1,
    BitsAllocated: dataset.BitsAllocated ?? 8,
    BitsStored: dataset.BitsStored ?? 8,
    HighBit: dataset.HighBit ?? 7,
    PixelRepresentation: dataset.PixelRepresentation ?? 0,
    PhotometricInterpretation: dataset.PhotometricInterpretation || 'MONOCHROME2',
    PlanarConfiguration: dataset.PlanarConfiguration || 0,
    PatientAge: dataset.PatientAge || '',
    PatientSex: dataset.PatientSex || '',
    SeriesNumber: String(dataset.SeriesNumber || '1'),
    StationName: dataset.StationName || '',
    StudyDescription: dataset.StudyDescription || '',
    TransducerType_raw: Array.isArray(dataset.TransducerType)
      ? dataset.TransducerType.join(',')
      : dataset.TransducerType || '',
    PhysicalDeltaX: spacing.deltaX,
    PhysicalDeltaY: spacing.deltaY,
  };
}

/**
 * Safely parse an integer value, returning a default if parsing fails or produces NaN.
 */
function safeParseInt(value: unknown, defaultValue: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : defaultValue;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

/**
 * Extract physical spacing from SequenceOfUltrasoundRegions.
 */
function extractSpacingInfo(dataset: Record<string, any>): {
  deltaX: number | null;
  deltaY: number | null;
} {
  let deltaX: number | null = null;
  let deltaY: number | null = null;

  const regions = dataset.SequenceOfUltrasoundRegions;
  if (Array.isArray(regions) && regions.length > 0) {
    const region = regions[0];
    if (region.PhysicalDeltaX !== undefined) {
      const parsed = parseFloat(region.PhysicalDeltaX);
      deltaX = Number.isFinite(parsed) ? parsed : null;
    }
    if (region.PhysicalDeltaY !== undefined) {
      const parsed = parseFloat(region.PhysicalDeltaY);
      deltaY = Number.isFinite(parsed) ? parsed : null;
    }
  }

  return { deltaX, deltaY };
}

/**
 * Extract pixel dimensions from metadata.
 */
function extractDimensions(metadata: DicomMetadata): PixelDimensions {
  return {
    numFrames: metadata.NumberOfFrames,
    height: metadata.Rows,
    width: metadata.Columns,
    channels: metadata.SamplesPerPixel,
    bitsAllocated: metadata.BitsAllocated,
  };
}

/**
 * Parse transducer type string and return the transducer model.
 * e.g. "SC6-1s,02597" → "sc6-1s"
 */
export function getTransducerModel(transducerType: string): string {
  if (!transducerType || transducerType.trim() === '') {
    return 'unknown';
  }
  return transducerType.split(',')[0].toLowerCase();
}

/**
 * Check if a DICOM file is an ultrasound modality.
 */
export function isUltrasound(metadata: DicomMetadata): boolean {
  return metadata.Modality === 'US';
}
