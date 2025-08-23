import { Bot } from 'lucide-react';
import EmailCard from '../ui/EmailCard';

interface ProcessingActivityProps {
  processingLogs: string[];
  allResults: any[];
  userPlanType: 'free' | 'paid';
  onReply: (email: any) => void;
  onAIReply: () => void;
}

export default function ProcessingActivity({ 
  processingLogs, 
  allResults, 
  userPlanType,
  onReply,
  onAIReply 
}: ProcessingActivityProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      minHeight: '500px'
    }}>
      {/* Left: Processing Activity */}
      <div style={{
        padding: '1.5rem',
        borderRight: '1px solid #f3f4f6'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
          Processing Activity
        </h3>
        <div style={{
          backgroundColor: '#111827',
          borderRadius: '0.5rem',
          padding: '1rem',
          height: '400px',
          overflowY: 'auto',
          fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace'
        }}>
          {processingLogs.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
              Click "Process Emails" to start categorizing your inbox...
            </p>
          ) : (
            processingLogs.map((log, index) => (
              <div key={index} style={{
                color: '#10b981',
                fontSize: '0.875rem',
                marginBottom: '0.25rem'
              }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Processed Emails */}
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
          Processed Emails ({allResults.length})
        </h3>
        <div style={{
          height: '400px',
          overflowY: 'auto'
        }}>
          {allResults.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: '#6b7280'
            }}>
              <Bot size={48} style={{ color: '#9ca3af', margin: '0 auto 1rem auto' }} />
              <p style={{ margin: 0 }}>
                No emails processed yet. Start processing to see categorized emails with reply options.
              </p>
            </div>
          ) : (
            allResults.map((email, index) => (
        <EmailCard
          key={index}
          email={email}
          userPlanType={userPlanType}
          onReply={() => onReply(email)}
           onAIReply={() => onAIReply(email)}  // <-- NOW PASSES EMAIL
/>
            ))
          )}
        </div>
      </div>
    </div>
  );
}