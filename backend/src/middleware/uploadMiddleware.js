import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sendError } from '../utils/apiResponse.js';

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'onboarding_documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.doc', '.docx']);

// Storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    cb(null, `${sanitizedBase}_${uniqueSuffix}${ext}`);
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (ALLOWED_MIME_TYPES.has(mime) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    const err = new Error(
      `Unsupported file type '${file.originalname}'. Allowed formats: PDF, JPEG, PNG, WEBP, DOC, DOCX.`
    );
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * Middleware wrapper for single document upload with robust error interception
 */
export const uploadSingleDocument = (fieldName = 'file') => {
  const singleHandler = upload.single(fieldName);

  return (req, res, next) => {
    singleHandler(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 'File size exceeds maximum allowed limit of 10MB.', 400, [
            'Maximum allowed file size is 10MB.',
          ]);
        }
        return sendError(res, `File upload error: ${err.message}`, 400, [err.code]);
      } else if (err) {
        return sendError(res, err.message || 'File upload failed.', 400, [err.code || 'UPLOAD_ERROR']);
      }

      if (!req.file) {
        return sendError(res, 'No file uploaded. Please attach a valid document file.', 400, [
          `Form field '${fieldName}' must contain a file.`,
        ]);
      }

      next();
    });
  };
};

export default uploadSingleDocument;
