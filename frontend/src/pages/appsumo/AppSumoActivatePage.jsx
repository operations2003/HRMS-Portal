import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LogIn,
  UserPlus,
  RefreshCw,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { appsumoService } from '../../services/appsumoService.js';
import { TaskNeraLogo } from '../../components/common/TaskNeraLogo.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { PasswordInput } from '../../components/common/PasswordInput.jsx';
import { Alert } from '../../components/common/Alert.jsx';
import { Badge } from '../../components/common/Badge.jsx';

export const AppSumoActivatePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, login } = useAuth();
  const toast = useToast();

  const code = searchParams.get('code');

  // States: 'connecting' | 'login_required' | 'signup_required' | 'activating' | 'success' | 'already_activated' | 'invalid_license' | 'expired_authorization' | 'error'
  const [state, setState] = useState('connecting');
  const [licenseData, setLicenseData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Auth mode toggle for guest users: 'login' | 'signup'
  const [authMode, setAuthMode] = useState('login');

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // 1. Initial OAuth Code Exchange
  useEffect(() => {
    if (!code) {
      setState('invalid_license');
      setErrorMessage('No authorization code provided in the URL. Please launch activation from your AppSumo dashboard.');
      return;
    }

    const exchangeCode = async () => {
      try {
        setState('connecting');
        const redirectUri = window.location.origin + window.location.pathname;
        const res = await appsumoService.exchangeOAuthCode(code, redirectUri);
        setLicenseData(res);

        if (res.isLinked && res.organizationId) {
          setState('already_activated');
        } else if (isAuthenticated) {
          // If already logged in, prompt direct link
          handleDirectActivation(res.licenseKey);
        } else {
          setState('login_required');
        }
      } catch (err) {
        console.error('AppSumo code exchange failed:', err);
        if (err.status === 400 || err.oauthError === 'invalid_grant') {
          setState('expired_authorization');
          setErrorMessage('The AppSumo authorization code has expired or has already been used. Please return to your AppSumo portal and click "Activate now" again.');
        } else {
          setState('error');
          setErrorMessage(err.message || 'Unable to connect to AppSumo. Please verify your credentials and try again.');
        }
      }
    };

    exchangeCode();
  }, [code, isAuthenticated]);

  // 2. Direct Activation for currently authenticated users
  const handleDirectActivation = async (licenseKey) => {
    try {
      setState('activating');
      const res = await appsumoService.activateLicense({
        licenseKey: licenseKey || licenseData?.licenseKey,
        mode: 'authenticated',
      });
      setLicenseData((prev) => ({
        ...prev,
        ...res.license,
        organizationName: user?.organization?.name || 'Your Organization',
      }));
      setState('success');
      toast.success('AppSumo license activated successfully!');
    } catch (err) {
      console.error('Direct activation error:', err);
      setState('error');
      setErrorMessage(err.message || 'Failed to link license to your organization.');
    }
  };

  // 3. Existing User Login & Link
  const handleLoginAndLink = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setFormError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      setState('activating');
      const res = await appsumoService.activateLicense({
        licenseKey: licenseData.licenseKey,
        mode: 'login',
        email: loginEmail.trim(),
        password: loginPassword,
      });

      // Update local auth context
      if (res.authSession) {
        await login(loginEmail.trim(), loginPassword);
      }

      setLicenseData((prev) => ({
        ...prev,
        ...res.license,
        organizationName: res.authSession?.user?.organization?.name || 'Your Organization',
      }));
      setState('success');
      toast.success('AppSumo license activated and linked to your account!');
    } catch (err) {
      setIsSubmitting(false);
      setState('login_required');
      setFormError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  // 4. New Customer Signup & Link
  const handleSignupAndLink = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!companyName.trim() || !signupEmail.trim() || !signupPassword) {
      setFormError('Please fill in company name, email, and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      setState('activating');
      const res = await appsumoService.activateLicense({
        licenseKey: licenseData.licenseKey,
        mode: 'signup',
        companyName: companyName.trim(),
        firstName: firstName.trim() || 'Admin',
        lastName: lastName.trim() || 'User',
        signupEmail: signupEmail.trim(),
        signupPassword,
      });

      // Update local auth session
      if (res.authSession) {
        await login(signupEmail.trim(), signupPassword);
      }

      setLicenseData((prev) => ({
        ...prev,
        ...res.license,
        organizationName: companyName.trim(),
      }));
      setState('success');
      toast.success('Your company account and AppSumo license have been set up!');
    } catch (err) {
      setIsSubmitting(false);
      setState('signup_required');
      setFormError(err.message || 'Registration failed. Please review your inputs.');
    }
  };

  const tierLimits = licenseData?.tierConfig || {
    tier: licenseData?.tier || 1,
    name: `AppSumo Tier ${licenseData?.tier || 1}`,
    maxEmployees: licenseData?.tier === 3 ? 250 : licenseData?.tier === 2 ? 50 : 15,
    maxDepartments: licenseData?.tier === 3 ? 'Unlimited' : licenseData?.tier === 2 ? 15 : 5,
  };

  return (
    <div className="min-h-screen tasknera-gradient flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-slate-400/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Header Logo */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <TaskNeraLogo variant="full" size="md" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>AppSumo Partner Licensing Integration</span>
          </div>
        </div>

        {/* Main Activation Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-9 shadow-2xl border border-slate-200/80 shadow-slate-200/60">
          {/* ========================================================================= */}
          {/* STATE 1: CONNECTING */}
          {/* ========================================================================= */}
          {state === 'connecting' && (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-inner animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Connecting your AppSumo license...
              </h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Securely verifying your single-use authorization code with AppSumo and resolving your plan tier.
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 4: ACTIVATING IN PROGRESS */}
          {/* ========================================================================= */}
          {state === 'activating' && (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
                <Layers className="w-8 h-8 animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Activating your TaskNera entitlement...
              </h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Configuring organization quotas, allocating employee seats, and applying AppSumo lifetime benefits.
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 5: SUCCESS */}
          {/* ========================================================================= */}
          {state === 'success' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner mb-4">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Your AppSumo license has been activated successfully.
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Lifetime access and plan limits are now applied to your TaskNera organization.
                </p>
              </div>

              {/* Plan Limits Card */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Active Plan</span>
                    <h3 className="text-base font-bold text-slate-900">{tierLimits.name}</h3>
                  </div>
                  <Badge variant="brand" size="md">
                    Tier {licenseData?.tier || 1}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 block">Organization</span>
                    <span className="font-semibold text-slate-900 text-sm truncate block mt-0.5">
                      {licenseData?.organizationName || 'Connected Org'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 block">Max Employee Seats</span>
                    <span className="font-semibold text-slate-900 text-sm block mt-0.5">
                      {tierLimits.maxEmployees} Employees
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 block">Departments</span>
                    <span className="font-semibold text-slate-900 text-sm block mt-0.5">
                      {tierLimits.maxDepartments} Allowed
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 block">Entitlement Source</span>
                    <span className="font-semibold text-emerald-700 text-sm block mt-0.5">
                      Lifetime License
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                icon={ArrowRight}
                onClick={() => navigate('/dashboard')}
                className="w-full justify-center shadow-lg shadow-brand-500/25"
              >
                Go to TaskNera
              </Button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 6: ALREADY ACTIVATED */}
          {/* ========================================================================= */}
          {state === 'already_activated' && (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">License Already Activated</h2>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  This AppSumo license is already actively linked to organization{' '}
                  <span className="font-bold text-slate-800">
                    {licenseData?.organizationName || licenseData?.organizationId}
                  </span>.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tier:</span>
                  <span className="font-semibold text-slate-800">Tier {licenseData?.tier || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-semibold text-emerald-700 capitalize">{licenseData?.status}</span>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                icon={ArrowRight}
                onClick={() => navigate('/dashboard')}
                className="w-full justify-center"
              >
                Go to TaskNera Dashboard
              </Button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 2 & 3: LOGIN OR SIGNUP REQUIRED */}
          {/* ========================================================================= */}
          {(state === 'login_required' || state === 'signup_required') && (
            <div className="space-y-6">
              {/* Plan Banner */}
              <div className="bg-brand-50 border border-brand-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block">
                    Verified Purchase
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{tierLimits.name}</h3>
                </div>
                <Badge variant="brand" size="md">
                  {tierLimits.maxEmployees} Seats
                </Badge>
              </div>

              {/* Mode Selector Tabs */}
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setState('login_required');
                    setFormError(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                    authMode === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>I have a TaskNera account</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setState('signup_required');
                    setFormError(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                    authMode === 'signup'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create new company</span>
                </button>
              </div>

              {formError && <Alert variant="danger">{formError}</Alert>}

              {/* Tab A: Log In to Existing Org */}
              {authMode === 'login' && (
                <form onSubmit={handleLoginAndLink} className="space-y-4">
                  <div className="text-xs text-slate-500 mb-2">
                    Log in with your existing Administrator credentials to link this license to your current organization.
                  </div>
                  <Input
                    label="Email Address"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@company.com"
                  />
                  <PasswordInput
                    label="Password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSubmitting}
                    icon={ArrowRight}
                    className="w-full justify-center"
                  >
                    Link License & Log In
                  </Button>
                </form>
              )}

              {/* Tab B: Create New Company */}
              {authMode === 'signup' && (
                <form onSubmit={handleSignupAndLink} className="space-y-4">
                  <div className="text-xs text-slate-500 mb-2">
                    Enter your organization details to create your new TaskNera portal and link your AppSumo license.
                  </div>
                  <Input
                    label="Company Name"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Global Inc."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                    />
                    <Input
                      label="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                  <Input
                    label="Admin Email"
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="jane@acme.com"
                  />
                  <PasswordInput
                    label="Admin Password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a strong password"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSubmitting}
                    icon={ArrowRight}
                    className="w-full justify-center"
                  >
                    Create Organization & Activate
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 7, 8, 9: ERROR STATES */}
          {/* ========================================================================= */}
          {(state === 'error' || state === 'invalid_license' || state === 'expired_authorization') && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {state === 'expired_authorization'
                  ? 'Authorization Expired'
                  : state === 'invalid_license'
                  ? 'Invalid License Request'
                  : 'Activation Failed'}
              </h2>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                {errorMessage || 'An error occurred during activation. Please try again.'}
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  icon={RefreshCw}
                >
                  Retry Activation
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => window.open('https://appsumo.com/products/', '_blank')}
                  icon={ExternalLink}
                >
                  Return to AppSumo
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Security Assurance Footer */}
        <div className="text-center mt-6 text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>TaskNera Secure 256-Bit TLS & HMAC-Protected Licensing Engine</span>
        </div>
      </div>
    </div>
  );
};

export default AppSumoActivatePage;
