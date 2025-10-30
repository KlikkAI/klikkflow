/**
 * Collaboration Session Model for real-time workflow editing
 * Stores session data in PostgreSQL for persistence and scaling
 */

import mongoose, { type Document, Schema } from 'mongoose';

export interface ICollaborationSession extends Document {
  _id: string;
  workflowId: string;
  sessionId: string;
  ownerId: string;
  organizationId?: string;
  participants: Array<{
    userId: string;
    socketId: string;
    userName: string;
    avatar?: string;
    joinedAt: Date;
    lastSeen: Date;
    lastActivity: Date;
    role: 'owner' | 'editor' | 'viewer';
    cursor?: {
      x: number;
      y: number;
      nodeId?: string;
    };
    selection?: {
      nodeIds: string[];
      edgeIds: string[];
    };
  }>;
  isActive: boolean;
  endedAt?: Date;
  currentVersion: number;
  lastActivity: Date;
  settings: {
    allowAnonymous: boolean;
    maxParticipants: number;
    autoSave: boolean;
    autoSaveInterval: number; // minutes
    conflictResolution: 'last-write-wins' | 'operational-transform' | 'manual';
  };
  status: 'active' | 'paused' | 'ended';
  metadata: {
    totalOperations: number;
    totalConflicts: number;
    averageResponseTime: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const collaborationSessionSchema = new Schema<ICollaborationSession>(
  {
    workflowId: {
      type: String,
      required: true,
      ref: 'Workflow',
    },
    sessionId: {
      type: String,
      required: true,
    },
    ownerId: {
      type: String,
      required: true,
      ref: 'User',
    },
    organizationId: {
      type: String,
      ref: 'Organization',
    },
    participants: [
      {
        userId: {
          type: String,
          required: true,
          ref: 'User',
        },
        socketId: {
          type: String,
          required: true,
        },
        userName: {
          type: String,
          required: true,
        },
        avatar: {
          type: String,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        lastSeen: {
          type: Date,
          default: Date.now,
        },
        lastActivity: {
          type: Date,
          default: Date.now,
        },
        role: {
          type: String,
          enum: ['owner', 'editor', 'viewer'],
          default: 'editor',
        },
        cursor: {
          x: { type: Number },
          y: { type: Number },
          nodeId: { type: String },
        },
        selection: {
          nodeIds: [{ type: String }],
          edgeIds: [{ type: String }],
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    endedAt: {
      type: Date,
    },
    currentVersion: {
      type: Number,
      default: 0,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    settings: {
      allowAnonymous: {
        type: Boolean,
        default: false,
      },
      maxParticipants: {
        type: Number,
        default: 10,
      },
      autoSave: {
        type: Boolean,
        default: true,
      },
      autoSaveInterval: {
        type: Number,
        default: 5, // 5 minutes
      },
      conflictResolution: {
        type: String,
        enum: ['last-write-wins', 'operational-transform', 'manual'],
        default: 'operational-transform',
      },
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'ended'],
      default: 'active',
    },
    metadata: {
      totalOperations: {
        type: Number,
        default: 0,
      },
      totalConflicts: {
        type: Number,
        default: 0,
      },
      averageResponseTime: {
        type: Number,
        default: 0,
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
collaborationSessionSchema.index({ workflowId: 1 });
collaborationSessionSchema.index({ sessionId: 1 }, { unique: true });
collaborationSessionSchema.index({ ownerId: 1 });
collaborationSessionSchema.index({ organizationId: 1 });
collaborationSessionSchema.index({ status: 1 });

// TTL index to automatically cleanup old sessions (7 days) - also serves as query index
collaborationSessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Virtual for active participants
collaborationSessionSchema.virtual('activeParticipants').get(function () {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.participants.filter((p) => p.lastSeen > fiveMinutesAgo);
});

// Methods
collaborationSessionSchema.methods.addParticipant = function (participant: any) {
  const existingIndex = this.participants.findIndex((p: any) => p.userId === participant.userId);

  if (existingIndex >= 0) {
    // Update existing participant
    this.participants[existingIndex] = {
      ...this.participants[existingIndex],
      ...participant,
      lastSeen: new Date(),
    };
  } else {
    // Add new participant
    this.participants.push({
      ...participant,
      joinedAt: new Date(),
      lastSeen: new Date(),
    });
  }

  this.lastActivity = new Date();
  return this.save();
};

collaborationSessionSchema.methods.removeParticipant = function (userId: string) {
  this.participants = this.participants.filter((p: any) => p.userId !== userId);
  this.lastActivity = new Date();
  return this.save();
};

collaborationSessionSchema.methods.updateParticipantPresence = function (
  userId: string,
  presence: any
) {
  const participant = this.participants.find((p: any) => p.userId === userId);
  if (participant) {
    if (presence.cursor) {
      participant.cursor = presence.cursor;
    }
    if (presence.selection) {
      participant.selection = presence.selection;
    }
    participant.lastSeen = new Date();
    this.lastActivity = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

collaborationSessionSchema.methods.incrementVersion = function () {
  this.currentVersion += 1;
  this.metadata.totalOperations += 1;
  this.lastActivity = new Date();
  return this.save();
};

export const CollaborationSession = mongoose.model<ICollaborationSession>(
  'CollaborationSession',
  collaborationSessionSchema
);
