import bcrypt from 'bcryptjs';
import mongoose, { type Document, Schema } from 'mongoose';

export interface IApiKey extends Document {
  _id: string;
  userId: string;
  name: string;
  keyHash: string; // Hashed version of the API key (never store plain text)
  keyPrefix: string; // First 8 chars for identification (e.g., "rkr_live")
  permissions: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  ipWhitelist?: string[]; // Optional IP restrictions
  requestCount: number; // Track total requests made with this key
  createdAt: Date;
  updatedAt: Date;
  compareKey(candidateKey: string): Promise<boolean>;
  isExpired(): boolean;
  incrementUsage(): Promise<void>;
  getMaskedKey(): string;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    keyHash: {
      type: String,
      required: [true, 'API key hash is required'],
      unique: true,
      select: false, // Don't include hash in queries by default
    },
    keyPrefix: {
      type: String,
      required: [true, 'Key prefix is required'],
      maxlength: [12, 'Prefix cannot be more than 12 characters'],
    },
    permissions: {
      type: [String],
      default: ['read'],
      validate: {
        validator: (permissions: string[]) => {
          const validPermissions = [
            'read',
            'write',
            'execute',
            'workflows:read',
            'workflows:write',
            'workflows:execute',
            'workflows:delete',
            'credentials:read',
            'credentials:write',
            'executions:read',
            'admin',
          ];
          return permissions.every((p) => validPermissions.includes(p));
        },
        message: 'Invalid permission value',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      index: true, // Index for querying expired keys
    },
    ipWhitelist: {
      type: [String],
      default: [],
    },
    requestCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for performance
apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ userId: 1, createdAt: -1 });
apiKeySchema.index({ keyHash: 1 }, { unique: true, sparse: true });
apiKeySchema.index({ expiresAt: 1 }, { sparse: true, expireAfterSeconds: 0 });

// Pre-save middleware to hash API key
apiKeySchema.pre('save', async function (next) {
  if (!this.isModified('keyHash')) {
    return next();
  }

  // If keyHash is already a bcrypt hash (starts with $2), skip hashing
  if (this.keyHash.startsWith('$2')) {
    return next();
  }

  const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  this.keyHash = await bcrypt.hash(this.keyHash, saltRounds);
  next();
});

// Method to compare API key
apiKeySchema.methods.compareKey = async function (candidateKey: string): Promise<boolean> {
  return bcrypt.compare(candidateKey, this.keyHash);
};

// Method to check if API key is expired
apiKeySchema.methods.isExpired = function (): boolean {
  if (!this.expiresAt) {
    return false;
  }
  return this.expiresAt < new Date();
};

// Method to increment usage count and update last used
apiKeySchema.methods.incrementUsage = async function (): Promise<void> {
  this.lastUsedAt = new Date();
  this.requestCount = (this.requestCount || 0) + 1;
  await this.save();
};

// Method to get masked key for display (show only prefix and last 4 chars)
apiKeySchema.methods.getMaskedKey = function (): string {
  // Show format like: rkr_live_****...**1234
  const lastFour = this._id.toString().slice(-4);
  return `${this.keyPrefix}****...****${lastFour}`;
};

// Remove sensitive data from JSON output
apiKeySchema.methods.toJSON = function () {
  const apiKeyObject = this.toObject();
  apiKeyObject.keyHash = undefined;
  // Add masked key for display
  apiKeyObject.maskedKey = this.getMaskedKey();
  return apiKeyObject;
};

// Static method to find active, non-expired keys for a user
apiKeySchema.statics.findActiveKeys = function (userId: string) {
  return this.find({
    userId,
    isActive: true,
    $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }],
  }).sort({ createdAt: -1 });
};

export const ApiKey = mongoose.model<IApiKey>('ApiKey', apiKeySchema);
