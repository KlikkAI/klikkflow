import { CodeOrganizationChecker } from '../code-organization-checker';

describe('CodeOrganizationChecker', () => {
  let checker: CodeOrganizationChecker;

  beforeEach(() => {
    checker = new CodeOrganizationChecker();
  });

  test('should initialize without errors', async () => {
    await expect(checker.initialize()).resolves.not.toThrow();
  });

  test('should validate code organization', async () => {
    await checker.initialize();
    const result = await checker.validateCodeOrganization();

    expect(result).toHaveProperty('separationOfConcerns');
    expect(result).toHaveProperty('codeDuplication');
    expect(result).toHaveProperty('namingConventions');
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('recommendations');

    // Check separation of concerns
    expect(result.separationOfConcerns).toHaveProperty('score');
    expect(result.separationOfConcerns).toHaveProperty('violations');
    expect(result.separationOfConcerns).toHaveProperty('packageScores');
    expect(Array.isArray(result.separationOfConcerns.violations)).toBe(true);
    expect(typeof result.separationOfConcerns.packageScores).toBe('object');

    // Check code duplication
    expect(result.codeDuplication).toHaveProperty('duplicatedBlocks');
    expect(result.codeDuplication).toHaveProperty('totalDuplication');
    expect(result.codeDuplication).toHaveProperty('duplicationPercentage');
    expect(result.codeDuplication).toHaveProperty('affectedFiles');
    expect(result.codeDuplication).toHaveProperty('recommendations');
    expect(Array.isArray(result.codeDuplication.duplicatedBlocks)).toBe(true);
    expect(Array.isArray(result.codeDuplication.affectedFiles)).toBe(true);
    expect(Array.isArray(result.codeDuplication.recommendations)).toBe(true);

    // Check naming conventions
    expect(result.namingConventions).toHaveProperty('violations');
    expect(result.namingConventions).toHaveProperty('complianceScore');
    expect(result.namingConventions).toHaveProperty('conventionsCovered');
    expect(result.namingConventions).toHaveProperty('recommendations');
    expect(Array.isArray(result.namingConventions.violations)).toBe(true);
    expect(Array.isArray(result.namingConventions.conventionsCovered)).toBe(true);
    expect(Array.isArray(result.namingConventions.recommendations)).toBe(true);

    // Check overall score
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);

    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
