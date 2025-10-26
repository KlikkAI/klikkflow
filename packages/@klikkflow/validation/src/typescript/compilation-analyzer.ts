import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as ts from 'typescript';
import type { CompilationError, CompilationMetrics, CompilationWarning } from './types';

const execAsync = promisify(exec);

export class CompilationAnalyzer {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async analyzeCompilation(): Promise<CompilationMetrics[]> {
    const packageDirectories = await this.getPackageDirectories();
    const metrics: CompilationMetrics[] = [];

    for (const packageDir of packageDirectories) {
      try {
        const packageMetrics = await this.analyzePackageCompilation(packageDir);
        metrics.push(packageMetrics);
      } catch (error) {
        // Add failed compilation metrics
        metrics.push({
          packageName: path.basename(packageDir),
          totalFiles: 0,
          compilationTime: 0,
          memoryUsage: 0,
          errors: [
            {
              file: 'unknown',
              line: 0,
              column: 0,
              message: error instanceof Error ? error.message : 'Unknown compilation error',
              code: 0,
            },
          ],
          warnings: [],
        });
      }
    }

    return metrics;
  }

  private async analyzePackageCompilation(packageDir: string): Promise<CompilationMetrics> {
    const packageName = this.getPackageName(packageDir);

    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;

    // Get TypeScript files in the package
    const tsFiles = await this.getTypeScriptFiles(packageDir);

    // Create TypeScript program for the package
    const { errors, warnings } = await this.createProgramForPackage(packageDir, tsFiles);

    const compilationTime = Date.now() - startTime;
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsage = finalMemory - initialMemory;

    // Test incremental compilation if supported
    let incrementalBuildTime: number | undefined;
    try {
      incrementalBuildTime = await this.measureIncrementalBuild(packageDir);
    } catch (_error) {
      // Intentionally ignore - incremental build is optional
    }

    return {
      packageName,
      totalFiles: tsFiles.length,
      compilationTime,
      memoryUsage,
      errors,
      warnings,
      incrementalBuildTime,
    };
  }

  private async createProgramForPackage(
    packageDir: string,
    files: string[]
  ): Promise<{ program: ts.Program; errors: CompilationError[]; warnings: CompilationWarning[] }> {
    // Look for package-specific tsconfig, fallback to base config
    const packageTsConfig = path.join(packageDir, 'tsconfig.json');
    const baseTsConfig = path.join(this.workspaceRoot, 'tsconfig.base.json');
    const configPath = fs.existsSync(packageTsConfig) ? packageTsConfig : baseTsConfig;

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(`Error reading TypeScript config: ${configFile.error.messageText}`);
    }

    const { options, errors: configErrors } = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      packageDir
    );

    // Create program
    const program = ts.createProgram(files, options);

    // Get diagnostics
    const allDiagnostics = [
      ...configErrors,
      ...program.getOptionsDiagnostics(),
      ...program.getGlobalDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ];

    const errors: CompilationError[] = [];
    const warnings: CompilationWarning[] = [];

    for (const diagnostic of allDiagnostics) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      const file = diagnostic.file ? diagnostic.file.fileName : 'unknown';

      let line = 0;
      let column = 0;

      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line: lineNum, character } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start
        );
        line = lineNum + 1;
        column = character + 1;
      }

      const diagnosticItem = {
        file: path.relative(this.workspaceRoot, file),
        line,
        column,
        message,
        code: diagnostic.code,
      };

      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        errors.push(diagnosticItem);
      } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
        warnings.push(diagnosticItem);
      }
    }

    return { program, errors, warnings };
  }

  private async measureIncrementalBuild(packageDir: string): Promise<number> {
    const packageName = this.getPackageName(packageDir);

    // CodeQL fix: Validate package name to prevent command injection (Alert #97)
    if (!/^@?[a-z0-9-]+\/[a-z0-9-]+$/.test(packageName)) {
      throw new Error(`Invalid package name format: ${packageName}`);
    }

    try {
      // Use turbo to measure incremental build if available
      const startTime = Date.now();
      await execAsync(`pnpm turbo run build --filter=${packageName}`, {
        cwd: this.workspaceRoot,
        timeout: 30000, // 30 second timeout
      });
      return Date.now() - startTime;
    } catch (_error) {
      // Fallback to direct TypeScript compilation
      const startTime = Date.now();
      await execAsync('npx tsc --noEmit --incremental', {
        cwd: packageDir,
        timeout: 30000,
      });
      return Date.now() - startTime;
    }
  }

  private async getTypeScriptFiles(packageDir: string): Promise<string[]> {
    const files: string[] = [];
    const srcDir = path.join(packageDir, 'src');

    if (!fs.existsSync(srcDir)) {
      return files;
    }

    const scanDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.includes('node_modules')) {
          scanDirectory(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      }
    };

    scanDirectory(srcDir);
    return files;
  }

  private async getPackageDirectories(): Promise<string[]> {
    const packagesDir = path.join(this.workspaceRoot, 'packages');
    const packages: string[] = [];

    // Get main packages
    const mainPackages = ['backend', 'frontend', 'shared'];
    for (const pkg of mainPackages) {
      const pkgPath = path.join(packagesDir, pkg);
      if (fs.existsSync(pkgPath)) {
        packages.push(pkgPath);
      }
    }

    // Get @klikkflow packages
    const klikkflowDir = path.join(packagesDir, '@klikkflow');
    if (fs.existsSync(klikkflowDir)) {
      const klikkflowPackages = fs
        .readdirSync(klikkflowDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => path.join(klikkflowDir, dirent.name));
      packages.push(...klikkflowPackages);
    }

    return packages;
  }

  private getPackageName(packageDir: string): string {
    const packageJsonPath = path.join(packageDir, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.name || path.basename(packageDir);
      } catch (_error) {
        // Intentionally ignore - fallback to directory basename
      }
    }

    return path.basename(packageDir);
  }
}
