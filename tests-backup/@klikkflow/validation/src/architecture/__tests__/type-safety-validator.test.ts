import { TypeSafetyValidator } from '../type-safety-validator';

describe('TypeSafetyValidator', () => {
  let validator: TypeSafetyValidator;

  beforeEach(() => {
    validator = new TypeSafetyValidator();
  });

  test('should initialize without errors', async () => {
    await expect(validator.initialize()).resolves.not.toThrow();
  });

  test('should validate type safety', async () => {
    await validator.initialize();
    const result = await validator.validateTypeSafety();

    expect(result).toHaveProperty('crossPackageConsistency');
    expect(result).toHaveProperty('interfaceCompatibility');
    expect(result).toHaveProperty('exportStructure');
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('recommendations');

    // Check cross-package consistency
    expect(result.crossPackageConsistency).toHaveProperty('inconsistencies');
    expect(result.crossPackageConsistency).toHaveProperty('totalTypes');
    expect(result.crossPackageConsistency).toHaveProperty('consistencyScore');
    expect(Array.isArray(result.crossPackageConsistency.inconsistencies)).toBe(true);
    expect(typeof result.crossPackageConsistency.totalTypes).toBe('number');
    expect(typeof result.crossPackageConsistency.consistencyScore).toBe('number');

    // Check interface compatibility
    expect(result.interfaceCompatibility).toHaveProperty('incompatibilities');
    expect(result.interfaceCompatibility).toHaveProperty('totalInterfaces');
    expect(result.interfaceCompatibility).toHaveProperty('compatibilityScore');
    expect(Array.isArray(result.interfaceCompatibility.incompatibilities)).toBe(true);
    expect(typeof result.interfaceCompatibility.totalInterfaces).toBe('number');
    expect(typeof result.interfaceCompatibility.compatibilityScore).toBe('number');

    // Check export structure
    expect(result.exportStructure).toHaveProperty('issues');
    expect(result.exportStructure).toHaveProperty('totalExports');
    expect(result.exportStructure).toHaveProperty('structureScore');
    expect(result.exportStructure).toHaveProperty('optimizationOpportunities');
    expect(Array.isArray(result.exportStructure.issues)).toBe(true);
    expect(typeof result.exportStructure.totalExports).toBe('number');
    expect(typeof result.exportStructure.structureScore).toBe('number');
    expect(Array.isArray(result.exportStructure.optimizationOpportunities)).toBe(true);

    // Check overall score
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);

    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
