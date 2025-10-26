import { existsSync, readFileSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ValidationReport, ValidationResults } from '../../types/index.js';
import { DocumentationGenerator } from '../DocumentationGenerator.js';

describe('DocumentationGenerator', () => {
  let generator: DocumentationGenerator;
  let testOutputDir: string;
  let testTemplatesDir: string;
  let mockValidationResults: ValidationResults;
  let mockValidationReport: ValidationReport;

  beforeEach(() => {
    testOutputDir = './test-docs-output';
    testTemplatesDir = './test-doc-templates';
    generator = new DocumentationGenerator(testOutputDir, testTemplatesDir);

    mockValidationResults = {
      timestamp: new Date('2024-01-01T10:00:00Z'),
      phase: 'A',
      status: 'success',
      systemValidation: {
        testResults: {
          overallStatus: 'success',
          totalTests: 100,
          passedTests: 95,
          failedTests: 5,
          skippedTests: 0,
          coverage: {
            overall: 85,
            statements: 87,
            branches: 82,
            functions: 90,
            lines: 85,
            packageCoverage: {
              'package-a': 90,
              'package-b': 80,
            },
          },
          packageResults: [],
          duration: 9000,
        },
        apiValidation: {
          totalEndpoints: 20,
          validatedEndpoints: 18,
          failedEndpoints: [],
          responseTimeMetrics: {
            average: 150,
            median: 120,
            p95: 300,
            p99: 500,
            slowestEndpoints: [],
          },
          status: 'success',
        },
        e2eResults: {
          totalWorkflows: 10,
          passedWorkflows: 9,
          failedWorkflows: [],
          crossPackageIntegration: {
            testedIntegrations: 5,
            passedIntegrations: 4,
            failedIntegrations: [],
          },
          status: 'success',
        },
        buildValidation: {
          overallStatus: 'success',
          packageBuilds: [],
          totalBuildTime: 18000,
          parallelEfficiency: 75,
          cacheHitRate: 80,
        },
      },
      performanceAnalysis: {
        buildMetrics: {
          totalBuildTime: 45000,
          packageBuildTimes: {
            'package-a': 20000,
            'package-b': 15000,
            'package-c': 10000,
          },
          parallelEfficiency: 75,
          cacheHitRate: 85,
          improvementPercentage: 35,
          bottlenecks: [
            {
              packageName: 'package-a',
              buildTime: 20000,
              suggestions: ['Enable incremental compilation', 'Optimize dependencies'],
            },
          ],
        },
        bundleMetrics: {
          totalSize: 5242880, // 5MB
          packageSizes: {
            'package-a': 2097152,
            'package-b': 1572864,
            'package-c': 1572864,
          },
          reductionPercentage: 25,
          largestBundles: [
            {
              packageName: 'package-a',
              size: 2097152,
              suggestions: ['Implement code splitting', 'Remove unused dependencies'],
            },
          ],
        },
        memoryProfile: {
          development: {
            heapUsed: 134217728,
            heapTotal: 268435456,
            external: 16777216,
            rss: 402653184,
            peak: 536870912,
          },
          build: {
            heapUsed: 268435456,
            heapTotal: 536870912,
            external: 33554432,
            rss: 805306368,
            peak: 1073741824,
          },
          runtime: {
            heapUsed: 67108864,
            heapTotal: 134217728,
            external: 8388608,
            rss: 201326592,
            peak: 268435456,
          },
          leaks: [
            {
              location: 'package-a/memory-leak.ts',
              severity: 'medium',
              description: 'Event listeners not properly cleaned up',
              suggestion: 'Add cleanup in component unmount',
            },
          ],
          optimizations: [
            {
              area: 'build-cache',
              currentUsage: 104857600,
              potentialSavings: 52428800,
              recommendation: 'Optimize cache storage strategy',
            },
          ],
        },
        devExperienceMetrics: {
          typeScriptPerformance: {
            compilationTime: 8000,
            autocompleteSpeed: 150,
            typeResolutionAccuracy: 95,
            errorCount: 2,
          },
          idePerformance: {
            navigationSpeed: 200,
            intelliSenseResponseTime: 100,
            sourceMapAccuracy: 98,
            memoryUsage: 67108864,
          },
          importPathMetrics: {
            averagePathLength: 45,
            circularDependencies: 1,
            inconsistentPaths: 3,
            optimizationOpportunities: [
              'Use TypeScript path mapping',
              'Standardize import conventions',
            ],
          },
          debuggingMetrics: {
            sourceMapAccuracy: 98,
            stackTraceClarity: 90,
            breakpointReliability: 95,
          },
        },
      },
      architectureValidation: {
        dependencyAnalysis: {
          circularDependencies: [
            {
              packages: ['package-a', 'package-b'],
              severity: 'medium',
              suggestion: 'Extract shared interface',
            },
          ],
          packageBoundaryViolations: [
            {
              fromPackage: 'package-a',
              toPackage: 'package-b',
              violationType: 'unauthorized_access',
              suggestion: 'Use proper API boundaries',
            },
          ],
          dependencyGraph: {
            nodes: [
              {
                id: 'package-a',
                packageName: 'package-a',
                type: 'main',
                size: 1024,
              },
              {
                id: 'package-b',
                packageName: 'package-b',
                type: 'specialized',
                size: 512,
              },
            ],
            edges: [
              {
                from: 'package-a',
                to: 'package-b',
                type: 'dependency',
                weight: 1,
              },
            ],
            metrics: {
              totalNodes: 2,
              totalEdges: 1,
              maxDepth: 2,
              complexity: 1.5,
            },
          },
          healthScore: 85,
        },
        codeOrganization: {
          separationOfConcerns: {
            score: 80,
            violations: [
              {
                packageName: 'package-a',
                violationType: 'mixed_concerns',
                description: 'Business logic mixed with UI components',
                severity: 'medium',
              },
            ],
            suggestions: ['Separate business logic from UI components'],
          },
          codeDuplication: {
            duplicatedLines: 150,
            duplicatedBlocks: 5,
            duplicatedFiles: [
              {
                files: ['package-a/utils.ts', 'package-b/utils.ts'],
                similarity: 85,
                lines: 30,
                suggestion: 'Extract to shared utility package',
              },
            ],
            overallPercentage: 8,
          },
          namingConsistency: {
            consistencyScore: 90,
            violations: [
              {
                file: 'package-a/component.ts',
                violationType: 'inconsistent_naming',
                current: 'myComponent',
                suggested: 'MyComponent',
              },
            ],
            suggestions: ['Use PascalCase for component names'],
          },
          overallScore: 85,
        },
        typeSafety: {
          crossPackageTypeConsistency: 92,
          interfaceCompatibility: {
            compatibleInterfaces: 18,
            incompatibleInterfaces: [
              {
                interface: 'UserInterface',
                packages: ['package-a', 'package-b'],
                issue: 'Property type mismatch',
                severity: 'medium',
              },
            ],
            suggestions: ['Standardize interface definitions'],
          },
          exportStructureValidation: {
            consistentExports: 15,
            inconsistentExports: [
              {
                packageName: 'package-a',
                issue: 'Missing default export',
                suggestion: 'Add default export for main module',
              },
            ],
            suggestions: ['Standardize export patterns'],
          },
          overallScore: 88,
        },
      },
      recommendations: [
        {
          category: 'performance',
          priority: 'high',
          title: 'Optimize Build Performance',
          description: 'Build time can be improved by 15%',
          impact: 'Faster development cycles',
          effort: 'medium',
          steps: ['Enable build caching', 'Optimize dependencies'],
          affectedPackages: ['package-a'],
        },
        {
          category: 'architecture',
          priority: 'critical',
          title: 'Fix Circular Dependencies',
          description: 'One circular dependency found',
          impact: 'Better code organization',
          effort: 'low',
          steps: ['Extract shared interface'],
          affectedPackages: ['package-a', 'package-b'],
        },
      ],
      nextSteps: [
        'Address high priority recommendations',
        'Monitor performance improvements',
        'Update documentation',
      ],
    };

    mockValidationReport = {
      summary: {
        overallStatus: 'success',
        completedValidations: 3,
        totalValidations: 3,
        criticalIssues: 1,
        performanceImprovements: {
          buildTime: 35,
          bundleSize: 25,
        },
        nextSteps: mockValidationResults.nextSteps,
      },
      detailedResults: mockValidationResults,
      performanceDashboard: {
        charts: [],
        metrics: [
          {
            id: 'build-time',
            title: 'Build Time',
            value: 45,
            unit: 's',
            status: 'success',
          },
        ],
        trends: [],
        comparisons: [],
      },
      recommendations: {
        critical: [mockValidationResults.recommendations[1]],
        high: [mockValidationResults.recommendations[0]],
        medium: [],
        low: [],
      },
      documentation: [
        {
          file: 'architecture/package-structure.md',
          type: 'update',
          content: 'Updated package structure documentation',
          reason: 'Architecture validation completed',
        },
      ],
    };
  });

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
    if (existsSync(testTemplatesDir)) {
      rmSync(testTemplatesDir, { recursive: true, force: true });
    }
  });

  describe('generateArchitectureDocumentation', () => {
    it('should generate architecture documentation', async () => {
      const docs = await generator.generateArchitectureDocumentation(mockValidationResults);

      expect(docs.length).toBeGreaterThan(0);

      const packageStructureDoc = docs.find((d) => d.template === 'package-structure');
      expect(packageStructureDoc).toBeDefined();
      expect(packageStructureDoc?.content).toContain('Package Structure');
      expect(packageStructureDoc?.content).toContain('Total Packages: 2');
      expect(packageStructureDoc?.content).toContain('Health Score: 85/100');
      expect(packageStructureDoc?.content).toContain('package-a (main)');
      expect(packageStructureDoc?.content).toContain('package-b (specialized)');
    });

    it('should create architecture documentation files', async () => {
      await generator.generateArchitectureDocumentation(mockValidationResults);

      const packageStructurePath = `${testOutputDir}/architecture/package-structure.md`;
      expect(existsSync(packageStructurePath)).toBe(true);

      const content = readFileSync(packageStructurePath, 'utf-8');
      expect(content).toContain('# Package Structure');
      expect(content).toContain('SUCCESS');
    });

    it('should handle missing architecture data gracefully', async () => {
      const resultsWithoutArch = {
        ...mockValidationResults,
        architectureValidation: undefined as any,
      };

      const docs = await generator.generateArchitectureDocumentation(resultsWithoutArch);

      expect(docs.length).toBeGreaterThan(0);

      const packageStructureDoc = docs.find((d) => d.template === 'package-structure');
      expect(packageStructureDoc?.content).toContain('Total Packages: 0');
      expect(packageStructureDoc?.content).toContain('Health Score: 0/100');
    });
  });

  describe('generateSetupGuides', () => {
    it('should generate setup guides', async () => {
      const docs = await generator.generateSetupGuides(mockValidationResults);

      expect(docs.length).toBeGreaterThan(0);

      const setupGuideDoc = docs.find((d) => d.template === 'development-setup');
      expect(setupGuideDoc).toBeDefined();
      expect(setupGuideDoc?.content).toContain('Development Setup Guide');
      expect(setupGuideDoc?.content).toContain('Prerequisites');
      expect(setupGuideDoc?.content).toContain('Setup Steps');
      expect(setupGuideDoc?.content).toContain('Build Time: ~45 seconds');
      expect(setupGuideDoc?.content).toContain('Cache Hit Rate: 85%');
    });

    it('should create setup guide files', async () => {
      await generator.generateSetupGuides(mockValidationResults);

      const setupGuidePath = `${testOutputDir}/setup/development-setup.md`;
      expect(existsSync(setupGuidePath)).toBe(true);

      const content = readFileSync(setupGuidePath, 'utf-8');
      expect(content).toContain('# Development Setup Guide');
      expect(content).toContain('Node.js 18+');
      expect(content).toContain('pnpm install');
    });

    it('should include troubleshooting information', async () => {
      const resultsWithIssues = {
        ...mockValidationResults,
        performanceAnalysis: {
          ...mockValidationResults.performanceAnalysis,
          buildMetrics: {
            ...mockValidationResults.performanceAnalysis.buildMetrics,
            totalBuildTime: 120000, // 2 minutes - slow
            cacheHitRate: 60, // Low cache hit rate
          },
        },
        systemValidation: {
          ...mockValidationResults.systemValidation,
          testResults: {
            ...mockValidationResults.systemValidation.testResults,
            failedTests: 10,
            coverage: {
              ...mockValidationResults.systemValidation.testResults.coverage,
              overall: 65, // Low coverage
            },
          },
        },
      };

      const docs = await generator.generateSetupGuides(resultsWithIssues);

      const troubleshootingDoc = docs.find((d) => d.template === 'troubleshooting-guide');
      expect(troubleshootingDoc).toBeDefined();
      expect(troubleshootingDoc?.content).toContain('Slow Build Times');
      expect(troubleshootingDoc?.content).toContain('Low Cache Hit Rate');
      expect(troubleshootingDoc?.content).toContain('Failing Tests');
      expect(troubleshootingDoc?.content).toContain('Low Test Coverage');
    });
  });

  describe('generateBestPracticesDocumentation', () => {
    it('should generate best practices documentation', async () => {
      const docs = await generator.generateBestPracticesDocumentation(mockValidationResults);

      expect(docs.length).toBeGreaterThan(0);

      const bestPracticesDoc = docs.find((d) => d.template === 'development-best-practices');
      expect(bestPracticesDoc).toBeDefined();
      expect(bestPracticesDoc?.content).toContain('Development Best Practices');
      expect(bestPracticesDoc?.content).toContain('Code Organization');
      expect(bestPracticesDoc?.content).toContain('Code Duplication: 8%');
      expect(bestPracticesDoc?.content).toContain('Import Path Optimizations');
    });

    it('should include code examples', async () => {
      const docs = await generator.generateBestPracticesDocumentation(mockValidationResults);

      const bestPracticesDoc = docs.find((d) => d.template === 'development-best-practices');
      expect(bestPracticesDoc?.content).toContain('```typescript');
      expect(bestPracticesDoc?.content).toContain('Consistent Import Paths');
      expect(bestPracticesDoc?.content).toContain('@/services/UserService');
    });

    it('should generate performance best practices', async () => {
      const docs = await generator.generateBestPracticesDocumentation(mockValidationResults);

      const perfBestPracticesDoc = docs.find((d) => d.template === 'performance-best-practices');
      expect(perfBestPracticesDoc).toBeDefined();
    });

    it('should generate testing best practices', async () => {
      const docs = await generator.generateBestPracticesDocumentation(mockValidationResults);

      const testingBestPracticesDoc = docs.find((d) => d.template === 'testing-best-practices');
      expect(testingBestPracticesDoc).toBeDefined();
    });
  });

  describe('generateComprehensiveDocumentation', () => {
    it('should generate all documentation types', async () => {
      const docs = await generator.generateComprehensiveDocumentation(mockValidationReport);

      expect(docs.length).toBeGreaterThan(5); // Should have multiple docs

      // Check for different types of documentation
      const templateNames = docs.map((d) => d.template);
      expect(templateNames).toContain('package-structure');
      expect(templateNames).toContain('development-setup');
      expect(templateNames).toContain('development-best-practices');
      expect(templateNames).toContain('validation-report');
    });

    it('should update existing documentation', async () => {
      await generator.generateComprehensiveDocumentation(mockValidationReport);

      // Check that the update from the report was applied
      const updatePath = `${testOutputDir}/architecture/package-structure.md`;
      expect(existsSync(updatePath)).toBe(true);
    });

    it('should generate validation report documentation', async () => {
      const docs = await generator.generateComprehensiveDocumentation(mockValidationReport);

      const reportDoc = docs.find((d) => d.template === 'validation-report');
      expect(reportDoc).toBeDefined();
      expect(reportDoc?.content).toContain('Phase A Validation Report');
      expect(reportDoc?.content).toContain('Overall Status: SUCCESS');
      expect(reportDoc?.content).toContain('Build Time: 35.0% improvement');
      expect(reportDoc?.content).toContain('Bundle Size: 25.0% reduction');
      expect(reportDoc?.content).toContain('Critical Priority (1)');
      expect(reportDoc?.content).toContain('High Priority (1)');
    });
  });

  describe('createTemplate', () => {
    it('should create custom documentation template', async () => {
      const customTemplate = {
        name: 'custom-template',
        description: 'Custom test template',
        filePath: 'custom/test.md',
        template: '# Custom Template\n\nValue: {{testValue}}',
        variables: ['testValue'],
        category: 'setup' as const,
      };

      await generator.createTemplate(customTemplate);

      expect(generator.getAvailableTemplates()).toContain('custom-template');
      expect(generator.getTemplate('custom-template')).toEqual(customTemplate);
    });

    it('should save template to file', async () => {
      const customTemplate = {
        name: 'file-template',
        description: 'Template saved to file',
        filePath: 'test/file.md',
        template: '# File Template\n\nContent: {{content}}',
        variables: ['content'],
        category: 'setup' as const,
      };

      await generator.createTemplate(customTemplate);

      const templatePath = `${testTemplatesDir}/file-template.md`;
      expect(existsSync(templatePath)).toBe(true);

      const content = readFileSync(templatePath, 'utf-8');
      expect(content).toBe(customTemplate.template);
    });
  });

  describe('updateDocumentation', () => {
    it('should create new documentation files', async () => {
      const updates = [
        {
          file: 'new-doc.md',
          type: 'create' as const,
          content: '# New Documentation\n\nThis is new content.',
          reason: 'Test creation',
        },
      ];

      await generator.updateDocumentation(updates);

      const newDocPath = `${testOutputDir}/new-doc.md`;
      expect(existsSync(newDocPath)).toBe(true);

      const content = readFileSync(newDocPath, 'utf-8');
      expect(content).toContain('# New Documentation');
      expect(content).toContain('This is new content.');
    });

    it('should update existing documentation files', async () => {
      // First create a file
      const createUpdate = {
        file: 'existing-doc.md',
        type: 'create' as const,
        content: '# Original Content',
        reason: 'Initial creation',
      };

      await generator.updateDocumentation([createUpdate]);

      // Then update it
      const updateUpdate = {
        file: 'existing-doc.md',
        type: 'update' as const,
        content: '# Updated Content\n\nThis content was updated.',
        reason: 'Content update',
      };

      await generator.updateDocumentation([updateUpdate]);

      const docPath = `${testOutputDir}/existing-doc.md`;
      const content = readFileSync(docPath, 'utf-8');
      expect(content).toContain('# Updated Content');
      expect(content).toContain('This content was updated.');
    });

    it('should delete documentation files', async () => {
      // First create a file
      const createUpdate = {
        file: 'to-delete.md',
        type: 'create' as const,
        content: '# To Be Deleted',
        reason: 'Test deletion',
      };

      await generator.updateDocumentation([createUpdate]);

      const docPath = `${testOutputDir}/to-delete.md`;
      expect(existsSync(docPath)).toBe(true);

      // Then delete it
      const deleteUpdate = {
        file: 'to-delete.md',
        type: 'delete' as const,
        reason: 'Test deletion',
      };

      await generator.updateDocumentation([deleteUpdate]);

      expect(existsSync(docPath)).toBe(false);
    });
  });

  describe('template management', () => {
    it('should list available templates', () => {
      const templates = generator.getAvailableTemplates();

      expect(templates).toContain('package-structure');
      expect(templates).toContain('development-setup');
      expect(templates).toContain('troubleshooting-guide');
      expect(templates).toContain('development-best-practices');
    });

    it('should get template by name', () => {
      const template = generator.getTemplate('package-structure');

      expect(template).toBeDefined();
      expect(template?.name).toBe('package-structure');
      expect(template?.category).toBe('architecture');
      expect(template?.variables).toContain('timestamp');
      expect(template?.variables).toContain('totalPackages');
    });

    it('should return undefined for non-existent template', () => {
      const template = generator.getTemplate('non-existent');

      expect(template).toBeUndefined();
    });
  });

  describe('directory management', () => {
    it('should set and get output directory', () => {
      const newOutputDir = './new-output-dir';

      generator.setOutputDirectory(newOutputDir);

      expect(generator.getOutputDirectory()).toBe(newOutputDir);
    });

    it('should create output directory if it does not exist', () => {
      const newOutputDir = './created-output-dir';

      generator.setOutputDirectory(newOutputDir);

      expect(existsSync(newOutputDir)).toBe(true);

      // Clean up
      rmSync(newOutputDir, { recursive: true, force: true });
    });
  });

  describe('error handling', () => {
    it('should handle template not found error', async () => {
      await expect(
        generator.generateArchitectureDocumentation({
          ...mockValidationResults,
          architectureValidation: undefined as any,
        })
      ).resolves.toBeDefined(); // Should not throw, but handle gracefully
    });

    it('should handle invalid template variables', async () => {
      const customTemplate = {
        name: 'invalid-template',
        description: 'Template with invalid variables',
        filePath: 'invalid/test.md',
        template: '# Invalid Template\n\nValue: {{nonExistentValue}}',
        variables: ['nonExistentValue'],
        category: 'setup' as const,
      };

      await generator.createTemplate(customTemplate);

      // Should handle missing variables gracefully
      const docs = await generator.generateArchitectureDocumentation(mockValidationResults);
      expect(docs).toBeDefined();
    });
  });
});
