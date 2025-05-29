import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  CreditCard, 
  Shield, 
  Mail,
  Clock,
  Star,
  Crown,
  Zap,
  Building,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle
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
  const accentColor = isLight ? 'text-blue-600' : 'text-blue-400';

  // Helper function to get tier icon and color
  const getTierInfo = (tier: string) => {
    const tierData = {
      free: {
        icon: <Star className="w-5 h-5" />,
        color: 'text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-800'
      },
      pro: {
        icon: <Crown className="w-5 h-5" />,
        color: 'text-blue-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900'
      },
      elite: {
        icon: <Zap className="w-5 h-5" />,
        color: 'text-purple-500',
        bgColor: 'bg-purple-100 dark:bg-purple-900'
      },
      institutional: {
        icon: <Building className="w-5 h-5" />,
        color: 'text-green-500',
        bgColor: 'bg-green-100 dark:bg-green-900'
      }
    };

    return tierData[tier?.toLowerCase() as keyof typeof tierData] || tierData.free;
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

  // Calculate credits usage percentage
  const getCreditsUsagePercentage = (remaining: number, limit: number) => {
    if (limit === 0) return 0;
    return ((limit - remaining) / limit) * 100;
  };

  // Get subscription status badge color
  const getSubscriptionStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-400';
      case 'expired':
      case 'cancelled':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-400';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
    }
  };

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
              <User className={`w-8 h-8 ${accentColor}`} />
            </div>
            <div className="flex-1">
              <h1 className={`text-2xl font-bold ${textColor}`}>{profileData?.name || 'User Profile'}</h1>
              <p className={`${secondaryTextColor} mt-1`}>{profileData?.email}</p>
              <div className="flex items-center mt-2 space-x-4">
                {/* Tier Badge */}
                {profileData?.tier && (
                  <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getTierInfo(profileData.tier).bgColor}`}>
                    <span className={getTierInfo(profileData.tier).color}>
                      {getTierInfo(profileData.tier).icon}
                    </span>
                    <span className={`text-sm font-medium ${getTierInfo(profileData.tier).color}`}>
                      HRVSTR {profileData.tier.charAt(0).toUpperCase() + profileData.tier.slice(1)}
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
                <Calendar className="w-4 h-4 text-blue-500" />
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

        {/* Credits & Usage */}
        <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
          <h2 className={`text-xl font-semibold ${textColor} mb-4 flex items-center`}>
            <CreditCard className="w-5 h-5 mr-2" />
            Credits & Usage
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Credits Remaining */}
            <div className="space-y-2">
              <h3 className={`font-medium ${textColor}`}>Credits Remaining</h3>
              <p className={`text-2xl font-bold ${accentColor}`}>
                {profileData?.credits_remaining ?? 'N/A'}
              </p>
            </div>

            {/* Monthly Limit */}
            <div className="space-y-2">
              <h3 className={`font-medium ${textColor}`}>Monthly Limit</h3>
              <p className={`text-2xl font-bold ${textColor}`}>
                {profileData?.credits_monthly_limit ?? 'N/A'}
              </p>
            </div>

            {/* Credits Reset Date */}
            <div className="space-y-2 md:col-span-2">
              <h3 className={`font-medium ${textColor}`}>Credits Reset Date</h3>
              <p className={secondaryTextColor}>
                {profileData?.credits_reset_date ? formatDate(profileData.credits_reset_date) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription Details */}
        {(profileData?.stripe_customer_id || profileData?.stripe_subscription_id) && (
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
            <h2 className={`text-xl font-semibold ${textColor} mb-4 flex items-center`}>
              <CheckCircle className="w-5 h-5 mr-2" />
              Subscription Details
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {profileData?.stripe_customer_id && (
                <div className="space-y-2">
                  <h3 className={`font-medium ${textColor}`}>Stripe Customer ID</h3>
                  <p className={`font-mono text-sm ${secondaryTextColor} break-all`}>
                    {profileData.stripe_customer_id}
                  </p>
                </div>
              )}

              {profileData?.stripe_subscription_id && (
                <div className="space-y-2">
                  <h3 className={`font-medium ${textColor}`}>Stripe Subscription ID</h3>
                  <p className={`font-mono text-sm ${secondaryTextColor} break-all`}>
                    {profileData.stripe_subscription_id}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage; 