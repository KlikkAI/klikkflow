import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ProductivitySession {
  id: string;
  startTime: Date;
  endTime?: Date;
  activities: ProductivityActivity[];
  metrics: SessionMetrics;
}

export interface ProductivityActivity {
  type: 'coding' | 'debugging' | 'testing' | 'refactoring' | 'building' | 'researching';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  description?: string;
  success: boolean;
  errorCount?: number;
}

export interface SessionMetrics {
  totalDuration: number;
  codingTime: number;
  debuggingTime: number;
  testingTime: number;
  buildTime: number;
  errorResolutionTime: number;
  successfulBuilds: number;
  failedBuilds: number;
  testsRun: number;
  testsPassed: number;
  linesOfCodeChanged: number;
  filesModified: number;
}

export interface ProductivityTrends {
  averageSessionDuration: number;
  codingEfficiency: number; // coding time / total time
  debuggingRatio: number; // debugging time / coding time
  buildSuccessRate: number;
  testSuccessRate: number;
  dailyProductivity: DailyProductivity[];
  weeklyTrends: WeeklyTrend[];
}

export interface DailyProductivity {
  date: string;
  totalTime: number;
  codingTime: number;
  efficiency: number;
  buildCount: number;
  testCount: number;
}

export interface WeeklyTrend {
  week: string;
  averageEfficiency: number;
  totalCodingTime: number;
  improvementRate: number;
}

export class ProductivityTracker {
  private dataDir: string;
  private currentSession: ProductivitySession | null = null;
  private currentActivity: ProductivityActivity | null = null;

  constructor(workspaceRoot: string = process.cwd()) {
    this.dataDir = join(workspaceRoot, '.kiro', 'productivity-data');
  }

  /**
   * Start a new productivity tracking session
   */
  async startSession(sessionId?: string): Promise<string> {
    const id = sessionId || this.generateSessionId();

    this.currentSession = {
      id,
      startTime: new Date(),
      activities: [],
      metrics: this.initializeMetrics(),
    };

    await this.ensureDataDirectory();
    await this.saveSession();

    return id;
  }

  /**
   * End the current productivity session
   */
  async endSession(): Promise<ProductivitySession | null> {
    if (!this.currentSession) {
      return null;
    }

    // End any ongoing activity
    if (this.currentActivity) {
      await this.endActivity();
    }

    this.currentSession.endTime = new Date();
    this.currentSession.metrics = this.calculateSessionMetrics();

    await this.saveSession();

    const session = this.currentSession;
    this.currentSession = null;

    return session;
  }

  /**
   * Start tracking a specific activity
   */
  async startActivity(type: ProductivityActivity['type'], description?: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Start a session first.');
    }

    // End previous activity if exists
    if (this.currentActivity) {
      await this.endActivity();
    }

