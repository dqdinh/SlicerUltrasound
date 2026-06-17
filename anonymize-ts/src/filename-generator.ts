import * as crypto from 'crypto';
import { PATIENT_ID_HASH_LENGTH, INSTANCE_ID_HASH_LENGTH } from './types';

/**
 * Generate an anonymized filename from PatientID and SOPInstanceUID.
 *
 * Format: "{patientHash}_{instanceHash}.dcm"
 * - patientHash: 10-digit number derived from SHA-256 of PatientID
 * - instanceHash: 8-digit number derived from SHA-256 of SOPInstanceUID
 *
 * Matches the Python implementation in DicomFileManager._generate_filename_from_dicom().
 */
export function generateAnonFilename(
  patientId: string,
  sopInstanceUid: string,
  hashPatientId: boolean = true
): string {
  if (!patientId || !sopInstanceUid) {
    return '';
  }

  let patientPart: string;
  if (hashPatientId) {
    patientPart = hashToDigits(patientId, PATIENT_ID_HASH_LENGTH);
  } else {
    patientPart = patientId;
  }

  const instancePart = hashToDigits(sopInstanceUid, INSTANCE_ID_HASH_LENGTH);

  return `${patientPart}_${instancePart}.dcm`;
}

/**
 * Hash a string using SHA-256 and return a zero-padded decimal digit string.
 *
 * Mirrors Python: int(hashlib.sha256(s.encode()).hexdigest(), 16) % 10**length
 */
export function hashToDigits(value: string, length: number): string {
  const hash = crypto.createHash('sha256');
  hash.update(value);
  const hexDigest = hash.digest('hex');

  // Convert hex to BigInt, mod 10^length, then zero-pad
  const bigVal = BigInt('0x' + hexDigest);
  const modVal = bigVal % BigInt(10 ** length);
  return modVal.toString().padStart(length, '0');
}
