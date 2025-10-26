import { DependencyAnalyzer } from '../dependency-analyzer';

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
  });

  test('should initialize without errors', async () => {
    await expect(analyzer.initialize()).resolves.not.toThrow();
  });

  test('should check circular dependencies', async () => {
    await analyzer.initialize();
    const result = await analyzer.checkCircularDependencies();

    expect(result).toHaveProperty('hasCircularDependencies');
    expect(result).toHaveProperty('circularDependencies');
    expect(result).toHaveProperty('totalPackages');
    expect(result).toHaveProperty('affectedPackages');
    expect(result).toHaveProperty('severity');
    expect(result).toHaveProperty('recommendations');

    expect(Array.isArray(result.circularDependencies)).toBe(true);
    expect(Array.isArray(result.affectedPackages)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(typeof result.hasCircularDependencies).toBe('boolean');
    expect(typeof result.totalPackages).toBe('number');
    expect(['low', 'medium', 'high', 'critical']).toContain(result.severity);
  });

  test('should validate package boundaries', async () => {
    await analyzer.initialize();
    const result = await analyzer.validatePackageBoundaries();

    expect(result).toHaveProperty('violations');
    expect(result).toHaveProperty('totalChecks');
    expect(result).toHaveProperty('violationCount');
    expect(result).toHaveProperty('complianceScore');
    expect(result).toHaveProperty('recommendations');

    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(typeof result.totalChecks).toBe('number');
    expect(typeof result.violationCount).toBe('number');
    expect(typeof result.complianceScore).toBe('number');
    expect(result.complianceScore).toBeGreaterThanOrEqual(0);
    expect(result.complianceScore).toBeLessThanOrEqual(100);
  });

  test('should generate dependency graph', async () => {
    await analyzer.initialize();
    const result = await analyzer.generateDependencyGraph();

    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('visualization');

    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
    expect(typeof result.metrics).toBe('object');
    expect(typeof result.visualization).toBe('string');

    // Check metrics structure
    expect(result.metrics).toHaveProperty('totalNodes');
    expect(result.metrics).toHaveProperty('totalEdges');
    expect(result.metrics).toHaveProperty('averageDependencies');
    expect(result.metrics).toHaveProperty('maxDependencies');
    expect(result.metrics).toHaveProperty('cyclomaticComplexity');
    expect(result.metrics).toHaveProperty('instability');
    expect(result.metrics).toHaveProperty('abstractness');
  });
});
