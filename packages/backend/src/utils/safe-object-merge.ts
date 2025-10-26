/**
 * Safe object merge utility to prevent prototype pollution
 * Filters out dangerous properties like __proto__, constructor, and prototype
 */

const DANGEROUS_PROPERTIES = ['__proto__', 'constructor', 'prototype'];

/**
 * Check if a property name is safe to merge
 */
function isSafeProperty(key: string): boolean {
  return !DANGEROUS_PROPERTIES.includes(key);
}

/**
 * Safely merge source object into target, filtering out dangerous properties
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns The target object with safe properties merged
 */
export function safeObjectMerge<T extends Record<string, any>>(
  target: T,
  source: Record<string, any>
): T {
  if (!source || typeof source !== 'object') {
    return target;
  }

  for (const key of Object.keys(source)) {
    if (isSafeProperty(key) && Object.hasOwn(source, key)) {
      target[key as keyof T] = source[key];
    }
  }

  return target;
}

/**
 * Create a new object with only safe properties from source
 * @param source - The source object
 * @returns New object with dangerous properties filtered out
 */
export function sanitizeObject<T extends Record<string, any>>(source: T): Partial<T> {
  if (!source || typeof source !== 'object') {
    return {};
  }

  const result: Partial<T> = {};

  for (const key of Object.keys(source)) {
    if (isSafeProperty(key) && Object.hasOwn(source, key)) {
      result[key as keyof T] = source[key];
    }
  }

  return result;
}
