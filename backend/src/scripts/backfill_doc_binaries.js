import fs from 'fs';
import path from 'path';
import { query } from '../config/db.js';

async function backfill() {
  console.log('Starting backfill of local document binaries into document_vault...');
  const res = await query(`
    SELECT id, title, file_url, mime_type, file_size 
    FROM document_vault
    WHERE file_data IS NULL AND file_url IS NOT NULL;
  `);

  console.log(`Found ${res.rows.length} documents without binary data.`);

  let updatedCount = 0;
  for (const doc of res.rows) {
    if (!doc.file_url) continue;
    const cleanUrl = doc.file_url.startsWith('/') ? doc.file_url.slice(1) : doc.file_url;
    const absPath = path.resolve(process.cwd(), cleanUrl);

    if (fs.existsSync(absPath)) {
      const fileBuffer = fs.readFileSync(absPath);
      await query(`
        UPDATE document_vault 
        SET file_data = $1, file_size = $2, updated_at = NOW() 
        WHERE id = $3;
      `, [fileBuffer, fileBuffer.length, doc.id]);
      console.log(`[OK] Backfilled '${doc.title}' (${doc.id}) - ${fileBuffer.length} bytes from ${absPath}`);
      updatedCount++;
    } else {
      console.log(`[SKIP] File not found on disk: ${absPath}`);
    }
  }

  console.log(`Backfill complete. ${updatedCount} document(s) populated with binary content.`);
  process.exit(0);
}

backfill().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
