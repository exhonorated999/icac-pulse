/**
 * UC Personas — CRUD against uc_personas table.
 * Each persona maps to a unique session partition for UC BrowserViews:
 *   persist:uc_<personaId>
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDatabase, saveDatabase, getUserDataPath } from '../database';

export interface Persona {
  id: number;
  display_name: string;
  real_age: number | null;
  displayed_age: number | null;
  gender: string | null;
  hometown: string | null;
  bio: string | null;
  backstory: string | null;
  avatar_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CreatePersonaInput {
  display_name: string;
  real_age?: number;
  displayed_age?: number;
  gender?: string;
  hometown?: string;
  bio?: string;
  backstory?: string;
  avatar_path?: string;     // absolute path on disk — will be copied into avatars dir
  notes?: string;
}

export type UpdatePersonaInput = Partial<Omit<CreatePersonaInput, 'avatar_path'>> & {
  avatar_path?: string | null;
};

/** Where persona avatars live on disk. */
export function getAvatarsDir(): string {
  const dir = path.join(getUserDataPath(), 'uc_avatars');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Returns the session partition string for a persona. */
export function partitionForPersona(personaId: number): string {
  return `persist:uc_${personaId}`;
}

/** Copy a user-supplied avatar into the avatars dir; returns the stored path. */
function ingestAvatar(srcPath: string, personaId: number): string {
  if (!fs.existsSync(srcPath)) return srcPath;
  const ext = path.extname(srcPath).toLowerCase() || '.png';
  const dest = path.join(getAvatarsDir(), `persona_${personaId}_${Date.now()}${ext}`);
  fs.copyFileSync(srcPath, dest);
  return dest;
}

export function listPersonas(includeArchived = false): Persona[] {
  const db = getDatabase();
  const sql = includeArchived
    ? 'SELECT * FROM uc_personas ORDER BY archived_at IS NULL DESC, display_name ASC'
    : 'SELECT * FROM uc_personas WHERE archived_at IS NULL ORDER BY display_name ASC';
  return (db.prepare(sql).all() as Persona[]) || [];
}

export function getPersona(id: number): Persona | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM uc_personas WHERE id = ?').get(id) as Persona | undefined;
  return row || null;
}

export function createPersona(input: CreatePersonaInput): Persona {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO uc_personas
       (display_name, real_age, displayed_age, gender, hometown, bio, backstory, avatar_path, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.display_name,
    input.real_age ?? null,
    input.displayed_age ?? null,
    input.gender ?? null,
    input.hometown ?? null,
    input.bio ?? null,
    input.backstory ?? null,
    null,                       // avatar copied below once we have the id
    input.notes ?? null,
  );
  // sql.js lastInsertRowid returns 0 — workaround: query MAX(id).
  // Single-process Electron app, no concurrent inserts on this table.
  const row = db.prepare('SELECT id FROM uc_personas ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;
  const id = row?.id ?? 0;
  if (!id) throw new Error('createPersona: failed to resolve new persona id');
  if (input.avatar_path) {
    const stored = ingestAvatar(input.avatar_path, id);
    db.run('UPDATE uc_personas SET avatar_path = ? WHERE id = ?', [stored, id]);
  }
  saveDatabase();
  const persona = getPersona(id);
  if (!persona) throw new Error('createPersona: failed to read back row');
  return persona;
}

export function updatePersona(id: number, input: UpdatePersonaInput): Persona {
  const db = getDatabase();
  const existing = getPersona(id);
  if (!existing) throw new Error(`updatePersona: persona ${id} not found`);

  const fields: string[] = [];
  const values: any[] = [];
  const setKey = (k: string, v: any) => { fields.push(`${k} = ?`); values.push(v); };

  if (input.display_name !== undefined) setKey('display_name', input.display_name);
  if (input.real_age !== undefined) setKey('real_age', input.real_age);
  if (input.displayed_age !== undefined) setKey('displayed_age', input.displayed_age);
  if (input.gender !== undefined) setKey('gender', input.gender);
  if (input.hometown !== undefined) setKey('hometown', input.hometown);
  if (input.bio !== undefined) setKey('bio', input.bio);
  if (input.backstory !== undefined) setKey('backstory', input.backstory);
  if (input.notes !== undefined) setKey('notes', input.notes);
  if (input.avatar_path !== undefined) {
    if (input.avatar_path && input.avatar_path !== existing.avatar_path) {
      setKey('avatar_path', ingestAvatar(input.avatar_path, id));
    } else if (input.avatar_path === null) {
      setKey('avatar_path', null);
    }
  }

  if (fields.length === 0) return existing;
  setKey('updated_at', new Date().toISOString());
  values.push(id);
  db.run(`UPDATE uc_personas SET ${fields.join(', ')} WHERE id = ?`, values);
  saveDatabase();
  return getPersona(id)!;
}

/** Soft-archive (never delete; chain of custody requires permanence). */
export function archivePersona(id: number): void {
  const db = getDatabase();
  db.run('UPDATE uc_personas SET archived_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  saveDatabase();
}

export function unarchivePersona(id: number): void {
  const db = getDatabase();
  db.run('UPDATE uc_personas SET archived_at = NULL WHERE id = ?', [id]);
  saveDatabase();
}
