import { NextResponse } from 'next/server';
import { isSnowflakeConfigured } from '@/lib/snowflake';

// Tells the header switch whether Live mode is available. Reports only a boolean, never credentials.
export async function GET() {
  return NextResponse.json({ configured: isSnowflakeConfigured() });
}
