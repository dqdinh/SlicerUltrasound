import { deidentifyMetadata, shiftDate, getSeededDateOffset } from '../deidentifier';
import { DicomMetadata } from '../types';

function makeMetadata(overrides: Partial<DicomMetadata> = {}): DicomMetadata {
  return {
    PatientID: 'TEST_PATIENT_001',
    PatientName: 'John Doe',
    PatientBirthDate: '19850315',
    StudyInstanceUID: '1.2.3.4.5',
    SeriesInstanceUID: '1.2.3.4.5.6',
    SOPInstanceUID: '1.2.3.4.5.6.7',
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.6.1',
    Modality: 'US',
    Manufacturer: 'Mindray',
    ManufacturerModelName: 'DC-70',
    TransducerType: 'SC6-1s,02597',
    StudyDate: '20240115',
    SeriesDate: '20240115',
    ContentDate: '20240115',
    StudyTime: '143022',
    SeriesTime: '143022',
    ContentTime: '143022',
    ReferringPhysicianName: 'Dr. Smith',
    AccessionNumber: 'ACC12345',
    NumberOfFrames: 100,
    Rows: 600,
    Columns: 800,
    SamplesPerPixel: 3,
    BitsAllocated: 8,
    BitsStored: 8,
    HighBit: 7,
    PixelRepresentation: 0,
    PhotometricInterpretation: 'YBR_FULL_422',
    PlanarConfiguration: 0,
    PatientAge: '039Y',
    PatientSex: 'F',
    SeriesNumber: '1',
    StationName: 'US_MACHINE',
    StudyDescription: 'Obstetric US',
    TransducerType_raw: 'SC6-1s,02597',
    PhysicalDeltaX: 0.0001,
    PhysicalDeltaY: 0.0001,
    ...overrides,
  };
}

describe('deidentifyMetadata', () => {
  it('clears patient name and uses anon filename', () => {
    const result = deidentifyMetadata(makeMetadata(), '1234567890_12345678.dcm');
    expect(result.PatientName).toBe('1234567890_12345678');
  });

  it('hashes patient ID when enabled', () => {
    const result = deidentifyMetadata(makeMetadata(), 'test.dcm', true);
    expect(result.PatientID).toHaveLength(10);
    expect(result.PatientID).not.toBe('TEST_PATIENT_001');
  });

  it('preserves patient ID when hashing disabled', () => {
    const result = deidentifyMetadata(makeMetadata(), 'test.dcm', false);
    expect(result.PatientID).toBe('TEST_PATIENT_001');
  });

  it('truncates birth date to year', () => {
    const result = deidentifyMetadata(makeMetadata(), 'test.dcm');
    expect(result.PatientBirthDate).toBe('19850101');
  });

  it('clears referring physician name', () => {
    const result = deidentifyMetadata(makeMetadata(), 'test.dcm');
    expect(result.ReferringPhysicianName).toBe('');
  });

  it('clears accession number', () => {
    const result = deidentifyMetadata(makeMetadata(), 'test.dcm');
    expect(result.AccessionNumber).toBe('');
  });

  it('shifts dates by a deterministic offset', () => {
    const metadata = makeMetadata({ StudyDate: '20240115' });
    const result = deidentifyMetadata(metadata, 'test.dcm');
    // Date should be shifted forward by 0-30 days
    expect(result.StudyDate).not.toBe('20240115');
    expect(result.StudyDate).toHaveLength(8);
    // Verify the shift is between 0 and 30 days
    const origDate = new Date(2024, 0, 15);
    const shiftedYear = parseInt(result.StudyDate.substring(0, 4), 10);
    const shiftedMonth = parseInt(result.StudyDate.substring(4, 6), 10) - 1;
    const shiftedDay = parseInt(result.StudyDate.substring(6, 8), 10);
    const newDate = new Date(shiftedYear, shiftedMonth, shiftedDay);
    const diffDays = Math.round((newDate.getTime() - origDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(0);
    expect(diffDays).toBeLessThanOrEqual(30);
  });

  it('generates a new SeriesInstanceUID', () => {
    const metadata = makeMetadata();
    const result = deidentifyMetadata(metadata, 'test.dcm');
    expect(result.SeriesInstanceUID).not.toBe(metadata.SeriesInstanceUID);
    expect(result.SeriesInstanceUID).toBeTruthy();
  });
});

describe('shiftDate', () => {
  it('shifts a date forward by the given offset', () => {
    expect(shiftDate('20240115', 5)).toBe('20240120');
  });

  it('handles month rollover', () => {
    expect(shiftDate('20240130', 3)).toBe('20240202');
  });

  it('handles year rollover', () => {
    expect(shiftDate('20241230', 5)).toBe('20250104');
  });

  it('returns original string for invalid dates', () => {
    expect(shiftDate('', 5)).toBe('');
    expect(shiftDate('abc', 5)).toBe('abc');
  });
});

describe('getSeededDateOffset', () => {
  it('returns a value between 0 and 30', () => {
    const offset = getSeededDateOffset('PATIENT_123');
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThanOrEqual(30);
  });

  it('is deterministic for the same patient ID', () => {
    const a = getSeededDateOffset('PATIENT_ABC');
    const b = getSeededDateOffset('PATIENT_ABC');
    expect(a).toBe(b);
  });

  it('produces different offsets for different patient IDs', () => {
    // With enough different IDs, we should get at least 2 different offsets
    const offsets = new Set(
      ['A', 'B', 'C', 'D', 'E'].map((id) => getSeededDateOffset(id))
    );
    expect(offsets.size).toBeGreaterThan(1);
  });
});
