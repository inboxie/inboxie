import React, { useState, useEffect } from 'react';
import { 
  Quote,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Send,
  Clock,
  Sparkles
} from 'lucide-react';

interface InlineReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: any;
  userEmail: string;
  onSuccess: (message: string) => void;
  userPlan?: 'free' | 'paid';
}

export default function InlineReplyModal({ 
  isOpen, 
  onClose, 
  email, 
  userEmail, 
  onSuccess,
  userPlan = 'free'
}: InlineReplyModalProps) {
  const [quoteBlocks, setQuoteBlocks] = useState<any[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processedContent, setProcessedContent] = useState<string>('');
  const [isProcessingContent, setIsProcessingContent] = useState(false);
  const [generatingAiForBlock, setGeneratingAiForBlock] = useState<string | null>(null);

  // 🚀 NEW: Track AI usage
  const [usedAI, setUsedAI] = useState(false);

  // Handle text selection
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
    }
  };

  // Clean email content
  const cleanEmailContent = () => {
    return email.body || email.snippet || email.text || `Subject: ${email.subject}`;
  };

  // Process email content when modal opens
  useEffect(() => {
    if (isOpen && email) {
      setProcessedContent(email.body || email.snippet || `Subject: ${email.subject}`);
      // 🚀 NEW: Reset AI tracking when modal opens
      setUsedAI(false);
    }
  }, [isOpen, email]);

  if (!isOpen || !email) return null;
  
  // Add selected text as a quote block
  const addQuoteBlock = () => {
    if (!selectedText.trim()) return;
    
    const newQuoteBlock = {
      id: `quote-${Date.now()}`,
      quotedText: selectedText.trim(),
      userResponse: '',
      isEditing: true
    };
    
    setQuoteBlocks(prev => [...prev, newQuoteBlock]);
    setSelectedText('');
    
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
  };

  // Update quote block response
  const updateQuoteBlock = (id: string, response: string) => {
    setQuoteBlocks(prev => prev.map(block => 
      block.id === id 
        ? { ...block, userResponse: response, isEditing: false }
        : block
    ));
  };

  // Edit quote block
  const editQuoteBlock = (id: string) => {
    setQuoteBlocks(prev => prev.map(block => 
      block.id === id 
        ? { ...block, isEditing: true }
        : block
    ));
  };

  // 🚀 UPDATED: Generate AI response for specific quote block + track usage
  const generateAiResponseForBlock = async (blockId: string, quotedText: string) => {
    if (userPlan !== 'paid') return;
    
    setGeneratingAiForBlock(blockId);
    
    try {
      const response = await fetch('/api/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: email.id,
          // FIXED: Only send the specific quote, not entire email context
          responseContext: `Respond to this specific quote only: "${quotedText}"`,
          includeQuoting: false,
          createDraft: false
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setQuoteBlocks(prev => prev.map(block => 
          block.id === blockId 
            ? { ...block, userResponse: result.data.generatedResponse, isEditing: false }
            : block
        ));
        
        // 🚀 NEW: Mark that AI was used!
        setUsedAI(true);
        console.log('🤖 AI was used - will track this reply');
      } else {
        alert(`AI generation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Failed to generate AI response. Please try again.');
    } finally {
      setGeneratingAiForBlock(null);
    }
  };

  // Delete quote block
  const deleteQuoteBlock = (id: string) => {
    setQuoteBlocks(prev => prev.filter(block => block.id !== id));
  };

  // Generate final reply - REVERSED: Quote first, then response
  const generateFinalReply = (): string => {
    if (quoteBlocks.length === 0) return '';
    
    let reply = '';
    
    quoteBlocks.forEach((block, index) => {
      if (block.userResponse.trim()) {
        // REVERSED: Add quoted text first with proper email formatting
        reply += `On ${email.date}, ${email.from} wrote:\r\n`;
        const quotedLines = block.quotedText
          .split('\n')
          .map(line => `> ${line}`)
          .join('\r\n');
        
        reply += `${quotedLines}\r\n\r\n`;
        
        // Then add your response
        reply += `${block.userResponse}\r\n\r\n`;
        
        // Add separator between quote blocks
        if (index < quoteBlocks.filter(b => b.userResponse.trim()).length - 1) {
          reply += '---\r\n\r\n';
        }
      }
    });
    
    return reply.trim();
  };

  // 🚀 UPDATED: Send AI tracking info to quick-reply API
  const handleSave = async () => {
    const finalReply = generateFinalReply();
    console.log('📧 GMAIL DEBUG - Final reply being sent:', finalReply);
    if (!finalReply.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/quick-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: email.id,
          userResponse: finalReply,
          includeQuoting: false,
          // 🚀 NEW: Send AI usage info
          usedAI: usedAI,
          aiReplyMethod: usedAI ? 'ai_assisted' : 'manual'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        onSuccess('Reply created! Check your Gmail drafts.');
        onClose();
        setQuoteBlocks([]);
        setSelectedText('');
        // 🚀 NEW: Reset AI tracking
        setUsedAI(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Network error: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1200px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        border: '1px solid #374151'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #374151',
          background: 'linear-gradient(135deg, #1f2937, #111827)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.25rem', 
              fontWeight: 600, 
              color: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Quote size={20} style={{ color: '#00d4aa' }} />
              Reply {userPlan === 'paid' && <span style={{ color: '#8b5cf6' }}>✨ AI-Powered</span>}
              {/* 🚀 NEW: Show AI usage indicator */}
              {usedAI && (
                <span style={{ 
                  color: '#8b5cf6', 
                  fontSize: '0.75rem',
                  background: 'rgba(139, 92, 246, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(139, 92, 246, 0.3)'
                }}>
                  🤖 AI Used
                </span>
              )}
            </h2>
            <p style={{ 
              margin: '0.25rem 0 0 0', 
              fontSize: '0.875rem', 
              color: '#9ca3af' 
            }}>
              Select text from the original email, then {userPlan === 'paid' ? 'type or use AI to reply' : 'type your reply'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowPreview(!showPreview)}
              style={{
                background: 'rgba(75, 85, 99, 0.5)',
                color: '#e5e7eb',
                border: '1px solid #4b5563',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(75, 85, 99, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(75, 85, 99, 0.5)';
              }}
            >
              {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                padding: '0.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Subject */}
        <div style={{
          padding: '1rem 2rem',
          backgroundColor: '#111827',
          borderBottom: '1px solid #374151'
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '1rem', 
            fontWeight: 600, 
            color: '#f9fafb' 
          }}>
            Re: {email.subject}
          </p>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Left Side - Original Email */}
          <div style={{
            flex: 1,
            padding: '1.5rem',
            borderRight: '1px solid #374151',
            overflow: 'auto',
            backgroundColor: '#1f2937'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '1rem', 
                fontWeight: 600, 
                color: '#f9fafb' 
              }}>
                Original Email
              </h3>
              {selectedText && (
                <button
                  onClick={addQuoteBlock}
                  style={{
                    background: 'linear-gradient(135deg, #00d4aa, #059669)',
                    color: '#1f2937',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    boxShadow: '0 4px 12px rgba(0, 212, 170, 0.4)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 212, 170, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 212, 170, 0.4)';
                  }}
                >
                  <Quote size={14} />
                  Quote & Reply
                </button>
              )}
            </div>

            {selectedText && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.1), rgba(5, 150, 105, 0.1))',
                border: '1px solid rgba(0, 212, 170, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem'
              }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.875rem', 
                  color: '#00d4aa',
                  fontWeight: 500
                }}>
                  Selected: "{selectedText.substring(0, 100)}{selectedText.length > 100 ? '...' : ''}"
                </p>
              </div>
            )}

            {/* Email Content */}
            <div
              onMouseUp={handleTextSelection}
              style={{
                background: '#374151',
                border: '1px solid #4b5563',
                borderRadius: '12px',
                padding: '1.5rem',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                color: '#e5e7eb',
                userSelect: 'text',
                cursor: 'text',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                position: 'relative'
              }}
            >
              <div style={{
                marginBottom: '1rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid #4b5563',
                color: '#9ca3af',
                fontSize: '0.8rem'
              }}>
                From: {email.from} • {email.date}
              </div>
              {cleanEmailContent()}
              
              {/* Floating Quote Button */}
              {selectedText && (
                <div style={{
                  position: 'fixed',
                  top: '50%',
                  right: '20px',
                  transform: 'translateY(-50%)',
                  zIndex: 1001
                }}>
                  <button
                    onClick={addQuoteBlock}
                    style={{
                      background: 'linear-gradient(135deg, #00d4aa, #059669)',
                      color: '#1f2937',
                      border: 'none',
                      padding: '0.75rem 1.25rem',
                      borderRadius: '25px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 8px 25px rgba(0, 212, 170, 0.4)',
                      transition: 'all 0.2s ease',
                      border: '2px solid #1f2937'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 212, 170, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 212, 170, 0.4)';
                    }}
                  >
                    <Quote size={16} />
                    Quote & Reply
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Quote Blocks & Responses */}
          <div style={{
            flex: 1,
            padding: '1.5rem',
            overflow: 'auto',
            backgroundColor: '#111827'
          }}>
            {showPreview ? (
              // Preview Mode
              <div style={{
                backgroundColor: '#374151',
                border: '1px solid #4b5563',
                borderRadius: '12px',
                padding: '1.5rem',
                height: '100%'
              }}>
                <h3 style={{ 
                  margin: '0 0 1rem 0', 
                  fontSize: '1rem', 
                  color: '#f9fafb' 
                }}>
                  Preview of your reply:
                </h3>
                <pre style={{
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  color: '#e5e7eb',
                  whiteSpace: 'pre-wrap',
                  margin: 0
                }}>
                  {generateFinalReply() || 'No quotes added yet...'}
                </pre>
              </div>
            ) : (
              // Edit Mode
              <div>
                <h3 style={{ 
                  margin: '0 0 1rem 0', 
                  fontSize: '1rem', 
                  fontWeight: 600, 
                  color: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  Your Reply ({quoteBlocks.length} quotes) {userPlan === 'paid' && <span style={{ color: '#8b5cf6' }}>✨</span>}
                </h3>

                {quoteBlocks.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    color: '#9ca3af'
                  }}>
                    <Quote size={48} style={{ color: '#6b7280', margin: '0 auto 1rem auto' }} />
                    <p style={{ margin: 0, color: '#e5e7eb' }}>
                      Select text from the original email to start quoting and replying.
                    </p>
                    {userPlan === 'paid' && (
                      <p style={{ 
                        margin: '0.5rem 0 0 0', 
                        fontSize: '0.875rem', 
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}>
                        ✨ Pro users can use AI to generate responses
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {quoteBlocks.map((block) => (
                      <div key={block.id} style={{
                        border: '1px solid #4b5563',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        backgroundColor: '#1f2937'
                      }}>
                        {/* Quote */}
                        <div style={{
                          background: 'linear-gradient(135deg, #374151, #4b5563)',
                          borderLeft: '4px solid #00d4aa',
                          padding: '1rem',
                          borderBottom: '1px solid #4b5563'
                        }}>
                          <p style={{
                            margin: 0,
                            fontSize: '0.875rem',
                            color: '#d1d5db',
                            fontStyle: 'italic',
                            lineHeight: 1.5
                          }}>
                            "{block.quotedText}"
                          </p>
                        </div>

                        {/* Response */}
                        <div style={{ padding: '1rem' }}>
                          {block.isEditing ? (
                            <div>
                              <textarea
                                autoFocus
                                value={block.userResponse}
                                onChange={(e) => setQuoteBlocks(prev => prev.map(b => 
                                  b.id === block.id ? { ...b, userResponse: e.target.value } : b
                                ))}
                                placeholder={userPlan === 'paid' 
                                  ? "Type your response or click 'AI Reply' to generate one..." 
                                  : "Type your response to this quote..."
                                }
                                style={{
                                  width: '100%',
                                  minHeight: '80px',
                                  border: '1px solid #4b5563',
                                  borderRadius: '8px',
                                  padding: '0.75rem',
                                  outline: 'none',
                                  fontSize: '0.875rem',
                                  lineHeight: 1.5,
                                  resize: 'vertical',
                                  fontFamily: 'inherit',
                                  backgroundColor: '#374151',
                                  color: '#e5e7eb'
                                }}
                              />
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                                marginTop: '0.75rem'
                              }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    onClick={() => deleteQuoteBlock(block.id)}
                                    style={{
                                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))',
                                      color: '#ef4444',
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      padding: '0.375rem 0.75rem',
                                      borderRadius: '8px',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))';
                                    }}
                                  >
                                    <Trash2 size={12} />
                                    Delete
                                  </button>
                                  
                                  {/* AI Reply Button for Pro Users */}
                                  {userPlan === 'paid' && (
                                    <button
                                      onClick={() => generateAiResponseForBlock(block.id, block.quotedText)}
                                      disabled={generatingAiForBlock === block.id}
                                      style={{
                                        background: generatingAiForBlock === block.id 
                                          ? 'rgba(107, 114, 128, 0.3)' 
                                          : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                        color: generatingAiForBlock === block.id ? '#9ca3af' : 'white',
                                        border: 'none',
                                        padding: '0.375rem 0.75rem',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        cursor: generatingAiForBlock === block.id ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        boxShadow: generatingAiForBlock === block.id ? 'none' : '0 2px 8px rgba(139, 92, 246, 0.4)',
                                        transition: 'all 0.2s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        if (generatingAiForBlock !== block.id) {
                                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.6)';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (generatingAiForBlock !== block.id) {
                                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.4)';
                                        }
                                      }}
                                    >
                                      {generatingAiForBlock === block.id ? (
                                        <>
                                          <Clock size={12} />
                                          Generating...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles size={12} />
                                          AI Reply
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                                
                                <button
                                  onClick={() => updateQuoteBlock(block.id, block.userResponse)}
                                  style={{
                                    background: 'linear-gradient(135deg, #00d4aa, #059669)',
                                    color: '#1f2937',
                                    border: 'none',
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                  }}
                                >
                                  Save Response
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => editQuoteBlock(block.id)}
                              style={{
                                cursor: 'pointer',
                                minHeight: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.5rem',
                                borderRadius: '8px',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.3)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              {block.userResponse ? (
                                <div>
                                  <p style={{ 
                                    margin: 0, 
                                    fontSize: '0.875rem', 
                                    color: '#e5e7eb',
                                    lineHeight: 1.5
                                  }}>
                                    {block.userResponse}
                                  </p>
                                  <p style={{ 
                                    margin: '0.5rem 0 0 0', 
                                    fontSize: '0.75rem', 
                                    color: '#9ca3af',
                                    fontStyle: 'italic'
                                  }}>
                                    Click to edit
                                  </p>
                                </div>
                              ) : (
                                <p style={{ 
                                  margin: 0, 
                                  fontSize: '0.875rem', 
                                  color: '#9ca3af',
                                  fontStyle: 'italic'
                                }}>
                                  Click to add your response...
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '1px solid #374151',
          background: 'linear-gradient(135deg, #1f2937, #111827)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            {quoteBlocks.filter(b => b.userResponse && b.userResponse.trim()).length} replies ready
            {/* 🚀 NEW: Show AI usage in footer */}
            {usedAI && (
              <span style={{ 
                marginLeft: '12px',
                color: '#8b5cf6',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                🤖 AI assisted
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.625rem 1.25rem',
                border: '1px solid #6b7280',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: '#e5e7eb',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.3)';
                e.currentTarget.style.borderColor = '#9ca3af';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = '#6b7280';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={quoteBlocks.filter(b => b.userResponse && b.userResponse.trim()).length === 0 || isSubmitting}
              style={{
                padding: '0.625rem 1.25rem',
                border: 'none',
                borderRadius: '8px',
                background: (quoteBlocks.filter(b => b.userResponse && b.userResponse.trim()).length > 0 && !isSubmitting)
                  ? (usedAI 
                      ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' // Purple gradient if AI used
                      : 'linear-gradient(135deg, #00d4aa, #059669)'  // Green gradient if manual
                    )
                  : 'rgba(107, 114, 128, 0.5)',
                color: (quoteBlocks.filter(b => b.userResponse && b.userResponse.trim()).length > 0 && !isSubmitting) ? (usedAI ? 'white' : '#1f2937') : '#9ca3af',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: (quoteBlocks.filter(b => b.userResponse && b.userResponse.trim()).length > 0 && !isSubmitting) ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                boxShadow: (quoteBlocks.filter(b => b.userResponse && b.userResponse.trim()).length > 0 && !isSubmitting) 
                  ? (usedAI 
                      ? '0 4px 12px rgba(139, 92, 246, 0.4)' 
                      : '0 4px 12px rgba(0, 212, 170, 0.4)'
                    ) 
                  : 'none'
              }}
              onMouseEnter={(e) => {
                if (quoteBlocks.filter(b => b.userResponse && b.userResponse.trim()).length > 0 && !isSubmitting) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = usedAI 
                    ? '0 6px 16px rgba(139, 92, 246, 0.5)' 
                    : '0 6px 16px rgba(0, 212, 170, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (quoteBlocks.filter(b => b.userResponse && b.userResponse.trim()).length > 0 && !isSubmitting) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = usedAI 
                    ? '0 4px 12px rgba(139, 92, 246, 0.4)' 
                    : '0 4px 12px rgba(0, 212, 170, 0.4)';
                }
              }}
            >
              {isSubmitting ? (
                <>
                  <Clock size={16} />
                  Creating...
                </>
              ) : (
                <>
                  <Send size={16} />
                  {usedAI ? 'Create AI Reply' : 'Create Reply'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}