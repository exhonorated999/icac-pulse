// src/main/downloadCapture.ts
// Intercepts downloads from embedded BrowserView sessions (Flock, TLO, ICACCops,
// GridCop, Vigilant, TR CLEAR, Accurint, ICAC Data System, BYOA) and stages them
// in a temp directory. The renderer then prompts the user to route each file
// into Evidence, the Cybertip module, the OS Downloads folder, or discard it.

import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface PendingDownload {
  id: string;
  partition: string;
  provider: string;        // human label: "Flock", "TLO", "ICAC Data System", ...
  filename: string;
  mimeType: string;
  totalBytes: number;
  tempPath: string;
  sourceUrl: string;
  startedAt: string;
  /** Optional UC chat id that owns this capture (for evidence_log + auto case bind). */
  chatId?: number | null;
}

const pending = new Map<string, PendingDownload>();
const attachedPartitions = new Set<string>();
let stagingDir: string | null = null;

function getStagingDir(): string {
  if (stagingDir && fs.existsSync(stagingDir)) return stagingDir;
  const dir = path.join(app.getPath('temp'), 'icac-pulse-downloads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  stagingDir = dir;
  return dir;
}

function newId(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeFilename(name: string): string {
  // Strip path components & invalid chars
  let n = name.replace(/[\\/]+/g, '_').replace(/[<>:"|?*\x00-\x1f]+/g, '_').trim();
  if (!n) n = 'download';
  return n;
}

/**
 * Attach a will-download interceptor to a session partition. Idempotent.
 */
export function attachDownloadInterceptor(
  partition: string,
  provider: string,
  getWindow: () => BrowserWindow | null,
): void {
  if (attachedPartitions.has(partition)) return;
  attachedPartitions.add(partition);

  const sess = session.fromPartition(partition);
  sess.on('will-download', (_event, item, _webContents) => {
    try {
      const id = newId();
      const stage = getStagingDir();
      const baseName = safeFilename(item.getFilename() || 'download.bin');
      const tempPath = path.join(stage, `${id}__${baseName}`);
      item.setSavePath(tempPath);

      const win = getWindow();
      const rec: PendingDownload = {
        id,
        partition,
        provider,
        filename: baseName,
        mimeType: item.getMimeType() || '',
        totalBytes: item.getTotalBytes() || 0,
        tempPath,
        sourceUrl: item.getURL() || '',
        startedAt: new Date().toISOString(),
      };
      pending.set(id, rec);

      win?.webContents.send('resource-download-started', rec);

      item.on('updated', (_e, state) => {
        if (!win || win.isDestroyed()) return;
        win.webContents.send('resource-download-progress', {
          id,
          state,
          received: item.getReceivedBytes(),
          total: item.getTotalBytes(),
        });
      });

      item.once('done', (_e, state) => {
        if (!win || win.isDestroyed()) return;
        if (state === 'completed') {
          win.webContents.send('resource-download-complete', { ...rec });
        } else {
          // 'cancelled' or 'interrupted'
          pending.delete(id);
          try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* ignore */ }
          win.webContents.send('resource-download-failed', { id, state });
        }
      });
    } catch (err: any) {
      console.error('[downloadCapture] will-download handler error:', err);
    }
  });
}

export function getPendingDownload(id: string): PendingDownload | undefined {
  return pending.get(id);
}

/**
 * Remove the temp file for a completed/cancelled download and forget the record.
 */
export function discardDownload(id: string): { success: boolean; error?: string } {
  const rec = pending.get(id);
  if (!rec) return { success: true };
  try {
    if (fs.existsSync(rec.tempPath)) fs.unlinkSync(rec.tempPath);
  } catch (e: any) {
    return { success: false, error: e.message };
  }
  pending.delete(id);
  return { success: true };
}

/**
 * Move a staged download to the user's OS Downloads folder (the "cancel route"
 * — user opted not to route into a case). Returns the final path.
 */
export function moveToDownloads(id: string): { success: boolean; finalPath?: string; error?: string } {
  const rec = pending.get(id);
  if (!rec) return { success: false, error: 'Download not found' };
  try {
    const downloadsDir = app.getPath('downloads');
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
    let dest = path.join(downloadsDir, rec.filename);
    // Avoid collision
    if (fs.existsSync(dest)) {
      const ext = path.extname(rec.filename);
      const stem = path.basename(rec.filename, ext);
      let i = 1;
      while (fs.existsSync(path.join(downloadsDir, `${stem} (${i})${ext}`))) i++;
      dest = path.join(downloadsDir, `${stem} (${i})${ext}`);
    }
    fs.renameSync(rec.tempPath, dest);
    pending.delete(id);
    return { success: true, finalPath: dest };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Take ownership of the staged file: return its current temp path so callers
 * (evidence/cybertip handlers) can copy or move it. Does NOT delete the record;
 * call `discardDownload` after a successful copy to clean up.
 */
export function consumeDownload(id: string): { tempPath: string; filename: string; chatId?: number | null; provider?: string } | null {
  const rec = pending.get(id);
  if (!rec) return null;
  return { tempPath: rec.tempPath, filename: rec.filename, chatId: rec.chatId ?? null, provider: rec.provider };
}

/**
 * Register a file that was generated by the capture pipeline (PDF / SingleFile HTML)
 * into the same pending queue used by intercepted downloads, then emit
 * `resource-download-complete` so the existing DownloadCaptureModal picks it up.
 *
 * Caller is responsible for writing the file to `filePath` before invoking this.
 * The file should ideally already be inside the staging dir, but any path works
 * (we just track and clean it up the same way).
 */
export function registerStagedCapture(opts: {
  filePath: string;
  filename: string;
  provider: string;
  partition: string;
  mimeType: string;
  sourceUrl: string;
  getWindow: () => BrowserWindow | null;
  chatId?: number | null;
}): PendingDownload {
  // Make sure the file lives in our staging dir so it gets cleaned up the
  // same way intercepted downloads do.
  const stage = getStagingDir();
  let finalPath = opts.filePath;
  if (path.dirname(opts.filePath) !== stage) {
    const id0 = newId();
    const safe = safeFilename(opts.filename || 'capture.bin');
    const dest = path.join(stage, `${id0}__${safe}`);
    try {
      fs.copyFileSync(opts.filePath, dest);
      try { fs.unlinkSync(opts.filePath); } catch { /* original removal best-effort */ }
      finalPath = dest;
    } catch (e) {
      // Fall back to using the original path
      console.warn('[downloadCapture] could not move capture into staging dir:', (e as any)?.message);
    }
  }

  const id = newId();
  let totalBytes = 0;
  try { totalBytes = fs.statSync(finalPath).size; } catch { /* ignore */ }

  const rec: PendingDownload = {
    id,
    partition: opts.partition,
    provider: opts.provider,
    filename: safeFilename(opts.filename),
    mimeType: opts.mimeType,
    totalBytes,
    tempPath: finalPath,
    sourceUrl: opts.sourceUrl,
    startedAt: new Date().toISOString(),
    chatId: opts.chatId ?? null,
  };
  pending.set(id, rec);

  const win = opts.getWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('resource-download-complete', { ...rec });
  }

  return rec;
}

/**
 * Returns the active staging directory (used by capture handlers to write
 * directly into the right place).
 */
export function getCaptureStagingDir(): string {
  return getStagingDir();
}
