import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sendError } from '../utils/apiResponse.js';

// Safe upload directory initialization (resilient against read-only filesystems in serverless/Vercel)
const uploadDir = path.join(process.cwd(), 'uploads', 'onboarding_documents');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch {
  // Read-only filesystem in cloud serverless environment
}

// Storage engine configuration: use memoryStorage to ensure seamless uploads
// across serverless environments (Vercel, AWS Lambda) and local node instances
const storage = multer.memoryStorage();
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/jfif',
  'image/svg+xml',
  'image/x-png',
  'image/pjpeg',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.jfif',
  '.svg',
  '.heic',
  '.heif',
  '.doc',
  '.docx',
]);

// File filter function
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isMimeAllowed = ALLOWED_MIME_TYPES.has(mime) || mime.startsWith('image/');
  const isExtAllowed = ALLOWED_EXTENSIONS.has(ext);

  if (isMimeAllowed || isExtAllowed) {
    cb(null, true);
  } else {
    const err = new Error(
      `Unsupported file type '${file.originalname}'. Allowed formats: JPG, PNG, WEBP, GIF, BMP, SVG, PDF, DOC, DOCX.`
    );
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
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
          return sendError(res, 'File size exceeds maximum allowed limit of 25MB.', 400, [
            'Maximum allowed file size is 25MB.',
          ]);
        }
        return sendError(res, `File upload error: ${err.message}`, 400, [err.code]);
      } else if (err) {
        return sendError(res, err.message || 'File upload failed.', 400, [err.code || 'UPLOAD_ERROR']);
      }

      if (!req.file) {
        return sendError(res, 'No file uploaded. Please attach a valid image or document file.', 400, [
          `Form field '${fieldName}' must contain a file.`,
        ]);
      }

      // Generate sanitized filename and unique suffix if not set by storage
      if (!req.file.filename) {
        const ext = (path.extname(req.file.originalname || '') || '.jpg').toLowerCase();
        const sanitizedBase = path
          .basename(req.file.originalname || 'upload', ext)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 40);
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        req.file.filename = `${sanitizedBase}_${uniqueSuffix}${ext}`;
      }

      next();
    });
  };
};

export default uploadSingleDocument;
