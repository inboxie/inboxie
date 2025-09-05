'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Zap, Shield, Clock, ArrowRight, CheckCircle, Star, Users, Folder, Filter } from 'lucide-react';

export default function LandingPage() {
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [selectedProblem, setSelectedProblem] = useState('');
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const router = useRouter();

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail || !selectedProblem) return;

    // Track waitlist signup for analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'waitlist_signup', {
        event_category: 'conversion',
        event_label: selectedProblem
      });
    }

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
      <div className="landing-container">
        <div className="success-card">
          <CheckCircle size={64} className="success-icon" />
          <h1 className="success-title">You're on the list!</h1>
          <p className="success-text">
            We'll notify you when inboxie is ready to transform your email experience.
          </p>
          <p className="success-subtext">
            Thank you for helping us understand your biggest Gmail challenges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-container">
      {/* Navigation Header */}
      <nav className="landing-nav">
        <div className="nav-content">
          <div className="nav-logo">
            <div className="nav-logo-icon">
              <Mail size={16} className="nav-icon" />
            </div>
            <span className="nav-logo-text">inboxie</span>
          </div>
          <div className="nav-actions">
            <button
              onClick={() => setShowWaitlist(true)}
              className="nav-dashboard-btn"
            >
              Get Early Access
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          {/* Header */}
          <div className="hero-header">
            <h1 className="hero-title">
              You missed an important client email.<br />
              <span className="hero-title-highlight">Again.</span>
            </h1>
            
            <p className="hero-subtitle">
              inboxie clears the chaos so you can focus on replies that <strong>really</strong> matter.
            </p>

            {/* Social Proof */}
            <div className="social-proof">
              <div className="social-proof-item">
                <Users size={16} />
                <span>Used by early testers across tech, consulting, and solopreneurs</span>
              </div>
              <div className="social-proof-item">
                <Star size={16} />
                <span>Built by a consultant drowning in 700+ emails/week</span>
              </div>
              <div className="social-proof-item">
                <Shield size={16} />
                <span>Privacy-first approach</span>
              </div>
            </div>
          </div>

          {/* Before/After Demo with captions */}
          <div className="demo-grid">
            <div className="demo-card before">
              <h3 className="demo-title before-title">Inbox before inboxie</h3>
              <div className="demo-emails">
                <div className="demo-email">Newsletter: Weekly digest...</div>
                <div className="demo-email">Order confirmation...</div>
                <div className="demo-email">Meeting invite...</div>
                <div className="demo-email">Promotional offer...</div>
                <div className="demo-email">Client inquiry...</div>
                <div className="demo-count">+ 995 more unread emails...</div>
              </div>
            </div>

            <div className="demo-card after">
              <h3 className="demo-title after-title">Inbox after inboxie</h3>
              <div className="demo-emails">
                <div className="demo-email organized work">
                  <Folder size={14} className="demo-folder-icon" />Work: Client inquiry...
                </div>
                <div className="demo-email organized personal">
                  <Folder size={14} className="demo-folder-icon" />Personal: Meeting invite...
                </div>
                <div className="demo-email organized shopping">
                  <Folder size={14} className="demo-folder-icon" />Shopping: Order confirmation...
                </div>
                <div className="demo-smart-inbox">Smart Inbox: Only 2 emails need your attention today</div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          {!showWaitlist ? (
            <div className="cta-section">
              <button
                onClick={() => setShowWaitlist(true)}
                className="cta-primary"
              >
                <Mail size={20} />
                Get Early Access
                <ArrowRight size={16} />
              </button>
              
              <p className="cta-microcopy">Takes 10 seconds. No spam, ever.</p>
            </div>
          ) : (
            <div className="waitlist-form-container">
              <h3 className="waitlist-title">Early Access Form</h3>
              <form onSubmit={handleWaitlistSubmit} className="waitlist-form">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  required
                  className="waitlist-email-input"
                />
                
                <div className="waitlist-problems-section">
                  <label className="waitlist-problems-label">
                    What's your biggest Gmail problem?
                  </label>
                  <div className="waitlist-problems-list">
                    {problems.map((problem) => (
                      <label
                        key={problem}
                        className={`problem-option ${selectedProblem === problem ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="problem"
                          value={problem}
                          checked={selectedProblem === problem}
                          onChange={(e) => setSelectedProblem(e.target.value)}
                          className="problem-radio"
                        />
                        <span className="problem-text">{problem}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="waitlist-actions">
                  <button
                    type="button"
                    onClick={() => setShowWaitlist(false)}
                    className="waitlist-back-btn"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!waitlistEmail || !selectedProblem || isSubmittingWaitlist}
                    className="waitlist-submit-btn"
                  >
                    {isSubmittingWaitlist ? 'Joining...' : 'Join Waitlist'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Updated Features Section */}
      <section className="features-section">
        <div className="features-content">
          <h2 className="features-title">
            Save hours each week. Stay focused.
          </h2>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-container green">
                <Filter size={32} className="feature-icon" />
              </div>
              <h3 className="feature-card-title">Smart Inbox</h3>
              <p className="feature-card-description">Only see what needs your attention</p>
              <p style={{color: '#6b7280', marginBottom: '1.5rem', fontSize: '1rem'}}>
                Your Smart Inbox highlights just the 1–3 emails that actually need a response. Everything else is ignored.
              </p>
              <ul className="feature-benefits">
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Prioritize replies
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Skip the noise
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Focus on what matters
                </li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-container purple">
                <Zap size={32} className="feature-icon" />
              </div>
              <h3 className="feature-card-title">Auto-Labeling</h3>
              <p className="feature-card-description">Let AI organize your Gmail</p>
              <p style={{color: '#6b7280', marginBottom: '1.5rem', fontSize: '1rem'}}>
                inboxie auto-labels your emails by type: Work, Personal, Promos, Orders, Clients & no setup needed.
              </p>
              <ul className="feature-benefits">
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Built-in Gmail labels
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  No switching tools
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Just open and go
                </li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-container blue">
                <Clock size={32} className="feature-icon" />
              </div>
              <h3 className="feature-card-title">Reply in Your Tone</h3>
              <p className="feature-card-description">AI drafts replies in your voice</p>
              <p style={{color: '#6b7280', marginBottom: '1.5rem', fontSize: '1rem'}}>
                Trained on your own writing style, inboxie helps you reply 10x faster and sound like yourself.
              </p>
              <ul className="feature-benefits">
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Voice-matching replies
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Saves hours every week
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  No robotic AI-speak
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="problem-section">
        <div className="problem-content">
          <h2 className="problem-title">
            Tired of email taking over your life?
          </h2>
          
          <div className="problem-grid">
            <div className="problem-card">
              <h3 className="problem-card-title problem">The Problem</h3>
              <ul className="problem-list">
                <li>Your inbox has <strong>1,000+ unread emails</strong> and it's giving you anxiety</li>
                <li><strong>Important messages are buried</strong> in newsletters and promos</li>
                <li>You're wasting <strong>hours manually sorting</strong> what's junk vs urgent</li>
                <li>You <strong>miss critical emails</strong> from clients, colleagues, or your boss</li>
                <li>You have <strong>no system</strong> to track what actually needs a response</li>
              </ul>
            </div>
            
            <div className="problem-card">
              <h3 className="problem-card-title solution">The Solution</h3>
              <ul className="problem-list">
                <li><strong>AI organizes everything</strong> the moment it lands in your inbox</li>
                <li><strong>Smart Inbox</strong> shows you just the emails that need action</li>
                <li><strong>Color-coded Gmail labels</strong> help you spot what's what instantly</li>
                <li>You'll <strong>never miss another important message</strong> again</li>
                <li><strong>Reply 10x faster</strong> in your own tone with AI-powered drafts</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="trust-section">
        <div className="trust-content">
          <h2 className="trust-title">Works with your Gmail · No new app to learn · Designed for busy people</h2>
          
          <div className="trust-grid">
            <div className="trust-item">
              <Shield size={48} className="trust-icon blue" />
              <h3 className="trust-item-title">Google OAuth</h3>
              <p className="trust-item-text">Secure sign-in via Google's official OAuth — <strong>no passwords stored</strong>.</p>
            </div>
            
            <div className="trust-item">
              <Mail size={48} className="trust-icon green" />
              <h3 className="trust-item-title">Gmail Integration</h3>
              <p className="trust-item-text">Works directly inside Gmail. <strong>No new interface to learn.</strong></p>
            </div>
            
            <div className="trust-item">
              <Clock size={48} className="trust-icon purple" />
              <h3 className="trust-item-title">Built for Busy People</h3>
              <p className="trust-item-text">No settings. No rules to manage. <strong>Works out of the box</strong> to save you time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <div className="footer-logo-icon">
              <Mail size={16} />
            </div>
            <span className="footer-logo-text">inboxie</span>
          </div>
          <p className="footer-text">
            Transform your Gmail experience with AI-powered email organization
          </p>
        </div>
      </footer>
    </div>
  );
}