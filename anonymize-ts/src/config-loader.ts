import * as fs from 'fs';
import { AnonymizeConfig, TopRatioRule, DEFAULT_CONFIG, DicomMetadata } from './types';

/**
 * Load an AnonymizeConfig from a JSON file path.
 * Missing fields are filled with defaults.
 */
export function loadConfig(filePath: string): AnonymizeConfig {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const config = mergeWithDefaults(parsed);
  validateConfig(config);
  return config;
}

/**
 * Merge a partial config object with default values.
 */
export function mergeWithDefaults(partial: Partial<AnonymizeConfig>): AnonymizeConfig {
  return {
    defaultTopRatio: partial.defaultTopRatio ?? DEFAULT_CONFIG.defaultTopRatio,
    rules: partial.rules ?? DEFAULT_CONFIG.rules,
    hashPatientId: partial.hashPatientId ?? DEFAULT_CONFIG.hashPatientId,
    skipSingleFrame: partial.skipSingleFrame ?? DEFAULT_CONFIG.skipSingleFrame,
    preserveDirectoryStructure:
      partial.preserveDirectoryStructure ?? DEFAULT_CONFIG.preserveDirectoryStructure,
  };
}

/**
 * Resolve the top_ratio for a DICOM dataset by matching rules against its metadata.
 *
 * Each rule's `match` is a Record<string, string> where keys are DICOM tag keywords
 * and values are case-insensitive substring patterns.
 * The first rule where ALL match conditions are satisfied wins.
 * If no rule matches, the `defaultTopRatio` is returned.
 */
export function resolveTopRatio(
  metadata: DicomMetadata | Record<string, unknown>,
  config: AnonymizeConfig
): number {
  for (const rule of config.rules) {
    if (ruleMatches(rule, metadata)) {
      return rule.topRatio;
    }
  }
  return config.defaultTopRatio;
}

/**
 * Validate an AnonymizeConfig for type correctness and value ranges.
 */
export function validateConfig(config: AnonymizeConfig): void {
  if (typeof config.defaultTopRatio !== 'number' || !Number.isFinite(config.defaultTopRatio)) {
    throw new Error(`Invalid defaultTopRatio: ${config.defaultTopRatio} (must be a finite number)`);
  }
  if (config.defaultTopRatio < 0 || config.defaultTopRatio > 1) {
    throw new Error(`defaultTopRatio out of range: ${config.defaultTopRatio} (must be 0-1)`);
  }
  if (!Array.isArray(config.rules)) {
    throw new Error('rules must be an array');
  }
  for (let i = 0; i < config.rules.length; i++) {
    const rule = config.rules[i];
    if (typeof rule.topRatio !== 'number' || !Number.isFinite(rule.topRatio)) {
      throw new Error(`Invalid topRatio in rule[${i}]: ${rule.topRatio}`);
    }
    if (rule.topRatio < 0 || rule.topRatio > 1) {
      throw new Error(`topRatio out of range in rule[${i}]: ${rule.topRatio} (must be 0-1)`);
    }
    if (typeof rule.match !== 'object' || rule.match === null || Array.isArray(rule.match)) {
      throw new Error(`Invalid match in rule[${i}]: must be an object`);
    }
  }
}

function ruleMatches(rule: TopRatioRule, metadata: DicomMetadata | Record<string, unknown>): boolean {
  for (const [tagKey, pattern] of Object.entries(rule.match)) {
    const tagValue = (metadata as Record<string, unknown>)[tagKey];
    if (tagValue === undefined || tagValue === null) {
      return false;
    }
    const valueStr = String(tagValue).toLowerCase();
    const patternStr = pattern.toLowerCase();
    if (!valueStr.includes(patternStr)) {
      return false;
    }
  }
  return true;
}
