/**
 * Operation Model for Operational Transform
 * Stores all collaborative operations for conflict resolution and history
 */

import mongoose, { type Document, Schema } from 'mongoose';

export interface IOperation extends Document {
  _id: string;
  sessionId: string;
  workflowId: string;
  userId: string;
  operationId: string; // Unique operation ID for OT
  parentOperationId?: string; // For operation chains
  type:
    | 'node_add'
    | 'node_delete'
    | 'node_update'
    | 'node_move'
    | 'edge_add'
    | 'edge_delete'
    | 'edge_update'
    | 'property_update'
    | 'bulk_update'
    | 'transform';
  target: {
    type: 'node' | 'edge' | 'workflow' | 'property';
    id: string;
    path?: string; // For nested property updates
  };
  data: {
    before?: any; // Previous state
    after?: any; // New state
    delta?: any; // Change description
  };
  position: {
    x?: number;
    y?: number;
    index?: number; // For ordered operations
  };
  version: number; // Session version when operation was created
  appliedVersion?: number; // Version when operation was applied
  status: 'pending' | 'applied' | 'rejected' | 'transformed';
  transformations: Array<{
    operationId: string;
    type: 'composition' | 'transformation';
    timestamp: Date;
  }>;
  conflicts: Array<{
    conflictingOperationId: string;
    resolutionStrategy: 'auto' | 'manual' | 'priority';
    resolvedBy?: string;
    resolvedAt?: Date;
  }>;
  metadata: {
    clientId: string;
    timestamp: Date;
    latency?: number;
    retryCount?: number;
    source: 'user' | 'system' | 'sync';
  };
  createdAt: Date;
  updatedAt: Date;
}

const operationSchema = new Schema<IOperation>(
  {
    sessionId: {
      type: String,
      required: true,
      ref: 'CollaborationSession',
    },
    workflowId: {
      type: String,
      required: true,
      ref: 'Workflow',
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    operationId: {
      type: String,
      required: true,
    },
    parentOperationId: {
      type: String,
      ref: 'Operation',
    },
    type: {
      type: String,
      enum: [
        'node_add',
        'node_delete',
        'node_update',
        'node_move',
        'edge_add',
        'edge_delete',
        'edge_update',
        'property_update',
        'bulk_update',
        'transform',
      ],
      required: true,
    },
    target: {
      type: {
        type: String,
        enum: ['node', 'edge', 'workflow', 'property'],
        required: true,
      },
      id: {
        type: String,
        required: true,
      },
      path: {
        type: String, // For nested property updates like "nodes.node1.data.label"
      },
    },
    data: {
      before: Schema.Types.Mixed,
      after: Schema.Types.Mixed,
      delta: Schema.Types.Mixed,
    },
    position: {
      x: { type: Number },
      y: { type: Number },
      index: { type: Number },
    },
    version: {
      type: Number,
      required: true,
    },
    appliedVersion: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'applied', 'rejected', 'transformed'],
      default: 'pending',
    },
    transformations: [
      {
        operationId: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ['composition', 'transformation'],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    conflicts: [
      {
        conflictingOperationId: {
          type: String,
          required: true,
        },
        resolutionStrategy: {
          type: String,
          enum: ['auto', 'manual', 'priority'],
          default: 'auto',
        },
        resolvedBy: {
          type: String,
          ref: 'User',
        },
        resolvedAt: {
          type: Date,
        },
      },
    ],
    metadata: {
      clientId: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      latency: {
        type: Number,
      },
      retryCount: {
        type: Number,
        default: 0,
      },
      source: {
        type: String,
        enum: ['user', 'system', 'sync'],
        default: 'user',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
operationSchema.index({ sessionId: 1, version: 1 });
operationSchema.index({ workflowId: 1, createdAt: -1 });
operationSchema.index({ userId: 1, createdAt: -1 });
operationSchema.index({ operationId: 1 }, { unique: true });
operationSchema.index({ status: 1 });
operationSchema.index({ 'target.type': 1, 'target.id': 1 });

// TTL index to cleanup old operations (30 days)
operationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Methods for operational transform
operationSchema.methods.transform = function (_otherOperation: IOperation) {
  // This will be implemented by the OperationalTransform service
  // For now, return a simple transform
  return {
    operation: this,
    transformed: false,
    conflicts: [],
  };
};

operationSchema.methods.compose = function (otherOperation: IOperation) {
  // Compose two operations into one if possible
  if (
    this.target.id === otherOperation.target.id &&
    this.target.type === otherOperation.target.type
  ) {
    return {
      ...this.toObject(),
      data: {
        before: this.data.before,
        after: otherOperation.data.after,
        delta: { ...this.data.delta, ...otherOperation.data.delta },
      },
      version: Math.max(this.version, otherOperation.version),
      transformations: [...this.transformations, ...otherOperation.transformations],
    };
  }
  return null;
};

operationSchema.methods.inverse = function () {
  // Create inverse operation for undo functionality
  return {
    ...this.toObject(),
    operationId: `${this.operationId}_inverse`,
    data: {
      before: this.data.after,
      after: this.data.before,
      delta: this.invertDelta(this.data.delta),
    },
    metadata: {
      ...this.metadata,
      source: 'system',
      timestamp: new Date(),
    },
  };
};

operationSchema.methods.invertDelta = function (delta: any) {
  if (!delta) {
    return null;
  }

  // Simple delta inversion - this would be more complex in practice
  const inverted: any = {};

  for (const [key, value] of Object.entries(delta)) {
    if (typeof value === 'object' && value !== null) {
      inverted[key] = this.invertDelta(value);
    } else {
      // For simple values, we'd need the previous state to create proper inverse
      inverted[key] = null; // This would be properly implemented
    }
  }

  return inverted;
};

export const Operation = mongoose.model<IOperation>('Operation', operationSchema);
