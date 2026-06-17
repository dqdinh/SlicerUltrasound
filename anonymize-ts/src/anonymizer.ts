import { AnonymizeInput, AnonymizeResult, AnonymizeConfig, DEFAULT_CONFIG, SkippedError } from './types';
import { readDicom, isUltrasound } from './dicom-reader';
import { deidentifyMetadata } from './deidentifier';
import { generateAnonFilename } from './filename-generator';
import { resolveTopRatio } from './config-loader';
import { applyTopRedaction } from './pixel-redactor';
import { writeAnonymizedDicom } from './dicom-writer';
import { exportHeader, buildKeysRecord } from './header-exporter';

/**
 * Anonymize a single DICOM file.
 *
 * This is the main library entry point. It is stateless — each call processes
 * one DICOM buffer independently, making it suitable for use as an OHIF service.
 *
 * Pipeline: read → validate → resolve config → generate filename →
 *           de-identify metadata → redact pixels → write → export header
 */
export function anonymizeDicom(
  input: AnonymizeInput,
  config: AnonymizeConfig = DEFAULT_CONFIG
): AnonymizeResult {
  // 1. Parse the DICOM buffer
  const parsed = readDicom(input.dicomBuffer);

  // 2. Validate it's an ultrasound
  if (!isUltrasound(parsed.metadata)) {
    throw new Error(
      `Not an ultrasound DICOM file (Modality: ${parsed.metadata.Modality})`
    );
  }

  // 3. Skip single frame if configured
  if (config.skipSingleFrame && parsed.metadata.NumberOfFrames < 2) {
    throw new SkippedError('Single-frame DICOM file skipped (skipSingleFrame=true)');
  }

  // 4. Generate anonymized filename
  const anonFilename = generateAnonFilename(
    parsed.metadata.PatientID,
    parsed.metadata.SOPInstanceUID,
    config.hashPatientId
  );

  if (!anonFilename) {
    throw new Error('Failed to generate anonymized filename (missing PatientID or SOPInstanceUID)');
  }

  // 5. De-identify metadata
  const deidentified = deidentifyMetadata(
    parsed.metadata,
    anonFilename,
    config.hashPatientId
  );

  // 6. Resolve top_ratio based on manufacturer config
  const topRatio = resolveTopRatio(parsed.metadata, config);

  // 7. Apply pixel redaction if top_ratio > 0
  let modifiedPixelData: ArrayBuffer | undefined;
  if (topRatio > 0 && parsed.dataset.PixelData) {
    modifiedPixelData = applyTopRedaction(
      parsed.dataset.PixelData,
      parsed.dimensions,
      topRatio
    );
  }

  // 8. Write anonymized DICOM
  const anonymizedBuffer = writeAnonymizedDicom(parsed, deidentified, modifiedPixelData);

  // 9. Export header
  const headerJson = exportHeader(parsed.dataset, anonFilename);

  // 10. Build keys record
  const outputPath = anonFilename;
  const metadata = buildKeysRecord(
    parsed.metadata,
    input.inputPath || '',
    outputPath,
    anonFilename
  );

  return {
    anonymizedBuffer,
    anonFilename,
    headerJson,
    metadata,
  };
}

/**
 * Anonymize multiple DICOM buffers.
 * Returns results for each successfully processed file; errors are collected separately.
 */
export function anonymizeBatch(
  inputs: AnonymizeInput[],
  config: AnonymizeConfig = DEFAULT_CONFIG
): { results: AnonymizeResult[]; errors: Array<{ inputPath: string; error: string }> } {
  const results: AnonymizeResult[] = [];
  const errors: Array<{ inputPath: string; error: string }> = [];

  for (const input of inputs) {
    try {
      const result = anonymizeDicom(input, config);
      results.push(result);
    } catch (err) {
      errors.push({
        inputPath: input.inputPath || '<unknown>',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results, errors };
}
