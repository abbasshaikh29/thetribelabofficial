import { dbconnect } from './db';
import mongoose from 'mongoose';
import { sendEmail, EmailOptions, EmailResult } from './resend';

// Email job interface
export interface EmailJob {
  _id?: mongoose.Types.ObjectId;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  priority: 'high' | 'normal' | 'low';
  tags?: Array<{ name: string; value: string }>;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  scheduledAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Email job schema
const emailJobSchema = new mongoose.Schema<EmailJob>({
  to: { type: mongoose.Schema.Types.Mixed, required: true },
  subject: { type: String, required: true },
  html: { type: String, required: true },
  text: { type: String },
  from: { type: String },
  replyTo: { type: String },
  priority: { 
    type: String, 
    enum: ['high', 'normal', 'low'], 
    default: 'normal',
    index: true 
  },
  tags: [{ 
    name: { type: String, required: true },
    value: { type: String, required: true }
  }],
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'], 
    default: 'pending',
    index: true 
  },
  scheduledAt: { type: Date, default: Date.now, index: true },
  processedAt: { type: Date },
  completedAt: { type: Date },
  error: { type: String },
  result: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for performance
emailJobSchema.index({ status: 1, priority: -1, scheduledAt: 1 });
emailJobSchema.index({ createdAt: -1 });
emailJobSchema.index({ status: 1, attempts: 1 });

// Get or create the model using the standard Mongoose pattern to avoid redefining the model
const EmailJobModel = mongoose.models.EmailJob || mongoose.model<EmailJob>('EmailJob', emailJobSchema);

export class EmailQueue {
  /**
   * Add an email job to the queue
   */
  static async addJob(
    emailOptions: EmailOptions, 
    options: {
      priority?: 'high' | 'normal' | 'low';
      scheduledAt?: Date;
      maxAttempts?: number;
    } = {}
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      await dbconnect();

      const job = new EmailJobModel({
        to: emailOptions.to,
        subject: emailOptions.subject,
        html: emailOptions.html,
        text: emailOptions.text,
        from: emailOptions.from,
        replyTo: emailOptions.replyTo,
        priority: options.priority || 'normal',
        tags: emailOptions.tags || [],
        maxAttempts: options.maxAttempts || 3,
        scheduledAt: options.scheduledAt || new Date(),
        status: 'pending'
      });

      await job.save();

      console.log(`Email job added to queue: ${job._id}`);
      return { success: true, jobId: job._id?.toString() };

    } catch (error: any) {
      console.error('Error adding email job to queue:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process pending email jobs
   */
  static async processJobs(limit: number = 10): Promise<{
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    try {
      await dbconnect();

      // Get pending jobs ordered by priority and scheduled time
      const jobs = await EmailJobModel.find({
        status: 'pending',
        scheduledAt: { $lte: new Date() },
        $expr: { $lt: ["$attempts", "$maxAttempts"] }
      })
      .sort({ priority: -1, scheduledAt: 1 })
      .limit(limit);

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const job of jobs as (mongoose.Document<unknown, {}, EmailJob> & EmailJob)[]) {
        try {
          // Mark as processing
          job.status = 'processing';
          job.processedAt = new Date();
          job.attempts += 1;
          await job.save();

          // Send the email
          const emailResult = await sendEmail({
            to: job.to,
            subject: job.subject,
            html: job.html,
            text: job.text,
            from: job.from,
            replyTo: job.replyTo,
            priority: job.priority,
            tags: job.tags
          });

          if (emailResult.success) {
            // Mark as completed
            job.status = 'completed';
            job.completedAt = new Date();
            job.result = emailResult;
            await job.save();
            
            results.successful++;
            console.log(`Email job ${job._id} completed successfully`);
          } else {
            // Handle failure
            await this.handleJobFailure(job, emailResult.error || 'Unknown error');
            results.failed++;
          }

        } catch (error: any) {
          // Handle processing error
          await this.handleJobFailure(job, error.message);
          results.failed++;
          results.errors.push(`Job ${job._id}: ${error.message}`);
        }

        results.processed++;
      }

      return results;

    } catch (error: any) {
      console.error('Error processing email jobs:', error);
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private static async handleJobFailure(job: mongoose.Document<unknown, {}, EmailJob> & EmailJob, error: string): Promise<void> {
    job.error = error;

    if (job.attempts >= job.maxAttempts) {
      // Max attempts reached, mark as failed
      job.status = 'failed';
      console.error(`Email job ${job._id} failed after ${job.attempts} attempts: ${error}`);
    } else {
      // Schedule for retry with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, job.attempts), 300000); // Max 5 minutes
      job.status = 'pending';
      job.scheduledAt = new Date(Date.now() + retryDelay);
      console.log(`Email job ${job._id} scheduled for retry in ${retryDelay}ms (attempt ${job.attempts})`);
    }

    await job.save();
  }

  /**
   * Get job statistics
   */
  static async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    try {
      await dbconnect();

      const stats = await EmailJobModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0
      };

      stats.forEach(stat => {
        result[stat._id as keyof typeof result] = stat.count;
        result.total += stat.count;
      });

      return result;

    } catch (error: any) {
      console.error('Error getting email queue stats:', error);
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0
      };
    }
  }

  /**
   * Clean up old completed jobs
   */
  static async cleanup(olderThanDays: number = 30): Promise<{ deleted: number }> {
    try {
      await dbconnect();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await EmailJobModel.deleteMany({
        status: { $in: ['completed', 'failed'] },
        updatedAt: { $lt: cutoffDate }
      });

      console.log(`Cleaned up ${result.deletedCount} old email jobs`);
      return { deleted: result.deletedCount || 0 };

    } catch (error: any) {
      console.error('Error cleaning up email jobs:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Cancel a pending job
   */
  static async cancelJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await dbconnect();

      const job = await EmailJobModel.findById(jobId);
      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      if (job.status !== 'pending') {
        return { success: false, error: `Cannot cancel job with status: ${job.status}` };
      }

      job.status = 'cancelled';
      await job.save();

      return { success: true };

    } catch (error: any) {
      console.error('Error cancelling email job:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retry a failed job
   */
  static async retryJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await dbconnect();

      const job = await EmailJobModel.findById(jobId);
      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      if (job.status !== 'failed') {
        return { success: false, error: `Cannot retry job with status: ${job.status}` };
      }

      job.status = 'pending';
      job.attempts = 0;
      job.error = undefined;
      job.scheduledAt = new Date();
      await job.save();

      return { success: true };

    } catch (error: any) {
      console.error('Error retrying email job:', error);
      return { success: false, error: error.message };
    }
  }
}

export { EmailJobModel };
