/**
 * Tests for Build Process Validation System
 * Requirements: 1.4, 1.5
 */

import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';
import { type BuildValidationConfig, BuildValidator } from './BuildValidator.js';

// Mock Node.js modules
vi.mock('child_process');
vi.mock('fs');

const mockExecSync = execSync as MockedFunction<typeof execSync>;
const mockExistsSync = existsSync as MockedFunction<typeof existsSync>;
const mockStatSync = statSync as MockedFunction<typeof statSync>;

describe('BuildValidator', () => {
  let validator: BuildValidator;
  let config: BuildValidationConfig;

  beforeEach(() => {
    config = {
      workspaceRoot: '/test/workspace',
      buildCommand: 'npm run build',
      packages: ['frontend', 'backend', '@klikkflow/validation'],
      timeout: 30000,
      parallelBuilds: true,
      validateArtifacts: true,
      artifactPaths: ['dist', 'build'],
    };

    validator = new BuildValidator(config);

    // Setup default mocks
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1000,
    } as any);
    mockExecSync.mockReturnValue(Buffer.from('Build successful'));

    vi.clearAllMocks();
  });

  describe('validateBuildProcess', () => {
    it('should validate build process successfully', async () => {
      const result = await validator.validateBuildProcess();

      expect(result.overallStatus).toBe('success');
      expect(result.packageBuilds).toHaveLength(3);
      expect(result.totalBuildTime).toBeGreaterThan(0);
      expect(result.parallelEfficiency).toBeGreaterThan(0);
      expect(mockExecSync).toHaveBeenCalledTimes(3); // One for each package
    });

    it('should handle build failures', async () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('Build failed');
      });

      const result = await validator.validateBuildProcess();

      expect(result.overallStatus).toBe('failure');
      expect(result.packageBuilds.some((build) => build.status === 'failure')).toBe(true);
      expect(result.packageBuilds.some((build) => build.errors.length > 0)).toBe(true);
    });

    it('should handle workspace structure validation failure', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await validator.validateBuildProcess();

      expect(result.overallStatus).toBe('failure');
      expect(result.packageBuilds).toHaveLength(0);
    });

    it('should build packages in parallel when configured', async () => {
      const startTime = Date.now();
      await validator.validateBuildProcess();
      const endTime = Date.now();

      // In parallel mode, all builds should start roughly at the same time
      expect(mockExecSync).toHaveBeenCalledTimes(3);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast with mocks
    });

    it('should build packages sequentially when configured', async () => {
      const sequentialConfig = { ...config, parallelBuilds: false };
      const sequentialValidator = new BuildValidator(sequentialConfig);

      const result = await sequentialValidator.validateBuildProcess();

      expect(result.overallStatus).toBe('success');
      expect(mockExecSync).toHaveBeenCalledTimes(3);
    });

    it('should calculate parallel efficiency correctly', async () => {
      const result = await validator.validateBuildProcess();

      expect(result.parallelEfficiency).toBeGreaterThan(0);
      expect(result.parallelEfficiency).toBeLessThanOrEqual(100);
    });

    it('should calculate cache hit rate', async () => {
      // Mock fast builds to simulate cache hits
      mockExecSync.mockImplementation(() => {
        // Simulate very fast build (cache hit)
        return Buffer.from('Build successful');
      });

      const result = await validator.validateBuildProcess();

      expect(result.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(result.cacheHitRate).toBeLessThanOrEqual(100);
    });
  });

  describe('checkBuildArtifacts', () => {
    it('should validate build artifacts successfully', async () => {
      // Mock artifact files exist
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes('dist') || path.includes('package.json') || path.includes('workspace');
      });

      mockStatSync.mockImplementation(
        (path: string) =>
          ({
            isFile: () => path.includes('.js') || path.includes('.ts') || path.includes('.html'),
            isDirectory: () => path.includes('dist') || path.includes('assets'),
            size: 1000,
          }) as any
      );

      const result = await validator.checkBuildArtifacts();

      expect(result.overallStatus).toBe('success');
      expect(result.packageBuilds).toHaveLength(3);
      expect(result.packageBuilds.every((build) => build.status === 'success')).toBe(true);
    });

    it('should detect missing required artifacts', async () => {
      // Mock missing dist directory
      mockExistsSync.mockImplementation((path: string) => {
        return (
          !path.includes('dist') && (path.includes('package.json') || path.includes('workspace'))
        );
      });

      const result = await validator.checkBuildArtifacts();

      expect(result.overallStatus).toBe('failure');
      expect(
        result.packageBuilds.some((build) =>
          build.errors.some((error) => error.includes('Required artifact missing'))
        )
      ).toBe(true);
    });

    it('should warn about missing optional artifacts', async () => {
      // Mock missing optional artifacts
      mockExistsSync.mockImplementation((path: string) => {
        return (
          !path.includes('.d.ts') &&
          (path.includes('dist') || path.includes('package.json') || path.includes('workspace'))
        );
      });

      mockStatSync.mockImplementation(
        (path: string) =>
          ({
            isFile: () => path.includes('.js') || path.includes('.html'),
            isDirectory: () => path.includes('dist'),
            size: 1000,
          }) as any
      );

      const result = await validator.checkBuildArtifacts();

      expect(
        result.packageBuilds.some((build) =>
          build.warnings.some((warning) => warning.includes('Optional artifact missing'))
        )
      ).toBe(true);
    });

    it('should validate artifact types', async () => {
      // Mock incorrect artifact type (file instead of directory)
      mockStatSync.mockImplementation(
        (_path: string) =>
          ({
            isFile: () => true, // Everything is a file
            isDirectory: () => false,
            size: 1000,
          }) as any
      );

      const result = await validator.checkBuildArtifacts();

      expect(
        result.packageBuilds.some((build) =>
          build.errors.some((error) => error.includes('Expected directory but found file'))
        )
      ).toBe(true);
    });

    it('should validate artifact sizes', async () => {
      // Mock very small files
      mockStatSync.mockImplementation(
        (path: string) =>
          ({
            isFile: () => path.includes('.js'),
            isDirectory: () => path.includes('dist'),
            size: 10, // Very small file
          }) as any
      );

      const result = await validator.checkBuildArtifacts();

      expect(
        result.packageBuilds.some((build) =>
          build.warnings.some((warning) => warning.includes('smaller than expected'))
        )
      ).toBe(true);
    });
  });

  describe('validateDependencyResolution', () => {
    it('should validate dependencies successfully', async () => {
      const result = await validator.validateDependencyResolution();

      expect(result.overallStatus).toBe('success');
      expect(result.packageBuilds).toHaveLength(3);
      expect(mockExecSync).toHaveBeenCalledWith(
        'npm ls --depth=0',
        expect.objectContaining({ cwd: config.workspaceRoot })
      );
    });

    it('should detect missing node_modules', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return (
          !path.includes('node_modules') &&
          (path.includes('package.json') || path.includes('workspace'))
        );
      });

      const result = await validator.validateDependencyResolution();

      expect(result.overallStatus).toBe('failure');
    });

    it('should detect missing lock file', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        const isLockFile =
          path.includes('pnpm-lock.yaml') ||
          path.includes('package-lock.json') ||
          path.includes('yarn.lock');
        return (
          !isLockFile &&
          (path.includes('package.json') ||
            path.includes('workspace') ||
            path.includes('node_modules'))
        );
      });

      const result = await validator.validateDependencyResolution();

      // Should still succeed but with warnings
      expect(result.packageBuilds.length).toBeGreaterThan(0);
    });

    it('should handle dependency tree validation failure', async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('npm ls')) {
          throw new Error('Dependency tree invalid');
        }
        return Buffer.from('Success');
      });

      const result = await validator.validateDependencyResolution();

      expect(result.overallStatus).toBe('failure');
    });

    it('should validate TypeScript types when tsconfig exists', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return (
          path.includes('tsconfig.json') ||
          path.includes('package.json') ||
          path.includes('workspace') ||
          path.includes('node_modules')
        );
      });

      await validator.validateDependencyResolution();

      expect(mockExecSync).toHaveBeenCalledWith(
        'npx tsc --noEmit',
        expect.objectContaining({ timeout: 30000 })
      );
    });
  });

  describe('measureBuildPerformance', () => {
    it('should measure build performance', async () => {
      // Mock clean command
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('clean')) {
          return Buffer.from('Cleaned');
        }
        return Buffer.from('Build successful');
      });

      const result = await validator.measureBuildPerformance();

      expect(result.overallStatus).toBe('success');
      expect(result.totalBuildTime).toBeGreaterThan(0);
      expect(result.parallelEfficiency).toBeGreaterThanOrEqual(0);
      expect(result.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle clean command failure gracefully', async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('clean')) {
          throw new Error('Clean failed');
        }
        return Buffer.from('Build successful');
      });

      const result = await validator.measureBuildPerformance();

      // Should still succeed even if clean fails
      expect(result.overallStatus).toBe('success');
    });

    it('should calculate cache effectiveness', async () => {
      let buildCount = 0;
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('build')) {
          buildCount++;
          // Second build should be faster (cached)
          if (buildCount > 3) {
            // Simulate faster cached build
            return Buffer.from('Build successful (cached)');
          }
        }
        return Buffer.from('Build successful');
      });

      const result = await validator.measureBuildPerformance();

      expect(result.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('workspace structure validation', () => {
    it('should validate workspace structure successfully', async () => {
      const result = await validator.validateBuildProcess();

      expect(result.overallStatus).toBe('success');
      expect(mockExistsSync).toHaveBeenCalledWith(config.workspaceRoot);
      expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining('package.json'));
    });

    it('should fail when workspace root does not exist', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path !== config.workspaceRoot;
      });

      const result = await validator.validateBuildProcess();

      expect(result.overallStatus).toBe('failure');
      expect(result.packageBuilds).toHaveLength(0);
    });

    it('should fail when package.json is missing', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        return !path.includes('package.json');
      });

      const result = await validator.validateBuildProcess();

      expect(result.overallStatus).toBe('failure');
    });

    it('should warn when workspace config is missing', async () => {
      mockExistsSync.mockImplementation((path: string) => {
        const isWorkspaceConfig =
          path.includes('pnpm-workspace.yaml') ||
          path.includes('lerna.json') ||
          path.includes('rush.json');
        return !isWorkspaceConfig;
      });

      // Should still proceed but with warning
      const result = await validator.validateBuildProcess();

      expect(result.overallStatus).toBe('success');
    });
  });

  describe('createDefaultConfig', () => {
    it('should create default configuration', () => {
      const defaultConfig = BuildValidator.createDefaultConfig('/test/workspace');

      expect(defaultConfig.workspaceRoot).toContain('/test/workspace');
      expect(defaultConfig.buildCommand).toBe('npm run build');
      expect(defaultConfig.packages).toContain('frontend');
      expect(defaultConfig.packages).toContain('backend');
      expect(defaultConfig.timeout).toBe(300000);
      expect(defaultConfig.parallelBuilds).toBe(true);
      expect(defaultConfig.validateArtifacts).toBe(true);
    });

    it('should resolve workspace root path', () => {
      const defaultConfig = BuildValidator.createDefaultConfig('./relative/path');

      expect(defaultConfig.workspaceRoot).not.toContain('./');
    });
  });

  describe('package path resolution', () => {
    it('should resolve scoped package paths', async () => {
      const scopedConfig = {
        ...config,
        packages: ['@klikkflow/validation'],
      };
      const scopedValidator = new BuildValidator(scopedConfig);

      await scopedValidator.validateBuildProcess();

      expect(mockExecSync).toHaveBeenCalledWith(
        'npm run build',
        expect.objectContaining({
          cwd: expect.stringContaining('@klikkflow/validation'),
        })
      );
    });

    it('should resolve simple package paths', async () => {
      const simpleConfig = {
        ...config,
        packages: ['frontend'],
      };
      const simpleValidator = new BuildValidator(simpleConfig);

      await simpleValidator.validateBuildProcess();

      expect(mockExecSync).toHaveBeenCalledWith(
        'npm run build',
        expect.objectContaining({
          cwd: expect.stringContaining('frontend'),
        })
      );
    });

    it('should resolve path-like package names', async () => {
      const pathConfig = {
        ...config,
        packages: ['packages/custom-package'],
      };
      const pathValidator = new BuildValidator(pathConfig);

      await pathValidator.validateBuildProcess();

      expect(mockExecSync).toHaveBeenCalledWith(
        'npm run build',
        expect.objectContaining({
          cwd: expect.stringContaining('packages/custom-package'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle build timeouts', async () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('Command timed out') as any;
        error.code = 'TIMEOUT';
        throw error;
      });

      const result = await validator.validateBuildProcess();

      expect(result.overallStatus).toBe('failure');
      expect(result.packageBuilds.every((build) => build.status === 'failure')).toBe(true);
    });

    it('should handle file system errors', async () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await validator.validateBuildProcess();

      expect(result.overallStatus).toBe('failure');
    });

    it('should handle stat errors during artifact validation', async () => {
      mockStatSync.mockImplementation(() => {
        throw new Error('Stat error');
      });

      const result = await validator.checkBuildArtifacts();

      expect(result.packageBuilds.some((build) => build.status === 'failure')).toBe(true);
    });
  });
});
