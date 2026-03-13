# anonymize-ultrasound

TypeScript library for DICOM ultrasound de-identification. Provides metadata anonymization and pixel redaction (top-ratio masking) for ultrasound DICOM files. Designed to work with in-memory `ArrayBuffer`s for integration into web-based DICOM viewers like OHIF.

## Installation

```bash
npm install
```

## Library API

### `anonymizeDicom(input, config?)`

Anonymize a single DICOM file. This is the main entry point.

```typescript
import { anonymizeDicom, AnonymizeInput } from 'anonymize-ultrasound';

const input: AnonymizeInput = {
  dicomBuffer: arrayBuffer,  // Raw DICOM file bytes
  inputPath: '/path/to/original.dcm',  // Optional, for keys.csv tracking
};

const result = anonymizeDicom(input);
// result.anonymizedBuffer   - Anonymized DICOM bytes (ArrayBuffer)
// result.anonFilename       - Hashed filename, e.g. "1234567890_12345678.dcm"
// result.headerJson         - Anonymized DICOM header as JSON
// result.metadata           - Row data for keys.csv
```

### `anonymizeBatch(inputs, config?)`

Anonymize multiple DICOM files. Errors are collected rather than thrown.

```typescript
import { anonymizeBatch } from 'anonymize-ultrasound';

const { results, errors } = anonymizeBatch(inputs, config);
// results: AnonymizeResult[]
// errors: Array<{ inputPath: string; error: string }>
```

### Configuration

Both functions accept an optional `AnonymizeConfig` object:

```typescript
import { AnonymizeConfig } from 'anonymize-ultrasound';

const config: AnonymizeConfig = {
  defaultTopRatio: 0,              // Fallback pixel masking ratio (0 = none)
  hashPatientId: true,             // Hash PatientID via SHA-256
  skipSingleFrame: false,          // Skip single-frame DICOM files
  preserveDirectoryStructure: true,
  rules: [
    {
      match: { Manufacturer: 'mindray' },  // Case-insensitive substring
      topRatio: 0.1,                       // Mask top 10% of pixels
    },
  ],
};
```

Rules are evaluated in order; the first match wins. Each key in `match` is checked as a case-insensitive substring against the corresponding DICOM tag value.

## De-identification Details

The following transformations are applied to DICOM metadata:

| Field | Action |
|---|---|
| PatientName | Replaced with hashed filename |
| PatientID | SHA-256 hashed to 10 digits |
| PatientBirthDate | Truncated to year + "0101" |
| ReferringPhysicianName | Cleared |
| AccessionNumber | Cleared |
| StudyDate, SeriesDate, ContentDate | Shifted by 0-30 days (deterministic, seeded by PatientID) |
| SeriesInstanceUID | Regenerated |
| SOPInstanceUID, StudyInstanceUID | Preserved from source |

Pixel redaction zeros out the top N% of image rows based on the resolved `topRatio`.

## CLI

```bash
npx ts-node cli/cli.ts \
  --input-dir ./dicoms \
  --output-dir ./output \
  --headers-dir ./headers \
  --config ./anonymize-config.json
```

### Options

| Flag | Description |
|---|---|
| `--input-dir <path>` | **(required)** Directory containing DICOM files |
| `--output-dir <path>` | **(required)** Directory for anonymized DICOM output |
| `--headers-dir <path>` | **(required)** Directory for headers and keys.csv |
| `--config <path>` | Path to JSON config file |
| `--skip-single-frame` | Skip single-frame DICOM files |
| `--no-preserve-directory-structure` | Flatten output into a single directory |
| `--no-hash-patient-id` | Keep original PatientID (do not hash) |
| `--overwrite` | Overwrite existing output files |

### Output

- Anonymized `.dcm` files with hashed filenames (`{patientHash}_{instanceHash}.dcm`)
- `*_DICOMHeader.json` files with anonymized header data
- `keys.csv` mapping original paths to anonymized filenames and UIDs

## Config File

See `anonymize-config.json` for the default configuration:

```json
{
  "defaultTopRatio": 0,
  "hashPatientId": true,
  "skipSingleFrame": false,
  "preserveDirectoryStructure": true,
  "rules": [
    {
      "match": { "Manufacturer": "mindray" },
      "topRatio": 0.1
    }
  ]
}
```

## Project Structure

```
anonymize-ts/
├── package.json
├── tsconfig.json
├── jest.config.ts
├── anonymize-config.json          # Default manufacturer config
├── cli/
│   └── cli.ts                     # CLI entry point
└── src/
    ├── index.ts                   # Public API exports
    ├── types.ts                   # Interfaces and constants
    ├── anonymizer.ts              # Main orchestrator
    ├── config-loader.ts           # Config loading and rule matching
    ├── dicom-reader.ts            # DICOM parsing via dcmjs
    ├── dicom-writer.ts            # Anonymized DICOM serialization
    ├── deidentifier.ts            # Metadata de-identification
    ├── pixel-redactor.ts          # Top-ratio pixel masking
    ├── filename-generator.ts      # SHA-256 hashed filename generation
    ├── header-exporter.ts         # JSON header and keys.csv export
    └── __tests__/                 # Unit tests
```

## Development

```bash
npm test          # Run tests
npm run build     # Compile TypeScript
npm run cli -- --input-dir ./dicoms --output-dir ./out --headers-dir ./headers
```
