import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { getProxyUrl } from '../../services/apiService';
import { 
  Server, 
  Database, 
  Activity, 
  Clock, 
  HardDrive, 
  Cpu, 
  Network,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader
} from 'lucide-react';

interface ServerMemory {
  used: string;
  total: string;
  external: string;
}

interface ServerInfo {
  port: number;
  memory: ServerMemory;
  platform: string;
  nodeVersion: string;
}

interface Services {
  api: string;
  rateLimit: string;
  cors: string;
}

interface HealthChecks {
  express: boolean;
  cors: boolean;
  json_parser: boolean;
  rate_limiter: boolean;
}

interface StatusData {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  server: ServerInfo;
  services: Services;
  healthChecks: HealthChecks;
  endpoints: {
    total: number;
    available: string[];
  };
}

const StatusPage: React.FC = () => {
  const { theme } = useTheme();
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-100' : 'bg-gray-900';
  const cardBgColor = isLight ? 'bg-white' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const borderColor = isLight ? 'border-stone-300' : 'border-gray-700';

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const proxyUrl = getProxyUrl();
      const response = await fetch(`${proxyUrl}/api/status`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatusData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      setStatusData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'operational':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'unhealthy':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'operational':
        return 'text-green-500';
      case 'unhealthy':
      case 'error':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  const formatServiceName = (service: string) => {
    switch (service.toLowerCase()) {
      case 'api':
        return 'API';
      case 'ratelimit':
        return 'Rate Limiting';
      case 'cors':
        return 'CORS';
      default:
        return service.charAt(0).toUpperCase() + service.slice(1);
    }
  };

  const formatStatusValue = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatHealthCheckName = (check: string) => {
    switch (check.toLowerCase()) {
      case 'express':
        return 'Express';
      case 'cors':
        return 'CORS';
      case 'json_parser':
        return 'JSON Parser';
      case 'rate_limiter':
        return 'Rate Limiter';
      default:
        return check.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  if (loading && !statusData) {
    return (
      <div className={`min-h-screen ${bgColor} ${textColor} p-6`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading backend status...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgColor} ${textColor} p-6`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Server className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Status</h1>
            </div>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Activity className="w-4 h-4 mr-2" />
              )}
              Refresh
            </button>
          </div>
          <p className={`${secondaryTextColor}`}>
            Real-time status and health information for backend services
          </p>
          <p className={`text-sm ${secondaryTextColor} mt-2`}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">Error fetching status:</span>
            </div>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {statusData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Overall Status */}
            <div className={`${cardBgColor} p-6 rounded-lg border ${borderColor}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Overall Status</h3>
                {getStatusIcon(statusData.status)}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>Status:</span>
                  <span className={`font-medium ${getStatusColor(statusData.status)}`}>
                    {formatStatusValue(statusData.status)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>Environment:</span>
                  <span className="font-medium">{formatStatusValue(statusData.environment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>Version:</span>
                  <span className="font-medium">{statusData.version}</span>
                </div>
              </div>
            </div>

            {/* Server Info */}
            <div className={`${cardBgColor} p-6 rounded-lg border ${borderColor}`}>
              <div className="flex items-center mb-4">
                <Cpu className="w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold">Server Info</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>Port:</span>
                  <span className="font-medium">{statusData.server.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>Platform:</span>
                  <span className="font-medium">{statusData.server.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>Node.js:</span>
                  <span className="font-medium">{statusData.server.nodeVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>Uptime:</span>
                  <span className="font-medium">{formatUptime(statusData.uptime)}</span>
                </div>
              </div>
            </div>

            {/* Memory Usage */}
            <div className={`${cardBgColor} p-6 rounded-lg border ${borderColor}`}>
              <div className="flex items-center mb-4">
                <HardDrive className="w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold">Memory Usage</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>Used:</span>
                  <span className="font-medium">{statusData.server.memory.used}</span>
                </div>
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>Total:</span>
                  <span className="font-medium">{statusData.server.memory.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className={secondaryTextColor}>External:</span>
                  <span className="font-medium">{statusData.server.memory.external}</span>
                </div>
              </div>
            </div>

            {/* Services Status */}
            <div className={`${cardBgColor} p-6 rounded-lg border ${borderColor}`}>
              <div className="flex items-center mb-4">
                <Network className="w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold">Services</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(statusData.services).map(([service, status]) => (
                  <div key={service} className="flex justify-between">
                    <span className={secondaryTextColor}>{formatServiceName(service)}:</span>
                    <div className="flex items-center">
                      {getStatusIcon(status)}
                      <span className={`ml-2 font-medium ${getStatusColor(status)}`}>
                        {formatStatusValue(status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Health Checks */}
            <div className={`${cardBgColor} p-6 rounded-lg border ${borderColor}`}>
              <div className="flex items-center mb-4">
                <CheckCircle className="w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold">Health Checks</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(statusData.healthChecks).map(([check, status]) => (
                  <div key={check} className="flex justify-between">
                    <span className={secondaryTextColor}>{formatHealthCheckName(check)}:</span>
                    <div className="flex items-center">
                      {status ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`ml-2 font-medium ${status ? 'text-green-500' : 'text-red-500'}`}>
                        {status ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* API Endpoints */}
            <div className={`${cardBgColor} p-6 rounded-lg border ${borderColor}`}>
              <div className="flex items-center mb-4">
                <Database className="w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold">API Endpoints</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between mb-3">
                  <span className={secondaryTextColor}>Total Available:</span>
                  <span className="font-medium text-green-500">{statusData.endpoints.total}</span>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {statusData.endpoints.available.map((endpoint, index) => (
                    <div key={index} className={`text-sm ${secondaryTextColor} py-1`}>
                      {endpoint}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusPage;