import { resolveTopRatio, mergeWithDefaults } from '../config-loader';
import { AnonymizeConfig, DEFAULT_CONFIG } from '../types';

describe('mergeWithDefaults', () => {
  it('returns defaults when empty object given', () => {
    const config = mergeWithDefaults({});
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('overrides specific fields', () => {
    const config = mergeWithDefaults({ defaultTopRatio: 0.2, hashPatientId: false });
    expect(config.defaultTopRatio).toBe(0.2);
    expect(config.hashPatientId).toBe(false);
    expect(config.skipSingleFrame).toBe(false); // default
  });
});

describe('resolveTopRatio', () => {
  const config: AnonymizeConfig = {
    defaultTopRatio: 0,
    rules: [
      { match: { Manufacturer: 'mindray' }, topRatio: 0.1 },
      { match: { Manufacturer: 'ge', ManufacturerModelName: 'logiq' }, topRatio: 0.15 },
    ],
    hashPatientId: true,
    skipSingleFrame: false,
    preserveDirectoryStructure: true,
  };

  it('returns matching rule topRatio for mindray', () => {
    const metadata = { Manufacturer: 'Mindray Bio-Medical Electronics' };
    expect(resolveTopRatio(metadata, config)).toBe(0.1);
  });

  it('returns default when no rule matches', () => {
    const metadata = { Manufacturer: 'Philips' };
    expect(resolveTopRatio(metadata, config)).toBe(0);
  });

  it('matches all conditions in a multi-field rule', () => {
    const metadata = { Manufacturer: 'GE Healthcare', ManufacturerModelName: 'LOGIQ E10' };
    expect(resolveTopRatio(metadata, config)).toBe(0.15);
  });

  it('fails multi-field match if one condition is missing', () => {
    const metadata = { Manufacturer: 'GE Healthcare' };
    // GE matches "ge" substring but ManufacturerModelName is missing, so rule 2 fails.
    // GE doesn't match "mindray", so rule 1 also fails. Returns default.
    expect(resolveTopRatio(metadata, config)).toBe(0);
  });

  it('returns first matching rule (order matters)', () => {
    const twoRuleConfig: AnonymizeConfig = {
      ...config,
      rules: [
        { match: { Manufacturer: 'mindray' }, topRatio: 0.05 },
        { match: { Manufacturer: 'mindray' }, topRatio: 0.2 },
      ],
    };
    const metadata = { Manufacturer: 'Mindray' };
    expect(resolveTopRatio(metadata, twoRuleConfig)).toBe(0.05);
  });

  it('case-insensitive matching', () => {
    const metadata = { Manufacturer: 'MINDRAY' };
    expect(resolveTopRatio(metadata, config)).toBe(0.1);
  });

  it('returns default when metadata field is missing', () => {
    const metadata = {};
    expect(resolveTopRatio(metadata, config)).toBe(0);
  });
});
