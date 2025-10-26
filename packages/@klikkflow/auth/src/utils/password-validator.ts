import { randomInt } from 'node:crypto';

export interface PasswordPolicy {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  minUniqueChars?: number;
  preventCommonPasswords?: boolean;
  preventUserInfo?: boolean;
  preventRepeatingChars?: number;
  preventSequentialChars?: number;
}

interface ValidationCheck {
  errors: string[];
  score: number;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very-strong';
  score: number;
}

export class PasswordValidator {
  private policy: Required<PasswordPolicy>;
  private commonPasswords: Set<string>;

  constructor(policy: PasswordPolicy = {}) {
    this.policy = {
      minLength: policy.minLength ?? 8,
      maxLength: policy.maxLength ?? 128,
      requireUppercase: policy.requireUppercase ?? true,
      requireLowercase: policy.requireLowercase ?? true,
      requireNumbers: policy.requireNumbers ?? true,
      requireSpecialChars: policy.requireSpecialChars ?? true,
      minUniqueChars: policy.minUniqueChars ?? 5,
      preventCommonPasswords: policy.preventCommonPasswords ?? true,
      preventUserInfo: policy.preventUserInfo ?? true,
      preventRepeatingChars: policy.preventRepeatingChars ?? 3,
      preventSequentialChars: policy.preventSequentialChars ?? 3,
    };

    this.commonPasswords = new Set([
      'password',
      '123456',
      '12345678',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
      '1234567890',
      'password1',
      '123456789',
      'welcome123',
      'root',
      'toor',
      'pass',
      'test',
      'guest',
      'master',
    ]);
  }

  private validateLength(password: string): ValidationCheck {
    const errors: string[] = [];
    let score = 0;

    if (password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters long`);
    } else {
      score += 10;
    }

    if (password.length > this.policy.maxLength) {
      errors.push(`Password must not exceed ${this.policy.maxLength} characters`);
    }

    return { errors, score };
  }

  private validateCharacterTypes(password: string): ValidationCheck {
    const errors: string[] = [];
    let score = 0;

    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (this.policy.requireUppercase) {
      score += 10;
    }

    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (this.policy.requireLowercase) {
      score += 10;
    }

    if (this.policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (this.policy.requireNumbers) {
      score += 10;
    }

    if (this.policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else if (this.policy.requireSpecialChars) {
      score += 10;
    }

    return { errors, score };
  }

  private validateUniqueChars(password: string): ValidationCheck {
    const errors: string[] = [];
    let score = 0;

    const uniqueChars = new Set(password).size;
    if (uniqueChars < this.policy.minUniqueChars) {
      errors.push(`Password must contain at least ${this.policy.minUniqueChars} unique characters`);
    } else {
      score += 10;
    }

    return { errors, score };
  }

  private validateNotCommonPassword(password: string): ValidationCheck {
    const errors: string[] = [];
    let score = 0;

    if (this.policy.preventCommonPasswords && this.commonPasswords.has(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a more unique password');
    } else if (this.policy.preventCommonPasswords) {
      score += 10;
    }

    return { errors, score };
  }

  private validateNotUserInfo(
    password: string,
    userInfo?: { email?: string; username?: string; firstName?: string; lastName?: string }
  ): ValidationCheck {
    const errors: string[] = [];
    let score = 0;

    if (this.policy.preventUserInfo && userInfo) {
      const lowerPassword = password.toLowerCase();
      const checks = [
        userInfo.email?.split('@')[0],
        userInfo.username,
        userInfo.firstName,
        userInfo.lastName,
      ].filter(Boolean);

      for (const info of checks) {
        if (info && lowerPassword.includes(info.toLowerCase())) {
          errors.push('Password must not contain personal information');
          break;
        }
      }

      if (errors.length === 0) {
        score += 10;
      }
    }

    return { errors, score };
  }

  private validateNoRepeatingChars(password: string): ValidationCheck {
    const errors: string[] = [];
    let score = 0;

    if (this.policy.preventRepeatingChars) {
      const repeatRegex = new RegExp(`(.)\\1{${this.policy.preventRepeatingChars - 1},}`);
      if (repeatRegex.test(password)) {
        errors.push(
          `Password must not contain ${this.policy.preventRepeatingChars} or more repeating characters`
        );
      } else {
        score += 10;
      }
    }

    return { errors, score };
  }

  private validateNoSequentialChars(password: string): ValidationCheck {
    const errors: string[] = [];
    let score = 0;

    if (this.policy.preventSequentialChars) {
      if (this.hasSequentialChars(password, this.policy.preventSequentialChars)) {
        errors.push(
          `Password must not contain ${this.policy.preventSequentialChars} or more sequential characters`
        );
      } else {
        score += 10;
      }
    }

    return { errors, score };
  }

  private calculateStrength(score: number): 'weak' | 'fair' | 'strong' | 'very-strong' {
    if (score < 30) {
      return 'weak';
    }
    if (score < 60) {
      return 'fair';
    }
    if (score < 80) {
      return 'strong';
    }
    return 'very-strong';
  }

  validate(
    password: string,
    userInfo?: { email?: string; username?: string; firstName?: string; lastName?: string }
  ): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Run all validation checks
    const checks = [
      this.validateLength(password),
      this.validateCharacterTypes(password),
      this.validateUniqueChars(password),
      this.validateNotCommonPassword(password),
      this.validateNotUserInfo(password, userInfo),
      this.validateNoRepeatingChars(password),
      this.validateNoSequentialChars(password),
    ];

    // Aggregate results
    for (const check of checks) {
      errors.push(...check.errors);
      score += check.score;
    }

    // Extra points for length
    score += Math.min((password.length - this.policy.minLength) * 2, 20);

    // Calculate strength
    const strength = this.calculateStrength(score);

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score: Math.min(score, 100),
    };
  }

  private hasSequentialChars(password: string, maxSequential: number): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];

    const lowerPassword = password.toLowerCase();

    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - maxSequential; i++) {
        const subSeq = seq.slice(i, i + maxSequential);
        const reverseSubSeq = subSeq.split('').reverse().join('');
        if (lowerPassword.includes(subSeq) || lowerPassword.includes(reverseSubSeq)) {
          return true;
        }
      }
    }

    return false;
  }

  generateStrongPassword(length = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const allChars = uppercase + lowercase + numbers + special;
    let password = '';

    // Ensure at least one of each required type
    password += uppercase[randomInt(0, uppercase.length)];
    password += lowercase[randomInt(0, lowercase.length)];
    password += numbers[randomInt(0, numbers.length)];
    password += special[randomInt(0, special.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[randomInt(0, allChars.length)];
    }

    // Shuffle the password using Fisher-Yates algorithm
    const chars = password.split('');
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}
