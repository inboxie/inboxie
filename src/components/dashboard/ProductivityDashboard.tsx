'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Mail, Target, Clock, Settings, Star, Folder, Users, Newspaper, ShoppingBag, HelpCircle, Filter } from 'lucide-react';

// Import the streaming hook
import { useEmailStreaming } from '@/hooks/useEmailStreaming';
import InlineReplyModal from '@/components/modals/InlineReplyModal';
import ModernSidebar from '@/components/dashboard/ModernSidebar';

// ✨ Debug toggle - set to false to silence console logs
const DEBUG_MODE = false;

interface Stats {
  emailsConquered: number;
  floodSurvived: number;
  pendingResponses: number;
  streak: number;
}

interface StatsData {
  day: Stats;
  week: Stats;
  month: Stats;
  year: Stats;
}

interface EmailItem {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  time: string;
  category: string;
  isUnread: boolean;
  isActive?: boolean;
}

export default function ProductivityDashboard() {
  const { data: session } = useSession();
  
  // Use the streaming hook for real-time data
  const { 
    isProcessing, 
    stats, 
    error, 
    startProcessing,
    lightningImport,
    cancelProcessing 
  } = useEmailStreaming();

  // Add voice training state
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);
  const [hasTrainedBefore, setHasTrainedBefore] = useState(false);
  
  // Add category filtering state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEmailIndex, setSelectedEmailIndex] = useState<number>(0);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [emailContent, setEmailContent] = useState<any>(null);
  const [processedEmailContent, setProcessedEmailContent] = useState<any>(null);
  const [isProcessingEmail, setIsProcessingEmail] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  
  // ✨ NEW: Smart Inbox toggle state - DEFAULT TO TRUE
  const [isSmartInboxEnabled, setIsSmartInboxEnabled] = useState(true);
  
  // UNIFIED: Single modal for reply
  const [showInlineReplyModal, setShowInlineReplyModal] = useState(false);

  // ✨ UPDATED: Filter emails based on Smart Inbox toggle AND selected category
  const filteredEmails = React.useMemo(() => {
    let emailsToFilter = [];
    
    // Step 1: Choose base email list (Smart Inbox or All)
    if (isSmartInboxEnabled) {
      // Smart Inbox: Only show emails that need replies
      emailsToFilter = stats?.pendingReplies || [];
    } else {
      // Regular Inbox: Show all emails
      emailsToFilter = stats?.recentEmails || [];
    }
    
    // Step 2: Apply category filter (if not "all")
    if (selectedCategory === 'all') {
      return emailsToFilter;
    }
    
    return emailsToFilter.filter(email => 
      email.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [stats?.recentEmails, stats?.pendingReplies, selectedCategory, isSmartInboxEnabled]);

  // Load email details when selection changes
  useEffect(() => {
    const loadEmailDetails = async () => {
      const email = filteredEmails[selectedEmailIndex];
      if (!email) return;

      if (DEBUG_MODE) {
        console.log('🔍 DEBUG EMAIL LOADING:');
        console.log('selectedEmailIndex:', selectedEmailIndex);
        console.log('email being loaded:', { id: email.id, subject: email.subject, from: email.from });
        console.log('filteredEmails length:', filteredEmails.length);
      }

      setSelectedEmail(email);
      setLoadingEmail(true);
      // CLEAR processed content when switching emails
      setProcessedEmailContent(null);

      try {
        const response = await fetch('/api/get-email-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailId: email.id })
        });

        const result = await response.json();
        
        if (result.success) {
          setEmailContent(result.data);
          
          // Auto-process with AI if the email looks messy
          const bodyContent = result.data.body || result.data.snippet || '';
          const htmlTagCount = (bodyContent.match(/<[^>]*>/g) || []).length;
          const urlCount = (bodyContent.match(/https?:\/\/[^\s]+/g) || []).length;
          const textLength = bodyContent.replace(/<[^>]*>/g, '').trim().length;
          const htmlToTextRatio = bodyContent.length > 0 ? htmlTagCount / (textLength || 1) : 0;
          
          // IMPROVED: Detect messy emails (HTML OR plain text walls)
          const isMessyHtml = 
            htmlTagCount > 2 || // HTML emails
            bodyContent.includes('<!DOCTYPE') || 
            bodyContent.includes('<style') ||
            bodyContent.includes('<html') ||
            bodyContent.includes('<body') ||
            bodyContent.includes('<div') ||
            bodyContent.includes('<span') ||
            bodyContent.includes('<p ') ||
            bodyContent.includes('<table') ||
            htmlToTextRatio > 0.1 ||
            urlCount > 2 ||
            // IMPROVED: Better detection of plain text walls
            (bodyContent.length > 300 && !bodyContent.includes('\n\n') && htmlTagCount === 0) ||
            // NEW: Long sentences without breaks
            (bodyContent.length > 200 && bodyContent.split('.').some(sentence => sentence.length > 150)) ||
            // NEW: Very long single paragraphs  
            (bodyContent.length > 400 && bodyContent.split('\n').length < 3);
          
          if (isMessyHtml && bodyContent.length > 50) {
            // Pass the current email ID to prevent race conditions
            processEmailWithAI(bodyContent, email.id);
          }
        } else {
          if (DEBUG_MODE) {
            console.error('❌ API returned error:', result.error);
          }
        }
      } catch (error) {
        if (DEBUG_MODE) {
          console.error('❌ Fetch error:', error);
        }
      } finally {
        setLoadingEmail(false);
      }
    };

    loadEmailDetails();
  }, [selectedEmailIndex, filteredEmails]);

  // Keyboard shortcuts (simplified - removed archive/delete)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'r':
          if (event.metaKey || event.ctrlKey) { // Cmd+R or Ctrl+R
            event.preventDefault();
            if (filteredEmails[selectedEmailIndex]) {
              handleReply();
            }
          }
          break;
          
        case 'j':
        case 'arrowdown':
          event.preventDefault();
          setSelectedEmailIndex(prev => 
            Math.min(prev + 1, filteredEmails.length - 1)
          );
          break;
          
        case 'k':
        case 'arrowup':
          event.preventDefault();
          setSelectedEmailIndex(prev => Math.max(prev - 1, 0));
          break;
          
        // ✨ NEW: Toggle Smart Inbox with 'S' key
        case 's':
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            setIsSmartInboxEnabled(prev => !prev);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredEmails, selectedEmailIndex]);

  // Reset selected email when category changes OR smart inbox toggles
  useEffect(() => {
    setSelectedEmailIndex(0);
    setProcessedEmailContent(null); // Clear AI processed content when switching emails
    setIsProcessingEmail(false); // FIXED: Stop any ongoing AI processing
  }, [selectedCategory, isSmartInboxEnabled]);

  // UNIFIED: Direct reply handler
  const handleReply = () => {
    setShowInlineReplyModal(true);
  };

  // AI Email Processing Function - RACE CONDITION FIXED
  const processEmailWithAI = async (content: string, currentEmailId: string) => {
    setIsProcessingEmail(true);
    if (DEBUG_MODE) {
      console.log(`🤖 Processing AI for email: ${currentEmailId}`);
    }
    
    try {
      const response = await fetch('/api/restructure-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        if (DEBUG_MODE) {
          console.warn(`⚠️ AI processing failed with status: ${response.status}`);
        }
        return;
      }

      // Check content type to ensure it's JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (DEBUG_MODE) {
          console.warn('⚠️ AI processing returned non-JSON response');
        }
        return;
      }

      const result = await response.json();
      
      // IMPROVED: Set processed content even if user switched emails (for caching)
      if (result.processed && result.restructuredContent) {
        // Always cache the result
        if (selectedEmail?.id === currentEmailId) {
          setProcessedEmailContent(result.restructuredContent);
          if (DEBUG_MODE) {
            console.log(`✅ Email ${currentEmailId} processed with AI successfully`);
          }
        } else {
          if (DEBUG_MODE) {
            console.log(`📝 Cached AI result for ${currentEmailId} (user on different email ${selectedEmail?.id})`);
          }
          // TODO: Could implement proper caching here for future use
        }
      } else {
        if (DEBUG_MODE) {
          console.log('ℹ️ AI processing skipped - content too short or failed');
        }
      }
    } catch (error) {
      if (DEBUG_MODE) {
        console.warn('⚠️ AI processing failed, continuing without it:', error);
      }
      // Don't show user error - just skip AI processing gracefully
    } finally {
      setIsProcessingEmail(false);
    }
  };

  const handleReplySuccess = (message: string) => {
    setShowInlineReplyModal(false);
    // ✅ Refresh stats to show updated AI reply count
    if (stats) {
      // Force refresh of stats to update AI replies count
      setTimeout(() => {
        // This will trigger a re-fetch and update the dashboard
        window.location.reload();
      }, 1000);
    }
  };

  // Check if user has trained before
  useEffect(() => {
    const checkTrainingStatus = async () => {
      if (stats?.user?.planType === 'paid') {
        try {
          const response = await fetch(`/api/tone-training?userEmail=${stats.user.email}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setHasTrainedBefore(true);
              setTrainingStatus('Training completed! Voice profile ready.');
            }
          }
        } catch (error) {
          // No training found, which is fine
        }
      }
    };

    checkTrainingStatus();
  }, [stats?.user]);

  // Voice training function
  const startVoiceTraining = async () => {
    if (stats?.user?.planType !== 'paid') {
      setTrainingStatus('Voice Training is a Pro feature. Upgrade to access!');
      return;
    }

    if (hasTrainedBefore && !window.confirm('You have already trained your voice. Do you want to retrain with your latest emails?')) {
      return;
    }

    setIsTraining(true);
    setTrainingStatus('Analyzing your sent emails...');

    try {
      const response = await fetch('/api/tone-training', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analyzeCount: 50
        })
      });

      const result = await response.json();

      if (result.success) {
        setTrainingStatus(`Training completed! Analyzed ${result.data.toneProfile.sentEmailsAnalyzed} emails.`);
        setHasTrainedBefore(true);
      } else {
        setTrainingStatus(`Training failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Voice training error:', error);
      setTrainingStatus('Training failed. Please try again.');
    } finally {
      setIsTraining(false);
    }
  };

  const [statsData, setStatsData] = useState<StatsData>({
    day: { emailsConquered: 0, floodSurvived: 0, pendingResponses: 0, streak: 0 },
    week: { emailsConquered: 0, floodSurvived: 0, pendingResponses: 0, streak: 0 },
    month: { emailsConquered: 0, floodSurvived: 0, pendingResponses: 0, streak: 0 },
    year: { emailsConquered: 0, floodSurvived: 0, pendingResponses: 0, streak: 0 }
  });
  const [loading, setLoading] = useState(true);

  // Update stats when streaming data changes
  useEffect(() => {
    if (stats?.user) {
      const realStats = {
        emailsConquered: stats.user.emailsProcessed,
        floodSurvived: stats.user.emailsProcessed,
        pendingResponses: 3, // Keep static for now
        streak: 1
      };
      setStatsData({
        day: realStats,
        week: realStats,
        month: realStats,
        year: realStats
      });
      setLoading(false);
    }
  }, [stats]);

  const currentStats = statsData.day;

  // Real-time email data from streaming
  const recentEmails = stats?.recentEmails?.slice(0, 3).map(email => ({
    id: email.id,
    sender: email.from,
    subject: email.subject,
    preview: email.snippet || email.subject,
    time: new Date(email.date).toLocaleDateString(),
    category: email.category,
    isUnread: true,
    isActive: false
  })) || [];

  // Calculate progress percentage
  const progressPercentage = stats?.user ? 
    Math.round((stats.user.emailsProcessed / stats.user.limit) * 100) : 0;

  if (loading && !stats) {
    return (
      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Add Modern Sidebar */}
      <ModernSidebar
        currentPage="dashboard"
        userEmail={session?.user?.email || ''}
        planType={stats?.user?.planType || 'free'}
        userStats={{
          emailsProcessed: stats?.user?.emailsProcessed || 0,
          limit: stats?.user?.limit || 500
        }}
      />

      {/* Main content area */}
      <div style={{ flex: 1 }}>
        <div className="app-container">

          {/* Dashboard Cards Section - FIXED 5 CARDS */}
      <div className="dashboard-section">
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '20px',
          maxWidth: '1600px',
          margin: '0 auto'
        }}>
          {/* Card 1: Emails Organized */}
          <div className="dashboard-status-card warning">
            <div className="dashboard-card-header">
              <div className="dashboard-card-title">
                <Target size={18} />
                <span>Emails Organized</span>
              </div>
            </div>
            <div className="dashboard-card-value">
              {stats?.user?.emailsProcessed || 0}/{stats?.user?.limit || 500}
            </div>
            <div className="dashboard-card-description">
              {stats?.user?.planType === 'free' ? 'Free plan limit' : 'Pro plan usage'}
            </div>
            <div className="dashboard-card-progress">
              <div className="dashboard-progress-fill warning" style={{ width: `${progressPercentage}%` }} />
            </div>
            <a href="#" className="dashboard-card-action">View organized emails →</a>
          </div>
          
          {/* Card 2: Pending Replies - ✨ NOW CLICKABLE */}
          <div 
            className={`dashboard-status-card ${isSmartInboxEnabled ? 'success' : ''}`}
            onClick={() => setIsSmartInboxEnabled(true)}
            style={{ cursor: 'pointer' }}
          >
            <div className="dashboard-card-header">
              <div className="dashboard-card-title">
                <Clock size={18} />
                <span>Pending Replies</span>
              </div>
            </div>
            <div className="dashboard-card-value">{stats?.pendingReplies?.length || 0}</div>
            <div className="dashboard-card-description">Emails waiting for your response</div>
            <div className="dashboard-card-progress">
              <div className="dashboard-progress-fill success" style={{ width: `${Math.min((stats?.pendingReplies?.length || 0) * 10, 100)}%` }} />
            </div>
            <div className="dashboard-card-action" style={{ color: isSmartInboxEnabled ? '#00d4aa' : 'inherit' }}>
              {isSmartInboxEnabled ? '✅ Viewing Smart Inbox' : '🎯 View Smart Inbox →'}
            </div>
          </div>

          {/* Card 3: Import More Emails */}
          <div className="dashboard-status-card">
            <div className="dashboard-card-header">
              <div className="dashboard-card-title">
                <Mail size={18} />
                <span>Import More Emails</span>
              </div>
            </div>
            <div className="dashboard-card-value">
              {isProcessing 
                ? 'Processing...' 
                : stats?.user && stats.user.remaining > 0 
                  ? `${stats.user.remaining} left`
                  : 'Complete'
              }
            </div>
            <div className="dashboard-card-description">
              {isProcessing 
                ? `${stats?.user?.emailsProcessed || 0} of ${stats?.user?.limit || 500} emails processed`
                : stats?.user && stats.user.remaining > 0
                  ? 'Ready to import more from your Gmail'
                  : 'All available emails imported'
              }
            </div>
            {isProcessing && (
              <div className="dashboard-card-progress">
                <div className="dashboard-progress-fill success" style={{ width: `${progressPercentage}%` }} />
              </div>
            )}
            <div style={{ marginTop: '20px' }}>
              {isProcessing ? (
                <button 
                  onClick={cancelProcessing}
                  className="dashboard-card-action"
                  style={{ 
                    background: '#dc3545',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'none'
                  }}
                >
                  🛑 Cancel Import
                </button>
              ) : stats?.user && stats.user.remaining > 0 ? (
                <button 
                  onClick={lightningImport}
                  className="dashboard-card-action"
                  style={{ 
                    background: '#00d4aa',
                    color: '#1a1d29',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    textDecoration: 'none'
                  }}
                >
                  📥 Start Import
                </button>
              ) : (
                <div className="dashboard-card-action" style={{ color: '#00d4aa' }}>
                  ✅ Import Complete
                </div>
              )}
            </div>
          </div>
          
          {/* Card 4: Replied by AI */}
          <div className="dashboard-status-card premium">
            <div className="dashboard-card-header">
              <div className="dashboard-card-title">
                <Mail size={18} />
                <span>Replied by AI</span>
              </div>
            </div>
            <div className="dashboard-card-value">{stats?.aiRepliesCount || 0}</div>
            <div className="dashboard-card-description">Emails AI has responded to for you</div>
            <div className="dashboard-card-progress">
              <div className="dashboard-progress-fill success" style={{ width: `${Math.min((stats?.aiRepliesCount || 0) * 10, 100)}%` }} />
            </div>
            <div style={{ marginTop: '20px' }}>
              <a href="/ai-replies" className="dashboard-card-action">View AI replies →</a>
            </div>
          </div>
          
          {/* Card 5: Voice Training */}
          <div className="dashboard-status-card premium">
            <div className="dashboard-card-header">
              <div className="dashboard-card-title">
                <Settings size={18} />
                <span>Voice Training</span>
              </div>
            </div>
            <div className="dashboard-card-value">
              {stats?.user?.planType === 'paid' 
                ? (isTraining ? 'Training...' : hasTrainedBefore ? 'Active' : 'Ready') 
                : 'Pro'
              }
            </div>
            <div className="dashboard-card-description">
              {isTraining 
                ? (trainingStatus || 'Analyzing your writing style...')
                : trainingStatus || 'Train AI to match your writing style'
              }
            </div>
            <div style={{ marginTop: '20px' }}>
              {stats?.user?.planType === 'paid' ? (
                <button 
                  onClick={startVoiceTraining}
                  disabled={isTraining}
                  className={`dashboard-card-action ${hasTrainedBefore ? '' : 'primary'}`}
                  style={{ 
                    background: 'transparent',
                    border: 'none',
                    padding: '0',
                    cursor: isTraining ? 'not-allowed' : 'pointer',
                    textDecoration: 'none',
                    color: 'inherit'
                  }}
                >
                  {isTraining 
                    ? '⏳ Training...' 
                    : hasTrainedBefore 
                      ? '🔄 Retrain Voice' 
                      : '🎯 Start Training'
                  }
                </button>
              ) : (
                <a href="#" className="dashboard-card-action premium">⭐ Upgrade to Pro</a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Email Interface */}
      <div className="email-container">
        {/* Left Sidebar - Folders (20%) */}
        <div className="email-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-title">
              <Folder size={16} />
              <span>Folders</span>
            </div>
            <div 
              className={`folder-item ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
              style={{ cursor: 'pointer' }}
            >
              <div className="folder-name">
                <Mail size={16} />
                <span>Inbox</span>
              </div>
              <span className="folder-count">{stats?.folderCounts?.Inbox || 0}</span>
            </div>
          </div>
          
          <div className="sidebar-section">
            <div className="sidebar-title">
              <Star size={16} />
              <span>Categories</span>
            </div>
            {[
              { name: 'Work', count: stats?.folderCounts?.Work || 0, icon: Users },
              { name: 'Personal', count: stats?.folderCounts?.Personal || 0, icon: Users },
              { name: 'Newsletter', count: stats?.folderCounts?.Newsletter || 0, icon: Newspaper },
              { name: 'Shopping', count: stats?.folderCounts?.Shopping || 0, icon: ShoppingBag },
              { name: 'Support', count: stats?.folderCounts?.Support || 0, icon: HelpCircle },
              { name: 'Other', count: stats?.folderCounts?.Other || 0, icon: Folder }
            ].map((category) => (
              <div 
                key={category.name} 
                className={`folder-item ${selectedCategory === category.name.toLowerCase() ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.name.toLowerCase())}
                style={{ cursor: 'pointer' }}
              >
                <div className="folder-name">
                  <category.icon size={16} />
                  <span>{category.name}</span>
                </div>
                <span className="folder-count">{category.count}</span>
              </div>
            ))}
          </div>

          {/* ✨ NEW: Smart Inbox Section */}
          <div className="sidebar-section">
            <div className="sidebar-title">
              <Filter size={16} />
              <span>Smart Inbox</span>
            </div>
            <div 
              className={`folder-item ${isSmartInboxEnabled ? 'active' : ''}`}
              onClick={() => setIsSmartInboxEnabled(prev => !prev)}
              style={{ cursor: 'pointer' }}
            >
              <div className="folder-name">
                <Clock size={16} />
                <span>{isSmartInboxEnabled ? 'Smart Inbox ON' : 'Smart Inbox OFF'}</span>
              </div>
              <span className="folder-count" style={{ color: isSmartInboxEnabled ? '#00d4aa' : 'inherit' }}>
                {isSmartInboxEnabled ? '✨' : stats?.pendingReplies?.length || 0}
              </span>
            </div>
            {isSmartInboxEnabled && (
              <div style={{ 
                fontSize: '12px', 
                color: '#666', 
                padding: '8px 16px', 
                fontStyle: 'italic' 
              }}>
                Showing only emails that need replies
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts - ✨ UPDATED */}
          <div className="sidebar-section">
            <div className="sidebar-title">
              <span>⌨️</span>
              <span>Shortcuts</span>
            </div>
            <div className="shortcuts-list">
              {[
                { key: '⌘R', action: 'Reply' },
                { key: 'J/K', action: 'Next/Prev' },
                { key: 'S', action: 'Smart Inbox' }
              ].map((shortcut) => (
                <div key={shortcut.key} className="shortcut-item">
                  <span className="shortcut-key">{shortcut.key}</span>
                  <span className="shortcut-action">{shortcut.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Pane - Email List (30%) - ✨ CLEANED UP - NO MORE REPLY BUTTONS */}
        <div className="email-list">
          <div className="email-list-header">
            <div className="email-list-title">
              {isSmartInboxEnabled ? (
                <span style={{ color: '#00d4aa' }}>
                  ✨ Smart Inbox
                </span>
              ) : (
                selectedCategory === 'all' ? 'Inbox' : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)
              )}
            </div>
            <div className="email-list-subtitle">
              {isSmartInboxEnabled ? (
                <span>
                  {filteredEmails.length} emails need replies
                  <button 
                    onClick={() => setIsSmartInboxEnabled(false)}
                    style={{ 
                      marginLeft: '8px',
                      background: 'transparent',
                      border: '1px solid #666',
                      borderRadius: '4px',
                      color: '#666',
                      fontSize: '10px',
                      padding: '2px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    Show All
                  </button>
                </span>
              ) : (
                <>
                  {filteredEmails.length} emails
                  {selectedCategory === 'all' && stats?.pendingReplies?.length ? (
                    <>
                      {' • '}
                      <button 
                        onClick={() => setIsSmartInboxEnabled(true)}
                        style={{ 
                          background: 'transparent',
                          border: 'none',
                          color: '#00d4aa',
                          fontSize: 'inherit',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        {stats.pendingReplies.length} need replies ✨
                      </button>
                    </>
                  ) : ''}
                </>
              )}
            </div>
          </div>
          
          <div className="email-list-content" style={{ padding: '0 16px' }}>
            {/* Show filtered emails from streaming data - ✨ CLEANED UP: NO MORE REPLY BUTTONS */}
            {filteredEmails.length > 0 ? filteredEmails.map((email, index) => (
              <div 
                key={email.id} 
                className={`email-item ${email.isUnread ? 'unread' : ''} ${index === selectedEmailIndex ? 'active' : ''}`}
                onClick={() => setSelectedEmailIndex(index)}
                style={{ position: 'relative' }}
              >
                {/* ✨ REMOVED: No more REPLY button here - just clean email display */}
                <div className="email-sender">
                  {email.from}
                </div>
                <div className="email-subject">
                  {email.subject}
                </div>
                <div className="email-preview">
                  {email.snippet}
                </div>
                <div className="email-meta">
                  <span className="email-time">{new Date(email.date).toLocaleDateString()}</span>
                  <span className="email-category">
                    {email.category}
                  </span>
                </div>
              </div>
            )) : (
              <div className="email-item" style={{ padding: '40px 12px', textAlign: 'center' }}>
                <div className="email-sender">
                  {isSmartInboxEnabled ? 'No emails need replies! 🎉' : 'No emails in this category'}
                </div>
                <div className="email-subject">
                  {isSmartInboxEnabled 
                    ? 'Your inbox is under control'
                    : selectedCategory === 'all' 
                      ? 'Import your emails to get started' 
                      : `No ${selectedCategory} emails found`
                  }
                </div>
                <div className="email-preview">
                  {isSmartInboxEnabled
                    ? 'All emails have been handled or don\'t require responses'
                    : selectedCategory === 'all' 
                      ? 'Click "Import More Emails" to begin processing your Gmail history'
                      : 'Try importing more emails or check other categories'
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane - Email Content (50%) */}
        <div className="email-content">
          {loadingEmail ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <div>Loading email...</div>
            </div>
          ) : emailContent ? (
            <>
              <div className="email-header">
                <div className="email-title">
                  {emailContent.subject}
                </div>
                <div className="email-details">
                  <div className="sender-info">
                    <div className="sender-avatar">
                      {emailContent.from?.charAt(0)?.toUpperCase() || 'E'}
                    </div>
                    <div className="sender-details">
                      <div className="sender-name">
                        {emailContent.from}
                      </div>
                      <div className="sender-email">
                        {new Date(emailContent.date).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {/* ✅ KEEP: Main Reply button in content area */}
                  <div className="email-actions">
                    <button 
                      className="email-action-btn primary"
                      onClick={handleReply}
                      style={{
                        background: '#00d4aa',
                        color: '#1a1d29',
                        padding: '10px 24px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Reply {stats?.user?.planType === 'paid' && '✨'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="email-body">
                {isProcessingEmail && (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                    borderLeft: '3px solid #10b981',
                    fontSize: '14px',
                    marginBottom: '16px'
                  }}>
                    🤖 AI is cleaning up this email for better readability...
                  </div>
                )}
                
                {processedEmailContent ? (
                  // Show AI-processed content as clean text
                  <div style={{ position: 'relative' }}>
                    <div 
                      className="email-text"
                      style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}
                    >
                      {processedEmailContent}
                    </div>
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '8px 12px', 
                      backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#059669'
                    }}>
                      ✨ Cleaned up with AI for better readability
                      <button 
                        onClick={() => setProcessedEmailContent(null)}
                        style={{ 
                          marginLeft: '8px', 
                          background: 'none', 
                          border: 'none', 
                          color: '#059669', 
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Show original
                      </button>
                    </div>
                  </div>
                ) : (
                  // Show original HTML content
                  <div 
                    className="email-text"
                    dangerouslySetInnerHTML={{ 
                      __html: emailContent.body || emailContent.snippet || 'No content available' 
                    }}
                    style={{
                      maxWidth: '100%',
                      overflow: 'hidden'
                    }}
                  />
                )}
                
                {!emailContent.body && emailContent.snippet && (
                  <div style={{ 
                    marginTop: '16px', 
                    padding: '12px', 
                    backgroundColor: 'rgba(255, 193, 7, 0.1)', 
                    borderLeft: '3px solid #ffc107',
                    fontSize: '14px',
                    color: '#856404'
                  }}>
                    ℹ️ Showing preview text. Full email body not available.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="email-header">
              <div className="email-title">
                Welcome to Inboxie
              </div>
              <div className="email-body">
                <div className="email-text">
                  <p>Your AI-powered email assistant is ready to help organize your inbox!</p>
                  <p>Select an email from the list to view its contents and reply options.</p>
                  
                  {/* ✨ NEW: Smart Inbox intro */}
                  {!isSmartInboxEnabled && stats?.pendingReplies?.length && stats.pendingReplies.length > 0 && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '12px', 
                      backgroundColor: 'rgba(0, 212, 170, 0.1)', 
                      borderRadius: '8px',
                      borderLeft: '3px solid #00d4aa'
                    }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#00d4aa' }}>
                        ✨ Try Smart Inbox!
                      </p>
                      <p style={{ margin: '8px 0 0 0' }}>
                        You have <strong>{stats.pendingReplies.length} emails</strong> that need replies. 
                        <button 
                          onClick={() => setIsSmartInboxEnabled(true)}
                          style={{ 
                            marginLeft: '8px',
                            background: '#00d4aa',
                            color: '#1a1d29',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          Show me
                        </button>
                      </p>
                    </div>
                  )}
                  
                  <p>Use keyboard shortcuts:</p>
                  <ul style={{ marginTop: '16px', paddingLeft: '20px' }}>
                    <li><strong>J/K</strong> - Navigate up/down</li>
                    <li><strong>⌘R</strong> - Reply to selected email</li>
                    <li><strong>S</strong> - Toggle Smart Inbox</li>
                  </ul>
                  {stats?.user?.planType === 'paid' && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '12px', 
                      backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                      borderRadius: '8px',
                      borderLeft: '3px solid #8b5cf6'
                    }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#7c3aed' }}>
                        ✨ Pro User Benefits:
                      </p>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#6b46c1' }}>
                        <li>AI-powered response generation</li>
                        <li>Smart quote and reply with AI assistance</li>
                        <li>Personalized tone training</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* UNIFIED: InlineReplyModal with AI integration */}
      {showInlineReplyModal && selectedEmail && emailContent && (
        <InlineReplyModal
          isOpen={showInlineReplyModal}
          onClose={() => setShowInlineReplyModal(false)}
          email={{
            ...emailContent,
            // FIXED: Pass cleaned content to modal for better text selection
            body: processedEmailContent || emailContent.body,
            originalBody: emailContent.body // Keep original for reference
          }}
          userEmail={session?.user?.email || ''}
          userPlan={stats?.user?.planType || 'free'}
          onSuccess={handleReplySuccess}
        />
      )}
        </div>
      </div>
    </div>
  );
}