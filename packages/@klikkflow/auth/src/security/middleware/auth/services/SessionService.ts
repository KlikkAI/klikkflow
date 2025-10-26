import { randomBytes } from 'node:crypto';
import { AuthenticationError } from '@klikkflow/core';
import type { Request } from 'express';
import Redis from 'ioredis';

export interface SessionConfig {
  store: 'memory' | 'redis';
  secret: string;
  ttl: number;
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
  };
}

interface SessionUser {
  id: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  [key: string]: unknown;
}

export interface Session {
  id: string;
  user: SessionUser;
  createdAt: Date;
  expiresAt: Date;
}

export class SessionService {
  private store: SessionStore;

  constructor(config?: SessionConfig) {
    this.store = this.createStore(config);
  }

  /**
   * Get session from request
   */
  public async getSession(req: Request): Promise<Session | null> {
    const sessionId = this.getSessionId(req);
    if (!sessionId) {
      return null;
    }

    return this.store.get(sessionId);
  }

  /**
   * Create new session
   */
  public async createSession(user: SessionUser, ttl: number = 24 * 60 * 60): Promise<Session> {
    const session: Session = {
      id: this.generateSessionId(),
      user,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttl * 1000),
    };

    await this.store.set(session.id, session, ttl);
    return session;
  }

  /**
   * Destroy session
   */
  public async destroySession(req: Request): Promise<void> {
    const sessionId = this.getSessionId(req);
    if (sessionId) {
      await this.store.delete(sessionId);
    }
  }

  /**
   * Extend session TTL
   */
  public async extendSession(req: Request, ttl: number): Promise<void> {
    const sessionId = this.getSessionId(req);
    if (!sessionId) {
      throw new AuthenticationError('No session found');
    }

    const session = await this.store.get(sessionId);
    if (!session) {
      throw new AuthenticationError('Invalid session');
    }

    session.expiresAt = new Date(Date.now() + ttl * 1000);
    await this.store.set(sessionId, session, ttl);
  }

  private getSessionId(req: Request): string | null {
    // Try session cookie
    if (req.cookies?.sessionId) {
      return req.cookies.sessionId;
    }

    // Try session header
    const sessionHeader = req.headers['x-session-id'];
    if (sessionHeader) {
      return sessionHeader as string;
    }

    return null;
  }

  private generateSessionId(): string {
    return randomBytes(16).toString('hex') + Date.now().toString(36);
  }

  private createStore(config?: SessionConfig): SessionStore {
    if (config?.store === 'redis' && config.redisConfig) {
      return new RedisSessionStore(config.redisConfig);
    }
    return new MemorySessionStore();
  }
}

/**
 * Session store interface
 */
interface SessionStore {
  get(id: string): Promise<Session | null>;
  set(id: string, session: Session, ttl: number): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * In-memory session store
 */
class MemorySessionStore implements SessionStore {
  private sessions: Map<string, { session: Session; expiresAt: number }>;

  constructor() {
    this.sessions = new Map();

    // Clean up expired sessions every minute
    setInterval(() => {
      const now = Date.now();
      for (const [id, data] of this.sessions.entries()) {
        if (data.expiresAt <= now) {
          this.sessions.delete(id);
        }
      }
    }, 60 * 1000);
  }

  public async get(id: string): Promise<Session | null> {
    const data = this.sessions.get(id);
    if (!data || data.expiresAt <= Date.now()) {
      return null;
    }
    return data.session;
  }

  public async set(id: string, session: Session, ttl: number): Promise<void> {
    this.sessions.set(id, {
      session,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  public async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }
}

/**
 * Redis session store
 */
class RedisSessionStore implements SessionStore {
  private client: Redis;
  private prefix: string;

  constructor(config: { host: string; port: number; password?: string }) {
    this.client = new Redis(config);
    this.prefix = 'session:';
  }

  public async get(id: string): Promise<Session | null> {
    const data = await this.client.get(this.getKey(id));
    if (!data) {
      return null;
    }

    return JSON.parse(data) as Session;
  }

  public async set(id: string, session: Session, ttl: number): Promise<void> {
    await this.client.set(this.getKey(id), JSON.stringify(session), 'EX', ttl);
  }

  public async delete(id: string): Promise<void> {
    await this.client.del(this.getKey(id));
  }

  private getKey(id: string): string {
    return `${this.prefix}${id}`;
  }
}
