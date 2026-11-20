import { store, syncEnabled, setSpace, sync, createSpace, fetchSpace, updateSpace, pendingCount, status } from './store.js';

/* ================= Config ================= */

const ACTS = {
  swim:    { label: 'Nuoto',        emoji: '🏊' },
  volley:  { label: 'Beach volley', emoji: '🏐' },
  stretch: { label: 'Stretching',   emoji: '🧘' },
};
const ORDER = ['swim', 'volley', 'stretch'];
const PEOPLE = ['a', 'b'];

const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const WD_LONG = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const CHEERS = {
  swim: (v) => [`${v} vasche, che nuotata! 🌊`, `Splash! ${v} vasche in cassaforte 💧`, `${v} vasche: sei un pesce 🐟`],
  volley: () => ['Schiacciata! 🏐', 'Sabbia, sole e sudore ☀️', 'Punto, set, partita! 🏆'],
  stretch: () => ['Corpo sciolto, mente leggera 🌿', 'Ogni centimetro conta 🧘', 'Respira… fatto ✨'],
};

const BADGES = [
  { id: 'first',      emoji: '🌱', title: 'Primo passo',      desc: 'La prima attività',            test: (s) => s.total >= 1 },
  { id: 'together',   emoji: '💞', title: 'Insieme',          desc: 'Entrambi attivi in un giorno',  test: (s) => s.togetherDays >= 1 },
  { id: 'tris',       emoji: '🎯', title: 'Tris',             desc: 'Tutte e 3 in un giorno',        test: (s) => s.trisDays >= 1 },
  { id: 'streak3',    emoji: '🔥', title: 'Tre di fila',      desc: '3 giorni consecutivi',          test: (s) => s.best >= 3 },
  { id: 'streak7',    emoji: '⚡', title: 'Settimana piena',  desc: '7 giorni consecutivi',          test: (s) => s.best >= 7 },
  { id: 'streak30',   emoji: '👑', title: 'Inarrestabili',    desc: '30 giorni consecutivi',         test: (s) => s.best >= 30 },
  { id: 'v100',       emoji: '🐟', title: 'Pesciolino',       desc: '100 vasche in totale',          test: (s) => s.vasche >= 100 },
  { id: 'v500',       emoji: '🐬', title: 'Delfino',          desc: '500 vasche in totale',          test: (s) => s.vasche >= 500 },
  { id: 'v1000',      emoji: '🦈', title: 'Squalo',           desc: '1.000 vasche in totale',        test: (s) => s.vasche >= 1000 },
  { id: 'volley10',   emoji: '🏖️', title: 'Re della spiaggia', desc: '10 partite di beach volley',   test: (s) => s.volley >= 10 },
  { id: 'stretch10',  emoji: '🌿', title: 'Flessibili',       desc: '10 sessioni di stretching',     test: (s) => s.stretch >= 10 },
  { id: 'team10',     emoji: '🤝', title: 'Squadra',          desc: '10 giorni attivi insieme',      test: (s) => s.togetherDays >= 10 },
];

/* ================= State ================= */

const SETTINGS_KEY = 'muoviamoci.settings.v1';

const state = {
  settings: loadSettings(),
  entries: [],
  today: todayKey(),
  date: todayKey(),
  person: null,
  tab: 'oggi',
  calMonth: todayKey().slice(0, 7),
};

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch { return null; }
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

