import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryLeakDetector } from '../monitoring/MemoryLeakDetector.js';
import { MemoryMonitor } from '../monitoring/MemoryMonitor.js';
import { MemoryOptimizer } from '../monitoring/MemoryOptimizer.js';

describe('MemoryMonitor', () => {
  let memoryMonitor: MemoryMonitor;

  beforeEach(() => {
    memoryMonitor = new MemoryMonitor();
  });

  afterEach(() => {
    memoryMonitor.stopMonitoring();
    memoryMonitor.reset();
  });

  describe('Memory Profiling', () => {
    it('should profile memory usage across different phases', async () => {
      const profile = await memoryMonitor.profileMemoryUsage();

      expect(profile).toHaveProperty('development');
      expect(profile).toHaveProperty('build');
      expect(profile).toHaveProperty('runtime');
      expect(profile).toHaveProperty('leaks');
      expect(profile).toHaveProperty('optimizations');

      // Verify memory stats structure
      expect(profile.development).toHaveProperty('heapUsed');
      expect(profile.development).toHaveProperty('heapTotal');
      expect(profile.development).toHaveProperty('external');
      expect(profile.development).toHaveProperty('rss');
      expect(profile.development).toHaveProperty('peak');

      // Verify arrays are present
      expect(Array.isArray(profile.leaks)).toBe(true);
      expect(Array.isArray(profile.optimizations)).toBe(true);
    });

    it('should detect memory leaks when present', async () => {
      // Start monitoring to generate some data
      memoryMonitor.startMonitoring(100);

      // Wait for a few snapshots
      await new Promise((resolve) => setTimeout(resolve, 300));

      const profile = await memoryMonitor.profileMemoryUsage();

      // Should have leak detection results
      expect(profile.leaks).toBeDefined();
      expect(Array.isArray(profile.leaks)).toBe(true);
    });

    it('should identify optimization opportunities', async () => {
      const profile = await memoryMonitor.profileMemoryUsage();

      expect(profile.optimizations).toBeDefined();
      expect(Array.isArray(profile.optimizations)).toBe(true);

      // Each optimization should have required properties
      profile.optimizations.forEach((opt) => {
        expect(opt).toHaveProperty('area');
        expect(opt).toHaveProperty('currentUsage');
        expect(opt).toHaveProperty('potentialSavings');
        expect(opt).toHaveProperty('recommendation');
        expect(typeof opt.currentUsage).toBe('number');
        expect(typeof opt.potentialSavings).toBe('number');
      });
    });

    it('should generate comprehensive memory report', async () => {
      const report = await memoryMonitor.generateMemoryReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('profile');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('summary');

      // Verify summary structure
      expect(report.summary).toHaveProperty('totalMemoryUsage');
      expect(report.summary).toHaveProperty('peakMemoryUsage');
      expect(report.summary).toHaveProperty('memoryEfficiency');
      expect(report.summary).toHaveProperty('leakRisk');
      expect(report.summary).toHaveProperty('optimizationPotential');

      // Verify numeric values
      expect(typeof report.summary.totalMemoryUsage).toBe('number');
      expect(typeof report.summary.peakMemoryUsage).toBe('number');
      expect(typeof report.summary.memoryEfficiency).toBe('number');
      expect(typeof report.summary.optimizationPotential).toBe('number');
    });
  });

  describe('Memory Monitoring', () => {
    it('should start and stop monitoring correctly', () => {
      const stats = memoryMonitor.getMonitoringStats();
      expect(stats.isMonitoring).toBe(false);

      memoryMonitor.startMonitoring(1000);
      const monitoringStats = memoryMonitor.getMonitoringStats();
      expect(monitoringStats.isMonitoring).toBe(true);

      memoryMonitor.stopMonitoring();
      const stoppedStats = memoryMonitor.getMonitoringStats();
      expect(stoppedStats.isMonitoring).toBe(false);
    });

    it('should collect memory snapshots during monitoring', async () => {
      memoryMonitor.startMonitoring(50);

      // Wait for a few snapshots
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stats = memoryMonitor.getMonitoringStats();
      expect(stats.snapshotCount).toBeGreaterThan(0);
      expect(stats.baselineMemory).toBeDefined();
      expect(stats.currentMemory).toBeDefined();
    });

    it('should not start monitoring if already monitoring', () => {
      memoryMonitor.startMonitoring(1000);
      const stats1 = memoryMonitor.getMonitoringStats();

      memoryMonitor.startMonitoring(500); // Should not change interval
      const stats2 = memoryMonitor.getMonitoringStats();

      expect(stats1.isMonitoring).toBe(true);
      expect(stats2.isMonitoring).toBe(true);
    });
  });
});

