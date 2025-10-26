/**
 * Plugin Validator Service
 * Handles security scanning, code analysis, and quality validation for plugins
 */

import { Logger } from '@klikkflow/core';
import { z } from 'zod';
import type { PluginMetadata, PluginPackage } from './plugin-registry';

// Validation result schemas
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(
    z.object({
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      category: z.enum(['security', 'performance', 'compatibility', 'quality']),
      message: z.string(),
      file: z.string().optional(),
      line: z.number().optional(),
    })
  ),
  recommendations: z.array(z.string()),
  securityScan: z.object({
    passed: z.boolean(),
    vulnerabilities: z.array(
      z.object({
        type: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        description: z.string(),
      })
    ),
  }),
  performanceMetrics: z.object({
    bundleSize: z.number(),
    loadTime: z.number().optional(),
    memoryUsage: z.number().optional(),
  }),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Security patterns to detect
const SECURITY_PATTERNS = [
  {
    pattern: /eval\s*\(/gi,
    severity: 'critical' as const,
    message: 'Use of eval() function detected - potential code injection vulnerability',
  },
  {
    pattern: /Function\s*\(/gi,
    severity: 'high' as const,
    message: 'Dynamic function creation detected - potential security risk',
  },
  {
    pattern: /document\.write/gi,
    severity: 'medium' as const,
    message: 'Use of document.write() detected - potential XSS vulnerability',
  },
  {
    pattern: /innerHTML\s*=/gi,
    severity: 'medium' as const,
    message: 'Direct innerHTML assignment detected - potential XSS vulnerability',
  },
  {
    pattern: /process\.env/gi,
    severity: 'low' as const,
    message: 'Environment variable access detected - ensure proper sanitization',
  },
];

// Performance patterns to detect
const PERFORMANCE_PATTERNS = [
  {
    pattern: /while\s*\(\s*true\s*\)/gi,
    severity: 'high' as const,
    message: 'Infinite loop detected - potential performance issue',
  },
  {
    pattern: /setInterval\s*\(/gi,
    severity: 'medium' as const,
    message: 'setInterval usage detected - ensure proper cleanup',
  },
  {
    pattern: /setTimeout\s*\(/gi,
    severity: 'low' as const,
    message: 'setTimeout usage detected - consider performance implications',
  },
];

export class PluginValidator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('PluginValidator');
  }

  /**
   * Validate a plugin package comprehensively
   */
  async validatePlugin(pluginPackage: PluginPackage): Promise<ValidationResult> {
    try {
      this.logger.info(`Starting validation for plugin: ${pluginPackage.metadata.id}`);

      const issues: ValidationResult['issues'] = [];
      const recommendations: string[] = [];

      // 1. Security validation
      const securityScan = await this.performSecurityScan(pluginPackage);
      if (!securityScan.passed) {
        issues.push(
          ...securityScan.vulnerabilities.map((vuln) => ({
            severity: vuln.severity,
            category: 'security' as const,
            message: vuln.description,
          }))
        );
      }

      // 2. Code quality validation
      const qualityIssues = await this.validateCodeQuality(pluginPackage);
      issues.push(...qualityIssues);

      // 3. Compatibility validation
      const compatibilityIssues = await this.validateCompatibility(pluginPackage);
      issues.push(...compatibilityIssues);

      // 4. Performance validation
      const performanceMetrics = await this.analyzePerformance(pluginPackage);
      const performanceIssues = await this.validatePerformance(pluginPackage, performanceMetrics);
      issues.push(...performanceIssues);

      // 5. Generate recommendations
      recommendations.push(...this.generateRecommendations(issues, pluginPackage.metadata));

      // Calculate overall score
      const score = this.calculateValidationScore(issues, performanceMetrics);

      const result: ValidationResult = {
        isValid: issues.filter((i) => i.severity === 'critical').length === 0,
        score,
        issues,
        recommendations,
        securityScan,
        performanceMetrics,
      };

      this.logger.info(
        `Validation completed for plugin: ${pluginPackage.metadata.id}, Score: ${score}`
      );
      return result;
    } catch (error) {
      this.logger.error('Plugin validation failed:', error);
      throw error;
    }
  }

  /**
   * Perform security scanning on plugin code
   */
  private async performSecurityScan(
    pluginPackage: PluginPackage
  ): Promise<ValidationResult['securityScan']> {
    const vulnerabilities: ValidationResult['securityScan']['vulnerabilities'] = [];

    try {
      // Decode and analyze plugin bundle
      const bundleContent = Buffer.from(pluginPackage.bundle, 'base64').toString('utf-8');

      // Check for security patterns
      for (const pattern of SECURITY_PATTERNS) {
        const matches = bundleContent.match(pattern.pattern);
        if (matches) {
          vulnerabilities.push({
            type: 'code_pattern',
            severity: pattern.severity,
            description: pattern.message,
          });
        }
      }

      // Check for suspicious imports
      const suspiciousImports = [
        'child_process',
        'fs',
        'path',
        'os',
        'crypto',
        'net',
        'http',
        'https',
      ];

      for (const importName of suspiciousImports) {
        const importPattern = new RegExp(
          `require\\s*\\(\\s*['"\`]${importName}['"\`]\\s*\\)`,
          'gi'
        );
        if (importPattern.test(bundleContent)) {
          vulnerabilities.push({
            type: 'suspicious_import',
            severity: 'medium',
            description: `Potentially dangerous import detected: ${importName}`,
          });
        }
      }

      return {
        passed:
          vulnerabilities.filter((v) => v.severity === 'critical' || v.severity === 'high')
            .length === 0,
        vulnerabilities,
      };
    } catch (error) {
      this.logger.error('Security scan failed:', error);
      return {
        passed: false,
        vulnerabilities: [
          {
            type: 'scan_error',
            severity: 'high',
            description: 'Failed to perform security scan',
          },
        ],
      };
    }
  }

  /**
   * Validate code quality and best practices
   */
  private async validateCodeQuality(
    pluginPackage: PluginPackage
  ): Promise<ValidationResult['issues']> {
    const issues: ValidationResult['issues'] = [];

    try {
      const bundleContent = Buffer.from(pluginPackage.bundle, 'base64').toString('utf-8');

      // Check for console.log statements (should use proper logging)
      if (/console\.(log|warn|error|info)/gi.test(bundleContent)) {
        issues.push({
          severity: 'low',
          category: 'quality',
          message: 'Console statements detected - use proper logging instead',
        });
      }

      // Check for TODO/FIXME comments
      if (/\/\/\s*(TODO|FIXME|HACK)/gi.test(bundleContent)) {
        issues.push({
          severity: 'low',
          category: 'quality',
          message: 'Unresolved TODO/FIXME comments found',
        });
      }

      // Check for proper error handling
      // CodeQL fix: Use simpler test to prevent ReDoS (Alert #118)
      if (!(bundleContent.includes('try') && bundleContent.includes('catch'))) {
        issues.push({
          severity: 'medium',
          category: 'quality',
          message: 'No error handling detected - consider adding try-catch blocks',
        });
      }

      return issues;
    } catch (error) {
      this.logger.error('Code quality validation failed:', error);
      return [
        {
          severity: 'medium',
          category: 'quality',
          message: 'Failed to validate code quality',
        },
      ];
    }
  }

  /**
   * Validate plugin compatibility with platform
   */
  private async validateCompatibility(
    pluginPackage: PluginPackage
  ): Promise<ValidationResult['issues']> {
    const issues: ValidationResult['issues'] = [];

    try {
      const { metadata, manifest } = pluginPackage;

      // Check version compatibility
      if (!metadata.compatibility.minVersion) {
        issues.push({
          severity: 'medium',
          category: 'compatibility',
          message: 'Minimum version requirement not specified',
        });
      }

      // Validate manifest structure
      if (!manifest.main) {
        issues.push({
          severity: 'high',
          category: 'compatibility',
          message: 'Main entry point not specified in manifest',
        });
      }

      // Check for required dependencies
      if (metadata.dependencies && metadata.dependencies.length > 0) {
        for (const dep of metadata.dependencies) {
          // TODO: Check if dependency is available in platform
          this.logger.debug(`Checking dependency: ${dep}`);
        }
      }

      return issues;
    } catch (error) {
      this.logger.error('Compatibility validation failed:', error);
      return [
        {
          severity: 'medium',
          category: 'compatibility',
          message: 'Failed to validate compatibility',
        },
      ];
    }
  }

  /**
   * Analyze plugin performance characteristics
   */
  private async analyzePerformance(
    pluginPackage: PluginPackage
  ): Promise<ValidationResult['performanceMetrics']> {
    try {
      const bundleBuffer = Buffer.from(pluginPackage.bundle, 'base64');

      return {
        bundleSize: bundleBuffer.length,
        loadTime: undefined, // Would require actual execution
        memoryUsage: undefined, // Would require actual execution
      };
    } catch (error) {
      this.logger.error('Performance analysis failed:', error);
      return {
        bundleSize: 0,
      };
    }
  }

  /**
   * Validate performance characteristics
   */
  private async validatePerformance(
    pluginPackage: PluginPackage,
    metrics: ValidationResult['performanceMetrics']
  ): Promise<ValidationResult['issues']> {
    const issues: ValidationResult['issues'] = [];

    try {
      const bundleContent = Buffer.from(pluginPackage.bundle, 'base64').toString('utf-8');

      // Check bundle size (warn if > 1MB)
      if (metrics.bundleSize > 1024 * 1024) {
        issues.push({
          severity: 'medium',
          category: 'performance',
          message: `Large bundle size detected: ${Math.round(metrics.bundleSize / 1024)} KB`,
        });
      }

      // Check for performance anti-patterns
      for (const pattern of PERFORMANCE_PATTERNS) {
        const matches = bundleContent.match(pattern.pattern);
        if (matches) {
          issues.push({
            severity: pattern.severity,
            category: 'performance',
            message: pattern.message,
          });
        }
      }

      return issues;
    } catch (error) {
      this.logger.error('Performance validation failed:', error);
      return [
        {
          severity: 'low',
          category: 'performance',
          message: 'Failed to validate performance',
        },
      ];
    }
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(
    issues: ValidationResult['issues'],
    metadata: PluginMetadata
  ): string[] {
    const recommendations: string[] = [];

    // Security recommendations
    const securityIssues = issues.filter((i) => i.category === 'security');
    if (securityIssues.length > 0) {
      recommendations.push('Review and fix security vulnerabilities before publishing');
      recommendations.push('Consider using safer alternatives to detected patterns');
    }

    // Performance recommendations
    const performanceIssues = issues.filter((i) => i.category === 'performance');
    if (performanceIssues.length > 0) {
      recommendations.push('Optimize code for better performance');
      recommendations.push('Consider code splitting for large bundles');
    }

    // Quality recommendations
    const qualityIssues = issues.filter((i) => i.category === 'quality');
    if (qualityIssues.length > 0) {
      recommendations.push('Improve code quality by addressing detected issues');
      recommendations.push('Add proper error handling and logging');
    }

    // General recommendations
    if (!metadata.documentation) {
      recommendations.push('Add comprehensive documentation for better user experience');
    }

    if (!metadata.repository) {
      recommendations.push('Provide repository link for transparency and community contributions');
    }

    return recommendations;
  }

  /**
   * Calculate overall validation score
   */
  private calculateValidationScore(
    issues: ValidationResult['issues'],
    metrics: ValidationResult['performanceMetrics']
  ): number {
    let score = 100;

    // Deduct points for issues based on severity
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    // Deduct points for large bundle size
    if (metrics.bundleSize > 1024 * 1024) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Quick validation for basic plugin structure
   */
  async quickValidate(
    pluginPackage: PluginPackage
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Basic structure validation
      if (!pluginPackage.metadata.id) {
        errors.push('Plugin ID is required');
      }

      if (!pluginPackage.metadata.name) {
        errors.push('Plugin name is required');
      }

      if (!pluginPackage.metadata.version) {
        errors.push('Plugin version is required');
      }

      if (!pluginPackage.bundle) {
        errors.push('Plugin bundle is required');
      }

      if (!pluginPackage.checksum) {
        errors.push('Plugin checksum is required');
      }

      if (!pluginPackage.manifest.main) {
        errors.push('Main entry point is required in manifest');
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      this.logger.error('Quick validation failed:', error);
      return {
        isValid: false,
        errors: ['Validation failed due to internal error'],
      };
    }
  }
}
