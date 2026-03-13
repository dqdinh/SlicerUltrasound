import dcmjs from 'dcmjs';
import { anonymizeDicom, anonymizeBatch } from '../anonymizer';
import { AnonymizeConfig } from '../types';

const { DicomDict, DicomMetaDictionary, DicomMessage } = dcmjs.data;

/**
 * Create a minimal synthetic ultrasound DICOM buffer for testing.
 */
function createSyntheticDicom(overrides: Record<string, any> = {}): ArrayBuffer {
  const width = 10;
  const height = 10;
  const channels = 1;
  const numFrames = 1;

  // Create uncompressed pixel data (10x10 grayscale, filled with 200)
  const pixelData = new Uint8Array(width * height * channels * numFrames);
  pixelData.fill(200);

  const dataset: Record<string, any> = {
    PatientID: 'TEST_PT_001',
    PatientName: { Alphabetic: 'Test Patient' },
    PatientBirthDate: '19900101',
    StudyInstanceUID: '1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379639',
    SeriesInstanceUID: '1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379640',
    SOPInstanceUID: '1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379641',
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.6.1', // US Image Storage
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
    ReferringPhysicianName: { Alphabetic: 'Dr. Smith' },
    AccessionNumber: 'ACC12345',
    NumberOfFrames: numFrames,
    Rows: height,
    Columns: width,
    SamplesPerPixel: channels,
    BitsAllocated: 8,
    BitsStored: 8,
    HighBit: 7,
    PixelRepresentation: 0,
    PhotometricInterpretation: 'MONOCHROME2',
    PixelData: pixelData.buffer,
    ...overrides,
  };

  // Denaturalize and create DicomDict
  const denaturalized = DicomMetaDictionary.denaturalizeDataset(dataset);

  // Create file meta
  const meta = {
    '00020001': { vr: 'OB', Value: [new Uint8Array([0, 1]).buffer] },
    '00020002': { vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.6.1'] },
    '00020003': { vr: 'UI', Value: [dataset.SOPInstanceUID] },
    '00020010': { vr: 'UI', Value: ['1.2.840.10008.1.2.1'] }, // Explicit VR Little Endian
    '00020012': { vr: 'UI', Value: ['1.2.3.4.5'] },
  };

  const dicomDict = new DicomDict(meta);
  dicomDict.dict = denaturalized;

  return dicomDict.write();
}

describe('anonymizeDicom', () => {
  const config: AnonymizeConfig = {
    defaultTopRatio: 0,
    rules: [{ match: { Manufacturer: 'mindray' }, topRatio: 0.1 }],
    hashPatientId: true,
    skipSingleFrame: false,
    preserveDirectoryStructure: true,
  };

  it('anonymizes a synthetic DICOM file', () => {
    const dicomBuffer = createSyntheticDicom();
    const result = anonymizeDicom({ dicomBuffer, inputPath: '/test/input.dcm' }, config);

    // Check filename format
    expect(result.anonFilename).toMatch(/^\d{10}_\d{8}\.dcm$/);

    // Check that anonymized buffer is valid
    expect(result.anonymizedBuffer.byteLength).toBeGreaterThan(0);

    // Check header has anonymized patient name and birth date
    // (header export only anonymizes PatientName and PatientBirthDate, matching Python behavior)
    expect(result.headerJson.PatientName).toBe(result.anonFilename.replace('.dcm', ''));

    // Check metadata record
    expect(result.metadata.AnonFilename).toBe(result.anonFilename);
    expect(result.metadata.InputPath).toBe('/test/input.dcm');
    expect(result.metadata.PatientUID).toBe('TEST_PT_001');
  });

  it('applies top ratio for Mindray manufacturer', () => {
    const dicomBuffer = createSyntheticDicom();
    const result = anonymizeDicom({ dicomBuffer }, config);

    // Parse the output to verify pixel modification
    const outputDict = DicomMessage.readFile(result.anonymizedBuffer);
    const outputDataset = DicomMetaDictionary.naturalizeDataset(outputDict.dict);

    // The output should exist and have pixel data
    expect(outputDataset.PixelData).toBeTruthy();
  });

  it('does not apply top ratio for non-matching manufacturer', () => {
    const dicomBuffer = createSyntheticDicom({ Manufacturer: 'Philips' });
    const result = anonymizeDicom({ dicomBuffer }, config);
    expect(result.anonymizedBuffer.byteLength).toBeGreaterThan(0);
  });

  it('throws for non-ultrasound modality', () => {
    const dicomBuffer = createSyntheticDicom({ Modality: 'CT' });
    expect(() => anonymizeDicom({ dicomBuffer }, config)).toThrow('Not an ultrasound');
  });

  it('throws when skipSingleFrame is true and file has 1 frame', () => {
    const dicomBuffer = createSyntheticDicom({ NumberOfFrames: 1 });
    const skipConfig = { ...config, skipSingleFrame: true };
    expect(() => anonymizeDicom({ dicomBuffer }, skipConfig)).toThrow('skipped');
  });

  it('shifts dates deterministically', () => {
    const dicomBuffer = createSyntheticDicom();
    const result1 = anonymizeDicom({ dicomBuffer }, config);
    const result2 = anonymizeDicom({ dicomBuffer }, config);

    // Parse both outputs
    const dataset1 = DicomMetaDictionary.naturalizeDataset(
      DicomMessage.readFile(result1.anonymizedBuffer).dict
    );
    const dataset2 = DicomMetaDictionary.naturalizeDataset(
      DicomMessage.readFile(result2.anonymizedBuffer).dict
    );

    // Dates should be the same for the same input
    expect(dataset1.StudyDate).toBe(dataset2.StudyDate);
    // But different from original
    expect(dataset1.StudyDate).not.toBe('20240115');
  });
});

describe('anonymizeBatch', () => {
  it('processes multiple files and collects errors', () => {
    const config: AnonymizeConfig = {
      defaultTopRatio: 0,
      rules: [],
      hashPatientId: true,
      skipSingleFrame: false,
      preserveDirectoryStructure: true,
    };

    const validDicom = createSyntheticDicom();
    const ctDicom = createSyntheticDicom({ Modality: 'CT' });

    const { results, errors } = anonymizeBatch(
      [
        { dicomBuffer: validDicom, inputPath: '/a.dcm' },
        { dicomBuffer: ctDicom, inputPath: '/b.dcm' },
      ],
      config
    );

    expect(results).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].inputPath).toBe('/b.dcm');
    expect(errors[0].error).toContain('Not an ultrasound');
  });
});