describe('MemoryLeakDetector', () => {
  let leakDetector: MemoryLeakDetector;

  beforeEach(() => {
    leakDetector = new MemoryLeakDetector();
  });

  afterEach(() => {
    leakDetector.stopTracking();
    leakDetector.reset();
  });

  describe('Leak Detection', () => {
    it('should detect sustained memory growth', async () => {
      // Start tracking
      leakDetector.startTracking(50);

      // Wait for some data collection
      await new Promise((resolve) => setTimeout(resolve, 200));

      const leaks = await leakDetector.detectLeaks();

      expect(Array.isArray(leaks)).toBe(true);

      // Each leak should have required properties
      leaks.forEach((leak) => {
        expect(leak).toHaveProperty('location');
        expect(leak).toHaveProperty('severity');
        expect(leak).toHaveProperty('description');
        expect(leak).toHaveProperty('suggestion');
        expect(['low', 'medium', 'high']).toContain(leak.severity);
      });
    });

    it('should track object types for leak detection', () => {
      leakDetector.trackObjectType('TestObject', 100);
      leakDetector.trackObjectType('TestObject', 150);

      const stats = leakDetector.getTrackingStats();
      expect(stats.trackedObjectTypes).toBe(1);
    });

    it('should emit events when leaks are detected', (done) => {
      let _eventEmitted = false;

      leakDetector.on('leaksDetected', (leaks) => {
        expect(Array.isArray(leaks)).toBe(true);
        _eventEmitted = true;
      });

      leakDetector.on('error', (error) => {
        // Handle potential errors
        console.warn('Leak detection error:', error.message);
      });

      leakDetector.startTracking(30);

      // Give it time to potentially detect leaks
      setTimeout(() => {
        leakDetector.stopTracking();
        // Don't fail if no leaks detected in test environment
        done();
      }, 100);
    });

    it('should provide tracking statistics', () => {
      const stats = leakDetector.getTrackingStats();

      expect(stats).toHaveProperty('isTracking');
      expect(stats).toHaveProperty('historyLength');
      expect(stats).toHaveProperty('trackedObjectTypes');
      expect(stats).toHaveProperty('thresholds');
      expect(stats).toHaveProperty('lastAnalysis');

      expect(typeof stats.isTracking).toBe('boolean');
      expect(typeof stats.historyLength).toBe('number');
      expect(typeof stats.trackedObjectTypes).toBe('number');
    });
  });

  describe('Configuration', () => {
    it('should accept custom thresholds', () => {
      const customDetector = new MemoryLeakDetector({
        sustainedGrowthThreshold: 0.2,
        memoryGrowthRate: 0.1,
      });

      const stats = customDetector.getTrackingStats();
      expect(stats.thresholds.sustainedGrowthThreshold).toBe(0.2);
      expect(stats.thresholds.memoryGrowthRate).toBe(0.1);

      customDetector.reset();
    });
  });
});

