import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Shield, 
  Star,
  Crown,
  Zap,
  Building,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import axios from 'axios';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
  tier: string;
  credits_remaining: number;
  credits_monthly_limit: number;
  credits_reset_date: string;
  subscription_status: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}

const ProfilePage: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLight = theme === 'light';
  
  // Theme-specific styling
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';

  // Helper function to get tier icon and color
  type TierType = 'free' | 'pro' | 'elite' | 'institutional';
  
  interface TierInfo {
    name: string;
    icon: JSX.Element;
    iconColor: string;
    textColor: string;
    bgColor: string;
  }

  const getTierInfo = (tier?: string): TierInfo => {
    const tierKey = (tier?.toLowerCase() as TierType) || 'free';
    
    const tierData: Record<TierType, TierInfo> = {
      free: {
        name: 'HRVSTR Free',
        icon: <Star className="w-4 h-4" />,
        iconColor: isLight ? 'text-gray-600' : 'text-gray-300',
        textColor: isLight ? 'text-gray-600' : 'text-gray-300',
        bgColor: isLight ? 'bg-gray-200' : 'bg-gray-800'
      },
      pro: {
        name: 'HRVSTR Pro',
        icon: <Crown className="w-4 h-4 text-white" />,
        iconColor: 'text-white',
        textColor: 'text-white',
        bgColor: 'bg-gradient-to-r from-blue-500 to-purple-600'
      },
      elite: {
        name: 'HRVSTR Elite',
        icon: <Zap className="w-4 h-4" />,
        iconColor: isLight ? 'text-purple-600' : 'text-purple-400',
        textColor: isLight ? 'text-purple-600' : 'text-purple-400',
        bgColor: isLight ? 'bg-purple-200' : 'bg-purple-900'
      },
      institutional: {
        name: 'HRVSTR Institutional',
        icon: <Building className="w-4 h-4" />,
        iconColor: isLight ? 'text-emerald-400' : 'text-emerald-300',
        textColor: isLight ? 'text-emerald-400' : 'text-emerald-300',
        bgColor: isLight ? 'bg-emerald-200' : 'bg-emerald-900'
      }
    };

    return tierData[tierKey] || tierData.free;
  };

  // Fetch user profile data
  const fetchProfileData = async () => {
    if (!user?.token) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/api/auth/profile`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });

      if (response.data) {
        setProfileData(response.data);
        setError(null);
      }
    } catch (error: any) {
      console.error('Error fetching profile data:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user?.token]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate account age
  const getAccountAge = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years !== 1 ? 's' : ''}`;
    }
  };

  // Note: getCreditsUsagePercentage and getSubscriptionStatusColor are kept for future use

  if (loading) {
    return (
      <div className={`p-6 ${bgColor} min-h-screen`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-6 h-6 animate-spin mr-2 ${secondaryTextColor}`} />
            <span className={textColor}>Loading profile...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${bgColor} min-h-screen`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <AlertCircle className="w-6 h-6 text-red-500 mr-2" />
            <span className="text-red-500">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${bgColor} min-h-screen`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 rounded-full ${cardBgColor} border-2 ${borderColor} flex items-center justify-center`}>
              <span className={`${getTierInfo(profileData?.tier || 'free').iconColor}`}>
                {React.cloneElement(getTierInfo(profileData?.tier || 'free').icon, { 
                  className: 'w-8 h-8' 
                })}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">
                <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                  {profileData?.name || 'User Profile'}
                </span>
              </h1>
              <p className={`${secondaryTextColor} mt-1`}>{profileData?.email}</p>
              <div className="flex items-center mt-2 space-x-4">
                {/* Tier Badge */}
                {profileData?.tier && (
                  <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getTierInfo(profileData.tier).bgColor}`}>
                    <span className={getTierInfo(profileData.tier).iconColor}>
                      {getTierInfo(profileData.tier).icon}
                    </span>
                    <span className={`text-sm font-medium ${getTierInfo(profileData.tier).textColor}`}>
                      {getTierInfo(profileData.tier).name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
          <h2 className={`text-xl font-semibold ${textColor} mb-4 flex items-center`}>
            <Shield className="w-5 h-5 mr-2" />
            Account Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Creation */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                  <Calendar className="w-3 h-3 text-white" />
                </div>
                <h3 className={`font-medium ${textColor}`}>Account Created</h3>
              </div>
              <p className={secondaryTextColor}>
                {profileData?.created_at ? formatDate(profileData.created_at) : 'N/A'}
              </p>
              <p className={`text-sm ${secondaryTextColor}`}>
                {profileData?.created_at ? `${getAccountAge(profileData.created_at)} ago` : ''}
              </p>
            </div>
          </div>
        </div>
          </div>
        </div>
  );
};

export default ProfilePage; 