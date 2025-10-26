import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { type NextFunction, type Request, type Response, Router } from 'express';
import rateLimit from 'express-rate-limit';

export interface WebhookConfig {
  path: string;
  secret?: string;
  headers?: Record<string, string>;
  validateSignature?: boolean;
  signatureHeader?: string;
  signatureAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  maxPayloadSize?: number;
  timeout?: number;
  retryOnError?: boolean;
  maxRetries?: number;
}

export interface WebhookRegistration {
  id: string;
  integrationName: string;
  config: WebhookConfig;
  handler: WebhookHandler;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  status: 'active' | 'paused' | 'error';
  error?: string;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  timestamp: Date;
  signature?: string;
  verified: boolean;
  processed: boolean;
  error?: string;
}

export type WebhookHandler = (event: WebhookEvent) => Promise<unknown>;

export class WebhookManager extends EventEmitter {
  private webhooks: Map<string, WebhookRegistration> = new Map();
  private router: Router;
  private eventQueue: WebhookEvent[] = [];
  private processing: boolean = false;
  private maxQueueSize: number = 1000;

  constructor() {
    super();
    this.router = Router();
    this.setupMiddleware();
    this.startEventProcessor();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Raw body parser for signature verification
    this.router.use((req: Request, _res: Response, next: NextFunction) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        (req as unknown as { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
        next();
      });
    });
  }

  /**
   * Register a webhook
   */
  registerWebhook(integrationName: string, config: WebhookConfig, handler: WebhookHandler): string {
    const id = this.generateWebhookId();

    const registration: WebhookRegistration = {
      id,
      integrationName,
      config,
      handler,
      createdAt: new Date(),
      triggerCount: 0,
      status: 'active',
    };

    this.webhooks.set(id, registration);

    // Setup route
    this.setupWebhookRoute(registration);

    this.emit('webhook:registered', { id, integrationName, path: config.path });

    return id;
  }

  /**
   * Setup webhook route
   */
  private setupWebhookRoute(registration: WebhookRegistration): void {
    // CodeQL fix: Apply rate limiting to prevent webhook abuse (Alert #41)
    const webhookRateLimit = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute per webhook
      message: 'Too many webhook requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.router.post(
      registration.config.path,
      webhookRateLimit,
      async (req: Request, res: Response) => {
        try {
          // Create webhook event
          const event: WebhookEvent = {
            id: this.generateEventId(),
            webhookId: registration.id,
            headers: req.headers as Record<string, string>,
            body: req.body,
            query: req.query as Record<string, string>,
            timestamp: new Date(),
            verified: false,
            processed: false,
          };

          // Verify signature if required
          if (registration.config.validateSignature && registration.config.secret) {
            const signature = req.headers[
              registration.config.signatureHeader || 'x-signature'
            ] as string;
            event.signature = signature;
            event.verified = this.verifySignature(
              (req as unknown as { rawBody: Buffer }).rawBody,
              signature,
              registration.config.secret,
              registration.config.signatureAlgorithm
            );

            if (!event.verified) {
              this.emit('webhook:verification_failed', {
                webhookId: registration.id,
                event,
              });
              return res.status(401).json({ error: 'Invalid signature' });
            }
          } else {
            event.verified = true;
          }

          // Update registration stats
          registration.lastTriggered = new Date();
          registration.triggerCount++;

          // Add to queue for processing
          this.queueEvent(event);

          // Send immediate response
          res.status(200).json({ received: true, eventId: event.id });

          this.emit('webhook:received', { webhookId: registration.id, event });
        } catch (error: unknown) {
          registration.status = 'error';
          registration.error = error instanceof Error ? error.message : 'Unknown error';

          this.emit('webhook:error', { webhookId: registration.id, error });

          res.status(500).json({ error: 'Webhook processing failed' });
        }
      }
    );
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(
    payload: Buffer,
    signature: string,
    secret: string,
    algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha256'
  ): boolean {
    if (!signature) {
      return false;
    }

    const expectedSignature = crypto.createHmac(algorithm, secret).update(payload).digest('hex');

    // Use timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Queue event for processing
   */
  private queueEvent(event: WebhookEvent): void {
    if (this.eventQueue.length >= this.maxQueueSize) {
      // Remove oldest event if queue is full
      const removed = this.eventQueue.shift();
      this.emit('webhook:queue_overflow', { removedEvent: removed });
    }

    this.eventQueue.push(event);
  }

  /**
   * Start event processor
   */
  private startEventProcessor(): void {
    setInterval(async () => {
      if (!this.processing && this.eventQueue.length > 0) {
        await this.processEvents();
      }
    }, 1000); // Process every second
  }

  /**
   * Process queued events
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Event processing requires queue management, retry logic, and webhook dispatch coordination
  private async processEvents(): Promise<void> {
    this.processing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (!event) {
        continue;
      }

      const webhook = this.webhooks.get(event.webhookId);
      if (!webhook || webhook.status !== 'active') {
        continue;
      }

      try {
        // Execute handler with retry logic
        await this.executeWithRetry(() => webhook.handler(event), webhook.config.maxRetries || 3);

        event.processed = true;

        this.emit('webhook:processed', { webhookId: event.webhookId, event });
      } catch (error: unknown) {
        event.error = error instanceof Error ? error.message : 'Unknown error';

        this.emit('webhook:processing_failed', {
          webhookId: event.webhookId,
          event,
          error,
        });

        // Mark webhook as error if too many failures
        if (webhook.triggerCount > 10 && webhook.status === 'active') {
          const failureRate =
            (webhook.triggerCount - this.getSuccessCount(webhook.id)) / webhook.triggerCount;
          if (failureRate > 0.5) {
            webhook.status = 'error';
            webhook.error = 'Too many processing failures';
          }
        }
      }
    }

    this.processing = false;
  }

  /**
   * Execute with retry
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          await this.sleep(delay * 2 ** attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Unregister webhook
   */
  unregisterWebhook(id: string): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      return false;
    }

    this.webhooks.delete(id);

    // Remove route
    const routes = this.router.stack;
    const index = routes.findIndex(
      (layer: { route?: { path: string } }) => layer.route?.path === webhook.config.path
    );

    if (index !== -1) {
      routes.splice(index, 1);
    }

    this.emit('webhook:unregistered', {
      id,
      integrationName: webhook.integrationName,
    });

    return true;
  }

  /**
   * Pause webhook
   */
  pauseWebhook(id: string): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      return false;
    }

    webhook.status = 'paused';
    this.emit('webhook:paused', { id });

    return true;
  }

  /**
   * Resume webhook
   */
  resumeWebhook(id: string): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      return false;
    }

    webhook.status = 'active';
    webhook.error = undefined;
    this.emit('webhook:resumed', { id });

    return true;
  }

  /**
   * Get webhook by ID
   */
  getWebhook(id: string): WebhookRegistration | undefined {
    return this.webhooks.get(id);
  }

  /**
   * Get all webhooks
   */
  getAllWebhooks(): WebhookRegistration[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get webhooks by integration
   */
  getWebhooksByIntegration(integrationName: string): WebhookRegistration[] {
    return Array.from(this.webhooks.values()).filter(
      (webhook) => webhook.integrationName === integrationName
    );
  }

  /**
   * Get webhook statistics
   */
  getStatistics(): {
    totalWebhooks: number;
    activeWebhooks: number;
    pausedWebhooks: number;
    errorWebhooks: number;
    queueSize: number;
    totalEvents: number;
  } {
    const webhooksArray = Array.from(this.webhooks.values());

    return {
      totalWebhooks: webhooksArray.length,
      activeWebhooks: webhooksArray.filter((w) => w.status === 'active').length,
      pausedWebhooks: webhooksArray.filter((w) => w.status === 'paused').length,
      errorWebhooks: webhooksArray.filter((w) => w.status === 'error').length,
      queueSize: this.eventQueue.length,
      totalEvents: webhooksArray.reduce((sum, w) => sum + w.triggerCount, 0),
    };
  }

  /**
   * Get success count for webhook
   */
  private getSuccessCount(_webhookId: string): number {
    // This would be tracked in a real implementation
    return 0;
  }

  /**
   * Generate webhook ID
   */
  private generateWebhookId(): string {
    return `webhook_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get Express router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Clear all webhooks
   */
  clearAll(): void {
    this.webhooks.clear();
    this.eventQueue = [];
    this.router.stack = [];
  }
}

// Singleton instance
export const webhookManager = new WebhookManager();

export default WebhookManager;
