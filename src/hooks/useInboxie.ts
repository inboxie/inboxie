// src/hooks/useInboxie.ts
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// ✨ Debug toggle - set to false to silence console logs
const DEBUG_MODE = false;

interface UserStats {
  planType: 'free' | 'paid';
  emailsProcessed: number;
  limit: number;
  features: string[];
}

export const useInboxie = () => {
  const { data: session } = useSession();
  
  // Get real user email from session
  const userEmail = session?.user?.email || '';
  
  const [userStats, setUserStats] = useState<UserStats>({
    planType: 'free', // Default while loading
    emailsProcessed: 0,
    limit: 50,
    features: ['gmail_connect', 'categorization', 'quote_reply']
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]); // This will persist emails
  const [isTraining, setIsTraining] = useState(false);

  // Modal states
  const [replyModal, setReplyModal] = useState<{
    isOpen: boolean;
    email: any;
  }>({
    isOpen: false,
    email: null
  });

  // Load existing emails on page load
  useEffect(() => {
    const loadExistingEmails = async () => {
      if (DEBUG_MODE) {
        console.log('🔍 DEBUG: useEffect triggered');
        console.log('🔍 DEBUG: userEmail:', userEmail);
      }
      
      if (!userEmail) {
        if (DEBUG_MODE) {
          console.log('❌ DEBUG: No userEmail, skipping load');
        }
        return;
      }

      try {
        setIsLoading(true);
        if (DEBUG_MODE) {
          console.log('📚 DEBUG: Starting to load existing processed emails...');
        }

        // First get user stats
        if (DEBUG_MODE) {
          console.log('📊 DEBUG: Fetching user stats...');
        }
        const userResponse = await fetch('/api/get-user-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail }),
        });

        if (DEBUG_MODE) {
          console.log('📊 DEBUG: User stats response status:', userResponse.status);
        }
        const userData = await userResponse.json();
        if (DEBUG_MODE) {
          console.log('📊 DEBUG: User stats data:', userData);
        }
        
        if (userData.success) {
          setUserStats({
            planType: userData.data.planType,
            emailsProcessed: userData.data.emailsProcessed,
            limit: userData.data.limit,
            features: userData.data.planType === 'paid' 
              ? ['gmail_connect', 'categorization', 'quote_reply', 'ai_reply', 'vector_search', 'tone_training']
              : ['gmail_connect', 'categorization', 'quote_reply']
          });
          if (DEBUG_MODE) {
            console.log('✅ DEBUG: User stats updated');
          }
        }

        // Load existing processed emails using dedicated API
        if (DEBUG_MODE) {
          console.log('📧 DEBUG: Fetching existing emails with new API...');
        }
        const emailsResponse = await fetch('/api/get-existing-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            limit: 50 // Load last 50 emails
          }),
        });

        if (DEBUG_MODE) {
          console.log('📧 DEBUG: Emails response status:', emailsResponse.status);
        }
        const emailsData = await emailsResponse.json();
        if (DEBUG_MODE) {
          console.log('📧 DEBUG: Emails data:', emailsData);
        }
        
        if (emailsData.success && emailsData.data?.emails) {
          if (DEBUG_MODE) {
            console.log('📧 DEBUG: Setting allResults with', emailsData.data.emails.length, 'emails');
          }
          setAllResults(emailsData.data.emails);
          if (DEBUG_MODE) {
            console.log(`✅ DEBUG: Loaded ${emailsData.data.emails.length} existing emails`);
          }
          setProcessingLogs([`📚 Loaded ${emailsData.data.emails.length} existing processed emails`]);
        } else {
          if (DEBUG_MODE) {
            console.log('❌ DEBUG: No emails found or API failed');
          }
          setProcessingLogs(['📭 No existing emails found']);
        }

      } catch (error) {
        if (DEBUG_MODE) {
          console.error('❌ DEBUG: Error loading existing emails:', error);
        }
        setProcessingLogs(['❌ Failed to load existing emails']);
      } finally {
        setIsLoading(false);
        if (DEBUG_MODE) {
          console.log('🔍 DEBUG: Loading completed');
        }
      }
    };

    loadExistingEmails();
  }, [userEmail]);

  // Toggle plan - to be removed after dev
  const togglePlan = async (newPlan: 'free' | 'paid') => {
    // Update frontend state
    setUserStats(prev => ({
      ...prev,
      planType: newPlan,
      limit: newPlan === 'paid' ? 500 : 50,
      features: newPlan === 'paid' 
        ? ['gmail_connect', 'categorization', 'quote_reply', 'ai_reply', 'vector_search', 'tone_training']
        : ['gmail_connect', 'categorization', 'quote_reply']
    }));
  
    // Update database too
    try {
      const response = await fetch('/api/update-user-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userEmail: userEmail,
          planType: newPlan 
        }),
      });
      
      if (response.ok) {
        if (DEBUG_MODE) {
          console.log(`✅ Updated plan to ${newPlan} in database`);
        }
        setProcessingLogs(prev => [...prev, `✅ Plan updated to ${newPlan} in database`]);
      } else {
        if (DEBUG_MODE) {
          console.log('⚠️ Database update failed');
        }
      }
    } catch (error) {
      if (DEBUG_MODE) {
        console.log('⚠️ Frontend updated, database sync failed (dev mode only)');
      }
    }
  };

  const handleStartTraining = () => {
    setIsTraining(true);
    setProcessingLogs(prev => [...prev, '🤖 AI training started...']);
  };

  // Regular Reply - Opens modal with email content (FAST)
  const openReply = async (email: any) => {
    try {
      setProcessingLogs(prev => [...prev, '📧 Loading email details...']);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`/api/quick-reply?emailId=${email.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal // Add abort signal
      });

      clearTimeout(timeoutId); // Clear timeout if request succeeds
      const emailData = await response.json();
      
      if (emailData.success && emailData.data) {
        // Open modal with full email details - NO AI response
        setReplyModal({ 
          isOpen: true, 
          email: {
            ...email,
            ...emailData.data,
            body: emailData.data.body || email.snippet || `Subject: ${email.subject}`,
            aiGeneratedResponse: null // No AI response for regular reply
          }
        });
        setProcessingLogs(prev => [...prev, '✅ Email details loaded']);
      } else {
        // Fallback to basic email
        setReplyModal({ 
          isOpen: true, 
          email: {
            ...email,
            body: email.snippet || `Subject: ${email.subject}`,
            aiGeneratedResponse: null
          }
        });
        setProcessingLogs(prev => [...prev, '⚠️ Using basic email info']);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        if (DEBUG_MODE) {
          console.warn('Email details request timed out');
        }
        setProcessingLogs(prev => [...prev, '⏰ Request timed out, using basic info']);
      } else {
        if (DEBUG_MODE) {
          console.error('Error loading email details:', error);
        }
        setProcessingLogs(prev => [...prev, '⚠️ Failed to load email details']);
      }
      
      // Always fallback to basic email on any error
      setReplyModal({ 
        isOpen: true, 
        email: {
          ...email,
          body: email.snippet || `Subject: ${email.subject}`,
          aiGeneratedResponse: null
        }
      });
    }
  };

  const closeReply = () => {
    setReplyModal({ isOpen: false, email: null });
  };

  const handleSuccess = (message: string) => {
    setProcessingLogs(prev => [...prev, `✅ ${message}`]);
  };

  // AI Reply - Opens modal with email content AND pre-filled AI response
  const handleAIReply = async (email: any) => {
    if (userStats.planType !== 'paid') {
      setProcessingLogs(prev => [...prev, '💡 Upgrade to Pro to unlock AI-powered replies!']);
      return;
    }

    try {
      setProcessingLogs(prev => [...prev, '📧 Loading email details...']);
      
      // Step 1: Fetch full email details first (same as regular reply)
      const emailResponse = await fetch(`/api/quick-reply?emailId=${email.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const emailData = await emailResponse.json();
      
      if (!emailData.success || !emailData.data) {
        setProcessingLogs(prev => [...prev, '❌ Failed to load email details for AI reply']);
        return;
      }

      setProcessingLogs(prev => [...prev, '🤖 Generating AI response...']);

      // Step 2: Generate AI response
      const aiResponse = await fetch('/api/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: userEmail,
          emailId: email.id,
          includeQuoting: true
        }),
      });

      const aiData = await aiResponse.json();

      // Step 3: Open modal with BOTH email content AND AI response
      setReplyModal({ 
        isOpen: true, 
        email: {
          ...email,
          ...emailData.data,
          body: emailData.data.body || email.snippet || `Subject: ${email.subject}`,
          aiGeneratedResponse: aiData.success ? aiData.data.generatedResponse : null
        }
      });

      if (aiData.success) {
        setProcessingLogs(prev => [...prev, '✅ AI response generated! Review and edit before sending.']);
      } else {
        setProcessingLogs(prev => [...prev, `❌ AI Reply failed: ${aiData.error}`]);
      }

    } catch (error) {
      setProcessingLogs(prev => [...prev, `❌ AI Reply error: ${error}`]);
      if (DEBUG_MODE) {
        console.error('AI Reply error:', error);
      }
    }
  };

  const processEmails = async () => {
    setIsProcessing(true);
    setProcessingLogs(['🚀 Starting email processing...']);

    try {
      const response = await fetch('/api/process-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userEmail,
          emailLimit: 50, // ⬆️ INCREASED from 10 to 50
          loadExisting: true // Load existing + process new
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setProcessingLogs(prev => [...prev, `✅ Successfully processed ${data.data.processed} emails in ${data.data.processingTimeMs}ms`]);
        
        // Update allResults with ALL emails (existing + new)
        if (data.data.results && data.data.results.length > 0) {
          setAllResults(data.data.results); // This now includes both existing and new
        }
        
        // Update user stats
        if (data.data.user) {
          setUserStats(prev => ({
            ...prev,
            emailsProcessed: data.data.user.emailsProcessed,
            planType: data.data.user.planType,
            limit: data.data.user.limit
          }));
        }
      } else {
        setProcessingLogs(prev => [...prev, `❌ Error: ${data.error}`]);
      }
    } catch (error) {
      setProcessingLogs(prev => [...prev, `❌ Network error: ${error}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Return all state and handlers
  return {
    // State
    userEmail,
    userStats,
    isLoading, 
    isProcessing,
    processingLogs,
    allResults, 
    isTraining,
    replyModal,
    
    // Handlers
    togglePlan,
    handleStartTraining,
    openReply,
    closeReply,
    handleSuccess,
    handleAIReply,
    processEmails,
  };
};