/* ================= Utils ================= */

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayKey() { return ymd(new Date()); }
function parse(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(key, n) { const d = parse(key); d.setDate(d.getDate() + n); return ymd(d); }

function dayLabel(key) {
  if (key === state.today) return 'oggi';
  if (key === addDays(state.today, -1)) return 'ieri';
  const d = parse(key);
  return `${WD_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
function longDate(key) {
  const d = parse(key);
  return `${WD_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const name = (p) => state.settings.names[p];
const initial = (p) => esc((name(p) || '?').trim().charAt(0).toUpperCase());
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n) => Math.max(0, Math.min(999, n));
const pool = () => state.settings.pool || 25;

function fmtDist(m) {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} km`;
}

const entryId = (date, person, act) => `${date}_${person}_${act}`;
const findEntry = (date, person, act) => state.entries.find((e) => e.id === entryId(date, person, act));
const entriesOn = (date) => state.entries.filter((e) => e.date === date);
const actsOn = (date, person) => ORDER.filter((a) => entriesOn(date).some((e) => e.activity === a && (!person || e.person === person)));

function lastVasche(person) {
  const swims = state.entries.filter((e) => e.activity === 'swim' && e.person === person).sort((a, b) => b.date.localeCompare(a.date));
  return swims[0]?.vasche;
}

function streaks(person) {
  const days = new Set(state.entries.filter((e) => !person || e.person === person).map((e) => e.date));
  let cur = 0;
  let k = state.today;
  if (!days.has(k)) k = addDays(k, -1); // today is still open: yesterday keeps the streak alive
  while (days.has(k)) { cur++; k = addDays(k, -1); }
  let best = 0, run = 0, prev = null;
  for (const d of [...days].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { cur, best, today: days.has(state.today) };
}

function summary() {
  const s = { total: state.entries.length, vasche: 0, swim: 0, volley: 0, stretch: 0, togetherDays: 0, trisDays: 0 };
  const byDay = {};
  for (const e of state.entries) {
    s[e.activity]++;
    if (e.activity === 'swim') s.vasche += e.vasche || 0;
    const d = (byDay[e.date] ||= { people: new Set(), acts: new Set() });
    d.people.add(e.person);
    d.acts.add(e.activity);
  }
  for (const d of Object.values(byDay)) {
    if (d.people.size === 2) s.togetherDays++;
    if (d.acts.size === 3) s.trisDays++;
  }
  s.best = streaks().best;
  return s;
}
const unlockedIds = () => { const s = summary(); return new Set(BADGES.filter((b) => b.test(s)).map((b) => b.id)); };

/* ================= Icons ================= */

const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="4"/><path d="M8 2.5v4M16 2.5v4M3.5 9.5h17"/><path d="M8.5 14.5l2.2 2.2 4.8-4.7"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
};

/* ================= Render ================= */

const $app = document.getElementById('app');

const needsOnboarding = () => !state.settings || (syncEnabled && !state.settings.space);

function render() {
  if (needsOnboarding()) {
    if (!$app.querySelector('.onboard')) renderOnboarding(state.joinCode ? 'join' : 'start');
    return;
  }
  $app.innerHTML = `
    <main class="screen">${state.tab === 'oggi' ? viewToday() : viewProgress()}</main>
    <nav class="nav"><div class="nav-inner">
      <button class="${state.tab === 'oggi' ? 'on' : ''}" data-action="tab" data-tab="oggi">${ICON.today}Oggi</button>
      <button class="${state.tab === 'progressi' ? 'on' : ''}" data-action="tab" data-tab="progressi">${ICON.chart}Progressi</button>
    </div></nav>`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Buonanotte';
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function streakBanner() {
  const st = streaks();
  let title, sub, cold = false;
  if (st.cur === 0) {
    title = 'Nuova serie';
    sub = 'Registrate un’attività per accendere la fiamma';
    cold = true;
  } else if (!st.today) {
    title = `${st.cur} ${st.cur === 1 ? 'giorno' : 'giorni'} di fila`;
    sub = 'Muovetevi oggi per non spezzare la serie!';
  } else {
    title = `${st.cur} ${st.cur === 1 ? 'giorno' : 'giorni'} di fila`;
    sub = st.cur >= st.best && st.cur > 1 ? 'Nuovo record di coppia! 🏆' : `Record: ${st.best} ${st.best === 1 ? 'giorno' : 'giorni'}`;
  }
  return `<section class="card streak ${cold ? 'cold' : ''}">
    <div class="flame">🔥</div>
    <div><strong>${title}</strong><p>${sub}</p></div>
  </section>`;
}

function viewToday() {
  const me = state.settings.me;
  const week = Array.from({ length: 7 }, (_, i) => addDays(state.today, i - 6));
  const sel = state.date;
  const person = state.person;

  const weekHtml = week.map((k) => {
    const d = parse(k);
    const acts = actsOn(k);
    const dots = acts.length ? acts.map((a) => `<i class="dot ${a}"></i>`).join('') : '<i class="dot"></i>';
    return `<button class="day ${k === sel ? 'sel' : ''} ${k === state.today ? 'today' : ''}" data-action="day" data-date="${k}" aria-label="${longDate(k)}">
      <span class="wd">${WD_SHORT[d.getDay()]}</span><span class="num">${d.getDate()}</span><span class="dots">${dots}</span>
    </button>`;
  }).join('');

  const actsHtml = ORDER.map((a) => {
    const e = findEntry(sel, person, a);
    let sub = 'Tocca per registrare';
    if (e) sub = a === 'swim' ? `${e.vasche} vasche · ${fmtDist(e.vasche * pool())}` : 'Fatto!';
    else if (a === 'swim') sub = 'Tocca e conta le vasche';
    return `<button class="act ${a} ${e ? 'done' : ''}" data-action="act" data-act="${a}" id="act-${a}">
      <span class="emo">${ACTS[a].emoji}</span>
      <span class="txt"><h3>${ACTS[a].label}</h3><p>${sub}</p></span>
      <span class="check">${ICON.check}</span>
    </button>`;
  }).join('');

  const isPast = sel < state.today;
  const rows = PEOPLE.map((p) => {
    const list = ORDER.map((a) => findEntry(sel, p, a)).filter(Boolean);
    const pills = list.map((e) => `<span class="pill ${e.activity}">${ACTS[e.activity].emoji}${e.activity === 'swim' ? ` ${e.vasche}` : ''}</span>`).join('');
    return `<div class="row">
      <span class="avatar ${p}">${initial(p)}</span>
      <span class="who">${esc(name(p))}</span>
      ${list.length ? `<span class="pills">${pills}</span>` : `<span class="none">${isPast ? 'Riposo 😴' : 'Ancora niente… 👀'}</span>`}
    </div>`;
  }).join('');
  const both = PEOPLE.every((p) => actsOn(sel, p).length);

  return `
    <header class="top">
      <div><p class="eyebrow">${greeting()}</p><h1>Ciao, ${esc(name(me))}</h1></div>
      <button class="icon-btn" data-action="settings" aria-label="Impostazioni">${ICON.gear}</button>
    </header>
    ${streakBanner()}
    <section class="week">${weekHtml}</section>
    <div class="day-head">
      <h2>${sel === state.today ? `Oggi, ${longDate(sel)}` : longDate(sel)}</h2>
      ${sel !== state.today ? '<button class="link" data-action="today">Torna a oggi</button>' : ''}
    </div>
    <div class="seg" role="tablist" aria-label="Chi ha fatto l’attività">
      ${PEOPLE.map((p) => `<button class="${p === person ? 'on' : ''}" data-action="person" data-person="${p}" role="tab" aria-selected="${p === person}">
        <span class="avatar ${p}">${initial(p)}</span>${esc(name(p))}
      </button>`).join('')}
    </div>
    <section class="acts">${actsHtml}</section>
    <section class="card together">
      <h3>La giornata</h3>
      ${rows}
      ${both ? '<div class="both">💞 Entrambi in movimento!</div>' : ''}
    </section>`;
}

function viewProgress() {
  const st = streaks();
  const s = summary();
  const month = state.calMonth;
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysIn = new Date(y, m, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // Monday first
  const inMonth = state.entries.filter((e) => e.date.startsWith(month));
  const thisMonth = state.today.slice(0, 7);
  const activeDays = new Set(state.entries.filter((e) => e.date.startsWith(thisMonth)).map((e) => e.date)).size;

  let cells = ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((w) => `<span class="wd">${w}</span>`).join('');
  cells += '<span></span>'.repeat(offset);
  for (let d = 1; d <= daysIn; d++) {
    const k = `${month}-${String(d).padStart(2, '0')}`;
    const acts = actsOn(k);
    const future = k > state.today;
    const dots = acts.map((a) => `<i class="dot ${a}"></i>`).join('');
    cells += future
      ? `<span class="cal-day future">${d}</span>`
      : `<button class="cal-day ${acts.length ? 'active' : ''} ${k === state.today ? 'today' : ''}" data-action="cal-day" data-date="${k}" aria-label="${longDate(k)}">${d}<span class="dots">${dots}</span></button>`;
  }

  const pstats = PEOPLE.map((p) => {
    const mine = inMonth.filter((e) => e.person === p);
    const days = new Set(mine.map((e) => e.date)).size;
    const ps = streaks(p);
    const pills = ORDER.map((a) => {
      const list = mine.filter((e) => e.activity === a);
      if (!list.length) return '';
      const extra = a === 'swim' ? ` · ${list.reduce((t, e) => t + (e.vasche || 0), 0)} vasche` : '';
      return `<span class="pill ${a}">${ACTS[a].emoji} ${list.length}×${extra}</span>`;
    }).join('');
    return `<div class="pstat">
      <div class="pstat-head"><span class="avatar ${p}">${initial(p)}</span>${esc(name(p))}
        <small>${days} ${days === 1 ? 'giorno' : 'giorni'} · 🔥 ${ps.cur}</small></div>
      <div class="pills">${pills || '<span class="pill mute">Nessuna attività questo mese</span>'}</div>
    </div>`;
  }).join('');

  const got = unlockedIds();
  const badges = BADGES.map((b) => `<div class="badge ${got.has(b.id) ? '' : 'locked'}">
    <span class="b-emo">${b.emoji}</span><strong>${b.title}</strong><small>${b.desc}</small>
  </div>`).join('');

  return `
    <header class="top"><div><p class="eyebrow">Insieme</p><h1>Progressi</h1></div>
      <button class="icon-btn" data-action="settings" aria-label="Impostazioni">${ICON.gear}</button></header>
    <section class="stats">
      <div class="card stat"><span class="emo">🔥</span><strong>${st.cur}</strong><span>serie attuale</span></div>
      <div class="card stat"><span class="emo">🏆</span><strong>${st.best}</strong><span>record di giorni</span></div>
      <div class="card stat"><span class="emo">🌊</span><strong>${s.vasche}</strong><span>vasche · ${fmtDist(s.vasche * pool())}</span></div>
      <div class="card stat"><span class="emo">📅</span><strong>${activeDays}</strong><span>attivi questo mese</span></div>
    </section>
    <section class="card">
      <div class="cal-head">
        <button data-action="cal-prev" aria-label="Mese precedente">‹</button>
        <h3>${MONTHS[m - 1]} ${y}</h3>
        <button data-action="cal-next" aria-label="Mese successivo" ${month >= thisMonth ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal">${cells}</div>
      <div class="legend">${ORDER.map((a) => `<span><i class="dot ${a}"></i>${ACTS[a].label}</span>`).join('')}</div>
    </section>
    <section class="card">
      <div class="section-title"><h3>Questo mese</h3><small>${MONTHS[m - 1]}</small></div>
      <div class="pstats">${pstats}</div>
    </section>
    <section class="card">
      <div class="section-title"><h3>Traguardi</h3><small>${got.size}/${BADGES.length}</small></div>
      <div class="badges">${badges}</div>
    </section>`;
}

/* ================= Onboarding ================= */

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  const s = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => CODE_CHARS[x % 32]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
function normCode(v) {
  const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 12 ? `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}` : null;
}
const inviteUrl = (code) => `${location.origin}${location.pathname}#join=${code}`;

function busy(btn, on, label) {
  btn.disabled = on;
  btn.style.opacity = on ? 0.6 : 1;
  if (label) btn.textContent = label;
}

// Steps: start → names → who (create)   |   start → join → who (join)
function renderOnboarding(step, data = {}) {
  const prev = state.settings?.names || { a: '', b: '' };

  if (step === 'start' && !syncEnabled) step = 'names';

  if (step === 'start') {
    $app.innerHTML = `<div class="onboard">
      <img class="logo" src="icons/icon.svg" alt="">
      <h1>Muoviamoci</h1>
      <p class="lead">Il vostro diario di movimento, insieme.<br>Nuoto, beach volley, stretching.</p>
      <div class="stack">
        <button class="btn primary" data-go="names">Iniziamo</button>
        <button class="btn" data-go="join">Ho un codice di invito</button>
      </div>
      <p class="hint">Uno dei due crea lo spazio, l’altro entra con il codice.</p>
    </div>`;
    $app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => renderOnboarding(b.dataset.go)));
    return;
  }

  if (step === 'names') {
    $app.innerHTML = `<div class="onboard">
      <img class="logo" src="icons/icon.svg" alt="">
      <h1>Come vi chiamate?</h1>
      <form id="ob">
        <input class="input" name="a" placeholder="Primo nome" value="${esc(prev.a)}" maxlength="20" autocomplete="off" required>
        <input class="input" name="b" placeholder="Secondo nome" value="${esc(prev.b)}" maxlength="20" autocomplete="off" required>
        <button class="btn primary">Continua</button>
      </form>
      ${syncEnabled ? '<button class="link" data-back>Indietro</button>' : ''}
    </div>`;
    $app.querySelector('[data-back]')?.addEventListener('click', () => renderOnboarding('start'));
    $app.querySelector('#ob').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const names = { a: f.get('a').trim(), b: f.get('b').trim() };
      if (!syncEnabled) return renderOnboarding('who', { names });
      const btn = e.target.querySelector('button');
      busy(btn, true, 'Creo il vostro spazio…');
      const code = newCode();
      try {
        await createSpace(code, names, state.settings?.pool || 25);
        renderOnboarding('who', { names, code, pool: state.settings?.pool || 25, created: true });
      } catch {
        busy(btn, false, 'Continua');
        toast('Serve una connessione', 'Riprova quando sei online');
      }
    });
    return;
  }

  if (step === 'join') {
    $app.innerHTML = `<div class="onboard">
      <img class="logo" src="icons/icon.svg" alt="">
      <h1>Entra nello spazio</h1>
      <p class="lead">Inserisci il codice che ti è stato condiviso.</p>
      <form id="oj">
        <input class="input code-input" name="code" placeholder="XXXX-XXXX-XXXX" value="${esc(state.joinCode || '')}" autocapitalize="characters" autocomplete="off" spellcheck="false" required>
        <button class="btn primary">Entra</button>
      </form>
      <button class="link" data-back>Indietro</button>
    </div>`;
    $app.querySelector('[data-back]').addEventListener('click', () => { state.joinCode = null; renderOnboarding('start'); });
    $app.querySelector('#oj').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = normCode(new FormData(e.target).get('code'));
      if (!code) return toast('Codice non valido', 'Sono 12 caratteri, es. K7QM-3XPA-9FDR');
      const btn = e.target.querySelector('button');
      busy(btn, true, 'Cerco…');
      try {
        const sp = await fetchSpace(code);
        if (!sp) throw new Error('not found');
        state.joinCode = null;
        renderOnboarding('who', { names: sp.names, code, pool: sp.pool, created: false });
      } catch (err) {
        busy(btn, false, 'Entra');
        toast(err.message === 'not found' ? 'Codice non trovato' : 'Serve una connessione', err.message === 'not found' ? 'Controlla e riprova' : 'Riprova quando sei online');
      }
    });
    return;
  }

  // step === 'who'
  const { names, code, pool: pl = 25, created } = data;
  $app.innerHTML = `<div class="onboard">
    <h1>Chi usa questo telefono?</h1>
    <div class="who">${PEOPLE.map((p) => `<button data-who="${p}"><span class="avatar lg ${p}">${esc(names[p].charAt(0).toUpperCase())}</span>${esc(names[p])}</button>`).join('')}</div>
    <p class="hint">Potrai sempre registrare anche per l’altra persona.</p>
  </div>`;
  $app.querySelectorAll('[data-who]').forEach((btn) => btn.addEventListener('click', async () => {
    const me = btn.dataset.who;
    if (code && !created) await store.clearLocal(); // joining: the shared space is the source of truth
    state.settings = { names, me, pool: pl, ...(code ? { space: code } : {}) };
    state.person = me;
    saveSettings();
    if (code) {
      setSpace(code);
      if (created) await store.queueAllLocal(); // bring along anything logged before sync
    }
    state.entries = await store.all();
    render();
    confetti(palette(), 90);
    toast(`Ciao ${names[me]}! 👋`, code && !created ? 'Siete connessi 💞' : 'Iniziamo a muoverci');
    await runSync({ quiet: true });
    if (created) setTimeout(openInvite, 900);
  }));
}

