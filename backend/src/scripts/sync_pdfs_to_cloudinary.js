import { query } from '../config/db.js';
import { cloudinaryService } from '../services/cloudinaryService.js';
import fs from 'fs';
import path from 'path';

export const syncPdfsToCloudinary = async () => {
  console.log('--- Starting Cloudinary PDF Migration ---');

  // Find all PDFs in document_vault
  const res = await query(`
    SELECT id, title, mime_type, file_url, file_size, file_data, encryption_metadata
    FROM document_vault
    WHERE mime_type = 'application/pdf' OR title ILIKE '%.pdf' OR file_url ILIKE '%.pdf'
  `);

  console.log(`Found ${res.rows.length} PDF documents in vault.`);

  let migratedCount = 0;
  let alreadyMigrated = 0;
  let failedCount = 0;

  for (const doc of res.rows) {
    if (doc.file_url && doc.file_url.startsWith('https://res.cloudinary.com')) {
      console.log(`[SKIP] '${doc.title}' (${doc.id}) is already hosted on Cloudinary.`);
      alreadyMigrated++;
      continue;
    }

    let buf = doc.file_data;

    // Check if buffer is valid
    if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
      if (doc.file_url) {
        const rel = doc.file_url.startsWith('/') ? doc.file_url.slice(1) : doc.file_url;
        const abs = path.resolve(process.cwd(), rel);
        if (fs.existsSync(abs)) {
          buf = fs.readFileSync(abs);
        }
      }
    }

    if (!buf || buf.length === 0) {
      console.warn(`[WARN] No binary data found for '${doc.title}' (${doc.id}). Skipping.`);
      failedCount++;
      continue;
    }

    try {
      console.log(`Uploading '${doc.title}' (${buf.length} bytes) to Cloudinary...`);
      const uploadRes = await cloudinaryService.upload(buf, {
        filename: doc.title || `doc_${doc.id}.pdf`,
        mimeType: 'application/pdf',
      });

      const existingMeta = typeof doc.encryption_metadata === 'string'
        ? JSON.parse(doc.encryption_metadata || '{}')
        : (doc.encryption_metadata || {});

      const updatedMeta = {
        ...existingMeta,
        storageProvider: 'CLOUDINARY',
        cloudinaryPublicId: uploadRes.publicId,
        cloudinaryResourceType: uploadRes.resourceType,
        cloudinaryBytes: uploadRes.bytes,
        migratedAt: new Date().toISOString(),
      };

      await query(
        `UPDATE document_vault 
         SET file_url = $1, encryption_metadata = $2 
         WHERE id = $3`,
        [uploadRes.secureUrl, JSON.stringify(updatedMeta), doc.id]
      );

      console.log(`[SUCCESS] Migrated '${doc.title}' -> ${uploadRes.secureUrl}`);
      migratedCount++;
    } catch (err) {
      console.error(`[ERROR] Failed to migrate '${doc.title}':`, err.message);
      failedCount++;
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total PDFs scanned: ${res.rows.length}`);
  console.log(`Successfully migrated to Cloudinary: ${migratedCount}`);
  console.log(`Already on Cloudinary: ${alreadyMigrated}`);
  console.log(`Failed / Skipped: ${failedCount}`);
  console.log('-------------------------');
};

syncPdfsToCloudinary()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
  });
