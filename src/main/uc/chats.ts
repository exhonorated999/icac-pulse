/**
 * UC Chats — CRUD against uc_chats + uc_chat_case_links + uc_chat_events.
 */

import { getDatabase, saveDatabase } from '../database';

export type ChatPlatform =
  | 'discord'
  | 'telegram'
  | 'instagram'
  | 'whatsapp'
  | 'snapchat'
  | 'messenger'
  | 'meetme'
  | 'sniffies'
  | 'custom';

export type ChatStatus = 'active' | 'archived';

export type ChatEventKind =
  | 'incoming'
  | 'outgoing'
  | 'capture'
  | 'alert'
  | 'panic'
  | 'link'
  | 'note'
  | 'route'
  | 'photo_used';

export interface Chat {
  id: number;
  persona_id: number;
  platform: ChatPlatform;
  platform_url: string | null;
  suspect_handle: string | null;
  suspect_display_name: string | null;
  status: ChatStatus;
  primary_case_id: number | null;
  unread_count: number;
  last_activity_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ChatWithPersona extends Chat {
  persona_name: string;
  persona_avatar: string | null;
}

export interface CreateChatInput {
  persona_id: number;
  platform: ChatPlatform;
  platform_url?: string;
  suspect_handle?: string;
  suspect_display_name?: string;
  primary_case_id?: number;
  notes?: string;
}

export type UpdateChatInput = Partial<Omit<CreateChatInput, 'persona_id'>>;

export interface ChatCaseLink {
  chat_id: number;
  case_id: number;
  role: 'primary' | 'secondary';
  linked_at: string;
}

export interface ChatEvent {
  id: number;
  chat_id: number;
  ts: string;
  kind: ChatEventKind;
  payload_json: string | null;
}

/** Default landing URL for each supported platform. */
export const PLATFORM_URLS: Record<Exclude<ChatPlatform, 'custom'>, string> = {
  discord:   'https://discord.com/app',
  telegram:  'https://web.telegram.org/a/',
  instagram: 'https://www.instagram.com/direct/inbox/',
  whatsapp:  'https://web.whatsapp.com/',
  snapchat:  'https://web.snapchat.com/',
  messenger: 'https://www.messenger.com/',
  meetme:    'https://app.meetme.com/get-started/email/login',
  sniffies:  'https://sniffies.com/',
};

/** Display label for each platform. */
export const PLATFORM_LABELS: Record<ChatPlatform, string> = {
  discord:   'Discord',
  telegram:  'Telegram',
  instagram: 'Instagram',
  whatsapp:  'WhatsApp',
  snapchat:  'Snapchat',
  messenger: 'Messenger',
  meetme:    'MeetMe',
  sniffies:  'Sniffies',
  custom:    'Custom',
};

export function listChats(opts: { includeArchived?: boolean; personaId?: number } = {}): ChatWithPersona[] {
  const db = getDatabase();
  const where: string[] = [];
  const params: any[] = [];
  if (!opts.includeArchived) where.push("c.status = 'active'");
  if (opts.personaId != null) { where.push('c.persona_id = ?'); params.push(opts.personaId); }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT c.*,
            p.display_name AS persona_name,
            p.avatar_path  AS persona_avatar
       FROM uc_chats c
       JOIN uc_personas p ON p.id = c.persona_id
       ${whereSql}
       ORDER BY COALESCE(c.last_activity_at, c.created_at) DESC`,
  ).all(...params) as ChatWithPersona[];
  return rows || [];
}

export function getChat(id: number): Chat | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM uc_chats WHERE id = ?').get(id) as Chat | undefined;
  return row || null;
}

export function createChat(input: CreateChatInput): Chat {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO uc_chats
       (persona_id, platform, platform_url, suspect_handle, suspect_display_name, primary_case_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.persona_id,
    input.platform,
    input.platform_url ?? null,
    input.suspect_handle ?? null,
    input.suspect_display_name ?? null,
    input.primary_case_id ?? null,
    input.notes ?? null,
  );
  saveDatabase();
  // sql.js lastInsertRowid returns 0 — query MAX(id) instead.
  const row = db.prepare('SELECT id FROM uc_chats ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;
  const id = row?.id ?? 0;
  if (!id) throw new Error('createChat: failed to resolve new chat id');
  const chat = getChat(id);
  if (!chat) throw new Error('createChat: failed to read back row');
  // Primary case binding also goes into links table for consistency.
  if (input.primary_case_id) {
    linkCase(id, input.primary_case_id, 'primary');
  }
  return chat;
}

export function updateChat(id: number, input: UpdateChatInput): Chat {
  const db = getDatabase();
  const existing = getChat(id);
  if (!existing) throw new Error(`updateChat: chat ${id} not found`);

  const fields: string[] = [];
  const values: any[] = [];
  const setKey = (k: string, v: any) => { fields.push(`${k} = ?`); values.push(v); };
  if (input.platform !== undefined) setKey('platform', input.platform);
  if (input.platform_url !== undefined) setKey('platform_url', input.platform_url);
  if (input.suspect_handle !== undefined) setKey('suspect_handle', input.suspect_handle);
  if (input.suspect_display_name !== undefined) setKey('suspect_display_name', input.suspect_display_name);
  if (input.primary_case_id !== undefined) setKey('primary_case_id', input.primary_case_id);
  if (input.notes !== undefined) setKey('notes', input.notes);
  if (fields.length === 0) return existing;
  setKey('updated_at', new Date().toISOString());
  values.push(id);
  db.run(`UPDATE uc_chats SET ${fields.join(', ')} WHERE id = ?`, values);
  saveDatabase();
  return getChat(id)!;
}

export function archiveChat(id: number): void {
  const db = getDatabase();
  db.run("UPDATE uc_chats SET status = 'archived', archived_at = ? WHERE id = ?", [new Date().toISOString(), id]);
  saveDatabase();
}

export function unarchiveChat(id: number): void {
  const db = getDatabase();
  db.run("UPDATE uc_chats SET status = 'active', archived_at = NULL WHERE id = ?", [id]);
  saveDatabase();
}

export function incrementUnread(chatId: number, delta = 1): void {
  const db = getDatabase();
  db.run(
    'UPDATE uc_chats SET unread_count = unread_count + ?, last_activity_at = ? WHERE id = ?',
    [delta, new Date().toISOString(), chatId],
  );
  saveDatabase();
}

export function markRead(chatId: number): void {
  const db = getDatabase();
  db.run('UPDATE uc_chats SET unread_count = 0 WHERE id = ?', [chatId]);
  saveDatabase();
}

export function bumpActivity(chatId: number): void {
  const db = getDatabase();
  db.run('UPDATE uc_chats SET last_activity_at = ? WHERE id = ?', [new Date().toISOString(), chatId]);
  saveDatabase();
}

/* ── Case bindings ─────────────────────────────────────── */

export function listCaseLinks(chatId: number): ChatCaseLink[] {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM uc_chat_case_links WHERE chat_id = ?').all(chatId) as ChatCaseLink[]) || [];
}

export function linkCase(chatId: number, caseId: number, role: 'primary' | 'secondary' = 'secondary'): void {
  const db = getDatabase();
  // If marking primary, demote any existing primary on this chat.
  if (role === 'primary') {
    db.run("UPDATE uc_chat_case_links SET role = 'secondary' WHERE chat_id = ? AND role = 'primary'", [chatId]);
    db.run('UPDATE uc_chats SET primary_case_id = ? WHERE id = ?', [caseId, chatId]);
  }
  db.run(
    `INSERT INTO uc_chat_case_links (chat_id, case_id, role)
     VALUES (?, ?, ?)
     ON CONFLICT(chat_id, case_id) DO UPDATE SET role = excluded.role`,
    [chatId, caseId, role],
  );
  saveDatabase();
}

export function unlinkCase(chatId: number, caseId: number): void {
  const db = getDatabase();
  db.run('DELETE FROM uc_chat_case_links WHERE chat_id = ? AND case_id = ?', [chatId, caseId]);
  // If we just removed the primary, clear the column too.
  const existing = getChat(chatId);
  if (existing?.primary_case_id === caseId) {
    db.run('UPDATE uc_chats SET primary_case_id = NULL WHERE id = ?', [chatId]);
  }
  saveDatabase();
}

/* ── Events ─────────────────────────────────────────────── */

export function appendEvent(chatId: number, kind: ChatEventKind, payload?: Record<string, any>): ChatEvent {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO uc_chat_events (chat_id, kind, payload_json) VALUES (?, ?, ?)',
  ).run(chatId, kind, payload ? JSON.stringify(payload) : null);
  saveDatabase();
  // sql.js lastInsertRowid returns 0 — query MAX(id) for this chat instead.
  const row = db.prepare('SELECT id FROM uc_chat_events WHERE chat_id = ? ORDER BY id DESC LIMIT 1').get(chatId) as { id: number } | undefined;
  const id = row?.id ?? 0;
  return db.prepare('SELECT * FROM uc_chat_events WHERE id = ?').get(id) as ChatEvent;
}

export function listEvents(chatId: number, limit = 500): ChatEvent[] {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM uc_chat_events WHERE chat_id = ? ORDER BY ts DESC LIMIT ?').all(chatId, limit) as ChatEvent[]) || [];
}
