'use client';

// Import our clean, organized components
import InlineReplyModal from '@/components/modals/InlineReplyModal';
import ProductivityDashboard from '@/components/dashboard/ProductivityDashboard';

// Import both hooks - keep existing functionality while adding streaming
import { useInboxie } from '@/hooks/useInboxie';
import { useEmailStreaming } from '@/hooks/useEmailStreaming';

export default function InboxieDashboard() {
  // Keep your existing hook for now (all the complex functionality)
  const {
    userEmail,
    userStats,
    isProcessing,
    processingLogs,
    allResults,
    isTraining,
    replyModal,
    togglePlan,
    handleStartTraining,
    openReply,
    closeReply,
    handleSuccess,
    handleAIReply,
    processEmails,
  } = useInboxie();

  // Add the new streaming hook (for testing)
  const { 
    isProcessing: isStreamingProcessing, 
    stats: streamingStats, 
    error: streamingError,
    startProcessing: startStreamingProcessing 
  } = useEmailStreaming();

  return (
    <div>
      
      <ProductivityDashboard />

      {/* Keep the modal for now */}
      <InlineReplyModal
        isOpen={replyModal.isOpen}
        onClose={closeReply}
        email={replyModal.email}
        userEmail={userEmail}
        onSuccess={handleSuccess}
      />
    </div>
  );
}