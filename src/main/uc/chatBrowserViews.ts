/**
 * UC Chat BrowserView lifecycle.
 *
 * Each chat owns one BrowserView, attached to the persona's session partition
 * (persist:uc_<personaId>). The renderer drives visibility/bounds via IPC
 * exactly the same way ResourceDrawer does for fixed resources.
 */

import { BrowserView, BrowserWindow, session } from 'electron';
import * as path from 'path';
import { app } from 'electron';
import { partitionForPersona } from './personas';

interface ChatBV {
  view: BrowserView;
  chatId: number;
  personaId: number;
  attachedTo: BrowserWindow | null;
}

const views = new Map<number, ChatBV>();
const wcIdToChatId = new Map<number, number>();

/** Lookup chatId from a webContents.id (used by alert IPC). */
export function chatIdForWebContents(wcId: number): number | null {
  return wcIdToChatId.get(wcId) ?? null;
}

/** Path to the UC notification-hook preload script (compiled output). */
function getNotifPreloadPath(): string {
  // In dev: electron-vite outputs preload entries beside this file.
  // We pre-bundle the notif preload as src/preload/ucNotifPreload.ts (added
  // in task 5). The output sits next to other preload bundles.
  const candidates = [
    path.join(__dirname, '..', 'preload', 'ucNotifPreload.js'),
    path.join(__dirname, '..', '..', 'preload', 'ucNotifPreload.js'),
    path.join(app.getAppPath(), 'out', 'preload', 'ucNotifPreload.js'),
  ];
  for (const p of candidates) {
    try { require('fs').accessSync(p); return p; } catch {}
  }
  // Fall back to first candidate; we'll log if it's missing at attach time.
  return candidates[0];
}

const preloadedPartitions = new Set<string>();

/** Attach the UC notification preload to a partition exactly once. */
function ensurePreloadAttached(partition: string) {
  if (preloadedPartitions.has(partition)) return;
  try {
    const ses = session.fromPartition(partition);
    const preloads = ses.getPreloads();
    const notifPath = getNotifPreloadPath();
    if (!preloads.includes(notifPath)) {
      ses.setPreloads([...preloads, notifPath]);
    }
    preloadedPartitions.add(partition);
  } catch (e) {
    console.warn('[uc/chatBrowserViews] failed to attach notif preload:', e);
  }
}

export interface CreateBvOpts {
  chatId: number;
  personaId: number;
  url: string;
  mainWindow: BrowserWindow | null;
}

export function getChatView(chatId: number): BrowserView | null {
  return views.get(chatId)?.view || null;
}

export function getAllChatIds(): number[] {
  return Array.from(views.keys());
}

export function createChatView(opts: CreateBvOpts): BrowserView {
  const existing = views.get(opts.chatId);
  if (existing) {
    if (opts.url) existing.view.webContents.loadURL(opts.url).catch(() => {});
    return existing.view;
  }

  const partition = partitionForPersona(opts.personaId);
  ensurePreloadAttached(partition);

  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition,
      // Spoof a recent Chrome UA so social platforms don't reject Electron.
    },
  });

  // Realistic UA — most platforms refuse Electron's default UA.
  try {
    view.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
  } catch {}

  views.set(opts.chatId, {
    view,
    chatId: opts.chatId,
    personaId: opts.personaId,
    attachedTo: null,
  });
  try { wcIdToChatId.set(view.webContents.id, opts.chatId); } catch {}

  if (opts.mainWindow && !opts.mainWindow.isDestroyed()) {
    try { opts.mainWindow.addBrowserView(view); } catch {}
    views.get(opts.chatId)!.attachedTo = opts.mainWindow;
  }

  // Hidden until renderer positions it.
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  if (opts.url) view.webContents.loadURL(opts.url).catch(() => {});

  return view;
}

export function setChatViewBounds(chatId: number, b: { x: number; y: number; width: number; height: number }): void {
  const entry = views.get(chatId);
  if (!entry) return;
  entry.view.setBounds({
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.round(b.width),
    height: Math.round(b.height),
  });
}

export function setChatViewVisible(chatId: number, visible: boolean): void {
  const entry = views.get(chatId);
  if (!entry) return;
  if (visible) {
    if (entry.attachedTo && !entry.attachedTo.isDestroyed()) {
      try { entry.attachedTo.addBrowserView(entry.view); } catch {}
    }
  } else {
    // "Hide" = move offscreen / detach.
    entry.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    if (entry.attachedTo && !entry.attachedTo.isDestroyed()) {
      try { entry.attachedTo.removeBrowserView(entry.view); } catch {}
    }
  }
}

/**
 * Hide every known chat BrowserView. Used by the renderer on mount
 * (e.g. after HMR-driven remount) to clear any orphan BVs that
 * survived the React component tear-down but weren't explicitly
 * hidden via setChatViewVisible(id, false).
 */
export function hideAllChatViews(): void {
  for (const id of views.keys()) {
    setChatViewVisible(id, false);
  }
}

export function loadChatUrl(chatId: number, url: string): void {
  const entry = views.get(chatId);
  if (!entry) return;
  entry.view.webContents.loadURL(url).catch(() => {});
}

export function reloadChat(chatId: number): void {
  const entry = views.get(chatId);
  if (!entry) return;
  try { entry.view.webContents.reload(); } catch {}
}

export function navBack(chatId: number): void {
  const entry = views.get(chatId);
  if (!entry) return;
  try {
    if (entry.view.webContents.canGoBack()) entry.view.webContents.goBack();
  } catch {}
}

export function destroyChatView(chatId: number): void {
  const entry = views.get(chatId);
  if (!entry) return;
  try {
    if (entry.attachedTo && !entry.attachedTo.isDestroyed()) {
      entry.attachedTo.removeBrowserView(entry.view);
    }
    try { wcIdToChatId.delete(entry.view.webContents.id); } catch {}
    // @ts-ignore — webContents.close exists at runtime
    if (typeof (entry.view.webContents as any).close === 'function') {
      (entry.view.webContents as any).close();
    } else {
      (entry.view.webContents as any).destroy?.();
    }
  } catch {}
  views.delete(chatId);
}

/** Used by the alert pipeline + capture handlers to find a chat's webContents. */
export function getChatPersona(chatId: number): number | null {
  return views.get(chatId)?.personaId ?? null;
}

export function getChatPartition(chatId: number): string | null {
  const entry = views.get(chatId);
  return entry ? partitionForPersona(entry.personaId) : null;
}
