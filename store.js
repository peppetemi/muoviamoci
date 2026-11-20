// Storage + sync.
// - The UI always reads/writes the local cache (instant, works offline).
// - Every change also goes into an "outbox"; when online, the outbox is pushed to
//   Supabase and the latest data is pulled back. If Supabase isn't configured
//   (config.js empty), the app simply stays local.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const syncEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

const ENTRIES = 'muoviamoci.entries.v1';
const OUTBOX = 'muoviamoci.outbox.v1';
const SPACE_OP = '__space__';

let space = null;
let flushing = null;
export const status = { lastSync: null, error: null };

/* ---------- local cache ---------- */

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

const readEntries = () => { const l = load(ENTRIES, []); return Array.isArray(l) ? l : []; };
const writeEntries = (list) => save(ENTRIES, list);
const readOutbox = () => load(OUTBOX, {});
const writeOutbox = (o) => save(OUTBOX, o);

// Last write per id wins, so the outbox never grows beyond one op per entry.
function enqueue(key, op) {
  if (!syncEnabled) return;
  const o = readOutbox();
  if (key === SPACE_OP && o[SPACE_OP]) op.patch = { ...o[SPACE_OP].patch, ...op.patch };
  o[key] = op;
  writeOutbox(o);
}
export const pendingCount = () => Object.keys(readOutbox()).length;

/* ---------- Supabase REST ---------- */

function headers(extra = {}) {
  const h = { apikey: SUPABASE_KEY, 'x-space': space || '', 'Content-Type': 'application/json', ...extra };
  if (SUPABASE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SUPABASE_KEY}`; // legacy anon JWT key
  return h;
}

async function api(path, { method = 'GET', body, prefer, spaceOverride } = {}) {
  const h = headers(prefer ? { Prefer: prefer } : {});
  if (spaceOverride) h['x-space'] = spaceOverride;
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const toRow = (e) => ({ space, id: e.id, date: e.date, person: e.person, activity: e.activity, vasche: e.vasche ?? null, minuti: e.minuti ?? null, updated_at: e.updatedAt });
const fromRow = (r) => ({ id: r.id, date: r.date, person: r.person, activity: r.activity, vasche: r.vasche, minuti: r.minuti, updatedAt: r.updated_at });
const q = (v) => encodeURIComponent(v);

/* ---------- spaces (the couple's shared code) ---------- */

export function setSpace(code) { space = code; }

export async function createSpace(code, names, pool) {
  await api('spaces', { method: 'POST', body: { id: code, names, pool }, prefer: 'return=minimal', spaceOverride: code });
}

export async function fetchSpace(code = space) {
  const rows = await api(`spaces?id=eq.${q(code)}&select=id,names,pool`, { spaceOverride: code });
  return rows[0] || null;
}

export function updateSpace(patch) {
  enqueue(SPACE_OP, { op: 'space', patch });
}

/* ---------- public store API (used by app.js) ---------- */

export const store = {
  async all() { return readEntries(); },

  async upsert(entry) {
    const list = readEntries();
    const i = list.findIndex((e) => e.id === entry.id);
    if (i >= 0) list[i] = entry; else list.push(entry);
    writeEntries(list);
    enqueue(entry.id, { op: 'upsert', entry });
    return entry;
  },

  async remove(id) {
    writeEntries(readEntries().filter((e) => e.id !== id));
    enqueue(id, { op: 'delete', id });
  },

  // Backup import. With sync on, imported entries are added/updated for both phones.
  async replaceAll(list) {
    writeEntries(list);
    for (const e of list) enqueue(e.id, { op: 'upsert', entry: e });
  },

  // Upload everything already on this phone (used when creating a new space).
  async queueAllLocal() {
    for (const e of readEntries()) enqueue(e.id, { op: 'upsert', entry: e });
  },

  async clearLocal() {
    writeEntries([]);
    writeOutbox({});
  },
};

/* ---------- sync ---------- */

async function flush() {
  const o = readOutbox();
  const ops = Object.entries(o);
  if (!ops.length) return;

  const upserts = ops.filter(([, v]) => v.op === 'upsert');
  const deletes = ops.filter(([, v]) => v.op === 'delete');
  const spaceOp = o[SPACE_OP];

  if (upserts.length) {
    await api('entries?on_conflict=space,id', {
      method: 'POST',
      body: upserts.map(([, v]) => toRow(v.entry)),
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }
  if (deletes.length) {
    const ids = deletes.map(([k]) => `"${k}"`).join(',');
    await api(`entries?space=eq.${q(space)}&id=in.(${q(ids)})`, { method: 'DELETE', prefer: 'return=minimal' });
  }
  if (spaceOp) {
    await api(`spaces?id=eq.${q(space)}`, { method: 'PATCH', body: spaceOp.patch, prefer: 'return=minimal' });
  }

  // Remove only the ops we sent; anything queued meanwhile stays for next time.
  const now = readOutbox();
  for (const [k, v] of ops) if (JSON.stringify(now[k]) === JSON.stringify(v)) delete now[k];
  writeOutbox(now);
}

async function pull() {
  const [rows, sp] = await Promise.all([
    api(`entries?space=eq.${q(space)}&select=id,date,person,activity,vasche,minuti,updated_at&order=date.asc`),
    fetchSpace(),
  ]);
  // Server is the truth, plus any local changes that haven't been pushed yet.
  const map = new Map(rows.map((r) => [r.id, fromRow(r)]));
  for (const [k, v] of Object.entries(readOutbox())) {
    if (v.op === 'upsert') map.set(k, v.entry);
    if (v.op === 'delete') map.delete(k);
  }
  writeEntries([...map.values()]);
  return { space: sp };
}

// Push pending changes, then pull. Resolves to { space } on success or null if offline/failed.
// A call made while a sync is running triggers one more run right after it.
export function sync() {
  if (!syncEnabled || !space) return Promise.resolve(null);
  if (flushing) return flushing.then(() => sync());
  flushing = (async () => {
    try {
      await flush();
      const res = await pull();
      status.lastSync = new Date();
      status.error = null;
      return res;
    } catch (err) {
      status.error = navigator.onLine === false ? 'offline' : String(err.message || err);
      return null;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
