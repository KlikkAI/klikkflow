import bcrypt from 'bcryptjs';
import mongoose, { type Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  fullName: string; // Virtual field
  role: 'super_admin' | 'admin' | 'member' | 'viewer';
  permissions: string[];
  organizationId?: string;
  department?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationTokenExpires?: Date;
  passwordResetToken?: string;
  passwordResetTokenExpires?: Date;
  refreshTokens: string[]; // Store active refresh tokens
  lastLogin?: Date;
  lastPasswordChange?: Date;
  failedLoginAttempts: number;
  lockUntil?: Date;
  ssoProvider?: 'google' | 'microsoft' | 'okta' | 'auth0';
  ssoId?: string;
  preferences: {
    language: string;
    timezone: string;
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      push: boolean;
      workflow: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  hasPermission(permission: string): boolean;
  isLocked(): boolean;
  incLoginAttempts(): Promise<any>;
  resetLoginAttempts(): Promise<any>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot be more than 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot be more than 50 characters'],
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'member', 'viewer'],
      default: 'member',
    },
    permissions: {
      type: [String],
      default: [],
    },
    organizationId: {
      type: String,
      ref: 'Organization',
    },
    department: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationTokenExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetTokenExpires: {
      type: Date,
      select: false,
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    lastPasswordChange: {
      type: Date,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    ssoProvider: {
      type: String,
      enum: ['google', 'microsoft', 'okta', 'auth0'],
    },
    ssoId: {
      type: String,
    },
    preferences: {
      language: {
        type: String,
        default: 'en',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: true,
        },
        workflow: {
          type: Boolean,
          default: true,
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes for performance
userSchema.index({ isActive: 1 });
userSchema.index({ organizationId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ ssoProvider: 1, ssoId: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// Pre-save middleware to set password change date
userSchema.pre('save', function (next) {
  if (this.isModified('password') && !this.isNew) {
    this.lastPasswordChange = new Date();
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user has specific permission
userSchema.methods.hasPermission = function (permission: string): boolean {
  // Super admin has all permissions
  if (this.role === 'super_admin') {
    return true;
  }

  // Check if user has the specific permission
  return this.permissions.includes(permission);
};

// Method to check if account is locked
userSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Static method to handle failed login attempts
userSchema.methods.incLoginAttempts = function () {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { failedLoginAttempts: 1 },
    });
  }

  const updates = { $inc: { failedLoginAttempts: 1 } };

  // If we've hit max attempts and it's not locked already, lock the account
  if (this.failedLoginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    (updates as any).$set = { lockUntil: new Date(Date.now() + lockTime) };
  }

  return this.updateOne(updates);
};

// Static method to reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { failedLoginAttempts: 1, lockUntil: 1 },
  });
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  userObject.password = undefined;
  userObject.refreshTokens = undefined;
  userObject.emailVerificationToken = undefined;
  userObject.emailVerificationTokenExpires = undefined;
  userObject.passwordResetToken = undefined;
  userObject.passwordResetTokenExpires = undefined;
  return userObject;
};

export const User = mongoose.model<IUser>('User', userSchema);
