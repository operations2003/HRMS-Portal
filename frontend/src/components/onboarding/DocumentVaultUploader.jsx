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
  { value: 'IDENTITY', label: 'Identity (Passport, PAN, Aadhaar, National ID)' },
  { value: 'OFFER', label: 'Offer & Employment Contracts' },
  { value: 'EDUCATION', label: 'Educational Certificates & Degrees' },
  { value: 'EXPERIENCE', label: 'Previous Experience & Relieving Letters' },
  { value: 'TAX', label: 'Tax Forms & Declarations' },
  { value: 'MEDICAL', label: 'Medical & Fitness Certificates' },
  { value: 'OTHER', label: 'Other Onboarding Documents' },
];

const formatBytes = (bytes, decimals = 1) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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
  titlePrefix = 'Document Vault',
  subtitle = 'Securely stored verification documents and contract terms.',
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
      // Auto-populate title without extension
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            Verification Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Box (Only for HR / Admin / Candidate upload) */}
      {canUpload && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-600" />
                Upload Onboarding Document to Vault
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Drag and drop government IDs, signed contracts, or educational records.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20'
                  : selectedFile
                  ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : 'border-slate-300 dark:border-slate-700 hover:border-brand-400 bg-slate-50/50 dark:bg-slate-800/30'
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
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    icon={X}
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
                <div>
                  <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Click to browse or drag & drop file here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports PDF, PNG, JPG, WEBP, DOC, DOCX up to 10MB
                  </p>
                </div>
              )}
            </div>

            {/* Metadata Fields (Visible once file selected) */}
            {selectedFile && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
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
                    className="w-full"
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

      {/* Document Vault Table / Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" />
              {titlePrefix} ({documents.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center">
            <File className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No documents found in vault.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Upload documents using the form above to securely store and verify them.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map((doc) => {
              const isVerifying = verifyingDocId === doc.id;
              const isAcknowledging = acknowledgingDocId === doc.id;
              const acks = doc.acknowledgementLog || doc.acknowledgement_log || [];
              const isAcknowledged = Array.isArray(acks) && acks.length > 0;

              return (
                <div
                  key={doc.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {doc.title}
                        </h4>
                        {getStatusBadge(doc.verificationStatus)}
                        {isAcknowledged && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Acknowledged
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                        <span>{formatBytes(doc.fileSize)}</span>
                        <span>•</span>
                        <span>{doc.mimeType || 'Document'}</span>
                        <span>•</span>
                        <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                        {doc.ownerName && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              👤 {doc.ownerName} {doc.ownerCode ? `(${doc.ownerCode})` : ''} {doc.ownerDepartment ? `• ${doc.ownerDepartment}` : ''}
                            </span>
                          </>
                        )}
                        {isAcknowledged && acks[0]?.acknowledgedAt && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 dark:text-blue-400">
                              Acknowledged {new Date(acks[0].acknowledgedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Rejection alert if rejected */}
                      {doc.verificationStatus === 'REJECTED' && doc.rejectionReason && (
                        <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>Rejection Reason: {doc.rejectionReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                    {/* View */}
                    <button
                      type="button"
                      disabled={loadingActionDocId === doc.id}
                      onClick={() => handlePreview(doc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loadingActionDocId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      View
                    </button>

                    {/* Download */}
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {downloadingDocId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Download
                    </button>

                    {/* Acknowledgement Action */}
                    {canAcknowledge && !isAcknowledged && (
                      <Button
                        variant="secondary"
                        size="xs"
                        icon={CheckCircle2}
                        loading={isAcknowledging}
                        onClick={() => handleAcknowledge(doc.id)}
                      >
                        Acknowledge
                      </Button>
                    )}

                    {/* HR Verification Controls */}
                    {canVerify && doc.verificationStatus !== 'APPROVED' && (
                      <Button
                        variant="success"
                        size="xs"
                        icon={Check}
                        loading={isVerifying}
                        onClick={() => handleVerify(doc.id, 'APPROVED')}
                      >
                        Approve
                      </Button>
                    )}

                    {canVerify && doc.verificationStatus !== 'REJECTED' && (
                      <Button
                        variant="danger"
                        size="xs"
                        icon={X}
                        loading={isVerifying}
                        onClick={() => {
                          setRejectingDoc(doc);
                          setRejectionReason('');
                        }}
                      >
                        Reject
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Document Rejection Modal */}
      {rejectingDoc && (
        <Modal
          isOpen={true}
          onClose={() => setRejectingDoc(null)}
          title="Reject Document"
          subtitle={`Provide reason for rejecting '${rejectingDoc.title}'`}
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                The candidate will be notified of this rejection and prompted to upload a corrected
                copy.
              </span>
            </div>

            <Input
              label="Rejection Reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Blurry scan, expired document, or missing signature"
              required
            />

            <div className="flex justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={() => setRejectingDoc(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
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
            <div className="flex items-center justify-center p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 min-h-[300px] max-h-[68vh] overflow-auto">
              {previewDoc.isImage ? (
                <img
                  src={previewDoc.blobUrl}
                  alt={previewDoc.doc.title}
                  className="max-h-[64vh] max-w-full object-contain rounded-lg shadow-xs"
                />
              ) : previewDoc.isPdf ? (
                <iframe
                  src={previewDoc.blobUrl}
                  title={previewDoc.doc.title}
                  className="w-full h-[64vh] rounded-lg border-0"
                />
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <FileText className="w-16 h-16 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      {previewDoc.doc.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Inline preview not supported for this file type ({previewDoc.contentType}).
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Status:</span>
                <Badge
                  variant={
                    previewDoc.doc.verificationStatus === 'APPROVED'
                      ? 'success'
                      : previewDoc.doc.verificationStatus === 'REJECTED'
                      ? 'danger'
                      : 'warning'
                  }
                  size="sm"
                >
                  {previewDoc.doc.verificationStatus || 'PENDING'}
                </Badge>
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
                  Open in Tab
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
                  Download
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
