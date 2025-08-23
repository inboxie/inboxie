import { Clock, Play } from 'lucide-react';
import ProcessingActivity from './ProcessingActivity';

interface SmartCategorizationProps {
  isProcessing: boolean;
  processingLogs: string[];
  allResults: any[];
  userPlanType: 'free' | 'paid';
  onProcessEmails: () => void;
  onReply: (email: any) => void;
  onAIReply: () => void;
}

export default function SmartCategorization({
  isProcessing,
  processingLogs,
  allResults,
  userPlanType,
  onProcessEmails,
  onReply,
  onAIReply
}: SmartCategorizationProps) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '0.75rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      border: '1px solid #f3f4f6',
      marginBottom: '2rem'
    }}>
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
            Smart Categorization
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            AI categorizes and labels your emails in Gmail, then enables professional inline Reply
          </p>
        </div>
        <button
          onClick={onProcessEmails}
          disabled={isProcessing}
          style={{
            background: isProcessing ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          {isProcessing ? (
            <>
              <Clock size={16} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play size={16} />
              Process Emails
            </>
          )}
        </button>
      </div>

      <ProcessingActivity
        processingLogs={processingLogs}
        allResults={allResults}
        userPlanType={userPlanType}
        onReply={onReply}
        onAIReply={onAIReply}
      />
    </div>
  );
}