'use client';

import Link from 'next/link';
import { Mail, ArrowLeft, Shield, Lock, Database, Zap, CheckCircle, Trash2, Share2, Clock } from 'lucide-react';

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
                Last Updated: October 3, 2025
              </p>
            </div>

            {/* Data Accessed */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
                <Database size={24} style={{color: '#667eea'}} />
                <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0}}>
                  Data Accessed from Google
                </h2>
              </div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6}}>
                inboxie accesses the following types of Google user data from your Gmail account:
              </p>
              <div style={{background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem'}}>
                <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                  {[
                    'Email content: full email body text, subject lines, and email snippets',
                    'Email metadata: sender email address, recipient, date/time received',
                    'Email labels: existing Gmail labels and ability to create/modify labels',
                    'Email message IDs: technical identifiers for organizing emails',
                    'User profile information: your Gmail email address and name'
                  ].map((item, i) => (
                    <li key={i} style={{display: 'flex', alignItems: 'start', gap: '0.75rem', marginBottom: '0.75rem', color: 'var(--text-secondary)'}}>
                      <CheckCircle size={20} style={{color: '#10b981', flexShrink: 0, marginTop: '2px'}} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Data Usage */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
                <Zap size={24} style={{color: '#8b5cf6'}} />
                <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0}}>
                  How We Use Google User Data
                </h2>
              </div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6}}>
                The Google user data we access is used exclusively for the following purposes:
              </p>
              <ol style={{paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8}}>
                <li><strong>Email Categorization:</strong> Email content (sender, subject, and body text) is analyzed by AI to automatically assign category labels (Work, Personal, Shopping, Newsletter, Support, Other)</li>
                <li><strong>Reply Tracking:</strong> Email content is analyzed to identify which emails require user responses and assign urgency levels (High, Medium, Low)</li>
                <li><strong>Label Management:</strong> Gmail labels are created and applied to organize emails based on AI categorization</li>
                <li><strong>Dashboard Statistics:</strong> Email counts and organization metrics are displayed in the extension dashboard</li>
              </ol>
              <p style={{color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: 1.6}}>
                <strong>Important:</strong> All email content processing happens in real-time and in-memory only. Email content is sent to our servers, processed immediately by AI, and then completely discarded. We do not store email body text or subject lines in our database.
              </p>
            </div>

            {/* Data Sharing */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
                <Share2 size={24} style={{color: '#3b82f6'}} />
                <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0}}>
                  Data Sharing with Third Parties
                </h2>
              </div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6}}>
                We share Google user data with the following third-party service:
              </p>
              <div style={{background: '#fff3cd', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #ffc107', marginBottom: '1rem'}}>
                <p style={{margin: 0, color: '#856404', lineHeight: 1.6}}>
                  <strong>OpenAI API:</strong> Full email content (sender email address, subject line, and body text) is sent to OpenAI's API for:
                </p>
                <ul style={{marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem', color: '#856404'}}>
                  <li>AI-powered email categorization</li>
                  <li>Reply urgency analysis</li>
                </ul>
                <p style={{margin: '0.5rem 0 0 0', color: '#856404', lineHeight: 1.6}}>
                  This data is processed in real-time and immediately discarded after processing. OpenAI does not store or use your email data for training AI models per their API terms of service.
                </p>
              </div>
              <p style={{color: 'var(--text-secondary)', lineHeight: 1.6}}>
                <strong>We do not:</strong>
              </p>
              <ul style={{paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8}}>
                <li>Sell your data to advertisers or data brokers</li>
                <li>Share your data with marketing companies</li>
                <li>Use your data for purposes other than email organization</li>
                <li>Store email content beyond the immediate processing timeframe</li>
              </ul>
            </div>

            {/* Data Storage & Protection */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
                <Lock size={24} style={{color: '#10b981'}} />
                <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0}}>
                  Data Storage & Protection
                </h2>
              </div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6}}>
                We store the following data in our secure database:
              </p>
              <ul style={{paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '1rem'}}>
                <li>Technical email IDs (Gmail message identifiers, not email addresses)</li>
                <li>Email received timestamps</li>
                <li>Assigned category labels (Work, Personal, Shopping, etc.)</li>
                <li>Reply urgency classifications (High, Medium, Low)</li>
                <li>Reply status (needs reply or not)</li>
                <li>Your Gmail email address for account identification</li>
              </ul>
              <div style={{background: '#dcfce7', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #10b981', marginBottom: '1rem'}}>
                <p style={{margin: 0, color: '#065f46', fontWeight: 600}}>
                  We DO NOT store: Email subject lines, email body content, sender names, or any text from your emails.
                </p>
              </div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6}}>
                <strong>Security measures:</strong>
              </p>
              <ul style={{paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8}}>
                <li>All data transmitted over HTTPS encryption</li>
                <li>Database access restricted with authentication and authorization controls</li>
                <li>Gmail access tokens stored temporarily in browser secure storage only</li>
                <li>Email content processed in-memory and immediately discarded (never written to disk)</li>
                <li>Regular security audits of infrastructure and code</li>
              </ul>
            </div>

            {/* Data Retention & Deletion */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
                <Trash2 size={24} style={{color: '#dc2626'}} />
                <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0}}>
                  Data Retention & Deletion
                </h2>
              </div>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6}}>
                <strong>How long we retain your data:</strong>
              </p>
              <ul style={{paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '1rem'}}>
                <li>Email categorization labels and reply status: Retained indefinitely while you use the extension</li>
                <li>Email content (subject, body): Processed in real-time and immediately discarded (retention: 0 seconds)</li>
                <li>Gmail access tokens: Stored temporarily in browser only, cleared when you log out or browser session ends</li>
                <li>Account information: Retained until you request deletion</li>
              </ul>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6}}>
                <strong>How to delete your data:</strong>
              </p>
              <div style={{background: '#dcfce7', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #10b981'}}>
                <ol style={{paddingLeft: '1.5rem', margin: 0, color: '#065f46', lineHeight: 1.8}}>
                  <li>Email us at <strong>support@inboxie.ai</strong> with the subject line "Delete My Data"</li>
                  <li>Include your Gmail email address in the request</li>
                  <li>We will permanently delete all stored data within 30 days</li>
                  <li>You will receive confirmation once deletion is complete</li>
                </ol>
              </div>
              <p style={{color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: 1.6}}>
                <strong>Automatic deletion:</strong> Uninstalling the extension immediately stops all data collection. However, previously stored categorization data will remain in our database until you request deletion.
              </p>
            </div>

            {/* Authentication */}
            <div className="demo-card" style={{marginBottom: '2rem'}}>
              <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem'}}>
                Authentication & Access Tokens
              </h2>
              <p style={{color: 'var(--text-secondary)', lineHeight: 1.6}}>
                Your Gmail access token is stored temporarily in your browser's secure storage during your session. 
                When the browser context is cleared or you log out, you'll need to re-authenticate. We never permanently store your Gmail access credentials on our servers.
              </p>
            </div>

            {/* Contact */}
            <div className="demo-card" style={{textAlign: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'}}>
              <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem'}}>
                Contact Us
              </h2>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6}}>
                Questions about privacy or data deletion requests?
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