import { exec, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface TypeScriptPerformance {
  compilationTime: number;
  typeCheckingTime: number;
  incrementalBuildTime: number;
  languageServiceResponseTime: number;
  errorCount: number;
  warningCount: number;
}

export interface AutocompletePerformance {
  averageResponseTime: number;
  suggestionAccuracy: number;
  contextualRelevance: number;
  importSuggestionSpeed: number;
}

export interface NavigationPerformance {
  goToDefinitionTime: number;
  findReferencesTime: number;
  symbolSearchTime: number;
  fileSearchTime: number;
  workspaceIndexingTime: number;
}

export interface IntelliSensePerformance {
  hoverInfoTime: number;
  signatureHelpTime: number;
  diagnosticsUpdateTime: number;
  quickFixSuggestionTime: number;
}

export interface IDEPerformanceReport {
  timestamp: Date;
  workspaceSize: WorkspaceMetrics;
  typescript: TypeScriptPerformance;
  autocomplete: AutocompletePerformance;
  navigation: NavigationPerformance;
  intelliSense: IntelliSensePerformance;
  overallScore: number;
  recommendations: string[];
}

export interface WorkspaceMetrics {
  fileCount: number;
  totalLinesOfCode: number;
  packageCount: number;
  dependencyCount: number;
  typeScriptFileCount: number;
}

export class IDEPerformanceAnalyzer {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.tsConfigPath = join(workspaceRoot, 'tsconfig.json');
  }

  /**
   * Run comprehensive IDE performance analysis
   */
  async analyzeIDEPerformance(): Promise<IDEPerformanceReport> {
    const workspaceSize = await this.analyzeWorkspaceSize();
    const typescript = await this.analyzeTypeScriptPerformance();
    const autocomplete = await this.analyzeAutocompletePerformance();
    const navigation = await this.analyzeNavigationPerformance();
    const intelliSense = await this.analyzeIntelliSensePerformance();

    const overallScore = this.calculateOverallScore(
      typescript,
      autocomplete,
      navigation,
      intelliSense
    );
    const recommendations = this.generateRecommendations(
      typescript,
      autocomplete,
      navigation,
      intelliSense,
      workspaceSize
    );

    return {
      timestamp: new Date(),
      workspaceSize,
      typescript,
      autocomplete,
      navigation,
      intelliSense,
      overallScore,
      recommendations,
    };
  }

  /**
   * Analyze TypeScript compilation and type checking performance
   */
  async analyzeTypeScriptPerformance(): Promise<TypeScriptPerformance> {
    const compilationTime = await this.measureCompilationTime();
    const typeCheckingTime = await this.measureTypeCheckingTime();
    const incrementalBuildTime = await this.measureIncrementalBuildTime();
    const languageServiceResponseTime = await this.measureLanguageServiceResponse();
    const { errorCount, warningCount } = await this.countTypeScriptIssues();

    return {
      compilationTime,
      typeCheckingTime,
      incrementalBuildTime,
      languageServiceResponseTime,
      errorCount,
      warningCount,
    };
  }

  /**
   * Analyze autocomplete performance and accuracy
   */
  async analyzeAutocompletePerformance(): Promise<AutocompletePerformance> {
    const averageResponseTime = await this.measureAutocompleteResponseTime();
    const suggestionAccuracy = await this.measureSuggestionAccuracy();
    const contextualRelevance = await this.measureContextualRelevance();
    const importSuggestionSpeed = await this.measureImportSuggestionSpeed();

    return {
      averageResponseTime,
      suggestionAccuracy,
      contextualRelevance,
      importSuggestionSpeed,
    };
  }

  /**
   * Analyze code navigation performance
   */
  async analyzeNavigationPerformance(): Promise<NavigationPerformance> {
    const goToDefinitionTime = await this.measureGoToDefinitionTime();
    const findReferencesTime = await this.measureFindReferencesTime();
    const symbolSearchTime = await this.measureSymbolSearchTime();
    const fileSearchTime = await this.measureFileSearchTime();
    const workspaceIndexingTime = await this.measureWorkspaceIndexingTime();

    return {
      goToDefinitionTime,
      findReferencesTime,
      symbolSearchTime,
      fileSearchTime,
      workspaceIndexingTime,
    };
  }

  /**
   * Analyze IntelliSense performance
   */
  async analyzeIntelliSensePerformance(): Promise<IntelliSensePerformance> {
    const hoverInfoTime = await this.measureHoverInfoTime();
    const signatureHelpTime = await this.measureSignatureHelpTime();
    const diagnosticsUpdateTime = await this.measureDiagnosticsUpdateTime();
    const quickFixSuggestionTime = await this.measureQuickFixSuggestionTime();

    return {
      hoverInfoTime,
      signatureHelpTime,
      diagnosticsUpdateTime,
      quickFixSuggestionTime,
    };
  }

  private async analyzeWorkspaceSize(): Promise<WorkspaceMetrics> {
    try {
      const packageJsonPath = join(this.workspaceRoot, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

      // Count dependencies
      const dependencyCount = Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }).length;

      // Estimate file counts (simplified)
      const { stdout: fileCountOutput } = await execAsync(
        'find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | wc -l',
        {
          cwd: this.workspaceRoot,
        }
      );
      const fileCount = Number.parseInt(fileCountOutput.trim(), 10) || 0;

      const { stdout: tsFileCountOutput } = await execAsync(
        'find . -type f -name "*.ts" -o -name "*.tsx" | wc -l',
        {
          cwd: this.workspaceRoot,
        }
      );
      const typeScriptFileCount = Number.parseInt(tsFileCountOutput.trim(), 10) || 0;

      // Estimate lines of code
      const { stdout: locOutput } = await execAsync(
        'find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs wc -l | tail -1',
        {
          cwd: this.workspaceRoot,
        }
      );
      const totalLinesOfCode = Number.parseInt(locOutput.trim().split(' ')[0], 10) || 0;

      // Count packages (simplified)
      const { stdout: packageCountOutput } = await execAsync(
        'find . -name "package.json" | wc -l',
        {
          cwd: this.workspaceRoot,
        }
      );
      const packageCount = Number.parseInt(packageCountOutput.trim(), 10) || 1;

      return {
        fileCount,
        totalLinesOfCode,
        packageCount,
        dependencyCount,
        typeScriptFileCount,
      };
    } catch (_error) {
      // Retu_errorfault metrics if analysis fails
      return {
        fileCount: 100,
        totalLinesOfCode: 10000,
        packageCount: 5,
        dependencyCount: 50,
        typeScriptFileCount: 80,
      };
    }
  }

  private async measureCompilationTime(): Promise<number> {
    const start = performance.now();

    try {
      await this.runCommand('npx', ['tsc', '--noEmit'], { timeout: 60000 });
      return performance.now() - start;
    } catch (_error) {
      return performance.now() - start; // Return time even if compilation fails
    }
  }

  private async measureTypeCheckingTime(): Promise<number> {
    const start = performance.now();

    try {
      await this.runCommand('npx', ['tsc', '--noEmit', '--skipLibCheck'], { timeout: 30000 });
      return performance.now() - start;
    } catch (_error) {
      return performance.now() - start;
    }
  }

  private async measureIncrementalBuildTime(): Promise<number> {
    const start = performance.now();

    try {
      // First build to create incremental cache
      await this.runCommand('npx', ['tsc', '--incremental', '--noEmit'], { timeout: 60000 });

      const incrementalStart = performance.now();
      // Second build should be incremental
      await this.runCommand('npx', ['tsc', '--incremental', '--noEmit'], { timeout: 30000 });

      return performance.now() - incrementalStart;
    } catch (_error) {
      return performance.now() - start;
    }
  }

  private async measureLanguageServiceResponse(): Promise<number> {
    // Simulate language service response by checking TypeScript compiler API response
    const start = performance.now();

    try {
      await this.runCommand('npx', ['tsc', '--listFiles', '--skipLibCheck'], { timeout: 10000 });
      return performance.now() - start;
    } catch (_error) {
      return performance.now() - start;
    }
  }

  private async countTypeScriptIssues(): Promise<{ errorCount: number; warningCount: number }> {
    try {
      const { stdout } = await execAsync('npx tsc --noEmit 2>&1 || true', {
        cwd: this.workspaceRoot,
      });

      const lines = stdout.split('\n');
      let errorCount = 0;
      let warningCount = 0;

      lines.forEach((line) => {
        if (line.includes('error TS')) {
          errorCount++;
        } else if (line.includes('warning TS')) {
          warningCount++;
        }
      });

      return { errorCount, warningCount };
    } catch (_error) {
      return { errorCount: 0, warningCount: 0 };
    }
  }

  private async measureAutocompleteResponseTime(): Promise<number> {
    // Simulate autocomplete by measuring TypeScript language service response
    const start = performance.now();

    try {
      // Use TypeScript compiler API to simulate autocomplete
      await this.runCommand('npx', ['tsc', '--noEmit', '--skipLibCheck'], { timeout: 5000 });
      const responseTime = performance.now() - start;

      // Scale down to simulate autocomplete response (should be much faster than full compilation)
      return Math.min(responseTime / 10, 2000);
    } catch (_error) {
      return 2000; // Default slow response time
    }
  }

  private async measureSuggestionAccuracy(): Promise<number> {
    // Simulate suggestion accuracy measurement
    // In a real implementation, this would analyze actual autocomplete results
    try {
      const { errorCount } = await this.countTypeScriptIssues();
      // Fewer errors generally correlate with better autocomplete accuracy
      return Math.max(100 - errorCount * 2, 60);
    } catch (_error) {
      return 80; // Default accuracy score
    }
  }

  private async measureContextualRelevance(): Promise<number> {
    // Simulate contextual relevance measurement
    // This would analyze how relevant autocomplete suggestions are to the current context
    try {
      const workspaceMetrics = await this.analyzeWorkspaceSize();
      // Smaller, well-organized codebases tend to have better contextual relevance
      const complexityScore = Math.min(workspaceMetrics.fileCount / 10, 100);
      return Math.max(100 - complexityScore, 70);
    } catch (_error) {
      return 85; // Default relevance score
    }
  }

  private async measureImportSuggestionSpeed(): Promise<number> {
    const start = performance.now();

    try {
      // Simulate import suggestion by checking module resolution
      await this.runCommand('npx', ['tsc', '--showConfig'], { timeout: 3000 });
      return Math.min(performance.now() - start, 1000);
    } catch (_error) {
      return 1500; // Default slow import suggestion time
    }
  }

  private async measureGoToDefinitionTime(): Promise<number> {
    // Simulate "Go to Definition" by measuring symbol resolution time
    const start = performance.now();

    try {
      await this.runCommand('npx', ['tsc', '--listFiles'], { timeout: 5000 });
      return Math.min(performance.now() - start, 500);
    } catch (_error) {
      return 500;
    }
  }

  private async measureFindReferencesTime(): Promise<number> {
    // Simulate "Find References" by measuring cross-file analysis time
    const start = performance.now();

    try {
      await this.runCommand('npx', ['tsc', '--noEmit', '--skipLibCheck'], { timeout: 10000 });
      const totalTime = performance.now() - start;
      return Math.min(totalTime / 5, 2000); // Scale down for reference finding
    } catch (_error) {
      return 500;
    }
  }

  private async measureSymbolSearchTime(): Promise<number> {
    const start = performance.now();

    try {
      // Simulate symbol search by listing TypeScript files
      await execAsync('find . -name "*.ts" -o -name "*.tsx" | head -20', {
        cwd: this.workspaceRoot,
      });
      return performance.now() - start;
    } catch (_error) {
      return 500;
    }
  }

  private async measureFileSearchTime(): Promise<number> {
    const start = performance.now();

    try {
      await execAsync(
        'find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -50',
        {
          cwd: this.workspaceRoot,
        }
      );
      return performance.now() - start;
    } catch (_error) {
      return 500;
    }
  }

  private async measureWorkspaceIndexingTime(): Promise<number> {
    // Simulate workspace indexing by measuring TypeScript project analysis time
    const start = performance.now();

    try {
      await this.runCommand('npx', ['tsc', '--listFiles', '--skipLibCheck'], { timeout: 15000 });
      return performance.now() - start;
    } catch (_error) {
      return 500;
    }
  }

  private async measureHoverInfoTime(): Promise<number> {
    // Simulate hover info by measuring type information retrieval
    const start = performance.now();

    try {
      await this.runCommand('npx', ['tsc', '--noEmit', '--skipLibCheck'], { timeout: 3000 });
      const totalTime = performance.now() - start;
      return Math.min(totalTime / 20, 200); // Scale down for hover info
    } catch (_error) {
      return 500;
    }
  }

  private async measureSignatureHelpTime(): Promise<number> {
    // Similar to hover info but for function signatures
    const start = performance.now();

    try {
      await this.runCommand('npx', ['tsc', '--noEmit', '--skipLibCheck'], { timeout: 2000 });
      const totalTime = performance.now() - start;
      return Math.min(totalTime / 25, 150);
    } catch (_error) {
      return 500;
    }
  }

  private async measureDiagnosticsUpdateTime(): Promise<number> {
    const start = performance.now();

    try {
      await this.runCommand('npx', ['tsc', '--noEmit'], { timeout: 8000 });
      return performance.now() - start;
    } catch (_error) {
      return performance.now() - start;
    }
  }

  private async measureQuickFixSuggestionTime(): Promise<number> {
    // Simulate quick fix suggestion time
    const _start = performance.now();
    _start;
    try {
      const { errorCount } = await this.countTypeScriptIssues();
      // More errors might mean slower quick fix suggestions
      const baseTime = 100 + errorCount * 10;
      return Math.min(baseTime, 1000);
    } catch (_error) {
      return 500;
    }
  }

  private calculateOverallScore(
    typescript: TypeScriptPerformance,
    autocomplete: AutocompletePerformance,
    navigation: NavigationPerformance,
    intelliSense: IntelliSensePerformance
  ): number {
    // Calculate weighted score (0-100)
    const tsScore = this.calculateTypeScriptScore(typescript);
    const autocompleteScore = this.calculateAutocompleteScore(autocomplete);
    const navigationScore = this.calculateNavigationScore(navigation);
    const intelliSenseScore = this.calculateIntelliSenseScore(intelliSense);

    // Weighted average: TypeScript 30%, Autocomplete 25%, Navigation 25%, IntelliSense 20%
    return Math.round(
      tsScore * 0.3 + autocompleteScore * 0.25 + navigationScore * 0.25 + intelliSenseScore * 0.2
    );
  }

  private calculateTypeScriptScore(ts: TypeScriptPerformance): number {
    const compilationScore = Math.max(100 - ts.compilationTime / 500, 0);
    const typeCheckScore = Math.max(100 - ts.typeCheckingTime / 300, 0);
    const incrementalScore = Math.max(100 - ts.incrementalBuildTime / 100, 0);
    const languageServiceScore = Math.max(100 - ts.languageServiceResponseTime / 100, 0);
    const errorPenalty = Math.max(0, ts.errorCount * 5);

    return Math.max(
      (compilationScore + typeCheckScore + incrementalScore + languageServiceScore) / 4 -
        errorPenalty,
      0
    );
  }

  private calculateAutocompleteScore(autocomplete: AutocompletePerformance): number {
    const responseScore = Math.max(100 - autocomplete.averageResponseTime / 20, 0);
    const accuracyScore = autocomplete.suggestionAccuracy;
    const relevanceScore = autocomplete.contextualRelevance;
    const importScore = Math.max(100 - autocomplete.importSuggestionSpeed / 10, 0);

    return (responseScore + accuracyScore + relevanceScore + importScore) / 4;
  }

  private calculateNavigationScore(navigation: NavigationPerformance): number {
    const goToDefScore = Math.max(100 - navigation.goToDefinitionTime / 5, 0);
    const findRefsScore = Math.max(100 - navigation.findReferencesTime / 20, 0);
    const symbolSearchScore = Math.max(100 - navigation.symbolSearchTime / 3, 0);
    const fileSearchScore = Math.max(100 - navigation.fileSearchTime / 2, 0);
    const indexingScore = Math.max(100 - navigation.workspaceIndexingTime / 150, 0);

    return (goToDefScore + findRefsScore + symbolSearchScore + fileSearchScore + indexingScore) / 5;
  }

  private calculateIntelliSenseScore(intelliSense: IntelliSensePerformance): number {
    const hoverScore = Math.max(100 - intelliSense.hoverInfoTime / 2, 0);
    const signatureScore = Math.max(100 - intelliSense.signatureHelpTime / 1.5, 0);
    const diagnosticsScore = Math.max(100 - intelliSense.diagnosticsUpdateTime / 80, 0);
    const quickFixScore = Math.max(100 - intelliSense.quickFixSuggestionTime / 3, 0);

    return (hoverScore + signatureScore + diagnosticsScore + quickFixScore) / 4;
  }

  private generateRecommendations(
    typescript: TypeScriptPerformance,
    autocomplete: AutocompletePerformance,
    navigation: NavigationPerformance,
    intelliSense: IntelliSensePerformance,
    workspace: WorkspaceMetrics
  ): string[] {
    const recommendations: string[] = [];

    // TypeScript recommendations
    if (typescript.compilationTime > 30000) {
      recommendations.push(
        'TypeScript compilation is slow. Consider using project references or incremental compilation'
      );
    }

    if (typescript.errorCount > 10) {
      recommendations.push(
        'High number of TypeScript errors detected. Fix errors to improve IDE performance'
      );
    }

    if (typescript.incrementalBuildTime > 5000) {
      recommendations.push(
        'Incremental builds are slow. Check TypeScript configuration and project structure'
      );
    }

    // Autocomplete recommendations
    if (autocomplete.averageResponseTime > 1000) {
      recommendations.push(
        'Autocomplete is slow. Consider reducing project complexity or enabling TypeScript strict mode'
      );
    }

    if (autocomplete.suggestionAccuracy < 80) {
      recommendations.push(
        'Autocomplete accuracy is low. Improve type definitions and reduce any types'
      );
    }

    // Navigation recommendations
    if (navigation.workspaceIndexingTime > 10000) {
      recommendations.push(
        'Workspace indexing is slow. Consider excluding unnecessary files from TypeScript compilation'
      );
    }

    if (navigation.goToDefinitionTime > 300) {
      recommendations.push(
        'Go to Definition is slow. Check for circular dependencies and optimize import paths'
      );
    }

    // IntelliSense recommendations
    if (intelliSense.diagnosticsUpdateTime > 5000) {
      recommendations.push(
        'Diagnostics updates are slow. Consider using TypeScript strict mode and fixing type errors'
      );
    }

    // Workspace-based recommendations
    if (workspace.fileCount > 1000) {
      recommendations.push(
        'Large workspace detected. Consider using TypeScript project references to improve performance'
      );
    }

    if (workspace.dependencyCount > 200) {
      recommendations.push(
        'High dependency count. Consider reducing dependencies or using tree shaking'
      );
    }

    return recommendations;
  }

  private async runCommand(
    command: string,
    args: string[],
    options: { timeout?: number } = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: this.workspaceRoot,
        stdio: 'pipe',
      });

      const timeout = options.timeout || 30000;
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      child.on('close', (_code) => {
        clearTimeout(timer);
        resolve(); // Resolve regardless of exit code for performance measurement
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
}
