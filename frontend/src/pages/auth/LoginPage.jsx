import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Building2, Mail, Lock, Shield, Check } from 'lucide-react';
import { Input } from '../../components/common/Input.jsx';
import { PasswordInput } from '../../components/common/PasswordInput.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Alert } from '../../components/common/Alert.jsx';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const demoAccounts = [
    { role: 'SuperAdmin', email: 'admin@hrms.local', pass: 'Admin@123', desc: 'Full System Access' },
    { role: 'OrgAdmin', email: 'orgadmin@techcorp.local', pass: 'OrgAdmin@123', desc: 'Org Level Admin' },
    { role: 'HRManager', email: 'hr@techcorp.local', pass: 'Hr@123', desc: 'Employee & Dept Management' },
    { role: 'Employee', email: 'emp@techcorp.local', pass: 'Emp@123', desc: 'Read-only Directory Access' },
  ];

  const validate = () => {
    const errs = {};
    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
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

  const handleSelectDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setErrors({});
    setApiError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 mb-4 ring-4 ring-indigo-500/20">
            <Building2 className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">HRMS Portal</h2>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise Organization & Employee Management
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100/10">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Sign in to your account</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your corporate credentials or select a test role below.
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Work Email"
              id="email"
              name="email"
              type="email"
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
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          {/* Demo Accounts Quick-Select */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Quick Test Credentials (RBAC)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleSelectDemo(acc)}
                  className={`p-2 rounded-xl text-left border text-xs transition-all ${
                    email === acc.email
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold ring-1 ring-indigo-600'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{acc.role}</span>
                    {email === acc.email && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{acc.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Phase 1 Architecture • Ready for PostgreSQL/Supabase DB Integration
        </p>
      </div>
    </div>
  );
};
