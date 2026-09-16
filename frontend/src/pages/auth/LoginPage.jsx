import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Mail, Sparkles } from 'lucide-react';
import { Input } from '../../components/common/Input.jsx';
import { PasswordInput } from '../../components/common/PasswordInput.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { TaskNeraLogo } from '../../components/common/TaskNeraLogo.jsx';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const errs = {};
    const normalized = email.trim().toLowerCase();
    const isSpecialAdmin = normalized === 'shubhamtasknera.com' || normalized === 'shubham@tasknera.com';

    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!isSpecialAdmin && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      await login(email, password);
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setApiError({
        message: err.message || 'Login failed. Please verify your credentials.',
        errors: err.errors || [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen tasknera-gradient flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Dynamic ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-slate-400/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header with Official Logo Lockup */}
        <div className="text-center mb-7">
          <div className="flex justify-center mb-4">
            <TaskNeraLogo variant="full" size="md" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200/70 text-brand-700 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enterprise HR & Workforce Management</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-7 sm:p-9 shadow-2xl border border-slate-200/80 shadow-slate-200/60">
          <div className="mb-6 text-center sm:text-left">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign in to your portal</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your corporate credentials or choose a test role
            </p>
          </div>

          {apiError && (
            <Alert
              type="error"
              title="Authentication Failed"
              message={apiError.message}
              errors={apiError.errors}
              onClose={() => setApiError(null)}
              className="mb-6"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Work Email"
              id="email"
              name="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              icon={Mail}
              error={errors.email}
              required
            />

            <PasswordInput
              label="Password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              error={errors.password}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-3 shadow-lg shadow-brand-500/30"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 shadow-sm">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-600 font-medium">
              Enterprise HRMS v1.0 • PostgreSQL Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
