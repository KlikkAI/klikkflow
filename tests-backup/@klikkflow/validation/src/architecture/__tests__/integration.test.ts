import { CodeOrganizationChecker } from '../code-organization-checker';
import { DependencyAnalyzer } from '../dependency-analyzer';
import { TypeSafetyValidator } from '../type-safety-validator';

describe('Architecture Validation Integration', () => {
  test('should create instances without errors', () => {
    expect(() => new DependencyAnalyzer()).not.toThrow();
    expect(() => new CodeOrganizationChecker()).not.toThrow();
    expect(() => new TypeSafetyValidator()).not.toThrow();
  });

  test('should have correct exports from index', async () => {
    const { DependencyAnalyzer: ExportedAnalyzer } = await import('../dependency-analyzer');
    const { CodeOrganizationChecker: ExportedChecker } = await import(
      '../code-organization-checker'
    );
    const { TypeSafetyValidator: ExportedValidator } = await import('../type-safety-validator');

    expect(ExportedAnalyzer).toBeDefined();
    expect(ExportedChecker).toBeDefined();
    expect(ExportedValidator).toBeDefined();

    expect(typeof ExportedAnalyzer).toBe('function');
    expect(typeof ExportedChecker).toBe('function');
    expect(typeof ExportedValidator).toBe('function');
  });

  test('should have required methods', () => {
    const analyzer = new DependencyAnalyzer();
    const checker = new CodeOrganizationChecker();
    const validator = new TypeSafetyValidator();

    // Check DependencyAnalyzer methods
    expect(typeof analyzer.initialize).toBe('function');
    expect(typeof analyzer.checkCircularDependencies).toBe('function');
    expect(typeof analyzer.validatePackageBoundaries).toBe('function');
    expect(typeof analyzer.generateDependencyGraph).toBe('function');

    // Check CodeOrganizationChecker methods
    expect(typeof checker.initialize).toBe('function');
    expect(typeof checker.validateCodeOrganization).toBe('function');

    // Check TypeSafetyValidator methods
    expect(typeof validator.initialize).toBe('function');
    expect(typeof validator.validateTypeSafety).toBe('function');
  });
});
