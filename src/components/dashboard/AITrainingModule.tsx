'use client';

import { useState } from 'react';
import { Brain, Zap, CheckCircle, AlertCircle } from 'lucide-react';

interface AITrainingModuleProps {
  userPlanType: 'free' | 'paid';
  userEmail: string;
  isTraining: boolean;
  onStartTraining: () => void;
}

export default function AITrainingModule({ 
  userPlanType, 
  userEmail,
  isTraining, 
  onStartTraining 
}: AITrainingModuleProps) {
  const [trainingStatus, setTrainingStatus] = useState<'not_started' | 'training' | 'completed' | 'error'>('not_started');
  const [trainingLogs, setTrainingLogs] = useState<string[]>([]);
  const [actualEmailsUsed, setActualEmailsUsed] = useState<number>(0); // NEW: Track actual count

  // Only show for paid users
  if (userPlanType !== 'paid') {
    return null;
  }

  const handleTrainAI = async () => {
    setTrainingStatus('training');
    setTrainingLogs(['🚀 Starting AI training process...']);
    
    try {
      onStartTraining();
      
      // Call the training API
      setTrainingLogs(prev => [...prev, '📧 Fetching your sent emails...']);
      
      const response = await fetch('/api/tone-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userEmail: userEmail,
          analyzeCount: 50 // FIXED: Request realistic amount
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        const actualCount = data.data.toneProfile.sentEmailsAnalyzed || data.data.toneProfile.emailsActuallyUsed || 0;
        setActualEmailsUsed(actualCount); // Store actual count
        
        setTrainingLogs(prev => [...prev, `✅ Training completed! Analyzed ${actualCount} emails`]);
        setTrainingLogs(prev => [...prev, `🎯 Learned ${data.data.toneProfile.phrasesLearned} common phrases`]);
        setTrainingLogs(prev => [...prev, `📊 Formality: ${data.data.toneProfile.formality}, Length: ${data.data.toneProfile.length}`]);
        setTrainingStatus('completed');
      } else {
        setTrainingLogs(prev => [...prev, `❌ Training failed: ${data.error}`]);
        setTrainingStatus('error');
      }
    } catch (error) {
      setTrainingLogs(prev => [...prev, `❌ Network error: ${error}`]);
      setTrainingStatus('error');
    }
  };

  return (
    <div className="feature-card" style={{ marginBottom: '2rem' }}>
      <div className="feature-header">
        <div className="feature-info">
          <div className="feature-icon paid">
            <Brain size={24} />
          </div>
          <div className="feature-text">
            <h3>🤖 Train Your AI Assistant</h3>
            <p>Personalize AI replies based on your writing style</p>
          </div>
        </div>
        <div className="pro-badge">
          <Zap size={12} />
          Pro Feature
        </div>
      </div>

      <div className="feature-stats" style={{ marginBottom: '1rem' }}>
        {trainingStatus === 'not_started' && (
          <p>Train AI on your recent sent emails to generate personalized responses that match your writing style.</p>
        )}
        {trainingStatus === 'training' && (
          <p>🔄 Training in progress... Analyzing your writing patterns...</p>
        )}
        {trainingStatus === 'completed' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669' }}>
            <CheckCircle size={16} />
            <span>✅ AI training completed using {actualEmailsUsed} emails! Reply with AI is now available.</span>
          </div>
        )}
        {trainingStatus === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
            <AlertCircle size={16} />
            <span>❌ Training failed. Please try again.</span>
          </div>
        )}
      </div>

      {/* Training Logs Terminal */}
      {trainingLogs.length > 0 && (
        <div className="terminal" style={{ height: '8rem', marginBottom: '1rem' }}>
          {trainingLogs.map((log, index) => (
            <div key={index} className="terminal-log">
              {log}
            </div>
          ))}
          {trainingStatus === 'training' && (
            <div className="terminal-log" style={{ opacity: 0.7 }}>
              <span className="animate-spin">⚡</span> Processing...
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleTrainAI}
        disabled={isTraining || trainingStatus === 'training' || trainingStatus === 'completed'}
        className={`feature-btn ${
          trainingStatus === 'completed' 
            ? 'disabled' 
            : trainingStatus === 'training' || isTraining
            ? 'processing'
            : 'gradient'
        }`}
      >
        {trainingStatus === 'not_started' && '🤖 Train AI on Recent Emails'}
        {trainingStatus === 'training' && '🔄 Training AI...'}
        {trainingStatus === 'completed' && `✅ AI Trained on ${actualEmailsUsed} Emails`}
        {trainingStatus === 'error' && '🔄 Retry Training'}
      </button>

      {trainingStatus === 'completed' && (
        <div style={{ 
          background: '#f0fdf4', 
          border: '1px solid #bbf7d0', 
          borderRadius: '0.5rem', 
          padding: '0.75rem', 
          marginTop: '1rem',
          fontSize: '0.875rem',
          color: '#166534'
        }}>
          🎉 Your AI assistant is now trained on {actualEmailsUsed} emails! You can use "Reply with AI" on any email to generate personalized responses that match your writing style.
        </div>
      )}
    </div>
  );
}