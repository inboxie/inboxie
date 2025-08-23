import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userEmail, planType } = await request.json();

    if (!userEmail || !planType) {
      return NextResponse.json({
        success: false,
        error: 'userEmail and planType are required'
      }, { status: 400 });
    }

    // Get or create user
    const user = await getOrCreateUser(userEmail);

    // Update plan type
    const { error } = await supabase
      .from('users')
      .update({ 
        plan_type: planType,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Plan updated to ${planType}`,
      data: { planType }
    });

  } catch (error) {
    console.error('Error updating user plan:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update user plan'
    }, { status: 500 });
  }
}