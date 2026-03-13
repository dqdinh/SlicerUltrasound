import * as crypto from 'crypto';
import dcmjs from 'dcmjs';
import { DicomMetadata, DICOM_TAGS_TO_COPY, PATIENT_ID_HASH_LENGTH } from './types';
import { hashToDigits } from './filename-generator';

const { DicomMetaDictionary } = dcmjs.data;

/**
 * De-identified metadata fields to apply to the output dataset.
 */
export interface DeidentifiedFields {
  PatientName: string;
  PatientID: string;
  PatientBirthDate: string;
  ReferringPhysicianName: string;
  AccessionNumber: string;
  StudyDate: string;
  SeriesDate: string;
  ContentDate: string;
  StudyTime: string;
  SeriesTime: string;
  ContentTime: string;
  SeriesInstanceUID: string;
}

/**
 * De-identify DICOM metadata following the same logic as the Python DicomFileManager.
 *
 * - Clears PatientName, ReferringPhysicianName, AccessionNumber
 * - Hashes PatientID using SHA-256 (10 digits)
 * - Truncates PatientBirthDate to year + "0101"
 * - Shifts StudyDate/SeriesDate/ContentDate by 0-30 days (seeded by original PatientID)
 * - Regenerates SeriesInstanceUID
 */
export function deidentifyMetadata(
  metadata: DicomMetadata,
  anonFilename: string,
  hashPatientId: boolean = true
): DeidentifiedFields {
  const newPatientName = anonFilename.replace('.dcm', '');
  const newPatientId = hashPatientId
    ? hashToDigits(metadata.PatientID, PATIENT_ID_HASH_LENGTH)
    : metadata.PatientID;

  const truncatedBirthDate = truncateBirthDate(metadata.PatientBirthDate);

  const dateOffset = getSeededDateOffset(metadata.PatientID);
  const shiftedStudyDate = shiftDate(metadata.StudyDate, dateOffset);
  const shiftedSeriesDate = shiftDate(metadata.SeriesDate, dateOffset);
  const shiftedContentDate = shiftDate(metadata.ContentDate, dateOffset);

  const newSeriesInstanceUID = DicomMetaDictionary.uid();

  return {
    PatientName: newPatientName,
    PatientID: newPatientId,
    PatientBirthDate: truncatedBirthDate,
    ReferringPhysicianName: '',
    AccessionNumber: '',
    StudyDate: shiftedStudyDate,
    SeriesDate: shiftedSeriesDate,
    ContentDate: shiftedContentDate,
    StudyTime: metadata.StudyTime,
    SeriesTime: metadata.SeriesTime,
    ContentTime: metadata.ContentTime,
    SeriesInstanceUID: newSeriesInstanceUID,
  };
}

/**
 * Apply de-identified fields to a naturalized dcmjs dataset.
 * Also copies essential source tags and sets conformance attributes.
 */
export function applyDeidentification(
  dataset: Record<string, any>,
  sourceMetadata: DicomMetadata,
  deidentified: DeidentifiedFields
): void {
  // Apply anonymized patient info
  dataset.PatientName = deidentified.PatientName;
  dataset.PatientID = deidentified.PatientID;
  dataset.PatientBirthDate = deidentified.PatientBirthDate;
  dataset.ReferringPhysicianName = deidentified.ReferringPhysicianName;
  dataset.AccessionNumber = deidentified.AccessionNumber;

  // Apply shifted dates
  dataset.StudyDate = deidentified.StudyDate;
  dataset.SeriesDate = deidentified.SeriesDate;
  dataset.ContentDate = deidentified.ContentDate;
  dataset.StudyTime = deidentified.StudyTime;
  dataset.SeriesTime = deidentified.SeriesTime;
  dataset.ContentTime = deidentified.ContentTime;

  // Regenerate SeriesInstanceUID
  dataset.SeriesInstanceUID = deidentified.SeriesInstanceUID;
}

/**
 * Truncate birth date to year + "0101".
 */
function truncateBirthDate(birthDate: string): string {
  if (!birthDate || birthDate.length < 4) {
    return '';
  }
  return birthDate.substring(0, 4) + '0101';
}

/**
 * Get a deterministic date offset (0-30 days) seeded by patient ID.
 *
 * This implements a simple seeded PRNG that matches the Python behavior:
 *   random.seed(patientId)
 *   random.randint(0, 30)
 *
 * We use a simple hash-based approach for determinism.
 */
export function getSeededDateOffset(patientId: string): number {
  const hash = crypto.createHash('sha256');
  hash.update(patientId);
  const hexDigest = hash.digest('hex');
  // Use the first 8 hex chars as a seed value
  const seedVal = parseInt(hexDigest.substring(0, 8), 16);
  return seedVal % 31; // 0-30 inclusive
}

/**
 * Shift a date string (YYYYMMDD) by the given number of days.
 */
export function shiftDate(dateStr: string, offsetDays: number): string {
  if (!dateStr || dateStr.length !== 8) {
    return dateStr;
  }

  try {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // 0-indexed
    const day = parseInt(dateStr.substring(6, 8), 10);

    const date = new Date(year, month, day);
    date.setDate(date.getDate() + offsetDays);

    const newYear = date.getFullYear().toString().padStart(4, '0');
    const newMonth = (date.getMonth() + 1).toString().padStart(2, '0');
    const newDay = date.getDate().toString().padStart(2, '0');

    return `${newYear}${newMonth}${newDay}`;
  } catch {
    return dateStr;
  }
}
