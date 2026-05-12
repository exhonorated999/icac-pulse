/**
 * UC Alert Bus.
 *
 * Receives raw notification events from the per-partition preload script,
 * dedupes, increments unread counts in the DB, appends event rows, and
 * broadcasts to the renderer via 'uc-alert'.
 *
 * Discreet Mode (set via setDiscreetMode) strips notification text from
 * the broadcast — operator-side UI shows only "New activity".
 */

import { BrowserWindow } from 'electron';
import { incrementUnread, appendEvent } from './chats';

export interface UcAlertPayload {
  chatId: number;
  kind: 'notification' | 'title' | 'activity';
  title?: string;
  body?: string;
  icon?: string;
  ts: number;
}

let discreetMode = false;
let getWin: () => BrowserWindow | null = () => null;

// Per-chat dedupe — same {title|body|ts-bucket} within 3s is treated as one.
const recent = new Map<number, { sig: string; ts: number }>();

function shouldDedupe(chatId: number, sig: string, ts: number): boolean {
  const prev = recent.get(chatId);
  if (prev && prev.sig === sig && (ts - prev.ts) < 3000) return true;
  recent.set(chatId, { sig, ts });
  return false;
}

export function configureAlertBus(opts: { getMainWindow: () => BrowserWindow | null }) {
  getWin = opts.getMainWindow;
}

export function setDiscreetMode(on: boolean): void {
  discreetMode = on;
}

export function getDiscreetMode(): boolean {
  return discreetMode;
}

/**
 * Called from IPC when the per-partition preload reports a notification or
 * title-bar unread change. `chatId` is the renderer-resolved chat (the
 * preload tags messages with chatId via initial-property injection — see
 * ucNotifPreload.ts).
 */
export function ingestNotification(input: {
  chatId: number;
  title?: string;
  body?: string;
  icon?: string;
}): void {
  if (!input.chatId) return;
  const ts = Date.now();
  const sig = `${input.title || ''}|${input.body || ''}`;
  if (shouldDedupe(input.chatId, sig, ts)) return;

  try { incrementUnread(input.chatId, 1); } catch {}
  try {
    appendEvent(input.chatId, 'alert', {
      title: input.title,
      body: input.body,
      icon: input.icon,
    });
  } catch {}

  const win = getWin();
  if (!win || win.isDestroyed()) return;

  const payload: UcAlertPayload = discreetMode
    ? { chatId: input.chatId, kind: 'activity', ts }
    : {
        chatId: input.chatId,
        kind: 'notification',
        title: input.title,
        body: input.body,
        icon: input.icon,
        ts,
      };
  win.webContents.send('uc-alert', payload);
}

/** Title-bar unread bump (no message content, just a count). */
export function ingestTitleSignal(input: { chatId: number; unread: number }): void {
  if (!input.chatId || input.unread <= 0) return;
  // Use ts-bucketed signature so we don't double-count rapid pings.
  const ts = Date.now();
  const sig = `title:${input.unread}`;
  if (shouldDedupe(input.chatId, sig, ts)) return;

  try { incrementUnread(input.chatId, 1); } catch {}
  const win = getWin();
  if (!win || win.isDestroyed()) return;
  const payload: UcAlertPayload = { chatId: input.chatId, kind: discreetMode ? 'activity' : 'title', ts };
  win.webContents.send('uc-alert', payload);
}
