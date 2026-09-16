import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-3xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Page Not Found (404)</h1>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        The requested resource or page does not exist or has been relocated.
      </p>
      <Button variant="primary" icon={ArrowLeft} onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </Button>
    </div>
  );
};
