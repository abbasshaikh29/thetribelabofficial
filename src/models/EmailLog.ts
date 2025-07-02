import mongoose, { Schema, model, models } from "mongoose";

export interface IEmailLog {
  _id?: mongoose.Types.ObjectId;
  to: string | string[];
  from: string;
  subject: string;
  category: string; // email_verification, trial_reminder, payment_failed, etc.
  status: 'sent' | 'delivered' | 'bounced' | 'failed' | 'opened' | 'clicked';
  messageId?: string;
  resendId?: string;
  userId?: mongoose.Types.ObjectId;
  communityId?: mongoose.Types.ObjectId;
  jobId?: mongoose.Types.ObjectId; // Reference to email queue job
  
  // Timestamps
  sentAt: Date;
  deliveredAt?: Date;
  bouncedAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  
  // Error information
  error?: string;
  errorCode?: string;
  
  // Email content metadata
  tags?: Array<{ name: string; value: string }>;
  priority?: 'high' | 'normal' | 'low';
  
  // Analytics
  openCount: number;
  clickCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const emailLogSchema = new Schema<IEmailLog>({
  to: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true,
    index: true 
  },
  from: { 
    type: String, 
    required: true 
  },
  subject: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true,
    index: true,
    enum: [
      'email_verification',
      'trial_reminder', 
      'trial_expired',
      'trial_welcome',
      'renewal_reminder',
      'payment_failed',
      'subscription_cancelled',
      'community_suspended',
      'general'
    ]
  },
  status: { 
    type: String, 
    required: true,
    index: true,
    enum: ['sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked'],
    default: 'sent'
  },
  messageId: { 
    type: String,
    index: true 
  },
  resendId: { 
    type: String,
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true 
  },
  communityId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Community',
    index: true 
  },
  jobId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'EmailJob' 
  },
  
  // Timestamps
  sentAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  deliveredAt: { type: Date },
  bouncedAt: { type: Date },
  openedAt: { type: Date },
  clickedAt: { type: Date },
  
  // Error information
  error: { type: String },
  errorCode: { type: String },
  
  // Email content metadata
  tags: [{ 
    name: { type: String, required: true },
    value: { type: String, required: true }
  }],
  priority: { 
    type: String, 
    enum: ['high', 'normal', 'low'],
    default: 'normal'
  },
  
  // Analytics
  openCount: { 
    type: Number, 
    default: 0 
  },
  clickCount: { 
    type: Number, 
    default: 0 
  }
}, {
  timestamps: true
});

// Compound indexes for analytics queries
emailLogSchema.index({ category: 1, status: 1, sentAt: -1 });
emailLogSchema.index({ userId: 1, category: 1, sentAt: -1 });
emailLogSchema.index({ communityId: 1, category: 1, sentAt: -1 });
emailLogSchema.index({ sentAt: -1 });

// Static methods for analytics
emailLogSchema.statics.getDeliveryStats = async function(
  filter: any = {}, 
  dateRange?: { start: Date; end: Date }
) {
  const matchStage: any = { ...filter };
  
  if (dateRange) {
    matchStage.sentAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        categories: { $addToSet: '$category' }
      }
    }
  ]);

  const result = {
    sent: 0,
    delivered: 0,
    bounced: 0,
    failed: 0,
    opened: 0,
    clicked: 0,
    total: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0
  };

  stats.forEach(stat => {
    const status = stat._id as string;
    if (status in result && status !== 'total' && status !== 'deliveryRate' && status !== 'openRate' && status !== 'clickRate') {
      (result as any)[status] = stat.count;
      result.total += stat.count;
    }
  });

  // Calculate rates
  if (result.total > 0) {
    result.deliveryRate = (result.delivered / result.total) * 100;
    result.openRate = result.delivered > 0 ? (result.opened / result.delivered) * 100 : 0;
    result.clickRate = result.delivered > 0 ? (result.clicked / result.delivered) * 100 : 0;
  }

  return result;
};

emailLogSchema.statics.getCategoryStats = async function(
  dateRange?: { start: Date; end: Date }
) {
  const matchStage: any = {};
  
  if (dateRange) {
    matchStage.sentAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }

  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        sent: { $sum: 1 },
        delivered: { 
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } 
        },
        opened: { 
          $sum: { $cond: [{ $eq: ['$status', 'opened'] }, 1, 0] } 
        },
        failed: { 
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } 
        }
      }
    },
    {
      $addFields: {
        deliveryRate: {
          $cond: [
            { $gt: ['$sent', 0] },
            { $multiply: [{ $divide: ['$delivered', '$sent'] }, 100] },
            0
          ]
        },
        openRate: {
          $cond: [
            { $gt: ['$delivered', 0] },
            { $multiply: [{ $divide: ['$opened', '$delivered'] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { sent: -1 } }
  ]);
};

// Instance methods
emailLogSchema.methods.markDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

emailLogSchema.methods.markBounced = function(error?: string) {
  this.status = 'bounced';
  this.bouncedAt = new Date();
  if (error) this.error = error;
  return this.save();
};

emailLogSchema.methods.markOpened = function() {
  if (this.status === 'delivered') {
    this.status = 'opened';
    this.openedAt = new Date();
  }
  this.openCount += 1;
  return this.save();
};

emailLogSchema.methods.markClicked = function() {
  if (this.status === 'delivered' || this.status === 'opened') {
    this.status = 'clicked';
    this.clickedAt = new Date();
  }
  this.clickCount += 1;
  return this.save();
};

emailLogSchema.methods.markFailed = function(error: string, errorCode?: string) {
  this.status = 'failed';
  this.error = error;
  if (errorCode) this.errorCode = errorCode;
  return this.save();
};

export const EmailLog = models.EmailLog || model<IEmailLog>("EmailLog", emailLogSchema);
