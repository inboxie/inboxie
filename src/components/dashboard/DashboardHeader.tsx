'use client';

import { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Mail, Crown, Sparkles } from 'lucide-react';

interface DashboardHeaderProps {
  userEmail: string;
  planType: 'free' | 'paid';
}

export default function DashboardHeader({ userEmail, planType }: DashboardHeaderProps) {
  const { data: session } = useSession();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProfileDropdown && !(event.target as Element).closest('.profile-avatar-container')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);

  return (
    <div className="app-header">
      <div className="inboxie-logo">
        <span style={{
          color: '#00d4aa',
          fontSize: '28px',
          fontWeight: '600',
          letterSpacing: '-0.5px'
        }}>
          inboxie.ai
        </span>
      </div>
        
      {/* Right side with plan badge and profile */}
      <div className="header-right">
        {/* Plan badge outside dropdown */}
        <div className="plan-badge-header">
          {planType === 'paid' && <Crown size={14} />}
          <span>{planType === 'paid' ? 'Pro' : 'Free'} Plan</span>
        </div>
        
        {/* Upgrade button for free users */}
        {planType === 'free' && (
          <button className="upgrade-btn-header">
            <Sparkles size={14} />
            <span>Upgrade to Pro</span>
          </button>
        )}
        
        {/* Gmail-style profile section */}
        <div className="profile-section">
          <div 
            className="profile-avatar-container"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          >
            <img 
              src={session?.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session?.user?.name || userEmail.split('@')[0])}&background=00d4aa&color=fff`}
              alt="Profile"
              className="profile-avatar"
            />
            
            {/* Dropdown menu */}
            {showProfileDropdown && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <img 
                    src={session?.user?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(session?.user?.name || userEmail.split('@')[0])}&background=00d4aa&color=fff`}
                    alt="Profile"
                    className="profile-dropdown-avatar"
                  />
                  <div className="profile-dropdown-info">
                    <div className="profile-name">{session?.user?.name || userEmail.split('@')[0]}</div>
                    <div className="profile-email">{userEmail}</div>
                  </div>
                </div>
                
                <div className="profile-dropdown-divider"></div>
                
                <div 
                  className="profile-dropdown-item profile-dropdown-signout"
                  onClick={handleSignOut}
                >
                  <span>Sign out</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}