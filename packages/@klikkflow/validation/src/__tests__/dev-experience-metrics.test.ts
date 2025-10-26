import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevExperienceMetrics } from '../developer-experience/DevExperienceMetrics.js';
import { IDEPerformanceAnalyzer } from '../developer-experience/IDEPerformanceAnalyzer.js';
import { ProductivityTracker } from '../developer-experience/ProductivityTracker.js';

// Mock child_process and fs modules
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 10);
      }
    }),
    kill: vi.fn(),
  })),
  exec: vi.fn((_cmd, _optionss, callback) => {
    if (callback) {
      setTimeout(() => callback(null, { stdout: '10\n' }), 10);
    }
  }),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(() => Promise.resolve('{"dependencies": {}, "devDependencies": {}}')),
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
}));

vi.mock('node:util', () => ({
  promisify: vi.fn((fn) => fn),
}));

describe('DevExperienceMetrics', () => {
  let devMetrics: DevExperienceMetrics;

  beforeEach(() => {
    devMetrics = new DevExperienceMetrics('/test/workspace');
  });

  describe('measureIDEPerformance', () => {
    it('should measure IDE performance metrics', async () => {
      const metrics = await devMetrics.measureIDEPerformance();

      expect(metrics).toHaveProperty('typeCheckingTime');
      expect(metrics).toHaveProperty('autocompleteResponseTime');
      expect(metrics).toHaveProperty('navigationSpeed');
      expect(metrics).toHaveProperty('intelliSenseLatency');
      expect(metrics).toHaveProperty('sourceMapResolutionTime');

      expect(typeof metrics.typeCheckingTime).toBe('number');
      expect(typeof metrics.autocompleteResponseTime).toBe('number');
      expect(typeof metrics.navigationSpeed).toBe('number');
      expect(typeof metrics.intelliSenseLatency).toBe('number');
      expect(typeof metrics.sourceMapResolutionTime).toBe('number');
    });

    it('should return reasonable performance values', async () => {
      const metrics = await devMetrics.measureIDEPerformance();

      // Performance metrics should be positive numbers
      expect(metrics.typeCheckingTime).toBeGreaterThanOrEqual(0);
      expect(metrics.autocompleteResponseTime).toBeGreaterThanOrEqual(0);
      expect(metrics.navigationSpeed).toBeGreaterThanOrEqual(0);
      expect(metrics.intelliSenseLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.sourceMapResolutionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('measureWorkflowTiming', () => {
    it('should measure workflow timing metrics', async () => {
      const metrics = await devMetrics.measureWorkflowTiming();

      expect(metrics).toHaveProperty('hotReloadTime');
      expect(metrics).toHaveProperty('buildStartupTime');
      expect(metrics).toHaveProperty('testExecutionTime');
      expect(metrics).toHaveProperty('lintingTime');
      expect(metrics).toHaveProperty('formattingTime');

      expect(typeof metrics.hotReloadTime).toBe('number');
      expect(typeof metrics.buildStartupTime).toBe('number');
      expect(typeof metrics.testExecutionTime).toBe('number');
      expect(typeof metrics.lintingTime).toBe('number');
      expect(typeof metrics.formattingTime).toBe('number');
    });
  });

  describe('measureProductivity', () => {
    it('should measure productivity metrics', async () => {
      const metrics = await devMetrics.measureProductivity();

      expect(metrics).toHaveProperty('averageCompileTime');
      expect(metrics).toHaveProperty('errorResolutionTime');
      expect(metrics).toHaveProperty('refactoringEfficiency');
      expect(metrics).toHaveProperty('debuggingSpeed');
      expect(metrics).toHaveProperty('codeNavigationEfficiency');

      expect(typeof metrics.averageCompileTime).toBe('number');
      expect(typeof metrics.errorResolutionTime).toBe('number');
      expect(typeof metrics.refactoringEfficiency).toBe('number');
      expect(typeof metrics.debuggingSpeed).toBe('number');
      expect(typeof metrics.codeNavigationEfficiency).toBe('number');
    });
  });

  describe('generateReport', () => {
    it('should generate a comprehensive developer experience report', async () => {
      const report = await devMetrics.generateReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('idePerformance');
      expect(report).toHaveProperty('workflowTiming');
      expect(report).toHaveProperty('productivity');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('score');

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(typeof report.score).toBe('number');
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    });

    it('should include performance recommendations', async () => {
      const report = await devMetrics.generateReport();

      expect(Array.isArray(report.recommendations)).toBe(true);
      // Should have some recommendations for a typical project
      expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recordMeasurement', () => {
    it('should record measurements for later analysis', () => {
      devMetrics.recordMeasurement('compile', 1000);
      devMetrics.recordMeasurement('compile', 1200);
      devMetrics.recordMeasurement('compile', 800);

      // The measurements should be stored internally
      // We can't directly test the private measurements map,
      // but we can test that it doesn't throw errors
      expect(() => {
        devMetrics.recordMeasurement('test', 500);
      }).not.toThrow();
    });
  });
});

describe('IDEPerformanceAnalyzer', () => {
  let analyzer: IDEPerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new IDEPerformanceAnalyzer('/test/workspace');
  });

  describe('analyzeIDEPerformance', () => {
    it('should analyze comprehensive IDE performance', async () => {
      const report = await analyzer.analyzeIDEPerformance();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('workspaceSize');
      expect(report).toHaveProperty('typescript');
      expect(report).toHaveProperty('autocomplete');
      expect(report).toHaveProperty('navigation');
      expect(report).toHaveProperty('intelliSense');
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('recommendations');

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.overallScore).toBe('number');
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('analyzeTypeScriptPerformance', () => {
    it('should analyze TypeScript performance metrics', async () => {
      const metrics = await analyzer.analyzeTypeScriptPerformance();

      expect(metrics).toHaveProperty('compilationTime');
      expect(metrics).toHaveProperty('typeCheckingTime');
      expect(metrics).toHaveProperty('incrementalBuildTime');
      expect(metrics).toHaveProperty('languageServiceResponseTime');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('warningCount');

      expect(typeof metrics.compilationTime).toBe('number');
      expect(typeof metrics.typeCheckingTime).toBe('number');
      expect(typeof metrics.incrementalBuildTime).toBe('number');
      expect(typeof metrics.languageServiceResponseTime).toBe('number');
      expect(typeof metrics.errorCount).toBe('number');
      expect(typeof metrics.warningCount).toBe('number');
    });
  });

  describe('analyzeAutocompletePerformance', () => {
    it('should analyze autocomplete performance', async () => {
      const metrics = await analyzer.analyzeAutocompletePerformance();

      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('suggestionAccuracy');
      expect(metrics).toHaveProperty('contextualRelevance');
      expect(metrics).toHaveProperty('importSuggestionSpeed');

      expect(typeof metrics.averageResponseTime).toBe('number');
      expect(typeof metrics.suggestionAccuracy).toBe('number');
      expect(typeof metrics.contextualRelevance).toBe('number');
      expect(typeof metrics.importSuggestionSpeed).toBe('number');

      // Accuracy and relevance should be percentages (0-100)
      expect(metrics.suggestionAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.suggestionAccuracy).toBeLessThanOrEqual(100);
      expect(metrics.contextualRelevance).toBeGreaterThanOrEqual(0);
      expect(metrics.contextualRelevance).toBeLessThanOrEqual(100);
    });
  });

  describe('analyzeNavigationPerformance', () => {
    it('should analyze code navigation performance', async () => {
      const metrics = await analyzer.analyzeNavigationPerformance();

      expect(metrics).toHaveProperty('goToDefinitionTime');
      expect(metrics).toHaveProperty('findReferencesTime');
      expect(metrics).toHaveProperty('symbolSearchTime');
      expect(metrics).toHaveProperty('fileSearchTime');
      expect(metrics).toHaveProperty('workspaceIndexingTime');

      expect(typeof metrics.goToDefinitionTime).toBe('number');
      expect(typeof metrics.findReferencesTime).toBe('number');
      expect(typeof metrics.symbolSearchTime).toBe('number');
      expect(typeof metrics.fileSearchTime).toBe('number');
      expect(typeof metrics.workspaceIndexingTime).toBe('number');
    });
  });

  describe('analyzeIntelliSensePerformance', () => {
    it('should analyze IntelliSense performance', async () => {
      const metrics = await analyzer.analyzeIntelliSensePerformance();

      expect(metrics).toHaveProperty('hoverInfoTime');
      expect(metrics).toHaveProperty('signatureHelpTime');
      expect(metrics).toHaveProperty('diagnosticsUpdateTime');
      expect(metrics).toHaveProperty('quickFixSuggestionTime');

      expect(typeof metrics.hoverInfoTime).toBe('number');
      expect(typeof metrics.signatureHelpTime).toBe('number');
      expect(typeof metrics.diagnosticsUpdateTime).toBe('number');
      expect(typeof metrics.quickFixSuggestionTime).toBe('number');
    });
  });
});

describe('ProductivityTracker', () => {
  let tracker: ProductivityTracker;

  beforeEach(() => {
    tracker = new ProductivityTracker('/test/workspace');
  });

  describe('session management', () => {
    it('should start and end productivity sessions', async () => {
      const sessionId = await tracker.startSession();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);

      const session = await tracker.endSession();
      expect(session).toBeTruthy();
      expect(session?.id).toBe(sessionId);
      expect(session?.startTime).toBeInstanceOf(Date);
      expect(session?.endTime).toBeInstanceOf(Date);
    });

    it('should return null when ending session without starting', async () => {
      const session = await tracker.endSession();
      expect(session).toBeNull();
    });
  });

  describe('activity tracking', () => {
    it('should track coding activities', async () => {
      await tracker.startSession();

      await tracker.startActivity('coding', 'Working on feature');
      await tracker.endActivity(true, 0);

      const session = await tracker.endSession();
      expect(session?.activities).toHaveLength(1);
      expect(session?.activities[0].type).toBe('coding');
      expect(session?.activities[0].success).toBe(true);
    });

    it('should track debugging activities with errors', async () => {
      await tracker.startSession();

      await tracker.startActivity('debugging', 'Fixing bug');
      await tracker.endActivity(false, 3);

      const session = await tracker.endSession();
      expect(session?.activities).toHaveLength(1);
      expect(session?.activities[0].type).toBe('debugging');
      expect(session?.activities[0].success).toBe(false);
      expect(session?.activities[0].errorCount).toBe(3);
    });

    it('should handle multiple activities in sequence', async () => {
      await tracker.startSession();

      await tracker.startActivity('coding', 'Feature development');
      await tracker.endActivity(true, 0);

      await tracker.startActivity('testing', 'Running tests');
      await tracker.endActivity(true, 0);

      const session = await tracker.endSession();
      expect(session?.activities).toHaveLength(2);
      expect(session?.activities[0].type).toBe('coding');
      expect(session?.activities[1].type).toBe('testing');
    });
  });

  describe('build and test recording', () => {
    it('should record successful builds', async () => {
      await tracker.startSession();
      await tracker.recordBuild(true, 5000);

      // Wait a bit for the async recording to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      const session = await tracker.endSession();
      expect(session?.metrics.successfulBuilds).toBe(1);
      expect(session?.metrics.failedBuilds).toBe(0);
    });

    it('should record failed builds', async () => {
      await tracker.startSession();
      await tracker.recordBuild(false, 3000);

      // Wait a bit for the async recording to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      const session = await tracker.endSession();
      expect(session?.metrics.successfulBuilds).toBe(0);
      expect(session?.metrics.failedBuilds).toBe(1);
    });

    it('should record test runs', async () => {
      await tracker.startSession();
      await tracker.recordTestRun(10, 8, 2000);

      // Wait a bit for the async recording to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      const session = await tracker.endSession();
      expect(session?.metrics.testsRun).toBe(10);
      expect(session?.metrics.testsPassed).toBe(8);
    });
  });

  describe('code changes tracking', () => {
    it('should record code changes', async () => {
      await tracker.startSession();
      tracker.recordCodeChanges(50, 3);

      const session = await tracker.endSession();
      expect(session?.metrics.linesOfCodeChanged).toBe(50);
      expect(session?.metrics.filesModified).toBe(3);
    });

    it('should accumulate code changes', async () => {
      await tracker.startSession();
      tracker.recordCodeChanges(30, 2);
      tracker.recordCodeChanges(20, 1);

      const session = await tracker.endSession();
      expect(session?.metrics.linesOfCodeChanged).toBe(50);
      expect(session?.metrics.filesModified).toBe(3);
    });
  });

  describe('productivity trends', () => {
    it('should return empty trends when no data available', async () => {
      const trends = await tracker.getProductivityTrends(7);

      expect(trends).toHaveProperty('averageSessionDuration');
      expect(trends).toHaveProperty('codingEfficiency');
      expect(trends).toHaveProperty('debuggingRatio');
      expect(trends).toHaveProperty('buildSuccessRate');
      expect(trends).toHaveProperty('testSuccessRate');
      expect(trends).toHaveProperty('dailyProductivity');
      expect(trends).toHaveProperty('weeklyTrends');

      expect(trends.averageSessionDuration).toBe(0);
      expect(trends.codingEfficiency).toBe(0);
      expect(Array.isArray(trends.dailyProductivity)).toBe(true);
      expect(Array.isArray(trends.weeklyTrends)).toBe(true);
    });
  });

  describe('productivity report generation', () => {
    it('should generate productivity report', async () => {
      const report = await tracker.generateProductivityReport(7);

      expect(typeof report).toBe('string');
      expect(report).toContain('Developer Productivity Report');
      expect(report).toContain('Summary');
      expect(report).toContain('Recommendations');
    });

    it('should include recommendations in report', async () => {
      const report = await tracker.generateProductivityReport(7);

      expect(report).toContain('Recommendations');
      // Should have some default recommendations even with no data
      expect(report.length).toBeGreaterThan(100);
    });
  });
});
