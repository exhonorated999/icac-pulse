/**
 * UC Persona Photo Library
 *
 * Each persona has a private photo library used during chats.
 * On import we re-encode to strip EXIF (OPSEC) using Electron's
 * nativeImage (no native deps required). All photos are stored at:
 *   <userData>/uc_photos/<persona_id>/<uuid>.<ext>
 *
 * Renderer accesses thumbnails via the custom `uc-photo://` protocol
 * registered in main/index.ts. DB stores relative paths.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { nativeImage, clipboard } from 'electron';
import { getDatabase, saveDatabase, getUserDataPath } from '../database';
import { appendEvent } from './chats';
import { recordEvidenceLog } from './evidenceLog';

export interface PersonaPhoto {
  id: number;
  persona_id: number;
  file_path: string;            // relative to <userData>/uc_photos
  original_filename: string | null;
  caption: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  sha256: string | null;
  size_bytes: number | null;
  sort_order: number;
  created_at: string;
  archived_at: string | null;
  /** Computed: uc-photo:// URL the renderer can use directly. */
  src_url?: string;
  /** Computed: total times this photo has been used across all chats. */
  use_count?: number;
  /** Computed: last chat id the photo was sent to. */
  last_used_chat_id?: number | null;
  /** Computed: last use timestamp. */
  last_used_at?: string | null;
}

export interface AddPhotoInput {
  personaId: number;
  srcPath: string;
  caption?: string;
}

