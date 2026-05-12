/**
 * UC Chat Operations — IPC wiring.
 *
 * Call registerUcIpc() once from src/main/index.ts after the database is
 * initialized and the main window is created.
 *
 * Channel conventions mirror the rest of the app:
 *   - ipcMain.handle('uc-*') for request/response
 *   - ipcMain.on('uc-*-event') for fire-and-forget from preload
 *   - mainWindow.webContents.send('uc-alert') for main → renderer push
 */

import { ipcMain, BrowserWindow, dialog } from 'electron';
import * as personas from './personas';
import * as chats from './chats';
import * as bvs from './chatBrowserViews';
import * as bus from './alertBus';
import * as evlog from './evidenceLog';
import * as photos from './photos';

let getMainWindow: () => BrowserWindow | null = () => null;

export function registerUcIpc(opts: { getMainWindow: () => BrowserWindow | null }) {
  getMainWindow = opts.getMainWindow;
  bus.configureAlertBus({ getMainWindow: opts.getMainWindow });

  /* ── Personas ─────────────────────────────────────────── */
  ipcMain.handle('uc-persona-list', (_e, args?: { includeArchived?: boolean }) =>
    personas.listPersonas(!!args?.includeArchived));
  ipcMain.handle('uc-persona-get', (_e, id: number) => personas.getPersona(id));
  ipcMain.handle('uc-persona-create', (_e, input: personas.CreatePersonaInput) => personas.createPersona(input));
  ipcMain.handle('uc-persona-update', (_e, args: { id: number; input: personas.UpdatePersonaInput }) =>
    personas.updatePersona(args.id, args.input));
  ipcMain.handle('uc-persona-archive', (_e, id: number) => { personas.archivePersona(id); return true; });
  ipcMain.handle('uc-persona-unarchive', (_e, id: number) => { personas.unarchivePersona(id); return true; });

  /* ── Chats ────────────────────────────────────────────── */
  ipcMain.handle('uc-chat-list', (_e, args?: { includeArchived?: boolean; personaId?: number }) =>
    chats.listChats(args || {}));
  ipcMain.handle('uc-chat-get', (_e, id: number) => chats.getChat(id));
  ipcMain.handle('uc-chat-create', (_e, input: chats.CreateChatInput) => chats.createChat(input));
  ipcMain.handle('uc-chat-update', (_e, args: { id: number; input: chats.UpdateChatInput }) =>
    chats.updateChat(args.id, args.input));
  ipcMain.handle('uc-chat-archive', (_e, id: number) => { chats.archiveChat(id); return true; });
  ipcMain.handle('uc-chat-unarchive', (_e, id: number) => { chats.unarchiveChat(id); return true; });
  ipcMain.handle('uc-chat-mark-read', (_e, id: number) => { chats.markRead(id); return true; });

  ipcMain.handle('uc-chat-link-case', (_e, args: { chatId: number; caseId: number; role?: 'primary' | 'secondary' }) => {
    chats.linkCase(args.chatId, args.caseId, args.role || 'secondary');
    chats.appendEvent(args.chatId, 'link', { caseId: args.caseId, role: args.role || 'secondary' });
    return chats.listCaseLinks(args.chatId);
  });
  ipcMain.handle('uc-chat-unlink-case', (_e, args: { chatId: number; caseId: number }) => {
    chats.unlinkCase(args.chatId, args.caseId);
    return chats.listCaseLinks(args.chatId);
  });
  ipcMain.handle('uc-chat-case-links', (_e, chatId: number) => chats.listCaseLinks(chatId));

  ipcMain.handle('uc-chat-events', (_e, args: { chatId: number; limit?: number }) =>
    chats.listEvents(args.chatId, args.limit));

  /* ── BrowserView lifecycle ────────────────────────────── */
  ipcMain.handle('uc-chat-bv-create', (_e, args: { chatId: number; personaId: number; url: string }) => {
    const win = getMainWindow();
    bvs.createChatView({ chatId: args.chatId, personaId: args.personaId, url: args.url, mainWindow: win });
    return true;
  });
  ipcMain.on('uc-chat-bv-set-bounds', (_e, args: { chatId: number; bounds: { x: number; y: number; width: number; height: number } }) => {
    bvs.setChatViewBounds(args.chatId, args.bounds);
  });
  ipcMain.on('uc-chat-bv-set-visible', (_e, args: { chatId: number; visible: boolean }) => {
    bvs.setChatViewVisible(args.chatId, args.visible);
  });
  ipcMain.on('uc-chat-bv-load-url', (_e, args: { chatId: number; url: string }) => {
    bvs.loadChatUrl(args.chatId, args.url);
  });
  ipcMain.on('uc-chat-bv-reload', (_e, chatId: number) => bvs.reloadChat(chatId));
  ipcMain.on('uc-chat-bv-back', (_e, chatId: number) => bvs.navBack(chatId));
  ipcMain.on('uc-chat-bv-destroy', (_e, chatId: number) => bvs.destroyChatView(chatId));
  ipcMain.on('uc-chat-bv-hide-all', () => bvs.hideAllChatViews());

  /* ── Alerts (from per-partition preload) ──────────────── */
  // The ucNotifPreload sends raw events with NO chatId; main resolves
  // chatId from event.sender.id via the wcId → chatId map.
  ipcMain.on('uc-notif-raw', (e, payload: { title?: string; body?: string; icon?: string }) => {
    const chatId = bvs.chatIdForWebContents(e.sender.id);
    if (!chatId) return;
    bus.ingestNotification({ chatId, ...payload });
  });
  ipcMain.on('uc-title-signal', (e, payload: { unread: number }) => {
    const chatId = bvs.chatIdForWebContents(e.sender.id);
    if (!chatId) return;
    bus.ingestTitleSignal({ chatId, unread: payload.unread });
  });
  ipcMain.handle('uc-discreet-mode-get', () => bus.getDiscreetMode());
  ipcMain.handle('uc-discreet-mode-set', (_e, on: boolean) => { bus.setDiscreetMode(!!on); return bus.getDiscreetMode(); });

  /* ── Evidence Log ─────────────────────────────────────── */
  ipcMain.handle('uc-evidence-log-list', (_e, filter: { caseId?: number; chatId?: number; limit?: number }) =>
    evlog.listEvidenceLog(filter || {}));
  ipcMain.handle('uc-evidence-log-verify', (_e, id: number) => evlog.verifyEvidenceLogEntry(id));

  /* ── Persona Photo Library ────────────────────────────── */
  ipcMain.handle('uc-photo-list', (_e, args: { personaId: number; includeArchived?: boolean }) =>
    photos.listPhotos(args.personaId, !!args?.includeArchived));
  ipcMain.handle('uc-photo-add', (_e, args: { personaId: number; srcPath: string; caption?: string }) =>
    photos.addPhoto(args));
  ipcMain.handle('uc-photo-update', (_e, args: { id: number; input: { caption?: string | null; sort_order?: number } }) =>
    photos.updatePhoto(args.id, args.input));
  ipcMain.handle('uc-photo-archive', (_e, id: number) => { photos.archivePhoto(id); return true; });
  ipcMain.handle('uc-photo-unarchive', (_e, id: number) => { photos.unarchivePhoto(id); return true; });
  ipcMain.handle('uc-photo-uses', (_e, photoId: number) => photos.listPhotoUses(photoId));
  ipcMain.handle('uc-photo-copy-to-clipboard', (_e, args: { photoId: number; chatId: number }) =>
    photos.copyPhotoToClipboard(args.photoId, args.chatId));

  // Open a native file picker and add each selected image to the persona.
  // Returns array of newly created photo rows.
  ipcMain.handle('uc-photo-pick-and-add', async (_e, args: { personaId: number }) => {
    const win = getMainWindow();
    const opts: Electron.OpenDialogOptions = {
      title: 'Add Persona Photos',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'tiff'] },
      ],
    };
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths?.length) return [];
    const created: any[] = [];
    for (const fp of result.filePaths) {
      try {
        const p = photos.addPhoto({ personaId: args.personaId, srcPath: fp });
        created.push(p);
      } catch (e) {
        console.warn('[uc-photo-pick-and-add] failed for', fp, e);
      }
    }
    return created;
  });

  // Pick-only variant: returns the selected file paths so the renderer
  // can drive the import loop and show accurate per-file progress.
  // The renderer then calls `uc-photo-add` once per path.
  ipcMain.handle('uc-photo-pick-files', async () => {
    const win = getMainWindow();
    const opts: Electron.OpenDialogOptions = {
      title: 'Add Persona Photos',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'tiff'] },
      ],
    };
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths?.length) return [];
    return result.filePaths.map(fp => ({
      path: fp,
      name: fp.split(/[\\/]/).pop() || fp,
    }));
  });
}

// Re-export so other main-process modules can call helpers directly.
export { personas, chats, bvs, bus, evlog, photos };