/* ================= Sync ================= */

const DID = {
  swim: (e) => `ha nuotato ${e.vasche} vasche 🏊`,
  volley: () => 'ha giocato a beach volley 🏐',
  stretch: () => 'ha fatto stretching 🧘',
};

async function runSync({ quiet = false } = {}) {
  if (!syncEnabled || !state.settings?.space) return;
  const before = new Map(state.entries.map((e) => [e.id, JSON.stringify(e)]));
  const res = await sync();
  if (!res) return;
  const entries = await store.all();
  let changed = entries.length !== before.size || entries.some((e) => before.get(e.id) !== JSON.stringify(e));

  const sp = res.space;
  if (sp && (JSON.stringify(sp.names) !== JSON.stringify(state.settings.names) || sp.pool !== state.settings.pool)) {
    state.settings = { ...state.settings, names: sp.names, pool: sp.pool };
    saveSettings();
    changed = true;
  }

  // A little nudge when the other one logged something today.
  if (!quiet && before.size) {
    const news = entries.filter((e) => !before.has(e.id) && e.person !== state.settings.me && e.date === state.today);
    if (news.length) {
      const e = news[news.length - 1];
      toast(`💞 ${name(e.person)} ${DID[e.activity](e)}`, 'Tocca a te?');
    }
  }

  state.entries = entries;
  if (changed && !needsOnboarding()) render();
}

