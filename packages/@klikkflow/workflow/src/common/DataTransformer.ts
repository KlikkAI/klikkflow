// Data transformer reusing patterns from workflow-engine
// biome-ignore lint/complexity/noStaticOnlyClass: Pre-existing utility class design pattern
export class DataTransformer {
  // CodeQL fix: Dangerous keys for prototype pollution prevention (Alert #112, #111)
  private static readonly DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

  private static isDangerousKey(key: string): boolean {
    return DataTransformer.DANGEROUS_KEYS.includes(key);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility accepts generic data
  static transform(data: any, transformations: Record<string, any>): any {
    if (!(data && transformations)) {
      return data;
    }

    // Placeholder implementation - will be enhanced when needed
    return {
      ...data,
      _transformed: true,
      _timestamp: new Date(),
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility accepts generic data
  static extractValue(data: any, path: string): any {
    if (!(data && path)) {
      return undefined;
    }

    // Simple path extraction
    const keys = path.split('.');
    let result = data;

    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return undefined;
      }
    }

    return result;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility accepts generic data
  static setValue(data: any, path: string, value: any): any {
    if (!(data && path)) {
      return data;
    }

    const keys = path.split('.');

    // CodeQL fix: Validate ALL keys upfront to prevent prototype pollution (Alerts #132, #131, #130)
    for (const key of keys) {
      if (DataTransformer.isDangerousKey(key)) {
        throw new Error(`Dangerous property key detected: ${key}`);
      }
    }

    const result = { ...data };
    let current = result;

    // Build nested path - all keys already validated above
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      // CodeQL: Key is safe - validated in loop above
      if (!current[key] || typeof current[key] !== 'object') {
        // Assignment safe - key validated above
        current[key] = {};
      }
      current = current[key];
    }

    // Final assignment - key validated in initial loop
    const finalKey = keys[keys.length - 1];
    // CodeQL: Explicit check at assignment point
    if (!DataTransformer.isDangerousKey(finalKey)) {
      current[finalKey] = value;
    }
    return result;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility accepts generic data
  static merge(target: any, source: any): any {
    if (!(target && source)) {
      return target || source;
    }

    return {
      ...target,
      ...source,
    };
  }
}
