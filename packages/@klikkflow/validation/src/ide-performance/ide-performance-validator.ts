import { IntelliSenseTester } from './intellisense-tester';
import { NavigationTester } from './navigation-tester';
import { SourceMappingValidator } from './source-mapping-validator';
import type { IDEPerformanceReport } from './types';

export class IDEPerformanceValidator {
  public navigationTester: NavigationTester;
  public intelliSenseTester: IntelliSenseTester;
  public sourceMappingValidator: SourceMappingValidator;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.navigationTester = new NavigationTester(workspaceRoot);
    this.intelliSenseTester = new IntelliSenseTester(workspaceRoot);
    this.sourceMappingValidator = new SourceMappingValidator(workspaceRoot);
  }

  async validateIDEPerformance(): Promise<IDEPerformanceReport> {
    const _startTime = Date.now();
    const navigationResults = await this.navigationTester.runNavigationTests();
    const intelliSenseResults = await this.intelliSenseTester.runIntelliSenseTests();
    const sourceMappingResults = await this.sourceMappingValidator.validateSourceMapping();

    const _endTime = Date.now();

    // Calculate performance metrics
    const performanceMetrics = this.calculatePerformanceMetrics(
      navigationResults,
      intelliSenseResults,
      sourceMappingResults
    );

    // Calculate overall score
    const overallScore = this.calculateOverallScore(performanceMetrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      navigationResults,
      intelliSenseResults,
      sourceMappingResults,
      performanceMetrics
    );

    return {
      timestamp: new Date(),
      navigationResults,
      intelliSenseResults,
      sourceMappingResults,
      overallScore,
      recommendations,
      performanceMetrics,
    };
  }

  private calculatePerformanceMetrics(
    navigationResults: any[],
    intelliSenseResults: any[],
    sourceMappingResults: any[]
  ) {
    // Navigation metrics
    const successfulNavigations = navigationResults.filter((r) => r.successful);
    const averageNavigationTime =
      successfulNavigations.length > 0
        ? successfulNavigations.reduce((sum, r) => sum + r.navigationTime, 0) /
          successfulNavigations.length
        : 0;
    const navigationSuccessRate =
      navigationResults.length > 0 ? successfulNavigations.length / navigationResults.length : 0;

    // IntelliSense metrics
    const successfulIntelliSense = intelliSenseResults.filter((r) => r.successful);
    const averageIntelliSenseTime =
      successfulIntelliSense.length > 0
        ? successfulIntelliSense.reduce((sum, r) => sum + r.responseTime, 0) /
          successfulIntelliSense.length
        : 0;
    const intelliSenseAccuracy =
      intelliSenseResults.length > 0
        ? intelliSenseResults.reduce((sum, r) => sum + r.accuracy, 0) / intelliSenseResults.length
        : 0;

    // Source mapping metrics
    const reliableSourceMappings = sourceMappingResults.filter(
      (r) => r.sourceMappingAccurate && r.debuggingExperience !== 'broken'
    );
    const sourceMappingReliability =
      sourceMappingResults.length > 0
        ? reliableSourceMappings.length / sourceMappingResults.length
        : 0;

    return {
      averageNavigationTime,
      averageIntelliSenseTime,
      navigationSuccessRate,
      intelliSenseAccuracy,
      sourceMappingReliability,
    };
  }

  private calculateOverallScore(performanceMetrics: any): number {
    // Navigation score (0-30 points)
    const navigationScore = Math.min(
      30,
      performanceMetrics.navigationSuccessRate * 20 +
        Math.max(0, (2000 - performanceMetrics.averageNavigationTime) / 2000) * 10
    );

    // IntelliSense score (0-40 points)
    const intelliSenseScore = Math.min(
      40,
      (performanceMetrics.intelliSenseAccuracy / 100) * 25 +
        Math.max(0, (1000 - performanceMetrics.averageIntelliSenseTime) / 1000) * 15
    );

    // Source mapping score (0-30 points)
    const sourceMappingScore = performanceMetrics.sourceMappingReliability * 30;

    return Math.round(navigationScore + intelliSenseScore + sourceMappingScore);
  }

  private generateRecommendations(
    _navigationResults: any[],
    _intelliSenseResults: any[],
    sourceMappingResults: any[],
    performanceMetrics: any
  ): string[] {
    const recommendations: string[] = [];

    // Navigation recommendations
    if (performanceMetrics.navigationSuccessRate < 0.8) {
      recommendations.push(
        `Improve navigation reliability: ${Math.round((1 - performanceMetrics.navigationSuccessRate) * 100)}% of navigation tests failed. ` +
          'Check TypeScript configuration and ensure proper module resolution.'
      );
    }

    if (performanceMetrics.averageNavigationTime > 1000) {
      recommendations.push(
        `Optimize navigation speed: Average navigation time is ${Math.round(performanceMetrics.averageNavigationTime)}ms. ` +
          'Consider optimizing TypeScript project references and reducing compilation overhead.'
      );
    }

    // IntelliSense recommendations
    if (performanceMetrics.intelliSenseAccuracy < 70) {
      recommendations.push(
        `Enhance IntelliSense accuracy: Current accuracy is ${Math.round(performanceMetrics.intelliSenseAccuracy)}%. ` +
          'Review type definitions and ensure proper export/import patterns.'
      );
    }

    if (performanceMetrics.averageIntelliSenseTime > 500) {
      recommendations.push(
        `Improve IntelliSense response time: Average response time is ${Math.round(performanceMetrics.averageIntelliSenseTime)}ms. ` +
          'Consider enabling incremental compilation and optimizing TypeScript configuration.'
      );
    }

    // Source mapping recommendations
    if (performanceMetrics.sourceMappingReliability < 0.9) {
      recommendations.push(
        `Fix source mapping issues: ${Math.round((1 - performanceMetrics.sourceMappingReliability) * 100)}% of source mappings are unreliable. ` +
          'Ensure source maps are generated correctly and paths are properly configured.'
      );
    }

    // Check for specific issues
    const brokenSourceMappings = sourceMappingResults.filter(
      (r) => r.debuggingExperience === 'broken'
    );
    if (brokenSourceMappings.length > 0) {
      recommendations.push(
        `Critical: ${brokenSourceMappings.length} source mappings are completely broken. ` +
          'This severely impacts debugging experience and should be fixed immediately.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('IDE performance is excellent. Continue monitoring for regressions.');
    }

    return recommendations;
  }
}
