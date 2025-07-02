import { NextRequest, NextResponse } from 'next/server';
import { checkTrialExpirations } from '@/lib/trial-notifications';

// This endpoint is protected by a secret key to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      console.error('CRON_SECRET is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    // Verify the secret key
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('Unauthorized access attempt to cron endpoint');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting comprehensive trial expiration check...');

    // Run the comprehensive trial expiration check
    const result = await checkTrialExpirations();

    console.log('Trial expiration check completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Trial expiration check completed successfully',
      details: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in trial expiration check endpoint:', error);
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
