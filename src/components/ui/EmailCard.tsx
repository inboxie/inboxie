import { Reply, Bot } from 'lucide-react';

interface EmailCardProps {
  email: {
    subject?: string;
    from?: string;
    from_addr?: string;
    category?: string;
  };
  userPlanType: 'free' | 'paid';
  onReply: () => void;
  onAIReply: () => void;
}

export default function EmailCard({ 
  email, 
  userPlanType, 
  onReply, 
  onAIReply 
}: EmailCardProps) {
  return (
    <div style={{
      background: '#f9fafb',
      borderLeft: '4px solid #3b82f6',
      borderRadius: '0.5rem',
      padding: '1rem',
      marginBottom: '0.75rem'
    }}>
      <p style={{
        fontWeight: 600,
        color: '#111827',
        margin: '0 0 0.25rem 0',
        fontSize: '0.875rem'
      }}>
        {email.subject || 'No subject'}
      </p>
      
      <p style={{
        fontSize: '0.75rem',
        color: '#6b7280',
        margin: '0 0 0.5rem 0'
      }}>
        From: {email.from || email.from_addr}
      </p>
      
      <div style={{ marginBottom: '0.75rem' }}>
        {email.category && (
          <span style={{
            background: '#dbeafe',
            color: '#1e40af',
            padding: '0.125rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.75rem'
          }}>
            {email.category}
          </span>
        )}
      </div>
      
      {/* Reply Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={onReply}
          style={{
            background: '#2563eb',
            color: 'white',
            border: 'none',
            padding: '0.375rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem'
          }}
        >
          <Reply size={12} />
          Reply
        </button>
        
        <button
          onClick={onAIReply}
          disabled={userPlanType === 'free'}
          style={{
            background: userPlanType === 'paid' ? 'linear-gradient(45deg, #7c3aed, #2563eb)' : '#9ca3af',
            color: 'white',
            border: 'none',
            padding: '0.375rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: userPlanType === 'paid' ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            opacity: userPlanType === 'free' ? 0.6 : 1
          }}
          title={userPlanType === 'free' ? 'Upgrade to Pro to unlock AI replies' : 'Generate AI-powered reply'}
        >
          <Bot size={12} />
          Reply with AI
        </button>
      </div>
    </div>
  );
}