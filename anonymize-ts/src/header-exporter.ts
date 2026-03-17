import { KeysRecord, DicomMetadata } from './types';
import { getTransducerModel } from './dicom-reader';

/**
 * Convert a naturalized dcmjs dataset to a JSON-serializable header dictionary.
 * Excludes PixelData and applies partial anonymization.
 *
 * Mirrors DicomFileManager.dicom_header_to_dict() + save_anonymized_dicom_header().
 */
export function exportHeader(
  dataset: Record<string, any>,
  anonFilename: string
): Record<string, unknown> {
  const header: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(dataset)) {
    // Skip pixel data and internal dcmjs properties
    if (key === 'PixelData' || key === '_vrMap' || key === '_meta' || key.startsWith('_')) {
      continue;
    }
    header[key] = toJsonCompatible(value);
  }

  // Anonymize patient name in header
  if ('PatientName' in header) {
    header['PatientName'] = anonFilename.replace('.dcm', '');
  }

  // Partially anonymize birth date (keep year, set month/day to 0101)
  if ('PatientBirthDate' in header && typeof header['PatientBirthDate'] === 'string') {
    const birthDate = header['PatientBirthDate'] as string;
    if (birthDate.length >= 4) {
      header['PatientBirthDate'] = birthDate.substring(0, 4) + '0101';
    }
  }

  return header;
}

/**
 * Build a KeysRecord for the keys.csv output.
 */
export function buildKeysRecord(
  metadata: DicomMetadata,
  inputPath: string,
  outputPath: string,
  anonFilename: string
): KeysRecord {
  return {
    InputPath: inputPath,
    OutputPath: outputPath,
    AnonFilename: anonFilename,
    PatientUID: metadata.PatientID,
    StudyUID: metadata.StudyInstanceUID,
    SeriesUID: metadata.SeriesInstanceUID,
    InstanceUID: metadata.SOPInstanceUID,
    PhysicalDeltaX: metadata.PhysicalDeltaX,
    PhysicalDeltaY: metadata.PhysicalDeltaY,
    ContentDate: metadata.ContentDate,
    ContentTime: metadata.ContentTime,
    Patch: metadata.PhysicalDeltaX === null || metadata.PhysicalDeltaY === null,
    TransducerModel: getTransducerModel(metadata.TransducerType),
  };
}

/**
 * Serialize an array of KeysRecords to CSV string.
 */
export function keysRecordsToCsv(records: KeysRecord[]): string {
  if (records.length === 0) {
    return '';
  }

  const headers = Object.keys(records[0]) as (keyof KeysRecord)[];
  const headerLine = headers.join(',');

  const rows = records.map((record) =>
    headers.map((key) => {
      const val = record[key];
      if (val === null || val === undefined) {
        return '';
      }
      let str = String(val);
      // Prevent CSV formula injection in spreadsheet applications
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      // Escape fields containing commas or quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  return [headerLine, ...rows].join('\n') + '\n';
}

/**
 * Convert a value to a JSON-compatible format.
 */
function toJsonCompatible(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as Uint8Array);
  }
  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }
  if (Array.isArray(value)) {
    return value.map(toJsonCompatible);
  }
  if (typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = toJsonCompatible(v);
    }
    return obj;
  }
  return value;
}
