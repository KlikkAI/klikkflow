import mongoose, { type Document, Schema } from 'mongoose';

export interface IInstance extends Document {
  _id: string;
  apiKeyId: string; // Links to ApiKey model
  userId: string; // Owner of this instance
  instanceId: string; // Unique UUID for this installation
  hostname: string; // Instance hostname or IP
  version: string; // Current platform version (e.g., "1.2.0")
  platform: 'docker' | 'vps' | 'local' | 'kubernetes' | 'cloud'; // Deployment type
  status: 'active' | 'inactive' | 'suspended';
  firstSeen: Date; // When instance was first activated
  lastSeen: Date; // Last heartbeat received
  lastHeartbeatAt: Date; // Last successful heartbeat
  metadata: {
    os?: string; // Operating system (e.g., "linux", "darwin", "win32")
    osVersion?: string; // OS version
    nodeVersion?: string; // Node.js version
    architecture?: string; // System architecture (e.g., "x64", "arm64")
    cpu?: number; // Number of CPU cores
    memory?: number; // Total memory in GB
    diskSpace?: number; // Available disk space in GB
    timezone?: string; // Instance timezone
    country?: string; // Geographic location (optional)
  };
  features: {
    telemetryEnabled: boolean; // User opted-in for telemetry
    autoUpdate: boolean; // Auto-update enabled
    analyticsEnabled: boolean; // Anonymous usage analytics
  };
  statistics?: {
    workflowCount?: number; // Number of workflows
    executionCount?: number; // Total executions
    activeUsers?: number; // Number of users on this instance
    lastExecutionAt?: Date; // Last workflow execution
  };
  createdAt: Date;
  updatedAt: Date;
  isActive(): boolean;
  isHealthy(): boolean;
  updateHeartbeat(): Promise<void>;
  markInactive(): Promise<void>;
}

const instanceSchema = new Schema<IInstance>(
  {
    apiKeyId: {
      type: String,
      required: [true, 'API Key ID is required'],
      ref: 'ApiKey',
      index: true,
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      index: true,
    },
    instanceId: {
      type: String,
      required: [true, 'Instance ID is required'],
      unique: true,
      index: true,
    },
    hostname: {
      type: String,
      required: [true, 'Hostname is required'],
      trim: true,
    },
    version: {
      type: String,
      required: [true, 'Version is required'],
      default: '1.0.0',
    },
    platform: {
      type: String,
      enum: ['docker', 'vps', 'local', 'kubernetes', 'cloud'],
      default: 'docker',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true,
    },
    firstSeen: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    lastHeartbeatAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      os: {
        type: String,
        trim: true,
      },
      osVersion: {
        type: String,
        trim: true,
      },
      nodeVersion: {
        type: String,
        trim: true,
      },
      architecture: {
        type: String,
        trim: true,
      },
      cpu: {
        type: Number,
        min: 0,
      },
      memory: {
        type: Number,
        min: 0,
      },
      diskSpace: {
        type: Number,
        min: 0,
      },
      timezone: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
        maxlength: 2, // ISO country code
      },
    },
    features: {
      telemetryEnabled: {
        type: Boolean,
        default: true,
      },
      autoUpdate: {
        type: Boolean,
        default: false,
      },
      analyticsEnabled: {
        type: Boolean,
        default: true,
      },
    },
    statistics: {
      workflowCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      executionCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      activeUsers: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastExecutionAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient queries
instanceSchema.index({ userId: 1, status: 1 });
instanceSchema.index({ apiKeyId: 1, status: 1 });
instanceSchema.index({ lastSeen: -1 });
instanceSchema.index({ version: 1, status: 1 });
instanceSchema.index({ status: 1, lastSeen: -1 });

// Method to check if instance is active
instanceSchema.methods.isActive = function (): boolean {
  return this.status === 'active';
};

// Method to check if instance is healthy (seen in last 7 days)
instanceSchema.methods.isHealthy = function (): boolean {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.isActive() && this.lastSeen > sevenDaysAgo;
};

// Method to update heartbeat
instanceSchema.methods.updateHeartbeat = async function (): Promise<void> {
  this.lastSeen = new Date();
  this.lastHeartbeatAt = new Date();
  if (this.status === 'inactive') {
    this.status = 'active';
  }
  await this.save();
};

// Method to mark instance as inactive
instanceSchema.methods.markInactive = async function (): Promise<void> {
  this.status = 'inactive';
  await this.save();
};

// Static method to find active instances for a user
instanceSchema.statics.findActiveByUser = function (userId: string) {
  return this.find({
    userId,
    status: 'active',
  }).sort({ lastSeen: -1 });
};

// Static method to find stale instances (no heartbeat in 30+ days)
instanceSchema.statics.findStaleInstances = function (days: number = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    status: 'active',
    lastSeen: { $lt: cutoffDate },
  });
};

// Remove sensitive data from JSON output
instanceSchema.methods.toJSON = function () {
  const instanceObject = this.toObject();
  // Optionally mask sensitive metadata
  return instanceObject;
};

export const Instance = mongoose.model<IInstance>('Instance', instanceSchema);
