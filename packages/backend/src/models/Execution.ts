import mongoose, { type Document, Schema } from 'mongoose';
import { safeObjectMerge } from '../utils/safe-object-merge';

export interface INodeExecution {
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  retryAttempt: number;
}

export interface IExecution extends Document {
  _id: string;
  workflowId: string;
  userId: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled' | 'timeout';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  triggerType: 'manual' | 'webhook' | 'schedule' | 'api';
  triggerData?: Record<string, any>;
  nodeExecutions: INodeExecution[];
  totalNodes: number;
  completedNodes: number;
  errorMessage?: string;
  metadata: {
    version: number;
    environment: string;
    userAgent?: string;
    ipAddress?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  updateNodeExecution(nodeId: string, update: Partial<INodeExecution>): Promise<IExecution>;
}

const nodeExecutionSchema = new Schema({
  nodeId: { type: String, required: true },
  nodeName: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'success', 'error', 'skipped'],
    default: 'pending',
  },
  startTime: { type: Date },
  endTime: { type: Date },
  duration: { type: Number },
  input: { type: Schema.Types.Mixed },
  output: { type: Schema.Types.Mixed },
  error: {
    message: { type: String },
    stack: { type: String },
    code: { type: String },
  },
  retryAttempt: { type: Number, default: 0 },
});

const executionSchema = new Schema<IExecution>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Workflow ID is required'],
      ref: 'Workflow',
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, 'User ID is required'],
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'error', 'cancelled', 'timeout'],
      default: 'pending',
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: { type: Date },
    duration: { type: Number },
    triggerType: {
      type: String,
      enum: ['manual', 'webhook', 'schedule', 'api'],
      required: true,
    },
    triggerData: { type: Schema.Types.Mixed },
    nodeExecutions: [nodeExecutionSchema],
    totalNodes: {
      type: Number,
      required: true,
      min: [1, 'Total nodes must be at least 1'],
    },
    completedNodes: {
      type: Number,
      default: 0,
      min: [0, 'Completed nodes cannot be negative'],
    },
    errorMessage: { type: String },
    metadata: {
      version: { type: Number, required: true },
      environment: {
        type: String,
        default: process.env.NODE_ENV || 'development',
      },
      userAgent: { type: String },
      ipAddress: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
executionSchema.index({ workflowId: 1, startTime: -1 });
executionSchema.index({ userId: 1, startTime: -1 });
executionSchema.index({ status: 1 });
executionSchema.index({ triggerType: 1 });
executionSchema.index({ startTime: -1 });

// Virtual for progress percentage
executionSchema.virtual('progress').get(function () {
  if (this.totalNodes === 0) {
    return 0;
  }
  return Math.round((this.completedNodes / this.totalNodes) * 100);
});

// Virtual for success rate
executionSchema.virtual('isSuccessful').get(function () {
  return this.status === 'success';
});

// Pre-save middleware to calculate duration
executionSchema.pre('save', function (next) {
  if (this.endTime && this.startTime) {
    this.duration = this.endTime.getTime() - this.startTime.getTime();
  }
  next();
});

// Method to update node execution
executionSchema.methods.updateNodeExecution = function (
  nodeId: string,
  update: Partial<INodeExecution>
) {
  const nodeExecution = this.nodeExecutions.find((ne: INodeExecution) => ne.nodeId === nodeId);
  if (nodeExecution) {
    // Use safe merge to prevent prototype pollution
    safeObjectMerge(nodeExecution, update);

    // Calculate duration if both start and end times are present
    if (nodeExecution.startTime && nodeExecution.endTime) {
      nodeExecution.duration = nodeExecution.endTime.getTime() - nodeExecution.startTime.getTime();
    }

    // Update completed nodes count
    if (update.status === 'success' || update.status === 'error' || update.status === 'skipped') {
      this.completedNodes = this.nodeExecutions.filter((ne: INodeExecution) =>
        ['success', 'error', 'skipped'].includes(ne.status)
      ).length;
    }
  }
  return this.save();
};

// Static method to get execution statistics
executionSchema.statics.getStatistics = async function (workflowId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.aggregate([
    {
      $match: {
        workflowId,
        startTime: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalExecutions: { $sum: 1 },
        successfulExecutions: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
        failedExecutions: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
        averageDuration: { $avg: '$duration' },
      },
    },
  ]);

  return (
    stats[0] || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
    }
  );
};

export const Execution = mongoose.model<IExecution>('Execution', executionSchema);
