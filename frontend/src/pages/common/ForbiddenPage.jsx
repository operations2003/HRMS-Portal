import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';

export const ForbiddenPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Access Restricted (403)</h1>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        Your assigned role does not grant permission to view or manipulate this resource. Contact your organization administrator for elevated access.
      </p>
      <Button variant="primary" icon={ArrowLeft} onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </Button>
    </div>
  );
};
