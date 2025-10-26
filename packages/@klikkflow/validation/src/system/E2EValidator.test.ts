/**
 * Tests for Frontend E2E Validation Framework
 * Requirements: 1.3, 1.5
 */

import { chromium } from 'playwright';
import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';
import { type E2EValidationConfig, E2EValidator, type E2EWorkflow } from './E2EValidator.js';

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

const mockChromium = chromium as { launch: MockedFunction<typeof chromium.launch> };

describe('E2EValidator', () => {
  let validator: E2EValidator;
  let config: E2EValidationConfig;
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;

  beforeEach(() => {
    // Setup mocks
    mockPage = {
      goto: vi.fn(),
      click: vi.fn(),
      fill: vi.fn(),
      waitForSelector: vi.fn().mockResolvedValue({
        isVisible: vi.fn().mockResolvedValue(true),
        textContent: vi.fn().mockResolvedValue('connected'),
        evaluate: vi.fn().mockResolvedValue(true),
      }),
      screenshot: vi.fn(),
      close: vi.fn(),
    };

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn(),
    };

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn(),
    };

    mockChromium.launch.mockResolvedValue(mockBrowser);

    config = {
      baseUrl: 'http://localhost:3000',
      headless: true,
      timeout: 5000,
      workflows: [
        {
          name: 'Test Workflow',
          description: 'Test workflow description',
          steps: [
            { action: 'navigate', url: '/' },
            { action: 'wait', selector: 'body' },
            { action: 'assert', selector: 'body', expected: 'visible' },
          ],
        },
      ],
      screenshotPath: './screenshots',
      viewport: { width: 1280, height: 720 },
    };

    validator = new E2EValidator(config);
    vi.clearAllMocks();
  });

  describe('runFrontendWorkflows', () => {
    it('should run workflows successfully', async () => {
      const result = await validator.runFrontendWorkflows();

      expect(result.status).toBe('success');
      expect(result.totalWorkflows).toBe(1);
      expect(result.passedWorkflows).toBe(1);
      expect(result.failedWorkflows).toHaveLength(0);
      expect(mockChromium.launch).toHaveBeenCalledWith({
        headless: true,
        timeout: 5000,
      });
      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
      });
    });

    it('should handle workflow failures', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const result = await validator.runFrontendWorkflows();

      expect(result.status).toBe('failure');
      expect(result.totalWorkflows).toBe(1);
      expect(result.passedWorkflows).toBe(0);
      expect(result.failedWorkflows).toHaveLength(1);
      expect(result.failedWorkflows[0].workflowName).toBe('Test Workflow');
      expect(result.failedWorkflows[0].error).toBe('Navigation failed');
    });

    it('should take screenshots on failure', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      await validator.runFrontendWorkflows();

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: './screenshots/Test Workflow-failure.png',
        fullPage: true,
      });
    });

    it('should cleanup browser resources', async () => {
      await validator.runFrontendWorkflows();

      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('validateUserJourneys', () => {
    it('should validate user authentication journey', async () => {
      const result = await validator.validateUserJourneys();

      expect(result.status).toBe('success');
      expect(result.totalWorkflows).toBe(2); // Authentication + Workflow Creation
      expect(result.passedWorkflows).toBe(2);
      expect(result.failedWorkflows).toHaveLength(0);
    });

    it('should handle authentication failures', async () => {
      mockPage.waitForSelector.mockRejectedValueOnce(new Error('Login form not found'));

      const result = await validator.validateUserJourneys();

      expect(result.status).toBe('failure');
      expect(result.failedWorkflows.length).toBeGreaterThan(0);
    });
  });

  describe('checkCrossPackageIntegration', () => {
    it('should test cross-package integrations successfully', async () => {
      const result = await validator.checkCrossPackageIntegration();

      expect(result.status).toBe('success');
      expect(result.crossPackageIntegration.testedIntegrations).toBe(2);
      expect(result.crossPackageIntegration.passedIntegrations).toBe(2);
      expect(result.crossPackageIntegration.failedIntegrations).toHaveLength(0);
    });

    it('should handle integration failures', async () => {
      mockPage.waitForSelector.mockRejectedValueOnce(new Error('API status not found'));

      const result = await validator.checkCrossPackageIntegration();

      expect(result.status).toBe('failure');
      expect(result.crossPackageIntegration.failedIntegrations.length).toBeGreaterThan(0);
      expect(result.crossPackageIntegration.failedIntegrations[0].fromPackage).toBe('frontend');
      expect(result.crossPackageIntegration.failedIntegrations[0].toPackage).toBe('backend');
    });
  });

  describe('generateE2EReport', () => {
    it('should generate comprehensive E2E report', async () => {
      const result = await validator.generateE2EReport();

      expect(result.status).toBe('success');
      expect(result.totalWorkflows).toBeGreaterThan(0);
      expect(result.crossPackageIntegration).toBeDefined();
      expect(result.crossPackageIntegration.testedIntegrations).toBeGreaterThan(0);
    });

    it('should combine results from all validation types', async () => {
      const result = await validator.generateE2EReport();

      // Should include workflows from runFrontendWorkflows, validateUserJourneys, and checkCrossPackageIntegration
      expect(result.totalWorkflows).toBe(5); // 1 + 2 + 2
      expect(result.passedWorkflows).toBe(5);
    });
  });

  describe('workflow step execution', () => {
    it('should execute navigate steps', async () => {
      const workflow: E2EWorkflow = {
        name: 'Navigate Test',
        description: 'Test navigation',
        steps: [{ action: 'navigate', url: '/test' }],
      };

      const testConfig = { ...config, workflows: [workflow] };
      const testValidator = new E2EValidator(testConfig);

      await testValidator.runFrontendWorkflows();

      expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000/test', { timeout: 5000 });
    });

    it('should execute click steps', async () => {
      const workflow: E2EWorkflow = {
        name: 'Click Test',
        description: 'Test clicking',
        steps: [{ action: 'click', selector: '[data-testid="button"]' }],
      };

      const testConfig = { ...config, workflows: [workflow] };
      const testValidator = new E2EValidator(testConfig);

      await testValidator.runFrontendWorkflows();

      expect(mockPage.click).toHaveBeenCalledWith('[data-testid="button"]', { timeout: 5000 });
    });

    it('should execute type steps', async () => {
      const workflow: E2EWorkflow = {
        name: 'Type Test',
        description: 'Test typing',
        steps: [{ action: 'type', selector: '[data-testid="input"]', text: 'test text' }],
      };

      const testConfig = { ...config, workflows: [workflow] };
      const testValidator = new E2EValidator(testConfig);

      await testValidator.runFrontendWorkflows();

      expect(mockPage.fill).toHaveBeenCalledWith('[data-testid="input"]', 'test text', {
        timeout: 5000,
      });
    });

    it('should execute wait steps', async () => {
      const workflow: E2EWorkflow = {
        name: 'Wait Test',
        description: 'Test waiting',
        steps: [{ action: 'wait', selector: '[data-testid="element"]' }],
      };

      const testConfig = { ...config, workflows: [workflow] };
      const testValidator = new E2EValidator(testConfig);

      await testValidator.runFrontendWorkflows();

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="element"]', {
        timeout: 5000,
      });
    });

    it('should execute assert steps for visibility', async () => {
      const workflow: E2EWorkflow = {
        name: 'Assert Test',
        description: 'Test assertions',
        steps: [{ action: 'assert', selector: '[data-testid="element"]', expected: 'visible' }],
      };

      const testConfig = { ...config, workflows: [workflow] };
      const testValidator = new E2EValidator(testConfig);

      await testValidator.runFrontendWorkflows();

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="element"]', {
        timeout: 5000,
      });
    });

    it('should execute screenshot steps', async () => {
      const workflow: E2EWorkflow = {
        name: 'Screenshot Test',
        description: 'Test screenshots',
        steps: [{ action: 'screenshot' }],
      };

      const testConfig = { ...config, workflows: [workflow] };
      const testValidator = new E2EValidator(testConfig);

      await testValidator.runFrontendWorkflows();

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: expect.stringContaining('./screenshots/step-'),
        fullPage: true,
      });
    });

    it('should handle invalid steps', async () => {
      const workflow: E2EWorkflow = {
        name: 'Invalid Step Test',
        description: 'Test invalid steps',
        steps: [{ action: 'navigate' }], // Missing URL
      };

      const testConfig = { ...config, workflows: [workflow] };
      const testValidator = new E2EValidator(testConfig);

      const result = await testValidator.runFrontendWorkflows();

      expect(result.status).toBe('failure');
      expect(result.failedWorkflows[0].error).toContain('URL required');
    });
  });

  describe('createDefaultWorkflows', () => {
    it('should create default workflows', () => {
      const workflows = E2EValidator.createDefaultWorkflows('http://localhost:3000');

      expect(workflows).toHaveLength(3);
      expect(workflows[0].name).toBe('Homepage Load Test');
      expect(workflows[1].name).toBe('Navigation Test');
      expect(workflows[2].name).toBe('API Health Check');
      expect(workflows.every((w) => w.steps.length > 0)).toBe(true);
    });

    it('should include proper step configurations', () => {
      const workflows = E2EValidator.createDefaultWorkflows('http://localhost:3000');
      const homepageWorkflow = workflows[0];

      expect(homepageWorkflow.steps[0].action).toBe('navigate');
      expect(homepageWorkflow.steps[0].url).toBe('/');
      expect(homepageWorkflow.steps[1].action).toBe('wait');
      expect(homepageWorkflow.steps[2].action).toBe('assert');
    });
  });

  describe('configuration handling', () => {
    it('should use custom viewport settings', async () => {
      const customConfig = {
        ...config,
        viewport: { width: 1920, height: 1080 },
      };

      const customValidator = new E2EValidator(customConfig);
      await customValidator.runFrontendWorkflows();

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
      });
    });

    it('should handle missing screenshot path', async () => {
      const configWithoutScreenshots = { ...config };
      configWithoutScreenshots.screenshotPath = undefined;

      const validatorWithoutScreenshots = new E2EValidator(configWithoutScreenshots);
      mockPage.goto.mockRejectedValue(new Error('Test error'));

      const result = await validatorWithoutScreenshots.runFrontendWorkflows();

      expect(result.failedWorkflows[0].screenshot).toBeUndefined();
    });

    it('should respect custom timeouts', async () => {
      const workflow: E2EWorkflow = {
        name: 'Timeout Test',
        description: 'Test custom timeouts',
        steps: [{ action: 'wait', selector: '[data-testid="element"]', timeout: 10000 }],
      };

      const testConfig = { ...config, workflows: [workflow] };
      const testValidator = new E2EValidator(testConfig);

      await testValidator.runFrontendWorkflows();

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="element"]', {
        timeout: 10000,
      });
    });
  });
});
