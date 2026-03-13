import * as fs from 'fs';
import { AnonymizeConfig, TopRatioRule, DEFAULT_CONFIG } from './types';

/**
 * Load an AnonymizeConfig from a JSON file path.
 * Missing fields are filled with defaults.
 */
export function loadConfig(filePath: string): AnonymizeConfig {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return mergeWithDefaults(parsed);
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
  metadata: Record<string, unknown>,
  config: AnonymizeConfig
): number {
  for (const rule of config.rules) {
    if (ruleMatches(rule, metadata)) {
      return rule.topRatio;
    }
  }
  return config.defaultTopRatio;
}

function ruleMatches(rule: TopRatioRule, metadata: Record<string, unknown>): boolean {
  for (const [tagKey, pattern] of Object.entries(rule.match)) {
    const tagValue = metadata[tagKey];
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
