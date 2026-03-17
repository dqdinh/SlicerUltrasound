#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { anonymizeDicom } from '../src/anonymizer';
import { loadConfig, mergeWithDefaults } from '../src/config-loader';
import { keysRecordsToCsv } from '../src/header-exporter';
import { AnonymizeConfig, AnonymizeInput, AnonymizeResult, KeysRecord, DICOM_EXTENSIONS, SkippedError } from '../src/types';

const program = new Command();

/**
 * Validate that a resolved path stays within the expected base directory.
 * Prevents path traversal attacks via symlinks or ".." components.
 */
function assertPathWithin(filePath: string, baseDir: string): void {
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir) + path.sep;
  if (!resolved.startsWith(resolvedBase) && resolved !== path.resolve(baseDir)) {
    throw new Error(`Path traversal detected: ${filePath} escapes ${baseDir}`);
  }
}

program
  .name('anonymize-ultrasound')
  .description('Anonymize ultrasound DICOM files')
  .requiredOption('--input-dir <path>', 'Directory containing DICOM files to anonymize')
  .requiredOption('--output-dir <path>', 'Directory to save anonymized DICOM files')
  .requiredOption('--headers-dir <path>', 'Directory to save DICOM headers and keys.csv')
  .option('--config <path>', 'Path to JSON config file')
  .option('--no-preserve-directory-structure', 'Save all files to root of output directory')
  .option('--skip-single-frame', 'Skip single-frame DICOM files')
  .option('--no-hash-patient-id', 'Do not hash patient IDs')
  .option('--overwrite', 'Overwrite existing output files')
  .action(async (opts) => {
    const startTime = Date.now();

    // Load config
    let config: AnonymizeConfig;
    if (opts.config) {
      config = loadConfig(opts.config);
    } else {
      config = mergeWithDefaults({});
    }

    // Apply CLI overrides
    if (opts.preserveDirectoryStructure === false) {
      config.preserveDirectoryStructure = false;
    }
    if (opts.skipSingleFrame) {
      config.skipSingleFrame = true;
    }
    if (opts.hashPatientId === false) {
      config.hashPatientId = false;
    }

    // Scan for DICOM files
    const inputDir = path.resolve(opts.inputDir);
    const outputDir = path.resolve(opts.outputDir);
    const headersDir = path.resolve(opts.headersDir);

    const dicomFiles = scanDirectory(inputDir);
    console.log(`Found ${dicomFiles.length} DICOM files`);

    if (dicomFiles.length === 0) {
      console.log('No DICOM files found. Exiting.');
      return;
    }

    // Ensure output directories exist
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(headersDir, { recursive: true });

    // Process files
    let success = 0;
    let failed = 0;
    let skipped = 0;
    const keysRecords: KeysRecord[] = [];

    for (const filePath of dicomFiles) {
      const relativePath = path.relative(inputDir, filePath);
      console.log(`Processing: ${relativePath}`);

      try {
        const buffer = fs.readFileSync(filePath);
        const arrayBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        );

        const input: AnonymizeInput = {
          dicomBuffer: arrayBuffer,
          inputPath: filePath,
        };

        const result = anonymizeDicom(input, config);

        // Determine output path
        let outputPath: string;
        if (config.preserveDirectoryStructure) {
          const relDir = path.dirname(relativePath);
          outputPath = path.join(outputDir, relDir, result.anonFilename);
        } else {
          outputPath = path.join(outputDir, result.anonFilename);
        }
        assertPathWithin(outputPath, outputDir);

        // Check if file exists and skip if not overwriting
        if (fs.existsSync(outputPath) && !opts.overwrite) {
          console.log(`  Skipping (exists): ${outputPath}`);
          skipped++;
          continue;
        }

        // Write anonymized DICOM
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, Buffer.from(result.anonymizedBuffer));

        // Write header JSON
        const headerFilename = result.anonFilename.replace('.dcm', '_DICOMHeader.json');
        let headerPath: string;
        if (config.preserveDirectoryStructure) {
          const relDir = path.dirname(relativePath);
          headerPath = path.join(headersDir, relDir, headerFilename);
        } else {
          headerPath = path.join(headersDir, headerFilename);
        }
        assertPathWithin(headerPath, headersDir);
        fs.mkdirSync(path.dirname(headerPath), { recursive: true });
        fs.writeFileSync(headerPath, JSON.stringify(result.headerJson, null, 2));

        // Update output path in metadata for keys.csv
        result.metadata.OutputPath = config.preserveDirectoryStructure
          ? path.join(path.dirname(relativePath), result.anonFilename)
          : result.anonFilename;

        keysRecords.push(result.metadata);
        success++;
        console.log(`  -> ${result.anonFilename}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof SkippedError) {
          skipped++;
          console.log(`  Skipped: ${message}`);
        } else {
          failed++;
          console.error(`  Error: ${message}`);
        }
      }
    }

    // Write keys.csv
    if (keysRecords.length > 0) {
      const csvContent = keysRecordsToCsv(keysRecords);
      fs.writeFileSync(path.join(headersDir, 'keys.csv'), csvContent);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nComplete! Success: ${success}, Failed: ${failed}, Skipped: ${skipped}, Time: ${elapsed}s`);
  });

/**
 * Recursively scan a directory for DICOM files.
 */
function scanDirectory(dir: string): string[] {
  const results: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  // Sort for consistent processing order
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (DICOM_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

program.parse();