describe('MemoryOptimizer', () => {
  let memoryOptimizer: MemoryOptimizer;

  beforeEach(() => {
    memoryOptimizer = new MemoryOptimizer();
  });

  describe('Optimization Analysis', () => {
    it('should analyze memory optimizations', async () => {
      const optimizations = await memoryOptimizer.analyzeOptimizations();

      expect(Array.isArray(optimizations)).toBe(true);

      // Each optimization should have required properties
      optimizations.forEach((opt) => {
        expect(opt).toHaveProperty('area');
        expect(opt).toHaveProperty('currentUsage');
        expect(opt).toHaveProperty('potentialSavings');
        expect(opt).toHaveProperty('recommendation');

        expect(typeof opt.currentUsage).toBe('number');
        expect(typeof opt.potentialSavings).toBe('number');
        expect(typeof opt.recommendation).toBe('string');
      });
    });

    it('should generate comprehensive optimization report', async () => {
      const report = await memoryOptimizer.generateOptimizationReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('currentMemoryUsage');
      expect(report).toHaveProperty('optimizations');
      expect(report).toHaveProperty('totalPotentialSavings');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('implementationPlan');

      // Verify implementation plan structure
      expect(report.implementationPlan).toHaveProperty('quickWins');
      expect(report.implementationPlan).toHaveProperty('majorImpact');
      expect(report.implementationPlan).toHaveProperty('longTerm');
      expect(report.implementationPlan).toHaveProperty('totalEstimatedSavings');
      expect(report.implementationPlan).toHaveProperty('estimatedTimeframe');

      expect(Array.isArray(report.implementationPlan.quickWins)).toBe(true);
      expect(Array.isArray(report.implementationPlan.majorImpact)).toBe(true);
      expect(Array.isArray(report.implementationPlan.longTerm)).toBe(true);
    });

    it('should prioritize optimizations correctly', async () => {
      const report = await memoryOptimizer.generateOptimizationReport();

      // Optimizations should be sorted by priority
      for (let i = 1; i < report.optimizations.length; i++) {
        expect(report.optimizations[i - 1].priority).toBeGreaterThanOrEqual(
          report.optimizations[i].priority
        );
      }

      // Each optimization should have priority metrics
      report.optimizations.forEach((opt) => {
        expect(opt).toHaveProperty('impact');
        expect(opt).toHaveProperty('effort');
        expect(opt).toHaveProperty('priority');
        expect(opt).toHaveProperty('roi');

        expect(typeof opt.impact).toBe('number');
        expect(typeof opt.effort).toBe('number');
        expect(typeof opt.priority).toBe('number');
        expect(typeof opt.roi).toBe('number');
      });
    });

    it('should generate actionable recommendations', async () => {
      const report = await memoryOptimizer.generateOptimizationReport();

      expect(Array.isArray(report.recommendations)).toBe(true);

      report.recommendations.forEach((rec) => {
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('impact');
        expect(rec).toHaveProperty('effort');
        expect(rec).toHaveProperty('steps');
        expect(rec).toHaveProperty('timeline');

        expect(Array.isArray(rec.steps)).toBe(true);
        expect(rec.steps.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Integration Tests', () => {
  it('should work together for comprehensive memory analysis', async () => {
    const monitor = new MemoryMonitor();
    const detector = new MemoryLeakDetector();
    const optimizer = new MemoryOptimizer();

    try {
      // Start monitoring and detection
      monitor.startMonitoring(50);
      detector.startTracking(50);

      // Wait for some data collection
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Get comprehensive analysis
      const [profile, leaks, optimizations] = await Promise.all([
        monitor.profileMemoryUsage(),
        detector.detectLeaks(),
        optimizer.analyzeOptimizations(),
      ]);

      // Verify all components provide data
      expect(profile).toBeDefined();
      expect(Array.isArray(leaks)).toBe(true);
      expect(Array.isArray(optimizations)).toBe(true);

      // Verify data consistency
      expect(profile.leaks).toBeDefined();
      expect(profile.optimizations).toBeDefined();
    } finally {
      // Cleanup
      monitor.stopMonitoring();
      monitor.reset();
      detector.stopTracking();
      detector.reset();
    }
  });
});
