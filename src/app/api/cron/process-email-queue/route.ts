import { NextRequest, NextResponse } from 'next/server';
import { EmailQueue } from '@/lib/email-queue';

// This endpoint is protected by a secret key to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

const JOB_LIMIT = 50; // Process up to 50 emails per run

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      console.error('CRON_SECRET environment variable is required');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    // Verify the secret key
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn('Unauthorized attempt to access email processing cron job.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting email queue processing...');

    // Process jobs from the email queue
    const result = await EmailQueue.processJobs(JOB_LIMIT);

    console.log('Email queue processing finished.', result);

    return NextResponse.json({
      success: true,
      message: 'Email queue processed successfully.',
      details: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in email queue processing endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 