function openInvite() {
  const s = state.settings;
  const other = PEOPLE.find((p) => p !== s.me);
  openSheet(`
    <div class="invite">
      <p class="eyebrow">Il vostro spazio è pronto</p>
      <h2>Invita ${esc(s.names[other])}</h2>
      <p class="muted">Aprite il link sul suo telefono, oppure inserite il codice con “Ho un codice di invito”.</p>
      <div class="code">${esc(s.space)}</div>
      <div class="sheet-actions">
        <button class="btn" id="copy">Copia codice</button>
        <button class="btn primary" id="share">Condividi link</button>
      </div>
      <p class="hint">Tenete il codice per voi: chi lo ha può vedere e modificare i vostri dati.</p>
    </div>`, (sheet) => {
    const copy = async (text, msg) => {
      try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast('Copia non riuscita', text); }
    };
    sheet.querySelector('#copy').addEventListener('click', () => copy(s.space, 'Codice copiato 📋'));
    sheet.querySelector('#share').addEventListener('click', async () => {
      const url = inviteUrl(s.space);
      if (navigator.share) {
        try { await navigator.share({ title: 'Muoviamoci', text: `Entra nel nostro spazio su Muoviamoci 💪 Codice: ${s.space}`, url }); } catch { /* cancelled */ }
      } else copy(url, 'Link copiato 🔗');
    });
  });
}

