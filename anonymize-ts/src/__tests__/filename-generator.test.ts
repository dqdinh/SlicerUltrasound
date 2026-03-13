import { generateAnonFilename, hashToDigits } from '../filename-generator';

describe('hashToDigits', () => {
  it('produces a fixed-length zero-padded string', () => {
    const result = hashToDigits('test-patient-id', 10);
    expect(result).toHaveLength(10);
    expect(/^\d{10}$/.test(result)).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const a = hashToDigits('ABC123', 10);
    const b = hashToDigits('ABC123', 10);
    expect(a).toBe(b);
  });

  it('produces different values for different inputs', () => {
    const a = hashToDigits('patient-A', 10);
    const b = hashToDigits('patient-B', 10);
    expect(a).not.toBe(b);
  });

  it('handles different lengths', () => {
    const result8 = hashToDigits('test', 8);
    expect(result8).toHaveLength(8);
    expect(/^\d{8}$/.test(result8)).toBe(true);
  });
});

describe('generateAnonFilename', () => {
  it('generates filename in correct format', () => {
    const filename = generateAnonFilename('PATIENT123', '1.2.3.4.5.6');
    expect(filename).toMatch(/^\d{10}_\d{8}\.dcm$/);
  });

  it('returns empty string for empty patient ID', () => {
    expect(generateAnonFilename('', '1.2.3.4')).toBe('');
  });

  it('returns empty string for empty SOP instance UID', () => {
    expect(generateAnonFilename('PATIENT', '')).toBe('');
  });

  it('uses raw patient ID when hashing disabled', () => {
    const filename = generateAnonFilename('RAW_ID', '1.2.3.4', false);
    expect(filename).toMatch(/^RAW_ID_\d{8}\.dcm$/);
  });

  it('is deterministic', () => {
    const a = generateAnonFilename('P1', '1.2.3');
    const b = generateAnonFilename('P1', '1.2.3');
    expect(a).toBe(b);
  });
});
