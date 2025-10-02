'use client';

import Link from 'next/link';
import { Mail, ArrowLeft, Shield, Lock, Database, Zap, CheckCircle } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="landing-container">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-content">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">
              <Mail size={16} className="nav-icon" />
            </div>
            <span className="nav-logo-text">inboxie</span>
          </Link>
          <Link href="/" className="nav-dashboard-btn" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <section className="hero-section" style={{paddingTop: '2rem'}}>
        <div className="hero-content">
          <div style={{maxWidth: '900px', margin: '0 auto'}}>
            {/* Header Card */}
            <div className="demo-card" style={{marginBottom: '3rem', textAlign: 'center'}}>
              <div style={{display: 'flex', justifyContent: 'center', marginBottom: '1.5rem'}}>
                <div className="feature-icon-container blue">
                  <Shield size={32} className="feature-icon" />
                </div>
              </div>
              <h1 style={{fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem', letterSpacing: '-0.02em'}}>
                Privacy Policy
              </h1>
              <p style={{color: 'var(--text-muted)', fontSize: '1rem'}}>
                Last Updated: October 2, 2025
              </p>
            </div>

            {/* What We Store */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
                <Database size={24} style={{color: '#667eea'}} />
                <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0}}>
                  What We Store
                </h2>
              </div>
              <div style={{background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', marginBottom: '1rem'}}>
                <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                  {['Technical email ID (not the email address itself)', 
                    'When the email was received (timestamp)', 
                    'Email categorization labels (Work, Personal, Shopping, etc.)', 
                    'Reply urgency classification (High, Medium, Low)'].map((item, i) => (
                    <li key={i} style={{display: 'flex', alignItems: 'start', gap: '0.75rem', marginBottom: '0.75rem', color: 'var(--text-secondary)'}}>
                      <CheckCircle size={20} style={{color: '#10b981', flexShrink: 0, marginTop: '2px'}} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="demo-smart-inbox" style={{textAlign: 'center', fontSize: '1rem'}}>
                Nothing we store reveals the actual content of your emails. Your emails remain completely private to you.
              </div>
            </div>

            {/* How Processing Works */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
                <Zap size={24} style={{color: '#8b5cf6'}} />
                <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0}}>
                  How Email Processing Works
                </h2>
              </div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6}}>
                When you use inboxie, email metadata (sender, subject) is sent to OpenAI's API for categorization. This happens in real-time:
              </p>
              <ol style={{paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8}}>
                <li>A machine (AI) reads the metadata to categorize your email</li>
                <li>The categorization is returned to the extension</li>
                <li>The information is immediately purged from memory</li>
                <li>No humans ever read your email data</li>
              </ol>
            </div>

            {/* Authentication */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
                <Lock size={24} style={{color: '#3b82f6'}} />
                <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0}}>
                  Authentication & Access Tokens
                </h2>
              </div>
              <p style={{color: 'var(--text-secondary)', lineHeight: 1.6}}>
                Your Gmail access token is stored temporarily in your browser's secure storage during your session. 
                When the context is cleared, you'll need to log in again. We never permanently store your access credentials.
              </p>
            </div>

            {/* Data Storage */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem'}}>
                Data Storage
              </h2>
              <p style={{color: 'var(--text-secondary)', lineHeight: 1.6}}>
                Category preferences and email classifications are stored in our secure database. 
                This data cannot be used to reconstruct the content of your emails.
              </p>
            </div>

            {/* Third Party Services */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem'}}>
                Third-Party Services
              </h2>
              <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                <li style={{marginBottom: '0.75rem', color: 'var(--text-secondary)'}}>
                  <strong style={{color: 'var(--text-primary)'}}>Google Gmail API:</strong> For accessing your email metadata
                </li>
                <li style={{color: 'var(--text-secondary)'}}>
                  <strong style={{color: 'var(--text-primary)'}}>OpenAI API:</strong> For AI-powered categorization (processed in real-time, not stored)
                </li>
              </ul>
            </div>

            {/* Your Rights */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem'}}>
                Your Privacy Rights
              </h2>
              <p style={{color: 'var(--text-secondary)', lineHeight: 1.6}}>
                You can request deletion of your data at any time. 
                Uninstalling the extension stops all data collection immediately.
              </p>
            </div>

            {/* Contact */}
            <div className="demo-card" style={{textAlign: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'}}>
              <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem'}}>
                Contact Us
              </h2>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6}}>
                Questions about privacy? We're here to help.
              </p>
              <a 
                href="mailto:support@inboxie.ai" 
                className="cta-primary" 
                style={{display: 'inline-flex', padding: '1rem 2rem', fontSize: '1rem'}}
              >
                <Mail size={20} />
                support@inboxie.ai
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}