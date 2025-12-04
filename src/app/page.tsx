'use client';

import { useState } from 'react';
import { Mail, Zap, Shield, Clock, ArrowRight, CheckCircle, Folder, Filter, Chrome, ExternalLink } from 'lucide-react';

export default function LandingPage() {
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [selectedProblem, setSelectedProblem] = useState('');
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/inboxie-ai-email-assistan/ieocpkmconpngmncgdbhafnnhnamijdl";

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail || !selectedProblem) return;

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
    "Forget to respond to important emails",
    "No system for tracking what needs responses"
  ];

  if (waitlistSuccess) {
    return (
      <div className="landing-container">
        <div className="success-card">
          <CheckCircle size={64} className="success-icon" />
          <h1 className="success-title">Thanks for joining!</h1>
          <p className="success-text">
            We'll keep you updated on new features and improvements to inboxie.
          </p>
          <p className="success-subtext">
            In the meantime, you can install the extension from the Chrome Web Store.
          </p>
          <a 
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '1.5rem',
              padding: '1rem 2rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '1rem',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            Install Now <ExternalLink size={16} />
          </a>
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
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-dashboard-btn"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              Install Extension <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          {/* Header */}
          <div className="hero-header">
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '1rem'}}>
              <Chrome size={32} style={{color: '#ffffff'}} />
              <span style={{fontSize: '1rem', fontWeight: 600, color: '#ffffff'}}>Chrome Extension • Live on Chrome Web Store</span>
            </div>
            
            <h1 className="hero-title">
              Organize your emails in 10 seconds.<br />
              <span className="hero-title-highlight">Use the Chrome extension.</span>
            </h1>
            
            <p className="hero-subtitle">
              inboxie works inside Gmail to auto-label your emails and show you what needs replies. No new app to learn.
            </p>

            {/* Social Proof */}
            <div className="social-proof">
              <div className="social-proof-item">
                <Chrome size={16} />
                <span>Works directly in Gmail</span>
              </div>
              <div className="social-proof-item">
                <Zap size={16} />
                <span>Install in 10 seconds</span>
              </div>
              <div className="social-proof-item">
                <Shield size={16} />
                <span>Privacy-first approach</span>
              </div>
            </div>
          </div>

          {/* Demo Video */}
          <div style={{textAlign: 'center', marginBottom: '4rem'}}>
            <video 
              autoPlay 
              loop 
              muted 
              playsInline
              style={{
                maxWidth: '900px', 
                width: '100%', 
                borderRadius: '1.5rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              <source src="/demo.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <p style={{marginTop: '1rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic'}}>
              Watch inboxie organize 50 emails in seconds
            </p>
          </div>

          {/* Before/After Demo */}
          <div className="demo-grid">
            <div className="demo-card before">
              <h3 className="demo-title before-title">Gmail before inboxie</h3>
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
              <h3 className="demo-title after-title">Gmail after inboxie</h3>
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
                <div className="demo-smart-inbox">Smart Inbox: Only 2 emails need your attention</div>
              </div>
            </div>
          </div>

          {/* CTA Buttons - UPDATED */}
          {!showWaitlist ? (
            <div className="cta-section">
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-primary"
                style={{ textDecoration: 'none' }}
              >
                <Chrome size={20} />
                Install from Chrome Web Store
                <ExternalLink size={16} />
              </a>
              
              <p className="cta-microcopy">Free • Works in Gmail • No credit card required</p>
              
              <button
                onClick={() => setShowWaitlist(true)}
                style={{
                  marginTop: '1rem',
                  background: 'transparent',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '1rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
              >
                Join Email List for Updates
              </button>
            </div>
          ) : (
            <div className="waitlist-form-container">
              <h3 className="waitlist-title">Get Updates</h3>
              <p style={{textAlign: 'center', color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem'}}>
                Join our email list to hear about new features and improvements
              </p>
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
                    {isSubmittingWaitlist ? 'Joining...' : 'Join List'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-content">
          <h2 className="features-title">
            Three features. Zero setup. Works in Gmail.
          </h2>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-container green">
                <Filter size={32} className="feature-icon" />
              </div>
              <h3 className="feature-card-title">Smart Inbox</h3>
              <p className="feature-card-description">See only what needs replies</p>
              <p style={{color: '#6b7280', marginBottom: '1.5rem', fontSize: '1rem'}}>
                AI analyzes your emails and highlights the 1-5 that actually need your response. Everything else gets auto-labeled and filed away.
              </p>
              <ul className="feature-benefits">
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  High/medium/low urgency detection
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  One-click to see action items
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Never miss important emails
                </li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-container purple">
                <Zap size={32} className="feature-icon" />
              </div>
              <h3 className="feature-card-title">Auto-Labeling</h3>
              <p className="feature-card-description">AI organizes as emails arrive</p>
              <p style={{color: '#6b7280', marginBottom: '1.5rem', fontSize: '1rem'}}>
                Every email gets automatically labeled: Work, Personal, Shopping, Newsletter, Support, or Other. Labels appear directly in Gmail.
              </p>
              <ul className="feature-benefits">
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Works with Gmail labels
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Process 50 emails at once
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  No manual sorting needed
                </li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-container blue">
                <Clock size={32} className="feature-icon" />
              </div>
              <h3 className="feature-card-title">Dashboard Insights</h3>
              <p className="feature-card-description">Track your email progress</p>
              <p style={{color: '#6b7280', marginBottom: '1.5rem', fontSize: '1rem'}}>
                Floating dashboard shows how many emails you've organized, how many are left, and what needs replies. All without leaving Gmail.
              </p>
              <ul className="feature-benefits">
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Live email counters
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Reply tracking
                </li>
                <li className="feature-benefit">
                  <span className="benefit-dot"></span>
                  Minimizable & draggable
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="problem-section">
        <div className="problem-content">
          <h2 className="problem-title">
            How inboxie works
          </h2>
          
          <div className="problem-grid">
            <div className="problem-card">
              <h3 className="problem-card-title problem">Step 1: Install</h3>
              <ul className="problem-list">
                <li>Install the Chrome extension in <strong>10 seconds</strong></li>
                <li>Sign in with <strong>Google OAuth</strong> (no password needed)</li>
                <li>Grant Gmail permissions to read and label emails</li>
              </ul>
            </div>
            
            <div className="problem-card">
              <h3 className="problem-card-title solution">Step 2: Organize</h3>
              <ul className="problem-list">
                <li>Click <strong>"AI Organize"</strong> in the dashboard</li>
                <li>inboxie processes <strong>50 emails at once</strong></li>
                <li>AI categorizes and labels everything automatically</li>
                <li>Smart Inbox identifies emails needing replies</li>
              </ul>
            </div>
          </div>

          <div style={{marginTop: '2rem', textAlign: 'center'}}>
            <p style={{fontSize: '1.125rem', color: '#6b7280'}}>
              <strong>Step 3: Stay organized.</strong> The dashboard lives in Gmail and updates in real-time as you process more emails.
            </p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="trust-section">
        <div className="trust-content">
          <h2 className="trust-title">Built to work inside Gmail. Privacy-first. No new interface.</h2>
          
          <div className="trust-grid">
            <div className="trust-item">
              <Shield size={48} className="trust-icon blue" />
              <h3 className="trust-item-title">Google OAuth</h3>
              <p className="trust-item-text">Secure sign-in via Google's official OAuth. <strong>No passwords stored.</strong> We only store email metadata (categories, dates), never content.</p>
            </div>
            
            <div className="trust-item">
              <Mail size={48} className="trust-icon green" />
              <h3 className="trust-item-title">Works in Gmail</h3>
              <p className="trust-item-text">Chrome extension adds a floating dashboard to Gmail. <strong>No new app to learn.</strong> All labels appear as native Gmail labels.</p>
            </div>
            
            <div className="trust-item">
              <Chrome size={48} className="trust-icon purple" />
              <h3 className="trust-item-title">Chrome Extension</h3>
              <p className="trust-item-text">Install once, works forever. <strong>No browser switching.</strong> Dashboard stays with you as you navigate Gmail.</p>
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
            Chrome extension for AI-powered Gmail organization
          </p>
          <div style={{marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.875rem'}}>
            <a href="/privacy" style={{color: '#6b7280', textDecoration: 'none'}}>
              Privacy Policy
            </a>
            <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" style={{color: '#6b7280', textDecoration: 'none'}}>
              Chrome Web Store
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}