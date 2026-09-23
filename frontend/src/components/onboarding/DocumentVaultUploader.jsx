import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  File,
  Eye,
  Download,
  Loader2,
  Check,
  X,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  FileSpreadsheet,
  Image as ImageIcon,
  User,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { onboardingService } from '../../services/onboardingService.js';
import { documentService } from '../../services/documentService.js';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';

const CATEGORY_OPTIONS = [
  { value: 'IDENTITY', label: 'ID Proof (Aadhaar, PAN, Passport)' },
  { value: 'OFFER', label: 'Offer Letter & Job Contract' },
  { value: 'EDUCATION', label: 'Degree & Educational Certificates' },
  { value: 'EXPERIENCE', label: 'Past Experience & Relieving Letters' },
  { value: 'TAX', label: 'Tax Documents (Form 16, etc.)' },
  { value: 'MEDICAL', label: 'Medical & Fitness Certificates' },
  { value: 'OTHER', label: 'Other Documents' },
];

const QUICK_REJECTION_REASONS = [
  'Blurry or difficult to read',
  'Document has expired',
  'Name does not match profile',
  'Missing signature or official stamp',
  'Incomplete pages or cut-off corners',
];

const formatBytes = (bytes, decimals = 1) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const getFileTypeMeta = (filename = '', mimeType = '') => {
  const lowerName = filename.toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  if (lowerName.endsWith('.pdf') || lowerMime.includes('pdf')) {
    return {
      label: 'PDF',
      bgClass: 'bg-rose-50 text-rose-600 ring-1 ring-rose-100',
      badgeClass: 'bg-rose-100 text-rose-700',
      icon: FileText,
    };
  }
  if (
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.docx') ||
    lowerMime.includes('word') ||
    lowerMime.includes('officedocument')
  ) {
    return {
      label: 'DOC',
      bgClass: 'bg-blue-50 text-blue-600 ring-1 ring-blue-100',
      badgeClass: 'bg-blue-100 text-blue-700',
      icon: FileText,
    };
  }
  if (
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerMime.startsWith('image/')
  ) {
    return {
      label: 'IMG',
      bgClass: 'bg-purple-50 text-purple-600 ring-1 ring-purple-100',
      badgeClass: 'bg-purple-100 text-purple-700',
      icon: ImageIcon,
    };
  }
  if (
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.csv') ||
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('excel')
  ) {
    return {
      label: 'SHEET',
      bgClass: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      icon: FileSpreadsheet,
    };
  }
  return {
    label: 'FILE',
    bgClass: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    badgeClass: 'bg-slate-200 text-slate-700',
    icon: File,
  };
};

