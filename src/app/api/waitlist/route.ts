// src/app/api/waitlist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, biggest_problem } = body;

    // Validate input
    if (!email || !biggest_problem) {
      return NextResponse.json(
        { error: 'Email and problem selection are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Insert into waitlist
    const { data, error } = await supabase
      .from('waitlist')
      .insert([
        {
          email: email.toLowerCase().trim(),
          biggest_problem: biggest_problem
        }
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      
      // Handle duplicate email
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Email already registered on waitlist' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to join waitlist' },
        { status: 500 }
      );
    }

    console.log('New waitlist signup:', { email, biggest_problem });

    return NextResponse.json({
      success: true,
      message: 'Successfully added to waitlist',
      data: data[0]
    });

  } catch (error) {
    console.error('Waitlist API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check waitlist status or get stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('waitlist')
      .select('email, created_at')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error) {
      return NextResponse.json(
        { exists: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      exists: true,
      joined_at: data.created_at
    });

  } catch (error) {
    console.error('Waitlist GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}