/**
 * UC Chat — Notification preload.
 *
 * Injected via session.setPreloads() into every UC chat partition
 * (persist:uc_<personaId>). Runs inside the social-platform page's renderer.
 *
 * Responsibilities:
 *   1. Override window.Notification — when the page tries to fire a desktop
 *      notification, capture {title, body, icon} and forward to main as
 *      'uc-notif-raw'.
 *   2. Poll document.title for unread-count changes (e.g. "(3) Discord")
 *      and forward as 'uc-title-signal' when the count grows.
 *
 * The main process maps event.sender.id → chatId, so this preload does not
 * need to know which chat it's serving.
 */

const { ipcRenderer } = require('electron');

/* ── Notification API hijack ─────────────────────────────── */
try {
  const RealNotification = (window as any).Notification;
  if (RealNotification) {
    const HookedNotification: any = function (this: any, title: string, options?: NotificationOptions) {
      try {
        ipcRenderer.send('uc-notif-raw', {
          title: title || '',
          body: options?.body || '',
          icon: options?.icon || '',
        });
      } catch {
        /* swallow */
      }
      // Allow the page to think the notification fired (some apps gate UI on it).
      return new RealNotification(title, options);
    };
    HookedNotification.permission = 'granted';
    HookedNotification.requestPermission = (cb?: (p: NotificationPermission) => void) => {
      const p = 'granted' as NotificationPermission;
      if (cb) try { cb(p); } catch {}
      return Promise.resolve(p);
    };
    (window as any).Notification = HookedNotification;
  }
} catch {
  /* swallow */
}

/* ── Title polling ───────────────────────────────────────── */
let lastUnread = 0;
function parseTitleUnread(title: string): number {
  if (!title) return 0;
  // Matches "(3) Foo", "(3+) Foo", "● Foo", "Foo (3)", "[3] Foo"
  const paren = title.match(/\((\d+)\+?\)/);
  if (paren) return Math.min(99, parseInt(paren[1], 10) || 0);
  const bracket = title.match(/\[(\d+)\]/);
  if (bracket) return Math.min(99, parseInt(bracket[1], 10) || 0);
  if (/^[●•▲]\s/.test(title)) return 1;
  return 0;
}

function checkTitle() {
  try {
    const t = document.title || '';
    const n = parseTitleUnread(t);
    if (n > lastUnread) {
      ipcRenderer.send('uc-title-signal', { unread: n });
    }
    lastUnread = n;
  } catch {
    /* swallow */
  }
}

if (typeof document !== 'undefined') {
  // First check after page settles.
  setTimeout(checkTitle, 1500);
  setInterval(checkTitle, 1500);
}
