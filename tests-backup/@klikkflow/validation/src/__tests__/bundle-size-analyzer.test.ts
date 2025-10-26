import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BundleSizeAnalyzer } from '../bundle-size-analyzer.js';

// Mock file system
vi.mock('node:fs/promises');

describe('BundleSizeAnalyzer', () => {
  let _analyzer: BundleSizeAnalyzer;

  beforeEach(() => {
    _analyzer = new BundleSizeAnalyzer('./test-dist', './test-baseline.json');
    vi.clearAllMocks();
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(BundleSizeAnalyzer.formatBytes(0)).toBe('0 B');
      expect(BundleSizeAnalyzer.formatBytes(1024)).toBe('1 KB');
      expect(BundleSizeAnalyzer.formatBytes(1048576)).toBe('1 MB');
      expect(BundleSizeAnalyzer.formatBytes(1536)).toBe('1.5 KB');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages with correct signs', () => {
      expect(BundleSizeAnalyzer.formatPercentage(15.5)).toBe('+15.5%');
      expect(BundleSizeAnalyzer.formatPercentage(-10.2)).toBe('-10.2%');
      expect(BundleSizeAnalyzer.formatPercentage(0)).toBe('0.0%');
    });
  });

  describe('constructor', () => {
    it('should create analyzer with default paths', () => {
      const defaultAnalyzer = new BundleSizeAnalyzer();
      expect(defaultAnalyzer).toBeInstanceOf(BundleSizeAnalyzer);
    });

    it('should create analyzer with custom paths', () => {
      const customAnalyzer = new BundleSizeAnalyzer('./custom-dist', './custom-baseline.json');
      expect(customAnalyzer).toBeInstanceOf(BundleSizeAnalyzer);
    });
  });
});
