import { useAuth } from '../contexts/AuthContext';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

export function Login() {
  const { loading, handleGoogleSuccess, handleGoogleError } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <div className="mt-8 space-y-6">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap
          />
        </div>
      </div>
    </div>
  );
} 