    this.currentActivity = {
      type,
      startTime: new Date(),
      description,
      success: false,
    };
  }

  /**
   * End the current activity
   */
  async endActivity(success: boolean = true, errorCount: number = 0): Promise<void> {
    if (!(this.currentActivity && this.currentSession)) {
      return;
    }

    this.currentActivity.endTime = new Date();
    this.currentActivity.duration =
      this.currentActivity.endTime.getTime() - this.currentActivity.startTime.getTime();
    this.currentActivity.success = success;
    this.currentActivity.errorCount = errorCount;

    this.currentSession.activities.push(this.currentActivity);
    this.currentActivity = null;

    await this.saveSession();
  }

  /**
   * Record a build event
   */
  async recordBuild(success: boolean, duration: number): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    await this.startActivity('building', `Build ${success ? 'succeeded' : 'failed'}`);

    // Simulate build activity duration
    setTimeout(
      async () => {
        await this.endActivity(success, success ? 0 : 1);

        if (success) {
          if (this.currentSession) {
            this.currentSession.metrics.successfulBuilds++;
          }
        } else if (this.currentSession) {
          this.currentSession.metrics.failedBuilds++;
        }
      },
      Math.min(duration, 100)
    ); // Don't actually wait for the full duration
  }

  /**
   * Record test execution
   */
  async recordTestRun(testsRun: number, testsPassed: number, duration: number): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    await this.startActivity('testing', `Ran ${testsRun} tests, ${testsPassed} passed`);

    setTimeout(
      async () => {
        await this.endActivity(testsPassed === testsRun, testsRun - testsPassed);

        if (this.currentSession) {
          this.currentSession.metrics.testsRun += testsRun;
          this.currentSession.metrics.testsPassed += testsPassed;
        }
      },
      Math.min(duration, 100)
    );
  }

  /**
   * Record code changes
   */
  recordCodeChanges(linesChanged: number, filesModified: number): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.metrics.linesOfCodeChanged += linesChanged;
    this.currentSession.metrics.filesModified += filesModified;
  }

  /**
   * Get productivity trends over time
   */
  async getProductivityTrends(days: number = 30): Promise<ProductivityTrends> {
    const sessions = await this.loadRecentSessions(days);

    if (sessions.length === 0) {
      return this.getEmptyTrends();
    }

    const averageSessionDuration = this.calculateAverageSessionDuration(sessions);
    const codingEfficiency = this.calculateCodingEfficiency(sessions);
    const debuggingRatio = this.calculateDebuggingRatio(sessions);
    const buildSuccessRate = this.calculateBuildSuccessRate(sessions);
    const testSuccessRate = this.calculateTestSuccessRate(sessions);
    const dailyProductivity = this.calculateDailyProductivity(sessions);
    const weeklyTrends = this.calculateWeeklyTrends(sessions);

    return {
      averageSessionDuration,
      codingEfficiency,
      debuggingRatio,
      buildSuccessRate,
      testSuccessRate,
      dailyProductivity,
      weeklyTrends,
    };
  }

  /**
   * Generate productivity report
   */
  async generateProductivityReport(days: number = 7): Promise<string> {
    const trends = await this.getProductivityTrends(days);
    const sessions = await this.loadRecentSessions(days);

    let report = `# Developer Productivity Report (Last ${days} days)\n\n`;

    report += `## Summary\n`;
    report += `- Total Sessions: ${sessions.length}\n`;
    report += `- Average Session Duration: ${Math.round(trends.averageSessionDuration / 60000)} minutes\n`;
    report += `- Coding Efficiency: ${(trends.codingEfficiency * 100).toFixed(1)}%\n`;
    report += `- Build Success Rate: ${(trends.buildSuccessRate * 100).toFixed(1)}%\n`;
    report += `- Test Success Rate: ${(trends.testSuccessRate * 100).toFixed(1)}%\n\n`;

    report += `## Daily Productivity\n`;
    trends.dailyProductivity.forEach((day) => {
      report += `- ${day.date}: ${Math.round(day.totalTime / 60000)}min total, `;
      report += `${Math.round(day.codingTime / 60000)}min coding, `;
      report += `${(day.efficiency * 100).toFixed(1)}% efficiency\n`;
    });

    report += `\n## Weekly Trends\n`;
    trends.weeklyTrends.forEach((week) => {
      report += `- Week ${week.week}: ${(week.averageEfficiency * 100).toFixed(1)}% avg efficiency, `;
      report += `${Math.round(week.totalCodingTime / 3600000)}h coding, `;
      report += `${week.improvementRate > 0 ? '+' : ''}${(week.improvementRate * 100).toFixed(1)}% improvement\n`;
    });

    report += `\n## Recommendations\n`;
    const recommendations = this.generateRecommendations(trends);
    recommendations.forEach((rec) => {
      report += `- ${rec}\n`;
    });

    return report;
  }

  private generateSessionId(): string {
    // CodeQL fix: Use cryptographically secure random (Alert #86)
    return `session_${Date.now()}_${crypto.randomUUID()}`;
  }

  private initializeMetrics(): SessionMetrics {
    return {
      totalDuration: 0,
      codingTime: 0,
      debuggingTime: 0,
      testingTime: 0,
      buildTime: 0,
      errorResolutionTime: 0,
      successfulBuilds: 0,
      failedBuilds: 0,
      testsRun: 0,
      testsPassed: 0,
      linesOfCodeChanged: 0,
      filesModified: 0,
    };
  }

  private calculateSessionMetrics(): SessionMetrics {
    if (!this.currentSession) {
      return this.initializeMetrics();
    }

    const metrics = { ...this.currentSession.metrics };

    metrics.totalDuration = this.currentSession.endTime
      ? this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime()
      : 0;

    // Calculate time spent on different activities
    this.currentSession.activities.forEach((activity) => {
      if (activity.duration) {
        switch (activity.type) {
          case 'coding':
            metrics.codingTime += activity.duration;
            break;
          case 'debugging':
            metrics.debuggingTime += activity.duration;
            if (!activity.success) {
              metrics.errorResolutionTime += activity.duration;
            }
            break;
          case 'testing':
            metrics.testingTime += activity.duration;
            break;
          case 'building':
            metrics.buildTime += activity.duration;
            break;
        }
      }
    });

    return metrics;
  }

  private async ensureDataDirectory(): Promise<void> {
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const filename = `${this.currentSession.id}.json`;
    const filepath = join(this.dataDir, filename);

    await writeFile(filepath, JSON.stringify(this.currentSession, null, 2));
  }

  private async loadRecentSessions(days: number): Promise<ProductivitySession[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const sessions: ProductivitySession[] = [];

      // In a real implementation, you'd read all session files
      // For now, return empty array as we don't have historical data
      return sessions;
    } catch (_error) {
      return [];
    }
  }

  private calculateAverageSessionDuration(sessions: ProductivitySession[]): number {
    if (sessions.length === 0) {
      return 0;
    }

    const totalDuration = sessions.reduce((sum, session) => sum + session.metrics.totalDuration, 0);
    return totalDuration / sessions.length;
  }

  private calculateCodingEfficiency(sessions: ProductivitySession[]): number {
    if (sessions.length === 0) {
      return 0;
    }

    const totalTime = sessions.reduce((sum, session) => sum + session.metrics.totalDuration, 0);
    const codingTime = sessions.reduce((sum, session) => sum + session.metrics.codingTime, 0);

    return totalTime > 0 ? codingTime / totalTime : 0;
  }

  private calculateDebuggingRatio(sessions: ProductivitySession[]): number {
    if (sessions.length === 0) {
      return 0;
    }

    const codingTime = sessions.reduce((sum, session) => sum + session.metrics.codingTime, 0);
    const debuggingTime = sessions.reduce((sum, session) => sum + session.metrics.debuggingTime, 0);

    return codingTime > 0 ? debuggingTime / codingTime : 0;
  }

  private calculateBuildSuccessRate(sessions: ProductivitySession[]): number {
    if (sessions.length === 0) {
      return 0;
    }

    const totalBuilds = sessions.reduce(
      (sum, session) => sum + session.metrics.successfulBuilds + session.metrics.failedBuilds,
      0
    );
    const successfulBuilds = sessions.reduce(
      (sum, session) => sum + session.metrics.successfulBuilds,
      0
    );

    return totalBuilds > 0 ? successfulBuilds / totalBuilds : 0;
  }

  private calculateTestSuccessRate(sessions: ProductivitySession[]): number {
    if (sessions.length === 0) {
      return 0;
    }

    const totalTests = sessions.reduce((sum, session) => sum + session.metrics.testsRun, 0);
    const passedTests = sessions.reduce((sum, session) => sum + session.metrics.testsPassed, 0);

    return totalTests > 0 ? passedTests / totalTests : 0;
  }

  private calculateDailyProductivity(sessions: ProductivitySession[]): DailyProductivity[] {
    const dailyData = new Map<
      string,
      {
        totalTime: number;
        codingTime: number;
        buildCount: number;
        testCount: number;
      }
    >();

    sessions.forEach((session) => {
      const date = session.startTime.toISOString().split('T')[0];
      const existing = dailyData.get(date) || {
        totalTime: 0,
        codingTime: 0,
        buildCount: 0,
        testCount: 0,
      };

      existing.totalTime += session.metrics.totalDuration;
      existing.codingTime += session.metrics.codingTime;
      existing.buildCount += session.metrics.successfulBuilds + session.metrics.failedBuilds;
      existing.testCount += session.metrics.testsRun;

      dailyData.set(date, existing);
    });

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      totalTime: data.totalTime,
      codingTime: data.codingTime,
      efficiency: data.totalTime > 0 ? data.codingTime / data.totalTime : 0,
      buildCount: data.buildCount,
      testCount: data.testCount,
    }));
  }

  private calculateWeeklyTrends(sessions: ProductivitySession[]): WeeklyTrend[] {
    // Simplified weekly trend calculation
    const weeklyData = new Map<
      string,
      {
        totalCodingTime: number;
        totalTime: number;
        sessionCount: number;
      }
    >();

    sessions.forEach((session) => {
      const week = this.getWeekString(session.startTime);
      const existing = weeklyData.get(week) || {
        totalCodingTime: 0,
        totalTime: 0,
        sessionCount: 0,
      };

      existing.totalCodingTime += session.metrics.codingTime;
      existing.totalTime += session.metrics.totalDuration;
      existing.sessionCount++;

      weeklyData.set(week, existing);
    });

    const weeks = Array.from(weeklyData.entries()).map(([week, data]) => ({
      week,
      averageEfficiency: data.totalTime > 0 ? data.totalCodingTime / data.totalTime : 0,
      totalCodingTime: data.totalCodingTime,
      improvementRate: 0, // Would calculate based on previous week
    }));

    // Calculate improvement rates
    for (let i = 1; i < weeks.length; i++) {
      const current = weeks[i].averageEfficiency;
      const previous = weeks[i - 1].averageEfficiency;
      weeks[i].improvementRate = previous > 0 ? (current - previous) / previous : 0;
    }

    return weeks;
  }

  private getWeekString(date: Date): string {
    const year = date.getFullYear();
    const week = Math.ceil(date.getDate() / 7);
    const month = date.getMonth() + 1;
    return `${year}-${month.toString().padStart(2, '0')}-W${week}`;
  }

  private getEmptyTrends(): ProductivityTrends {
    return {
      averageSessionDuration: 0,
      codingEfficiency: 0,
      debuggingRatio: 0,
      buildSuccessRate: 0,
      testSuccessRate: 0,
      dailyProductivity: [],
      weeklyTrends: [],
    };
  }

  private generateRecommendations(trends: ProductivityTrends): string[] {
    const recommendations: string[] = [];

    if (trends.codingEfficiency < 0.6) {
      recommendations.push(
        'Consider reducing time spent on non-coding activities or improving focus during coding sessions'
      );
    }

    if (trends.debuggingRatio > 0.3) {
      recommendations.push(
        'High debugging ratio detected. Consider improving code quality practices and adding more tests'
      );
    }

    if (trends.buildSuccessRate < 0.8) {
      recommendations.push(
        'Build success rate is low. Review build configuration and consider adding pre-commit hooks'
      );
    }

    if (trends.testSuccessRate < 0.9) {
      recommendations.push(
        'Test success rate could be improved. Review test quality and consider TDD practices'
      );
    }

    if (trends.averageSessionDuration < 1800000) {
      // Less than 30 minutes
      recommendations.push(
        'Sessions are quite short. Consider longer focused work sessions for better productivity'
      );
    }

    if (trends.averageSessionDuration > 14400000) {
      // More than 4 hours
      recommendations.push(
        'Sessions are very long. Consider taking breaks to maintain productivity and avoid burnout'
      );
    }

    return recommendations;
  }
}
