import dcmjs from 'dcmjs';
import { DicomMetadata, DICOM_TAGS_TO_COPY } from './types';
import { DeidentifiedFields } from './deidentifier';
import { ParsedDicom } from './dicom-reader';

const { DicomDict, DicomMessage, DicomMetaDictionary } = dcmjs.data;

/**
 * Build an anonymized DICOM ArrayBuffer from the source parsed DICOM,
 * de-identified fields, and (optionally modified) pixel data.
 *
 * Preserves the original transfer syntax and pixel encoding.
 */
export function writeAnonymizedDicom(
  source: ParsedDicom,
  deidentified: DeidentifiedFields,
  modifiedPixelData?: ArrayBuffer
): ArrayBuffer {
  // Clone the source dataset so we don't mutate it
  const dataset = { ...source.dataset };

  // Apply de-identification
  dataset.PatientName = deidentified.PatientName;
  dataset.PatientID = deidentified.PatientID;
  dataset.PatientBirthDate = deidentified.PatientBirthDate;
  dataset.ReferringPhysicianName = deidentified.ReferringPhysicianName;
  dataset.AccessionNumber = deidentified.AccessionNumber;
  dataset.StudyDate = deidentified.StudyDate;
  dataset.SeriesDate = deidentified.SeriesDate;
  dataset.ContentDate = deidentified.ContentDate;
  dataset.StudyTime = deidentified.StudyTime;
  dataset.SeriesTime = deidentified.SeriesTime;
  dataset.ContentTime = deidentified.ContentTime;
  dataset.SeriesInstanceUID = deidentified.SeriesInstanceUID;

  // Set conformance attributes
  if (!dataset.Laterality) dataset.Laterality = '';
  if (!dataset.InstanceNumber) dataset.InstanceNumber = 1;
  if (!dataset.PatientOrientation) dataset.PatientOrientation = '';
  if (!dataset.ImageType) dataset.ImageType = ['ORIGINAL', 'PRIMARY', 'IMAGE'];

  // Multi-frame specific
  const numFrames = parseInt(dataset.NumberOfFrames, 10) || 1;
  if (numFrames > 1) {
    if (!dataset.FrameTime) dataset.FrameTime = 0.1;
  }

  // If we have modified pixel data, replace it
  if (modifiedPixelData) {
    dataset.PixelData = modifiedPixelData;
  }

  // Denaturalize the dataset back to dcmjs dict format
  const denaturalized = DicomMetaDictionary.denaturalizeDataset(dataset);

  // Build a new DicomDict with the original meta header
  const newDicomDict = new DicomDict(source.dicomDict.meta);
  newDicomDict.dict = denaturalized;

  // Write to ArrayBuffer
  return newDicomDict.write();
}