export const DocumentVaultUploader = ({
  candidateId,
  documents = [],
  canVerify = false,
  canUpload = false,
  canAcknowledge = false,
  onUpload,
  onVerify,
  onAcknowledge,
  titlePrefix = 'Documents',
  subtitle = 'Uploaded documents and files.',
  onDocumentsUpdated,
}) => {
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef(null);

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState('IDENTITY');
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('PASSPORT');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Rejection Modal State
  const [rejectingDoc, setRejectingDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [verifyingDocId, setVerifyingDocId] = useState(null);
  const [acknowledgingDocId, setAcknowledgingDocId] = useState(null);

  // Document View / Download State
  const [loadingActionDocId, setLoadingActionDocId] = useState(null);
  const [downloadingDocId, setDownloadingDocId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const handlePreview = async (doc) => {
    try {
      setLoadingActionDocId(doc.id);
      const { blob, contentType } = await documentService.getDocumentBlob(doc.id);
      const blobUrl = window.URL.createObjectURL(blob);
      setPreviewDoc({
        doc,
        blobUrl,
        contentType: contentType || doc.mimeType || 'application/octet-stream',
        isImage: (contentType || doc.mimeType || '').startsWith('image/'),
        isPdf: (contentType || doc.mimeType || '').includes('pdf'),
      });
    } catch (err) {
      showError(err.message || 'Failed to view document');
    } finally {
      setLoadingActionDocId(null);
    }
  };

  const closePreview = () => {
    if (previewDoc?.blobUrl) {
      window.URL.revokeObjectURL(previewDoc.blobUrl);
    }
    setPreviewDoc(null);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileSelected = (file) => {
    setSelectedFile(file);
    if (!title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', category);
      formData.append('title', title || selectedFile.name);
      formData.append('documentType', documentType);

      if (onUpload) {
        await onUpload(formData);
      } else if (candidateId) {
        await onboardingService.uploadDocument(candidateId, formData);
      } else {
        await documentService.uploadMyDocument(formData);
      }
      showSuccess(`Document '${title || selectedFile.name}' uploaded successfully.`);

      // Reset form
      setSelectedFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onDocumentsUpdated) {
        onDocumentsUpdated();
      }
    } catch (err) {
      showError(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async (docId, status, reason = '') => {
    try {
      setVerifyingDocId(docId);
      if (onVerify) {
        await onVerify(docId, status, reason);
      } else if (candidateId) {
        await onboardingService.verifyDocument(docId, {
          verificationStatus: status,
          rejectionReason: reason,
        });
      } else {
        await documentService.verifyDocument(docId, {
          verificationStatus: status,
          rejectionReason: reason,
        });
      }

      showSuccess(`Document status marked as ${status}.`);
      setRejectingDoc(null);
      setRejectionReason('');

      if (onDocumentsUpdated) {
        onDocumentsUpdated();
      }
    } catch (err) {
      showError(err.message || 'Failed to update document verification status.');
    } finally {
      setVerifyingDocId(null);
    }
  };

  const handleAcknowledge = async (docId) => {
    try {
      setAcknowledgingDocId(docId);
      if (onAcknowledge) {
        await onAcknowledge(docId);
      } else {
        await documentService.acknowledgeDocument(docId);
      }
      showSuccess('Document acknowledgement recorded.');
      if (onDocumentsUpdated) {
        onDocumentsUpdated();
      }
    } catch (err) {
      showError(err.message || 'Failed to acknowledge document.');
    } finally {
      setAcknowledgingDocId(null);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Verified
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Box (Only when upload is allowed) */}
      {canUpload && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center ring-1 ring-brand-100">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  Upload a Document
                </h3>
                <p className="text-xs text-slate-500">
                  Select an ID card, certificate, or contract to upload.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-lg">
              Max: 10MB
            </span>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-brand-500 bg-brand-50/60 ring-4 ring-brand-50'
                  : selectedFile
                  ? 'border-emerald-500 bg-emerald-50/30'
                  : 'border-slate-200 hover:border-brand-400 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                }}
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-200">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900 font-display">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatBytes(selectedFile.size)} • Ready for upload
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    icon={X}
                    className="text-slate-400 hover:text-slate-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3 ring-4 ring-brand-50/50">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-800 font-display">
                    Click to browse or drag & drop file here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Accepts PDF, PNG, JPG, WEBP, DOC, DOCX up to 10MB
                  </p>
                </div>
              )}
            </div>

            {/* Metadata Fields (Shown when file is selected) */}
            {selectedFile && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 animate-fade-in">
                <Input
                  label="Document Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Passport Copy"
                  required
                />
                <Select
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  options={CATEGORY_OPTIONS}
                />
                <div className="flex items-end">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full h-10 shadow-sm"
                    loading={uploading}
                    icon={Upload}
                  >
                    Confirm & Upload
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Document Vault Card Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              {titlePrefix} ({documents.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {subtitle}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
            {documents.length} {documents.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <File className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700 font-display">
              No documents found
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No documents have been uploaded matching your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => {
              const isVerifying = verifyingDocId === doc.id;
              const isAcknowledging = acknowledgingDocId === doc.id;
              const acks = doc.acknowledgementLog || doc.acknowledgement_log || [];
              const isAcknowledged = Array.isArray(acks) && acks.length > 0;
              const fileMeta = getFileTypeMeta(doc.title, doc.mimeType);
              const FileIcon = fileMeta.icon;

              return (
                <div
                  key={doc.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    {/* File type icon badge */}
                    <div
                      className={`w-11 h-11 rounded-xl ${fileMeta.bgClass} flex flex-col items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
                    >
                      <FileIcon className="w-5 h-5" />
                      <span className="text-[9px] font-black tracking-wider leading-none mt-0.5">
                        {fileMeta.label}
                      </span>
                    </div>

                    <div>
                      {/* Title & Status Badges */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors font-display">
                          {doc.title}
                        </h4>
                        {renderStatusBadge(doc.verificationStatus)}
                        {isAcknowledged && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Acknowledged
                          </span>
                        )}
                      </div>

                      {/* File Metadata Line */}
                      <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-1.5 flex-wrap">
                        <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {doc.category || 'GENERAL'}
                        </span>
                        <span>•</span>
                        <span>{formatBytes(doc.fileSize)}</span>
                        <span>•</span>
                        <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                        {doc.ownerName && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-800 bg-indigo-50/80 border border-indigo-100 px-2.5 py-0.5 rounded-md text-[11px]">
                              <span className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-800 text-[9px] flex items-center justify-center font-bold">
                                {doc.ownerName.charAt(0)}
                              </span>
                              {doc.ownerName} {doc.ownerCode ? `(${doc.ownerCode})` : ''} {doc.ownerDepartment ? `• ${doc.ownerDepartment}` : ''}
                            </span>
                          </>
                        )}
                        {isAcknowledged && acks[0]?.acknowledgedAt && (
                          <>
                            <span>•</span>
                            <span className="text-sky-700 font-medium">
                              Signed {new Date(acks[0].acknowledgedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Rejection Alert Box */}
                      {doc.verificationStatus === 'REJECTED' && doc.rejectionReason && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>
                            <strong className="font-semibold">Rejection Note:</strong> {doc.rejectionReason}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clean Modern Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center flex-wrap pt-2 lg:pt-0">
                    {/* View Button */}
                    <button
                      type="button"
                      disabled={loadingActionDocId === doc.id}
                      onClick={() => handlePreview(doc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {loadingActionDocId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      View
                    </button>

                    {/* Download Button */}
                    <button
                      type="button"
                      disabled={downloadingDocId === doc.id}
                      onClick={async () => {
                        try {
                          setDownloadingDocId(doc.id);
                          await documentService.downloadDocument(doc.id, doc.title || 'document');
                        } catch (err) {
                          showError(err.message || 'Failed to download document');
                        } finally {
                          setDownloadingDocId(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {downloadingDocId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      Download
                    </button>

                    {/* Employee Acknowledgement Button */}
                    {canAcknowledge && !isAcknowledged && (
                      <button
                        type="button"
                        disabled={isAcknowledging}
                        onClick={() => handleAcknowledge(doc.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isAcknowledging ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Acknowledge
                      </button>
                    )}

                    {/* HR Approve Button */}
                    {canVerify && doc.verificationStatus !== 'APPROVED' && (
                      <button
                        type="button"
                        disabled={isVerifying}
                        onClick={() => handleVerify(doc.id, 'APPROVED')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isVerifying ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Approve
                      </button>
                    )}

                    {/* HR Reject Button */}
                    {canVerify && doc.verificationStatus !== 'REJECTED' && (
                      <button
                        type="button"
                        disabled={isVerifying}
                        onClick={() => {
                          setRejectingDoc(doc);
                          setRejectionReason('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modern Rejection Modal with Quick Reasons */}
      {rejectingDoc && (
        <Modal
          isOpen={true}
          onClose={() => setRejectingDoc(null)}
          title="Reject Document"
          subtitle={`Provide verification feedback for '${rejectingDoc.title}'`}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>
                The candidate/employee will be notified of this rejection and asked to resubmit a compliant copy.
              </span>
            </div>

            {/* Quick Reason Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Quick Preset Reasons
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_REJECTION_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectionReason(preset)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Specific Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this document cannot be approved..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all"
                required
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setRejectingDoc(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!rejectionReason.trim()}
                onClick={() => handleVerify(rejectingDoc.id, 'REJECTED', rejectionReason)}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <Modal
          isOpen={true}
          onClose={closePreview}
          title={previewDoc.doc.title || 'Document Preview'}
          subtitle={`${previewDoc.doc.documentType || previewDoc.doc.category || 'Document'} • ${formatBytes(previewDoc.doc.fileSize)}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center p-3 bg-slate-100/60 rounded-2xl border border-slate-200 min-h-[340px] max-h-[70vh] overflow-auto">
              {previewDoc.isImage ? (
                <img
                  src={previewDoc.blobUrl}
                  alt={previewDoc.doc.title}
                  className="max-h-[66vh] max-w-full object-contain rounded-xl shadow-xs"
                />
              ) : previewDoc.isPdf ? (
                <iframe
                  src={previewDoc.blobUrl}
                  title={previewDoc.doc.title}
                  className="w-full h-[66vh] rounded-xl border-0 bg-white"
                />
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center shadow-xs">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 font-display">
                      {previewDoc.doc.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Inline browser rendering is not supported for this file format ({previewDoc.contentType}). Please download the file to inspect.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold">Status:</span>
                {renderStatusBadge(previewDoc.doc.verificationStatus)}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ExternalLink}
                  onClick={() => {
                    window.open(previewDoc.blobUrl, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Open in New Tab
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Download}
                  onClick={async () => {
                    try {
                      await documentService.downloadDocument(
                        previewDoc.doc.id,
                        previewDoc.doc.title || 'document'
                      );
                    } catch (err) {
                      showError(err.message || 'Failed to download document');
                    }
                  }}
                >
                  Download File
                </Button>
                <Button variant="ghost" size="sm" onClick={closePreview}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DocumentVaultUploader;
