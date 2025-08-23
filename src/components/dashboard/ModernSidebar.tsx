'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
  LogOut,
  Crown,
  Zap,
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  currentPage?: string;
  onPageChange?: (page: string) => void;
  userEmail: string;
  planType: 'free' | 'paid';
  userStats?: {
    emailsProcessed: number;
    limit: number;
  };
}

export default function ModernSidebar({ currentPage = 'dashboard', onPageChange, userEmail, planType, userStats }: SidebarProps) {
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  const progressPercentage = userStats 
    ? Math.round((userStats.emailsProcessed / userStats.limit) * 100) 
    : 0;

  return (
    <>
      {/* Sidebar Container */}
      <div 
        className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          height: '100vh',
          width: isCollapsed ? '60px' : '260px',
          background: 'linear-gradient(180deg, #1a1d29 0%, #151821 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        
        {/* Logo Section */}
        <div 
          style={{
            padding: isCollapsed ? '20px 8px' : '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            minHeight: '70px',
            justifyContent: isCollapsed ? 'center' : 'flex-start'
          }}
        >
          {!isCollapsed && (
            <div 
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#00d4aa',
                whiteSpace: 'nowrap'
              }}
            >
              inboxie.ai
            </div>
          )}
          {isCollapsed && (
            <div 
              style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#00d4aa'
              }}
            >
              📧
            </div>
          )}
        </div>

        {/* User Profile Section */}
        <div 
          style={{
            padding: isCollapsed ? '16px 8px' : '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundImage: session?.user?.image 
                  ? `url(${session.user.image})`
                  : `url(https://ui-avatars.com/api/?name=${encodeURIComponent(session?.user?.name || userEmail.split('@')[0])}&background=00d4aa&color=fff)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '600',
                color: '#ffffff',
                flexShrink: 0
              }}
            />
            
            {!isCollapsed && (
              <div style={{ marginLeft: '12px', overflow: 'hidden', flex: 1 }}>
                <div 
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {session?.user?.name || userEmail.split('@')[0]}
                </div>
                <div 
                  style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '2px'
                  }}
                >
                  {userEmail}
                </div>
              </div>
            )}
          </div>
          
          {!isCollapsed && (
            <button
              onClick={handleSignOut}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#9ca3af',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = '#9ca3af';
              }}
            >
              <LogOut size={12} />
              Sign Out
            </button>
          )}
        </div>

        {/* Plan Status Section - MOVED UP */}
        {!isCollapsed && (
          <div 
            style={{
              padding: '20px 24px',
              flex: 1
            }}
          >
            <div 
              style={{
                padding: '16px',
                background: planType === 'paid' 
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.1) 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                border: planType === 'paid' 
                  ? '1px solid rgba(139, 92, 246, 0.2)'
                  : '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}
              >
                {planType === 'paid' ? (
                  <Crown size={16} style={{ color: '#a855f7', marginRight: '8px' }} />
                ) : (
                  <Zap size={16} style={{ color: '#00d4aa', marginRight: '8px' }} />
                )}
                <span 
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: planType === 'paid' ? '#a855f7' : '#00d4aa',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {planType === 'paid' ? 'Pro Plan' : 'Free Plan'}
                </span>
              </div>
              
              {userStats && (
                <>
                  <div 
                    style={{
                      fontSize: '13px',
                      color: '#ffffff',
                      marginBottom: '8px'
                    }}
                  >
                    {userStats.emailsProcessed}/{userStats.limit} processed
                  </div>
                  
                  <div 
                    style={{
                      width: '100%',
                      height: '4px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                      marginBottom: '12px'
                    }}
                  >
                    <div 
                      style={{
                        width: `${progressPercentage}%`,
                        height: '100%',
                        background: planType === 'paid' 
                          ? 'linear-gradient(90deg, #a855f7, #8b5cf6)'
                          : 'linear-gradient(90deg, #00d4aa, #00b894)',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </>
              )}
              
              {planType === 'free' && (
                <button
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #00d4aa, #00b894)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#1a1d29',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  ⚡ Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapse Toggle - MOVED UP */}
        <div 
          style={{
            padding: isCollapsed ? '12px 8px' : '12px 24px'
          }}
        >
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#6b7280',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#9ca3af';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            {isCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft size={16} />
                <span style={{ marginLeft: '8px' }}>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Spacer - REMOVE THIS */}
      {/* <div 
        style={{
          marginLeft: isCollapsed ? '60px' : '260px',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '100vh'
        }}
      >
      </div> */}
    </>
  );
}