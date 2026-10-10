import React, { useState } from 'react';
import { Upload, X, User, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Alert } from '../common/Alert';
import { employeeService } from '../../services/employeeService';

const UploadEmployeePhotoModal = ({ 
  isOpen, 
  onClose, 
  employee, 
  onUploadSuccess,
  currentUser 
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Only allow Admin users to upload
  const isAdmin = currentUser?.role === 'Admin' || 
                 currentUser?.roleName === 'Admin' || 
                 ['admin', 'superadmin', 'orgadmin'].includes(
                   (currentUser?.roleName || currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                 );

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or GIF)');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    setError('');
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !isAdmin) return;

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('avatar', selectedFile);

      const response = await employeeService.uploadAvatar(employee.id, formData);
      
      setSuccess('Profile picture uploaded successfully!');
      
      // Call success callback after a brief delay to show success message
      setTimeout(() => {
        onUploadSuccess && onUploadSuccess(response);
        handleClose();
      }, 1500);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError('');
    setSuccess('');
    onClose();
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError('');
  };

  if (!isAdmin) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Access Denied"
        maxWidth="max-w-md"
      >
        <div className="py-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="font-medium">Access Denied</span>
          </div>
          <p className="text-sm text-gray-600">
            Only Admin users can upload employee profile pictures.
          </p>
          <div className="flex justify-end mt-6">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Profile Picture"
      subtitle={`Upload a profile picture for ${employee?.firstName} ${employee?.lastName}`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error" message={error} />
        )}

        {success && (
          <Alert variant="success" message={success} />
        )}

        {/* Current Photo Display */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {employee?.avatarUrl || employee?.avatar_url ? (
              <img 
                src={employee.avatarUrl || employee.avatar_url} 
                alt={`${employee.firstName} ${employee.lastName}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">{employee?.firstName} {employee?.lastName}</p>
            <p className="text-xs text-gray-500">
              {employee?.avatarUrl || employee?.avatar_url ? 'Has profile picture' : 'No profile picture'}
            </p>
          </div>
        </div>

        {/* File Upload Area */}
        <div className="space-y-3">
          <label htmlFor="avatar-upload" className="block text-sm font-medium text-gray-700">
            Select New Profile Picture
          </label>
          
          {!selectedFile ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center relative">
              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
              </div>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preview */}
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeSelectedFile}
                  disabled={isUploading}
                  icon={X}
                >
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 mt-6 border-t border-gray-200">
        <Button variant="outline" onClick={handleClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button 
          onClick={handleUpload} 
          disabled={!selectedFile || isUploading}
          isLoading={isUploading}
          className="min-w-[100px]"
        >
          Upload
        </Button>
      </div>
    </Modal>
  );
};

export default UploadEmployeePhotoModal;