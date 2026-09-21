import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { config } from '../config/index.js';

// Configure Cloudinary SDK with provided credentials or URL
cloudinary.config({
  cloud_name: config.cloudinary?.cloudName || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: config.cloudinary?.apiKey || process.env.CLOUDINARY_API_KEY,
  api_secret: config.cloudinary?.apiSecret || process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const cloudinaryService = {
  /**
   * Upload file buffer or local path to Cloudinary
   * @param {Buffer|string} fileSource - Buffer of the file or absolute local file path
   * @param {Object} options
   * @param {string} options.folder - Destination folder in Cloudinary
   * @param {string} options.filename - Desired public filename prefix
   * @param {string} options.mimeType - MIME type of the file
   * @returns {Promise<{secureUrl: string, publicId: string, bytes: number, format: string, resourceType: string}>}
   */
  async upload(fileSource, options = {}) {
    const folder = options.folder || 'hrms-portal/documents';
    const isPdf = (options.mimeType || '').includes('pdf') || (options.filename || '').toLowerCase().endsWith('.pdf');

    // Cloudinary supports 'auto', 'image', 'raw'
    // For PDFs and binary office docs, 'auto' or 'raw' works reliably
    const resourceType = options.resourceType || (isPdf ? 'raw' : 'auto');

    const uploadOptions = {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    };

    if (options.filename) {
      // Sanitize filename for public_id
      const cleanName = options.filename
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 60);
      uploadOptions.public_id = `${cleanName}_${Date.now()}`;
    }

    if (Buffer.isBuffer(fileSource)) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              return reject(new Error(`Cloudinary Upload Failed: ${error.message}`));
            }
            resolve({
              secureUrl: result.secure_url,
              publicId: result.public_id,
              bytes: result.bytes,
              format: result.format || (isPdf ? 'pdf' : ''),
              resourceType: result.resource_type,
            });
          }
        );

        const readableStream = new Readable();
        readableStream.push(fileSource);
        readableStream.push(null);
        readableStream.pipe(uploadStream);
      });
    }

    // Local file path
    const result = await cloudinary.uploader.upload(fileSource, uploadOptions);
    return {
      secureUrl: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
      format: result.format || (isPdf ? 'pdf' : ''),
      resourceType: result.resource_type,
    };
  },

  /**
   * Delete an asset from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @param {string} resourceType - 'raw' | 'image' | 'video'
   */
  async delete(publicId, resourceType = 'raw') {
    if (!publicId) return null;
    try {
      return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
      console.warn('Cloudinary delete warning:', err.message);
      return null;
    }
  },

  /**
   * Fetch file stream / buffer from Cloudinary URL for authorized proxy streaming
   * @param {string} secureUrl
   */
  async fetchBuffer(secureUrl) {
    const res = await fetch(secureUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch file from Cloudinary (status ${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },
};

export default cloudinaryService;
