'use client';

import { signIn, getSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Zap, Shield, Clock, ArrowRight, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [selectedProblem, setSelectedProblem] = useState('');
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        router.push('/dashboard');
      }
    });
  }, [router]);

  const handleGmailLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signIn('google', {
        callbackUrl: '/dashboard',
        redirect: false
      });
      
      if (result?.ok) {
        router.push('/dashboard');
      } else {
        console.error('Login failed:', result?.error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail || !selectedProblem) return;

    setIsSubmittingWaitlist(true);
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: waitlistEmail, 
          biggest_problem: selectedProblem 
        })
      });

      if (response.ok) {
        setWaitlistSuccess(true);
      } else {
        const error = await response.json();
        console.error('Waitlist signup failed:', error);
      }
    } catch (error) {
      console.error('Waitlist error:', error);
    }
    setIsSubmittingWaitlist(false);
  };

  const problems = [
    "Drowning in too many emails (1000+ unread)",
    "Can't find important emails in the chaos",
    "Spend too much time organizing/sorting",
    "Miss important emails in the noise",
    "Overwhelmed by newsletters and promotions",
    "Take forever to write replies",
    "Forget to respond to important emails",
    "No system for tracking what needs responses"
  ];

  if (waitlistSuccess) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #dbeafe 0%, #f3e8ff 50%, #fef3c7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          background: 'white',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          padding: '2.5rem',
          textAlign: 'center'
        }}>
          <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 1.5rem' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827', margin: '0 0 1rem 0' }}>
            You're on the list!
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#6b7280', margin: '0 0 2rem 0' }}>
            We'll notify you when Inboxie is ready to transform your email experience.
          </p>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Thank you for helping us understand your biggest Gmail challenges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #dbeafe 0%, #f3e8ff 50%, #fef3c7 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: 'white',
        borderRadius: '1rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        padding: '2.5rem',
        textAlign: 'center'
      }}>
        {/* Logo Section */}
        <div style={{
          width: '4rem',
          height: '4rem',
          background: 'linear-gradient(45deg, #2563eb, #7c3aed)',
          borderRadius: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto'
        }}>
          <Mail size={32} color="white" />
        </div>

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#111827',
          margin: '0 0 0.5rem 0'
        }}>
          Welcome to Inboxie
        </h1>

        <p style={{
          fontSize: '1.125rem',
          color: '#6b7280',
          margin: '0 0 2rem 0'
        }}>
          {showWaitlist ? 'Join the waitlist' : 'Your AI-powered email assistant'}
        </p>

        {!showWaitlist ? (
          <>
            {/* Features List */}
            <div style={{
              display: 'grid',
              gap: '1rem',
              marginBottom: '2rem',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  background: '#dbeafe',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Zap size={16} color="#2563eb" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>
                    AI Email Categorization
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                    Automatically organize your inbox with smart labels
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  background: '#f3e8ff',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Shield size={16} color="#7c3aed" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>
                    Secure & Private
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                    Your emails are processed securely and never shared
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  background: '#fef3c7',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Clock size={16} color="#f59e0b" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>
                    Save Time Daily
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                    Spend less time organizing, more time on what matters
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Login Button */}
              <button
                onClick={handleGmailLogin}
                disabled={isLoading}
                style={{
                  width: '100%',
                  background: isLoading ? '#9ca3af' : 'linear-gradient(45deg, #7c3aed, #2563eb)',
                  color: 'white',
                  border: 'none',
                  padding: '1rem 1.5rem',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.3s ease',
                  transform: isLoading ? 'none' : 'translateY(0)',
                  boxShadow: isLoading ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.4)'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(124, 58, 237, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.4)';
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <div style={{
                      width: '1.25rem',
                      height: '1.25rem',
                      border: '2px solid #ffffff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Mail size={20} />
                    Connect with Gmail
                  </>
                )}
              </button>

              {/* Waitlist Button */}
              <button
                onClick={() => setShowWaitlist(true)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#9ca3af';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                Join Waitlist Instead
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          /* Waitlist Form */
          <form onSubmit={handleWaitlistSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="email"
                placeholder="Enter your email"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.3s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
              />
            </div>

            <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '0.75rem' 
              }}>
                What's your biggest Gmail problem?
              </label>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {problems.map((problem) => (
                  <label
                    key={problem}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      border: selectedProblem === problem ? '2px solid #2563eb' : '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      backgroundColor: selectedProblem === problem ? '#eff6ff' : 'transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="radio"
                      name="problem"
                      value={problem}
                      checked={selectedProblem === problem}
                      onChange={(e) => setSelectedProblem(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                      {problem}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowWaitlist(false)}
                style={{
                  flex: '0 0 auto',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!waitlistEmail || !selectedProblem || isSubmittingWaitlist}
                style={{
                  flex: '1',
                  padding: '0.75rem 1rem',
                  background: (!waitlistEmail || !selectedProblem || isSubmittingWaitlist) 
                    ? '#9ca3af' 
                    : 'linear-gradient(45deg, #7c3aed, #2563eb)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: (!waitlistEmail || !selectedProblem || isSubmittingWaitlist) 
                    ? 'not-allowed' 
                    : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                {isSubmittingWaitlist ? 'Joining...' : 'Join Waitlist'}
              </button>
            </div>
          </form>
        )}

        <p style={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          margin: '1.5rem 0 0 0'
        }}>
          By connecting, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}