import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BuildComparison,
  type BuildMetrics,
  BuildTimeAnalyzer,
} from '../build-time-analyzer.js';

// Mock Node.js modules
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('BuildTimeAnalyzer', () => {
  let analyzer: BuildTimeAnalyzer;
  const mockMetrics: BuildMetrics = {
    timestamp: new Date('2024-01-01T00:00:00Z'),
    totalBuildTime: 60000, // 60 seconds
    packageBuildTimes: {
      '@klikkflow/core': 15000,
      '@klikkflow/workflow': 12000,
      backend: 20000,
      frontend: 13000,
    },
    cacheHitRate: 0.75,
    parallelEfficiency: 0.65,
    bottlenecks: [
      {
        packageName: 'backend',
        buildTime: 20000,
        percentage: 33.3,
        suggestions: ['Optimize TypeScript compilation', 'Review dependency bundling'],
      },
    ],
  };

  beforeEach(() => {
    analyzer = new BuildTimeAnalyzer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('measureBuildTimes', () => {
    it('should measure build times for all packages', async () => {
      // Mock successful build processes
      const { spawn } = await import('node:child_process');
      vi.mocked(spawn).mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 100); // Simulate successful build
            }
          }),
          stderr: { on: vi.fn() },
        };
        return mockProcess as any;
      });

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const metrics = await analyzer.measureBuildTimes();

      expect(metrics).toBeDefined();
      expect(metrics.totalBuildTime).toBeGreaterThan(0);
      expect(metrics.packageBuildTimes).toBeDefined();
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.parallelEfficiency).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(metrics.bottlenecks)).toBe(true);
    });

    it('should handle build failures gracefully', async () => {
      const { spawn } = await import('node:child_process');
      vi.mocked(spawn).mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 100); // Simulate failed build
            } else if (event === 'error') {
              // Don't trigger error callback for this test
            }
          }),
          stderr: {
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback(Buffer.from('Build failed'));
              }
            }),
          },
        };
        return mockProcess as any;
      });

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const metrics = await analyzer.measureBuildTimes();

      // Should still return metrics even with some failed builds
      expect(metrics).toBeDefined();
      expect(metrics.packageBuildTimes).toBeDefined();

      // Failed builds should be marked with -1
      const failedBuilds = Object.values(metrics.packageBuildTimes).filter((time) => time === -1);
      expect(failedBuilds.length).toBeGreaterThan(0);
    });
  });

  describe('compareWithBaseline', () => {
    it('should compare metrics with existing baseline', async () => {
      const baselineMetrics: BuildMetrics = {
        ...mockMetrics,
        totalBuildTime: 90000, // 90 seconds (slower baseline)
        packageBuildTimes: {
          '@klikkflow/core': 20000,
          '@klikkflow/workflow': 18000,
          backend: 30000,
          frontend: 22000,
        },
      };

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(baselineMetrics));

      const comparison = await analyzer.compareWithBaseline(mockMetrics);

      expect(comparison).toBeDefined();
      expect(comparison?.improvement.totalTimeImprovement).toBe(30000); // 30s improvement
      expect(comparison?.improvement.percentageImprovement).toBeCloseTo(33.33, 1);
      expect(comparison?.achievements.length).toBeGreaterThan(0);
    });

    it('should create baseline when none exists', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const comparison = await analyzer.compareWithBaseline(mockMetrics);

      expect(comparison).toBeNull();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('baseline-metrics.json'),
        JSON.stringify(mockMetrics, null, 2)
      );
    });

    it('should identify regressions correctly', async () => {
      const baselineMetrics: BuildMetrics = {
        ...mockMetrics,
        totalBuildTime: 45000, // 45 seconds (faster baseline)
        packageBuildTimes: {
          '@klikkflow/core': 10000,
          '@klikkflow/workflow': 8000,
          backend: 15000,
          frontend: 12000,
        },
      };

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(baselineMetrics));

      const comparison = await analyzer.compareWithBaseline(mockMetrics);

      expect(comparison).toBeDefined();
      expect(comparison?.improvement.percentageImprovement).toBeLessThan(0); // Regression
      expect(comparison?.regressions.length).toBeGreaterThan(0);
    });
  });

  describe('generateOptimizationRecommendations', () => {
    it('should generate cache optimization recommendations for low hit rate', () => {
      const lowCacheMetrics: BuildMetrics = {
        ...mockMetrics,
        cacheHitRate: 0.4, // Low cache hit rate
      };

      const recommendations = analyzer.generateOptimizationRecommendations(lowCacheMetrics);

      const cacheRec = recommendations.find((r) => r.type === 'cache');
      expect(cacheRec).toBeDefined();
      expect(cacheRec?.priority).toBe('high');
      expect(cacheRec?.description).toContain('Low cache hit rate');
    });

    it('should generate parallelization recommendations for low efficiency', () => {
      const lowParallelMetrics: BuildMetrics = {
        ...mockMetrics,
        parallelEfficiency: 0.3, // Low parallel efficiency
      };

      const recommendations = analyzer.generateOptimizationRecommendations(lowParallelMetrics);

      const parallelRec = recommendations.find((r) => r.type === 'parallelization');
      expect(parallelRec).toBeDefined();
      expect(parallelRec?.priority).toBe('high');
      expect(parallelRec?.description).toContain('Low parallel efficiency');
    });

    it('should generate bottleneck-specific recommendations', () => {
      const bottleneckMetrics: BuildMetrics = {
        ...mockMetrics,
        bottlenecks: [
          {
            packageName: 'frontend',
            buildTime: 30000,
            percentage: 50, // Major bottleneck
            suggestions: ['Optimize bundle size', 'Enable code splitting'],
          },
        ],
      };

      const recommendations = analyzer.generateOptimizationRecommendations(bottleneckMetrics);

      const bottleneckRec = recommendations.find((r) => r.type === 'dependency');
      expect(bottleneckRec).toBeDefined();
      expect(bottleneckRec?.description).toContain('frontend');
      expect(bottleneckRec?.description).toContain('major bottleneck');
    });

    it('should generate regression recommendations when comparison shows issues', () => {
      const comparison: BuildComparison = {
        current: mockMetrics,
        baseline: mockMetrics,
        improvement: {
          totalTimeImprovement: -5000,
          percentageImprovement: -8.33,
          packageImprovements: {},
        },
        regressions: ['backend: 10% slower'],
        achievements: [],
      };

      const recommendations = analyzer.generateOptimizationRecommendations(mockMetrics, comparison);

      const configRec = recommendations.find((r) => r.type === 'configuration');
      expect(configRec).toBeDefined();
      expect(configRec?.description).toContain('regressions detected');
    });
  });

  describe('generateAnalysisReport', () => {
    it('should generate comprehensive analysis report', async () => {
      // Mock all the necessary methods
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          ...mockMetrics,
          totalBuildTime: 90000, // Slower baseline for good comparison
        })
      );

      const { spawn } = await import('node:child_process');
      vi.mocked(spawn).mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stderr: { on: vi.fn() },
        };
        return mockProcess as any;
      });

      const report = await analyzer.generateAnalysisReport();

      expect(report).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.status).toMatch(/success|warning|failure/);
      expect(typeof report.summary.targetAchieved).toBe('boolean');
    });

    it('should mark as success when target is achieved', async () => {
      // Mock successful scenario with >30% improvement
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          ...mockMetrics,
          totalBuildTime: 100000, // Much slower baseline
        })
      );

      const { spawn } = await import('node:child_process');
      vi.mocked(spawn).mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stderr: { on: vi.fn() },
        };
        return mockProcess as any;
      });

      const report = await analyzer.generateAnalysisReport();

      expect(report.summary.status).toBe('success');
      expect(report.summary.targetAchieved).toBe(true);
      expect(report.summary.message).toContain('30%');
    });

    it('should mark as failure when regression is detected', async () => {
      // Mock regression scenario
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          ...mockMetrics,
          totalBuildTime: 45000, // Faster baseline (current is slower)
        })
      );

      const { spawn } = await import('node:child_process');
      vi.mocked(spawn).mockImplementation(() => {
        const mockProcess = {
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
          stderr: { on: vi.fn() },
        };
        return mockProcess as any;
      });

      const report = await analyzer.generateAnalysisReport();

      expect(report.summary.status).toBe('failure');
      expect(report.summary.targetAchieved).toBe(false);
      expect(report.summary.message).toContain('regression');
    });
  });

  describe('bottleneck identification', () => {
    it('should identify packages taking >15% of build time as bottlenecks', () => {
      const packageTimes = {
        'package-a': 10000, // 16.7% of 60s
        'package-b': 5000, // 8.3% of 60s
        'package-c': 20000, // 33.3% of 60s
        'package-d': 25000, // 41.7% of 60s
      };
      const totalTime = 60000;

      // Use reflection to access private method for testing
      const bottlenecks = (analyzer as any).identifyBottlenecks(packageTimes, totalTime);

      expect(bottlenecks).toHaveLength(2); // package-c and package-d
      expect(bottlenecks[0].packageName).toBe('package-d'); // Highest percentage first
      expect(bottlenecks[0].percentage).toBeCloseTo(41.7, 1);
      expect(bottlenecks[1].packageName).toBe('package-c');
      expect(bottlenecks[1].percentage).toBeCloseTo(33.3, 1);
    });

    it('should generate appropriate suggestions for different package types', () => {
      const suggestions = (analyzer as any).generateBottleneckSuggestions('frontend', 30000, 50);

      expect(suggestions).toContain('Consider code splitting and lazy loading');
      expect(suggestions).toContain('Optimize bundle size with tree shaking');
      expect(suggestions[0]).toContain('CRITICAL'); // High percentage should get critical priority
    });
  });
});
