import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TypeScriptAnalyzer } from '../analyzer';
import { AutocompleteTester } from '../autocomplete-tester';
import { CompilationAnalyzer } from '../compilation-analyzer';
import { TypeResolutionValidator } from '../type-resolution-validator';

// Mock the dependencies
vi.mock('../autocomplete-tester');
vi.mock('../type-resolution-validator');
vi.mock('../compilation-analyzer');

describe('TypeScriptAnalyzer', () => {
  let analyzer: TypeScriptAnalyzer;
  let mockWorkspaceRoot: string;

  beforeEach(() => {
    mockWorkspaceRoot = '/mock/workspace';
    analyzer = new TypeScriptAnalyzer(mockWorkspaceRoot);

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('analyzeTypeScriptSetup', () => {
    it('should run all analysis components and generate a report', async () => {
      // Mock the component results
      const mockAutocompleteResults = [
        {
          packageName: '@klikkflow/core',
          testFile: 'test.ts',
          position: { line: 1, character: 10 },
          expectedSuggestions: ['WorkflowEngine'],
          actualSuggestions: ['WorkflowEngine', 'NodeRegistry'],
          accuracy: 100,
          responseTime: 50,
          passed: true,
        },
      ];

      const mockTypeResolutionResults = [
        {
          packageName: '@klikkflow/core',
          typeDefinition: 'WorkflowEngine',
          resolutionTime: 25,
          resolved: true,
          sourceFile: 'test.ts',
        },
      ];

      const mockCompilationMetrics = [
        {
          packageName: '@klikkflow/core',
          totalFiles: 10,
          compilationTime: 1000,
          memoryUsage: 50000000,
          errors: [],
          warnings: [],
        },
      ];

      // Setup mocks
      const mockAutocompleteTester = vi.mocked(AutocompleteTester);
      const mockTypeResolutionValidator = vi.mocked(TypeResolutionValidator);
      const mockCompilationAnalyzer = vi.mocked(CompilationAnalyzer);

      mockAutocompleteTester.prototype.runAutocompleteTests = vi
        .fn()
        .mockResolvedValue(mockAutocompleteResults);
      mockTypeResolutionValidator.prototype.validateTypeResolution = vi
        .fn()
        .mockResolvedValue(mockTypeResolutionResults);
      mockCompilationAnalyzer.prototype.analyzeCompilation = vi
        .fn()
        .mockResolvedValue(mockCompilationMetrics);

      // Run analysis
      const report = await analyzer.analyzeTypeScriptSetup();

      // Verify results
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.autocompleteResults).toEqual(mockAutocompleteResults);
      expect(report.typeResolutionResults).toEqual(mockTypeResolutionResults);
      expect(report.compilationMetrics).toEqual(mockCompilationMetrics);
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.recommendations).toBeDefined();
    });

    it('should calculate overall score correctly', async () => {
      // Mock results with mixed success/failure
      const mockAutocompleteResults = [{ passed: true } as any, { passed: false } as any];

      const mockTypeResolutionResults = [{ resolved: true } as any, { resolved: true } as any];

      const mockCompilationMetrics = [{ errors: [] } as any];

      const mockAutocompleteTester = vi.mocked(AutocompleteTester);
      const mockTypeResolutionValidator = vi.mocked(TypeResolutionValidator);
      const mockCompilationAnalyzer = vi.mocked(CompilationAnalyzer);

      mockAutocompleteTester.prototype.runAutocompleteTests = vi
        .fn()
        .mockResolvedValue(mockAutocompleteResults);
      mockTypeResolutionValidator.prototype.validateTypeResolution = vi
        .fn()
        .mockResolvedValue(mockTypeResolutionResults);
      mockCompilationAnalyzer.prototype.analyzeCompilation = vi
        .fn()
        .mockResolvedValue(mockCompilationMetrics);

      const report = await analyzer.analyzeTypeScriptSetup();

      // Score should be: (1/2 * 40) + (2/2 * 30) + (30) = 20 + 30 + 30 = 80
      expect(report.overallScore).toBe(80);
    });

    it('should generate appropriate recommendations', async () => {
      // Mock results with failures
      const mockAutocompleteResults = [{ passed: false } as any];

      const mockTypeResolutionResults = [{ resolved: false } as any];

      const mockCompilationMetrics = [
        { errors: [{ message: 'Type error' }], compilationTime: 6000 } as any,
      ];

      const mockAutocompleteTester = vi.mocked(AutocompleteTester);
      const mockTypeResolutionValidator = vi.mocked(TypeResolutionValidator);
      const mockCompilationAnalyzer = vi.mocked(CompilationAnalyzer);

      mockAutocompleteTester.prototype.runAutocompleteTests = vi
        .fn()
        .mockResolvedValue(mockAutocompleteResults);
      mockTypeResolutionValidator.prototype.validateTypeResolution = vi
        .fn()
        .mockResolvedValue(mockTypeResolutionResults);
      mockCompilationAnalyzer.prototype.analyzeCompilation = vi
        .fn()
        .mockResolvedValue(mockCompilationMetrics);

      const report = await analyzer.analyzeTypeScriptSetup();

      expect(report.recommendations).toContain(
        expect.stringContaining('Improve autocomplete accuracy')
      );
      expect(report.recommendations).toContain(
        expect.stringContaining('Fix type resolution issues')
      );
      expect(report.recommendations).toContain(
        expect.stringContaining('Address compilation errors')
      );
      expect(report.recommendations).toContain(
        expect.stringContaining('Optimize compilation performance')
      );
    });
  });

  describe('getPackageDirectories', () => {
    it('should return all package directories', async () => {
      // Mock filesystem
      const mockExistsSync = vi.spyOn(fs, 'existsSync');
      const mockReaddirSync = vi.spyOn(fs, 'readdirSync');

      mockExistsSync.mockImplementation((path: any) => {
        const pathStr = path.toString();
        return (
          pathStr.includes('packages') ||
          pathStr.includes('backend') ||
          pathStr.includes('frontend') ||
          pathStr.includes('shared') ||
          pathStr.includes('@klikkflow')
        );
      });

      mockReaddirSync.mockReturnValue([
        { name: 'core', isDirectory: () => true },
        { name: 'auth', isDirectory: () => true },
        { name: 'workflow', isDirectory: () => true },
      ] as any);

      const directories = await analyzer.getPackageDirectories();

      expect(directories).toContain(path.join(mockWorkspaceRoot, 'packages', 'backend'));
      expect(directories).toContain(path.join(mockWorkspaceRoot, 'packages', 'frontend'));
      expect(directories).toContain(path.join(mockWorkspaceRoot, 'packages', 'shared'));
      expect(directories.length).toBeGreaterThan(3); // Should include @klikkflow packages too

      mockExistsSync.mockRestore();
      mockReaddirSync.mockRestore();
    });
  });
});