/** Root of the UC photo library on disk. */
export function getPhotosRoot(): string {
  const dir = path.join(getUserDataPath(), 'uc_photos');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getPersonaDir(personaId: number): string {
  const dir = path.join(getPhotosRoot(), String(personaId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Convert a stored relative path to an absolute path on disk. */
export function resolveAbsolutePath(relPath: string): string {
  return path.join(getPhotosRoot(), relPath);
}

function sha256Buffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Re-encode an image through nativeImage to strip EXIF + normalize format.
 * - JPEG → quality 92 JPEG (drops all metadata)
 * - PNG → PNG (drops ancillary chunks like tEXt/eXIf)
 * - Other (GIF/WebP/HEIC) → JPEG fallback
 */
function reencodeStripExif(srcPath: string): { buffer: Buffer; ext: '.jpg' | '.png'; mime: 'image/jpeg' | 'image/png'; width: number; height: number } {
  const img = nativeImage.createFromPath(srcPath);
  if (img.isEmpty()) {
    throw new Error(`reencodeStripExif: not a valid image: ${srcPath}`);
  }
  const size = img.getSize(); // {width,height}
  const ext = path.extname(srcPath).toLowerCase();
  if (ext === '.png') {
    return { buffer: img.toPNG(), ext: '.png', mime: 'image/png', width: size.width, height: size.height };
  }
  // JPEG path for everything else (jpg, jpeg, gif, webp, heic, bmp)
  const buf = img.toJPEG(92);
  return { buffer: buf, ext: '.jpg', mime: 'image/jpeg', width: size.width, height: size.height };
}

/**
 * Add a photo to a persona's library.
 * Re-encodes through nativeImage to strip EXIF.
 */
export function addPhoto(input: AddPhotoInput): PersonaPhoto {
  if (!fs.existsSync(input.srcPath)) {
    throw new Error(`addPhoto: source not found: ${input.srcPath}`);
  }
  const db = getDatabase();
  const personaDir = getPersonaDir(input.personaId);

  const { buffer, ext, mime, width, height } = reencodeStripExif(input.srcPath);
  const uuid = crypto.randomBytes(8).toString('hex');
  const storedName = `${uuid}${ext}`;
  const absDest = path.join(personaDir, storedName);
  fs.writeFileSync(absDest, buffer);

  const relPath = `${input.personaId}/${storedName}`;
  const hash = sha256Buffer(buffer);
  const size = buffer.byteLength;

  // Next sort_order = MAX+1 within this persona's library
  const ordRow = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM uc_persona_photos WHERE persona_id = ?',
  ).get(input.personaId) as { next: number } | undefined;
  const sortOrder = ordRow?.next ?? 1;

  db.prepare(
    `INSERT INTO uc_persona_photos
       (persona_id, file_path, original_filename, caption, mime_type, width, height, sha256, size_bytes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.personaId,
    relPath,
    path.basename(input.srcPath),
    input.caption ?? null,
    mime,
    width,
    height,
    hash,
    size,
    sortOrder,
  );
  saveDatabase();

  // sql.js lastInsertRowid workaround
  const row = db.prepare(
    'SELECT id FROM uc_persona_photos WHERE persona_id = ? ORDER BY id DESC LIMIT 1',
  ).get(input.personaId) as { id: number } | undefined;
  const id = row?.id ?? 0;
  if (!id) throw new Error('addPhoto: failed to resolve new photo id');

  // Chain-of-custody — photo enters the library.
  recordEvidenceLog({
    chatId: null,
    action: 'create',
    filePath: absDest,
    meta: { kind: 'uc_persona_photo', persona_id: input.personaId, stage: 'import' },
  }).catch(e => console.warn('[uc-photo-evlog-import]', e));

  return getPhoto(id)!;
}

function decorate(row: PersonaPhoto): PersonaPhoto {
  return {
    ...row,
    src_url: `uc-photo://${row.file_path.replace(/\\/g, '/')}`,
  };
}

export function getPhoto(id: number): PersonaPhoto | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM uc_persona_photos WHERE id = ?').get(id) as PersonaPhoto | undefined;
  if (!row) return null;
  // Decorate with use stats
  const stats = db.prepare(
    `SELECT COUNT(*) AS use_count,
            MAX(ts)   AS last_used_at,
            (SELECT chat_id FROM uc_photo_uses WHERE photo_id = ? ORDER BY ts DESC LIMIT 1) AS last_used_chat_id
       FROM uc_photo_uses
      WHERE photo_id = ?`,
  ).get(id, id) as { use_count: number; last_used_at: string | null; last_used_chat_id: number | null } | undefined;
  return {
    ...decorate(row),
    use_count: stats?.use_count ?? 0,
    last_used_at: stats?.last_used_at ?? null,
    last_used_chat_id: stats?.last_used_chat_id ?? null,
  };
}

export function listPhotos(personaId: number, includeArchived = false): PersonaPhoto[] {
  const db = getDatabase();
  const sql = includeArchived
    ? 'SELECT * FROM uc_persona_photos WHERE persona_id = ? ORDER BY archived_at IS NULL DESC, sort_order ASC, id ASC'
    : 'SELECT * FROM uc_persona_photos WHERE persona_id = ? AND archived_at IS NULL ORDER BY sort_order ASC, id ASC';
  const rows = (db.prepare(sql).all(personaId) as PersonaPhoto[]) || [];
  if (rows.length === 0) return [];
  // Bulk-decorate with use stats
  const idList = rows.map(r => r.id);
  const placeholders = idList.map(() => '?').join(',');
  const usesAgg = db.prepare(
    `SELECT photo_id, COUNT(*) AS use_count, MAX(ts) AS last_used_at
       FROM uc_photo_uses
      WHERE photo_id IN (${placeholders})
      GROUP BY photo_id`,
  ).all(...idList) as { photo_id: number; use_count: number; last_used_at: string }[];
  const lastChatRows = db.prepare(
    `SELECT u.photo_id, u.chat_id
       FROM uc_photo_uses u
      WHERE u.photo_id IN (${placeholders})
        AND u.ts = (SELECT MAX(ts) FROM uc_photo_uses u2 WHERE u2.photo_id = u.photo_id)`,
  ).all(...idList) as { photo_id: number; chat_id: number }[];

  const useMap = new Map(usesAgg.map(r => [r.photo_id, r]));
  const chatMap = new Map(lastChatRows.map(r => [r.photo_id, r.chat_id]));

  return rows.map(r => ({
    ...decorate(r),
    use_count: useMap.get(r.id)?.use_count ?? 0,
    last_used_at: useMap.get(r.id)?.last_used_at ?? null,
    last_used_chat_id: chatMap.get(r.id) ?? null,
  }));
}

export function updatePhoto(id: number, input: { caption?: string | null; sort_order?: number }): PersonaPhoto {
  const db = getDatabase();
  const existing = getPhoto(id);
  if (!existing) throw new Error(`updatePhoto: photo ${id} not found`);
  const fields: string[] = [];
  const values: any[] = [];
  if (input.caption !== undefined) { fields.push('caption = ?'); values.push(input.caption); }
  if (input.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(input.sort_order); }
  if (fields.length === 0) return existing;
  values.push(id);
  db.run(`UPDATE uc_persona_photos SET ${fields.join(', ')} WHERE id = ?`, values);
  saveDatabase();
  return getPhoto(id)!;
}

/** Soft-archive — keeps file on disk + DB row for evidence integrity. */
export function archivePhoto(id: number): void {
  const db = getDatabase();
  db.run('UPDATE uc_persona_photos SET archived_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  saveDatabase();
}

export function unarchivePhoto(id: number): void {
  const db = getDatabase();
  db.run('UPDATE uc_persona_photos SET archived_at = NULL WHERE id = ?', [id]);
  saveDatabase();
}

/** List uses of a photo (audit trail). */
export function listPhotoUses(photoId: number): { id: number; chat_id: number; ts: string; action: string; notes: string | null }[] {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM uc_photo_uses WHERE photo_id = ? ORDER BY ts DESC').all(photoId) as any[]) || [];
}

/**
 * Copy a photo to the clipboard as a native image (so officer can paste
 * into the social app's compose box). Logs the use + chat event +
 * evidence_log export so chain-of-custody is preserved.
 */
export function copyPhotoToClipboard(photoId: number, chatId: number): { ok: true } {
  const db = getDatabase();
  const photo = getPhoto(photoId);
  if (!photo) throw new Error(`copyPhotoToClipboard: photo ${photoId} not found`);
  const abs = resolveAbsolutePath(photo.file_path);
  if (!fs.existsSync(abs)) throw new Error(`copyPhotoToClipboard: file missing: ${abs}`);

  const img = nativeImage.createFromPath(abs);
  if (img.isEmpty()) throw new Error('copyPhotoToClipboard: nativeImage failed to load');
  clipboard.writeImage(img);

  // Log use row
  db.prepare(
    'INSERT INTO uc_photo_uses (photo_id, chat_id, action, notes) VALUES (?, ?, ?, ?)',
  ).run(photoId, chatId, 'copy_to_clipboard', null);
  saveDatabase();

  // Chat event for the chat's timeline
  try {
    appendEvent(chatId, 'photo_used', {
      photo_id: photoId,
      action: 'copy_to_clipboard',
      file_path: photo.file_path,
      sha256: photo.sha256,
    });
  } catch (e) { console.warn('[uc-photo-use-event]', e); }

  // Chain-of-custody export entry
  recordEvidenceLog({
    chatId,
    action: 'export',
    filePath: abs,
    meta: {
      kind: 'uc_persona_photo',
      stage: 'clipboard',
      photo_id: photoId,
      persona_id: photo.persona_id,
    },
  }).catch(e => console.warn('[uc-photo-evlog-export]', e));

  return { ok: true };
}