function syncLabel() {
  const n = pendingCount();
  if (status.error === 'offline') return `Offline${n ? ` · ${n} ${n === 1 ? 'modifica' : 'modifiche'} in attesa` : ''}`;
  if (status.error) return `Errore di sincronizzazione${n ? ` · ${n} in attesa` : ''}`;
  if (status.lastSync) return `Sincronizzato alle ${status.lastSync.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  return 'Sincronizzazione…';
}

/* ================= Actions ================= */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.closest('.sheet')) return;
  switch (el.dataset.action) {
    case 'tab':
      state.tab = el.dataset.tab;
      render();
      scrollTo(0, 0);
      break;
    case 'day': state.date = el.dataset.date; render(); break;
    case 'today': state.date = state.today; render(); break;
    case 'person': state.person = el.dataset.person; render(); break;
    case 'act': onActivity(el.dataset.act); break;
    case 'settings': openSettings(); break;
    case 'cal-prev': state.calMonth = shiftMonth(state.calMonth, -1); render(); break;
    case 'cal-next': state.calMonth = shiftMonth(state.calMonth, 1); render(); break;
    case 'cal-day':
      state.date = el.dataset.date;
      state.tab = 'oggi';
      render();
      scrollTo(0, 0);
      break;
  }
});

function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return ymd(d).slice(0, 7);
}

function onActivity(act) {
  const existing = findEntry(state.date, state.person, act);
  if (act === 'swim') return openSwim(existing);
  if (existing) return openRemove(act);
  logActivity(act);
}

async function refresh() {
  state.entries = await store.all();
  render();
}

async function logActivity(act, vasche = null) {
  const before = unlockedIds();
  const streakBefore = streaks().cur;
  const entry = {
    id: entryId(state.date, state.person, act),
    date: state.date,
    person: state.person,
    activity: act,
    vasche: act === 'swim' ? vasche : null,
    updatedAt: new Date().toISOString(),
  };
  await store.upsert(entry);
  await refresh();

  document.getElementById(`act-${act}`)?.classList.add('pop');
  confetti(palette(act), 110);
  navigator.vibrate?.(30);

  const st = streaks();
  const sub = st.cur > streakBefore && st.cur > 1 ? `🔥 ${st.cur} giorni di fila` : `${name(state.person)} · ${dayLabel(state.date)}`;
  toast(pick(CHEERS[act](vasche)), sub);

  const fresh = BADGES.filter((b) => !before.has(b.id) && unlockedIds().has(b.id));
  if (fresh.length) setTimeout(() => showUnlock(fresh), 1100);
  runSync({ quiet: true });
}

async function removeActivity(act) {
  await store.remove(entryId(state.date, state.person, act));
  await refresh();
  toast('Rimosso', `${ACTS[act].label} · ${dayLabel(state.date)}`);
  runSync({ quiet: true });
}

/* ================= Sheets ================= */

function openSheet(html, onMount) {
  document.querySelector('.sheet-wrap')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop" data-close></div>
    <div class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div>${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
  onMount?.(wrap.querySelector('.sheet'));
}

function closeSheet() {
  const wrap = document.querySelector('.sheet-wrap');
  if (!wrap) return;
  wrap.classList.remove('open');
  setTimeout(() => wrap.remove(), 280);
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

function sheetHead(act) {
  return `<div class="sheet-head"><span class="emo ${act}">${ACTS[act].emoji}</span>
    <div><h3>${ACTS[act].label}</h3><p>${esc(name(state.person))} · ${dayLabel(state.date)}</p></div></div>`;
}

function openSwim(existing) {
  const start = existing?.vasche ?? lastVasche(state.person) ?? 20;
  openSheet(`
    ${sheetHead('swim')}
    <div class="counter">
      <button class="round" data-step="-1" aria-label="Una vasca in meno">−</button>
      <div class="count"><input id="vasche" type="number" inputmode="numeric" min="1" max="999" value="${start}" aria-label="Vasche"><span>vasche</span></div>
      <button class="round" data-step="1" aria-label="Una vasca in più">+</button>
    </div>
    <p class="meters" id="meters"></p>
    <div class="chips">${[10, 20, 30, 40, 50, 60].map((n) => `<button class="chip" data-set="${n}">${n}</button>`).join('')}</div>
    <div class="sheet-actions">
      ${existing ? '<button class="btn danger small" data-remove>Rimuovi</button>' : ''}
      <button class="btn primary swim" data-save>${existing ? 'Aggiorna' : 'Registra'}</button>
    </div>`, (sheet) => {
    const input = sheet.querySelector('#vasche');
    const meters = sheet.querySelector('#meters');
    const sync = () => {
      const n = clamp(parseInt(input.value, 10) || 0);
      meters.textContent = n ? `≈ ${fmtDist(n * pool())} in vasca da ${pool()} m` : '';
      sheet.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', Number(c.dataset.set) === n));
    };
    sheet.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      const set = e.target.closest('[data-set]');
      if (step) { input.value = clamp((parseInt(input.value, 10) || 0) + Number(step.dataset.step)); sync(); }
      if (set) { input.value = set.dataset.set; sync(); }
      if (e.target.closest('[data-save]')) {
        const n = clamp(parseInt(input.value, 10) || 0);
        if (n < 1) { input.focus(); return; }
        closeSheet();
        logActivity('swim', n);
      }
      if (e.target.closest('[data-remove]')) { closeSheet(); removeActivity('swim'); }
    });
    input.addEventListener('input', sync);
    input.addEventListener('focus', () => input.select());
    sync();
  });
}

function openRemove(act) {
  openSheet(`
    ${sheetHead(act)}
    <p>Già registrato. Vuoi rimuoverlo?</p>
    <div class="sheet-actions">
      <button class="btn" data-close>Tieni</button>
      <button class="btn solid-danger" data-remove>Rimuovi</button>
    </div>`, (sheet) => {
    sheet.querySelector('[data-remove]').addEventListener('click', () => { closeSheet(); removeActivity(act); });
  });
}

function showUnlock(list) {
  confetti(palette(), 180);
  navigator.vibrate?.([30, 60, 30]);
  openSheet(`<div class="unlock">
    <p class="eyebrow">${list.length > 1 ? 'Nuovi traguardi!' : 'Nuovo traguardo!'}</p>
    ${list.map((b) => `<div class="unlock-badge"><span class="b-emo">${b.emoji}</span><h2>${b.title}</h2><p>${b.desc}</p></div>`).join('')}
    <button class="btn primary" data-close>Evviva! 🎉</button>
  </div>`);
}

function openSettings() {
  const s = state.settings;
  openSheet(`
    <h2>Impostazioni</h2>
    <div class="field"><label>Nomi</label>
      <div class="row-2">
        <input class="input" id="sa" value="${esc(s.names.a)}" maxlength="20" aria-label="Primo nome">
        <input class="input" id="sb" value="${esc(s.names.b)}" maxlength="20" aria-label="Secondo nome">
      </div>
    </div>
    <div class="field"><label>Questo telefono è di</label>
      <div class="seg" id="sme">${PEOPLE.map((p) => `<button data-me="${p}" class="${s.me === p ? 'on' : ''}">${esc(s.names[p])}</button>`).join('')}</div>
    </div>
    <div class="field"><label>Lunghezza vasca</label>
      <div class="seg" id="spool">${[25, 50].map((n) => `<button data-pool="${n}" class="${pool() === n ? 'on' : ''}">${n} m</button>`).join('')}</div>
    </div>
    ${s.space ? `<div class="field"><label>Spazio condiviso</label>
      <div class="space-row"><span class="code sm">${esc(s.space)}</span><button class="btn small" id="sinv">Invita</button></div>
      <p class="sync-status" id="sstat">${syncLabel()}</p>
    </div>` : ''}
    <div class="field"><label>Backup</label>
      <div class="row-2">
        <button class="btn small" id="exp">Esporta</button>
        <button class="btn small" id="imp">Importa</button>
      </div>
      <input type="file" id="impfile" accept="application/json,.json" hidden>
    </div>
    <button class="btn primary" id="ssave">Salva</button>`, (sheet) => {
    let me = s.me, pl = pool();
    sheet.querySelector('#sme').addEventListener('click', (e) => {
      const b = e.target.closest('[data-me]'); if (!b) return;
      me = b.dataset.me;
      sheet.querySelectorAll('[data-me]').forEach((x) => x.classList.toggle('on', x === b));
    });
    sheet.querySelector('#spool').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pool]'); if (!b) return;
      pl = Number(b.dataset.pool);
      sheet.querySelectorAll('[data-pool]').forEach((x) => x.classList.toggle('on', x === b));
    });
    sheet.querySelector('#ssave').addEventListener('click', () => {
      const a = sheet.querySelector('#sa').value.trim() || s.names.a;
      const b = sheet.querySelector('#sb').value.trim() || s.names.b;
      const shared = a !== s.names.a || b !== s.names.b || pl !== pool();
      state.settings = { ...s, names: { a, b }, me, pool: pl };
      state.person = me;
      saveSettings();
      closeSheet();
      render();
      if (shared && s.space) { updateSpace({ names: { a, b }, pool: pl }); runSync({ quiet: true }); }
    });
    sheet.querySelector('#sinv')?.addEventListener('click', () => { closeSheet(); setTimeout(openInvite, 300); });
    if (s.space) runSync({ quiet: true }).then(() => { const el = sheet.querySelector('#sstat'); if (el) el.textContent = syncLabel(); });
    sheet.querySelector('#exp').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ settings: state.settings, entries: state.entries }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `muoviamoci-backup-${state.today}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const file = sheet.querySelector('#impfile');
    sheet.querySelector('#imp').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      try {
        const data = JSON.parse(await file.files[0].text());
        if (!Array.isArray(data.entries)) throw new Error('formato');
        const msg = s.space
          ? `Aggiungere ${data.entries.length} attività dal backup al vostro spazio?`
          : `Sostituire i dati attuali con ${data.entries.length} attività dal backup?`;
        if (!confirm(msg)) return;
        await store.replaceAll(data.entries);
        closeSheet();
        await refresh();
        runSync({ quiet: true });
        toast('Backup importato ✅', `${data.entries.length} attività`);
      } catch {
        toast('File non valido', 'Scegli un backup di Muoviamoci');
      }
    });
  });
}

