// src/hooks/useEmailStreaming.ts
import { useState, useEffect, useRef } from 'react';

interface UserStats {
  user: {
    id: string;
    email: string;
    planType: string;
    emailsProcessed: number;
    limit: number;
    remaining: number;
  };
  folderCounts: Record<string, number>;
  recentEmails: any[];
  totalEmails: number;
  pendingReplies?: any[]; // Add this to track pending replies
}

interface StreamingState {
  isProcessing: boolean;
  stats: UserStats | null;
  error: string | null;
  lastUpdated: Date | null;
}

export function useEmailStreaming() {
  const [state, setState] = useState<StreamingState>({
    isProcessing: false,
    stats: null,
    error: null,
    lastUpdated: null
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const backgroundPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user stats
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/get-user-stats');
      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          stats: data.data,
          error: null,
          lastUpdated: new Date()
        }));
        
        return data.data; // Return stats for checking
      } else {
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to fetch stats'
        }));
        return null;
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to fetch stats'
      }));
      return null;
    }
  };

  // Simple background monitoring - just refresh after reasonable delay
  const startBackgroundMonitoring = () => {
    console.log('🔄 Starting background processing monitoring...');
    
    // Simple approach: refresh every 15 seconds for 2 minutes max
    let refreshCount = 0;
    const maxRefreshes = 8; // 8 x 15 seconds = 2 minutes
    
    backgroundPollingRef.current = setInterval(async () => {
      refreshCount++;
      console.log(`🔄 Auto-refreshing stats... (${refreshCount}/${maxRefreshes})`);
      
      await fetchStats();
      
      if (refreshCount >= maxRefreshes) {
        console.log('✅ Background monitoring completed');
        stopBackgroundMonitoring();
      }
    }, 15000); // Every 15 seconds
  };

  // Stop background monitoring
  const stopBackgroundMonitoring = () => {
    if (backgroundPollingRef.current) {
      clearInterval(backgroundPollingRef.current);
      backgroundPollingRef.current = null;
      console.log('🔄 Stopped background processing monitoring');
    }
  };

  // Start email processing with streaming updates
  const startProcessing = async () => {
    if (isProcessingRef.current) {
      console.log('Processing already in progress');
      return;
    }

    try {
      isProcessingRef.current = true;
      setState(prev => ({
        ...prev,
        isProcessing: true,
        error: null
      }));

      console.log('🚀 Starting email processing...');

      // START POLLING IMMEDIATELY (before API call)
      startPolling();

      // Start the processing (this will take 60+ seconds)
      const response = await fetch('/api/process-emails-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamUpdates: true,
          loadExisting: true
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Processing completed:', result.message);
      } else {
        console.error('❌ Processing failed:', result.error);
        setState(prev => ({
          ...prev,
          error: result.error || 'Processing failed'
        }));
      }

      // Stop polling and processing state after API completes
      stopPolling();
      setState(prev => ({
        ...prev,
        isProcessing: false
      }));
      isProcessingRef.current = false;

    } catch (error) {
      console.error('Error starting processing:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Failed to start processing'
      }));
      stopPolling();
      isProcessingRef.current = false;
    }
  };

  // NEW: Lightning fast import with auto-refresh
  const lightningImport = async () => {
    if (isProcessingRef.current) {
      console.log('Processing already in progress');
      return;
    }

    try {
      isProcessingRef.current = true;
      setState(prev => ({
        ...prev,
        isProcessing: true,
        error: null
      }));

      console.log('⚡ Starting lightning import...');

      // Call NEW fast endpoint that just saves emails
      const response = await fetch('/api/process-emails-fast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailLimit: 100  // Request max, API will enforce actual limit
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('⚡ Lightning import completed:', result.message);
        
        // Fetch updated stats immediately (shows initial pending replies)
        await fetchStats();
        
        // 🔄 AUTO-TRIGGER: Start background AI processing
        setTimeout(async () => {
          console.log('🤖 Auto-triggering background AI processing...');
          try {
            await fetch('/api/process-background', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ batchSize: 50 })
            });
            console.log('🤖 Background processing started');
            
            // ✨ NEW: Start auto-refresh monitoring
            startBackgroundMonitoring();
            
          } catch (error) {
            console.error('Background processing trigger failed:', error);
          }
        }, 2000); // Wait 2 seconds after import
        
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Import failed'
        }));
      }

    } catch (error) {
      console.error('Error with lightning import:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to import emails'
      }));
    } finally {
      setState(prev => ({
        ...prev,
        isProcessing: false
      }));
      isProcessingRef.current = false;
    }
  };

  // Start polling for updates
  const startPolling = () => {
    if (intervalRef.current) return;

    console.log('📊 Starting polling for updates...');
    
    // Fetch immediately
    fetchStats();
    
    // Then poll every 2 seconds
    intervalRef.current = setInterval(fetchStats, 2000);
  };

  // Stop polling
  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('📊 Stopped polling');
    }
  };

  // Initial load
  useEffect(() => {
    fetchStats();
    
    // Cleanup on unmount
    return () => {
      stopPolling();
      stopBackgroundMonitoring(); // NEW: Clean up background monitoring too
      isProcessingRef.current = false;
    };
  }, []);

  return {
    ...state,
    startProcessing,        // Keep this (slow way)
    lightningImport,        // NEW (fast way with auto-refresh)
    fetchStats,
    startPolling,
    stopPolling
  };
}