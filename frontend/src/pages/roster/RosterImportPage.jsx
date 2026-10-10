import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Info, Download, Sparkles, Bot } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { Alert } from '../../components/common/Alert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { rosterService } from '../../services/rosterService';
import { useToast } from '../../context/ToastContext';
import { Can } from '../../components/rbac/Can';

export const RosterImportPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [useAiAutomation, setUseAiAutomation] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setUploadError('Invalid file type. Please select an Excel (.xlsx, .xls) or CSV file.');
      setSelectedFile(null);
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit. Please select a smaller file.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadError(null);

    // Auto-detect month and year from filename if present
    const nameLower = file.name.toLowerCase();
    const yearMatch = nameLower.match(/\b(202[0-9]|203[0-5])\b/);
    if (yearMatch) {
      setSelectedYear(parseInt(yearMatch[1], 10));
    }
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    for (let m = 0; m < monthNames.length; m++) {
      if (nameLower.includes(monthNames[m])) {
        setSelectedMonth(m + 1);
        break;
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a roster file to upload.');
      return;
    }

    if (!selectedMonth || !selectedYear) {
      setUploadError('Please select the month and year for this roster.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('roster', selectedFile);
      formData.append('month', selectedMonth);
      formData.append('year', selectedYear);
      formData.append('aiMode', useAiAutomation);

      const response = await rosterService.uploadRoster(formData);

      if (response.success) {
        toast.success('Roster uploaded and parsed successfully!');
        
        // Navigate to preview page
        navigate(`/roster/preview/${response.data.jobId}`, {
          state: { previewData: response.data }
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to upload roster file.';
      const errors = err.response?.data?.errors || [];
      
      if (errors.length > 0) {
        setUploadError(
          <div>
            <div className="font-semibold mb-2">{errorMsg}</div>
            <ul className="list-disc list-inside text-sm space-y-1">
              {errors.slice(0, 5).map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
              {errors.length > 5 && <li>...and {errors.length - 5} more errors</li>}
            </ul>
          </div>
        );
      } else {
        setUploadError(errorMsg);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewHistory = () => {
    navigate('/roster/history');
  };

  return (
    <Can permission="employee:write">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-7 h-7 text-brand-600" />
              Monthly Roster Import
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Upload and synchronize monthly shift schedules from Excel or CSV files
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleViewHistory}
            icon={FileSpreadsheet}
          >
            Import History
          </Button>
        </div>

        {/* Instructions Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <h3 className="font-semibold mb-2">Roster File Format Requirements:</h3>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong>Column A:</strong> Employee Name</li>
                <li><strong>Column B:</strong> Designation</li>
                <li><strong>Columns C onwards:</strong> Day numbers (1, 2, 3, ..., 31)</li>
                <li><strong>Last column:</strong> Working Days (total count)</li>
                <li><strong>Shift formats:</strong> "11 - 8 PM", "2-8PM", "12 - 6 PM", etc.</li>
                <li><strong>Special codes:</strong> WO (Weekly Off), CL (Casual Leave), HD (Holiday), NA (Not Assigned)</li>
                <li><strong>Blank cells:</strong> Unspecified (will not be changed)</li>
              </ul>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={Download}
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  onClick={() => {
                    // Download sample template
                    window.open('/docs/roster-template-sample.xlsx', '_blank');
                  }}
                >
                  Download Sample Template
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-brand-600" />
              Upload Roster File
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Month and Year Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Roster Month <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  options={months}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Roster Year <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  options={years.map((y) => ({ value: y, label: String(y) }))}
                  required
                />
              </div>
            </div>

            {/* AI Automation Mode Card */}
            <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-blue-50/80 border border-indigo-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">AI Roster Automation Engine</h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                      OpenAI Integrated
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Intelligently adapts to any spreadsheet layout (horizontal/vertical), understands custom shift abbreviations (e.g. Morning, WFH, Split, M1), and auto-matches staff.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={useAiAutomation}
                  onChange={(e) => setUseAiAutomation(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Roster File <span className="text-red-500">*</span>
              </label>
              
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  selectedFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50'
                }`}
              >
                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <CheckCircle2 className="w-12 h-12 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{selectedFile.name}</p>
                      <p className="text-sm text-slate-500">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      Choose Different File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <FileSpreadsheet className="w-12 h-12 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Excel (.xlsx, .xls) or CSV files up to 10MB
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Select File
                    </Button>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Error Display */}
            {uploadError && (
              <Alert variant="error">
                {uploadError}
              </Alert>
            )}

            {/* Upload Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                isLoading={isUploading}
                icon={Upload}
              >
                {isUploading ? 'Uploading & Parsing...' : 'Upload & Preview'}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Step 1</h3>
            <p className="text-xs text-slate-600">
              Select month, year, and upload roster file
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Step 2</h3>
            <p className="text-xs text-slate-600">
              Review preview, resolve any employee matching issues
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Step 3</h3>
            <p className="text-xs text-slate-600">
              Confirm import to sync shifts to database
            </p>
          </div>
        </div>
      </div>
    </Can>
  );
};