/* ================= Rewards: toast + confetti ================= */

let toastTimer;
function toast(title, sub = '') {
  const t = document.getElementById('toast');
  t.innerHTML = `<strong>${esc(title)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function palette(act) {
  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  const all = [v('--swim'), v('--volley'), v('--stretch'), v('--flame'), '#FFD166'];
  return act ? [v(`--${act}`), v(`--${act}`), '#FFD166', v('--flame')] : all;
}

const canvas = document.getElementById('confetti');
const ctx = canvas.getContext('2d');
let parts = [];
let raf = null;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function confetti(colors, n = 110) {
  if (reduceMotion.matches) return;
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const speed = 9 + Math.random() * 10;
    parts.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * 60,
      y: innerHeight * 0.55,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 7 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: colors[i % colors.length],
      round: Math.random() < 0.35,
      life: 0,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.y < innerHeight + 30 && p.life < 200);
  for (const p of parts) {
    p.life++;
    p.vy += 0.32;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (200 - p.life) / 40);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  raf = parts.length ? requestAnimationFrame(tick) : null;
  if (!raf) ctx.clearRect(0, 0, innerWidth, innerHeight);
}

/* ================= Boot ================= */

async function init() {
  // Invite links look like …/#join=K7QM-3XPA-9FDR
  const m = location.hash.match(/join=([A-Za-z0-9-]+)/);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    if (!state.settings?.space) state.joinCode = normCode(m[1]);
  }

  state.entries = await store.all();
  if (state.settings) state.person = state.settings.me;
  if (state.settings?.space) setSpace(state.settings.space);
  render();
  runSync();

  // If the app is reopened on a new day, move "today" forward; always pull fresh data.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.today !== todayKey()) {
      const wasToday = state.date === state.today;
      state.today = todayKey();
      if (wasToday) state.date = state.today;
      state.calMonth = state.today.slice(0, 7);
      render();
    }
    runSync();
  });
  addEventListener('online', () => runSync());
  setInterval(() => { if (!document.hidden) runSync(); }, 30000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
