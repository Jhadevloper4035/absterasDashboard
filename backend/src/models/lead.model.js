import mongoose from 'mongoose';

export const LEAD_STATUSES = [
  'NEW',
  'ASSIGNED',
  'ACCEPTED',
  'CONTACT_ATTEMPTED',
  'CONTACTED',
  'QUALIFIED',
  'MEETING_SCHEDULED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
  'LOST',
  'ON_HOLD',
];

const ACTIVE_LEAD_STATUSES = LEAD_STATUSES.filter((status) => !['WON', 'LOST', 'ON_HOLD'].includes(status));

const attachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      min: 0,
    },
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
    },
    images: [attachmentSchema],
    isInternal: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

const followUpSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['call', 'email', 'whatsapp', 'meeting', 'task'],
      default: 'task',
    },
    dueAt: Date,
    timezone: {
      type: String,
      default: 'UTC',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'skipped', 'cancelled'],
      default: 'pending',
    },
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false },
);

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ['manual', 'csv', 'api', 'webhook', 'integration'],
      default: 'manual',
    },
    campaign: {
      type: String,
      trim: true,
    },
    productInterest: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    normalizedEmail: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    normalizedPhone: {
      type: String,
      trim: true,
      index: true,
    },
    company: {
      type: String,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    assignmentException: {
      type: Boolean,
      default: false,
    },
    territory: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: 'NEW',
    },
    statusReason: {
      type: String,
      trim: true,
    },
    statusHistory: [
      {
        from: {
          type: String,
          enum: LEAD_STATUSES,
        },
        to: {
          type: String,
          enum: LEAD_STATUSES,
          required: true,
        },
        reason: {
          type: String,
          trim: true,
        },
        actor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    assignmentHistory: [
      {
        previousOwner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        newOwner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reason: {
          type: String,
          trim: true,
        },
        rule: {
          type: String,
          trim: true,
        },
        actor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    nextAction: followUpSchema,
    notes: [noteSchema],
    attachments: [attachmentSchema],
    closedAt: Date,
    lossReason: {
      type: String,
      trim: true,
    },
    lossComment: {
      type: String,
      trim: true,
    },
    duplicateReview: {
      status: {
        type: String,
        enum: ['none', 'possible_duplicate', 'linked', 'merged', 'ignored', 'rejected'],
        default: 'none',
      },
      matchedLead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
      },
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      decidedAt: Date,
      reason: {
        type: String,
        trim: true,
      },
    },
  },
  { timestamps: true },
);

leadSchema.pre('validate', function setDerivedLeadFields() {
  if (this.email && !this.normalizedEmail) {
    this.normalizedEmail = this.email;
  }

  if (this.phone && !this.normalizedPhone) {
    this.normalizedPhone = this.phone.replace(/[^\d+]/g, '');
  }

  if (!this.owner && ACTIVE_LEAD_STATUSES.includes(this.status)) {
    this.assignmentException = true;
  }

  if (['LOST', 'ON_HOLD'].includes(this.status) && !this.statusReason) {
    this.invalidate('statusReason', `${this.status} requires a reason`);
  }

  if (this.status === 'LOST' && !this.lossReason) {
    this.invalidate('lossReason', 'LOST requires a loss reason');
  }

});

export const Lead = mongoose.model('Lead', leadSchema);
