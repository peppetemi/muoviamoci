import { store, syncEnabled, setSpace, sync, createSpace, fetchSpace, updateSpace, pendingCount, status } from './store.js';

/* ================= Config ================= */

// Activities with an amount open a counter sheet; the others are one tap.
const ACTS = {
  swim:    { label: 'Nuoto',        emoji: '🏊', field: 'vasche', unit: 'vasche', step: 1, chips: [10, 20, 30, 40, 50, 60], def: 20, max: 999, hint: 'Tocca e conta le vasche' },
  volley:  { label: 'Beach volley', emoji: '🏐' },
  stretch: { label: 'Stretching',   emoji: '🧘', field: 'minuti', unit: 'minuti', step: 5, chips: [5, 10, 15, 20, 30, 45], def: 15, max: 600, hint: 'Tocca e segna i minuti' },
  walk:    { label: 'Camminata',    emoji: '🚶', field: 'minuti', unit: 'minuti', step: 5, chips: [15, 20, 30, 45, 60, 90], def: 30, max: 600, hint: 'Tocca e segna i minuti' },
};
const ORDER = ['swim', 'volley', 'stretch', 'walk'];
const PEOPLE = ['a', 'b'];

const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const WD_LONG = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const CHEERS = {
  swim: (v) => [`${v} vasche, che nuotata! 🌊`, `Splash! ${v} vasche in cassaforte 💧`, `${v} vasche: sei un pesce 🐟`],
  volley: () => ['Schiacciata! 🏐', 'Sabbia, sole e sudore ☀️', 'Punto, set, partita! 🏆'],
  stretch: (n) => [`${fmtMin(n)} di allungamenti 🌿`, `Corpo sciolto, mente leggera · ${fmtMin(n)} 🧘`, `${fmtMin(n)} zen ✨`],
  walk: (n) => [`${fmtMin(n)} a passo svelto 🚶`, `Un passo dopo l’altro: ${fmtMin(n)} 👟`, `${fmtMin(n)} all’aria aperta 🌳`],
};

// metric = a key of summary(); unlocked when summary()[metric] >= target.
const B = (id, group, emoji, title, desc, metric, target) => ({ id, group, emoji, title, desc, metric, target });
const BADGES = [
  B('first',     'insieme', '🌱', 'Primo passo',        'La prima attività',               'total',        1),
  B('together',  'insieme', '💞', 'Insieme',            'Entrambi attivi in un giorno',    'togetherDays', 1),
  B('team10',    'insieme', '🤝', 'Squadra',            '10 giorni attivi insieme',        'togetherDays', 10),
  B('team30',    'insieme', '💑', 'Coppia d’acciaio',   '30 giorni attivi insieme',        'togetherDays', 30),
  B('tris',      'insieme', '🎯', 'Tris',               '3 attività diverse in un giorno', 'trisDays',     1),
  B('poker',     'insieme', '🃏', 'Poker',              'Tutte e 4 in un giorno',          'pokerDays',    1),
  B('streak3',   'serie',   '🔥', 'Tre di fila',        '3 giorni di fila insieme',            'best',         3),
  B('streak7',   'serie',   '⚡', 'Settimana piena',    '7 giorni di fila insieme',            'best',         7),
  B('streak14',  'serie',   '🌟', 'Due settimane',      '14 giorni di fila insieme',           'best',         14),
  B('streak30',  'serie',   '👑', 'Inarrestabili',      '30 giorni di fila insieme',           'best',         30),
  B('streak100', 'serie',   '💎', 'Leggendari',         '100 giorni di fila insieme',          'best',         100),
  B('v100',      'swim',    '🐟', 'Pesciolino',         '100 vasche',                      'vasche',       100),
  B('v500',      'swim',    '🐬', 'Delfino',            '500 vasche',                      'vasche',       500),
  B('v1000',     'swim',    '🦈', 'Squalo',             '1.000 vasche',                    'vasche',       1000),
  B('v5000',     'swim',    '🐋', 'Balena',             '5.000 vasche',                    'vasche',       5000),
  B('stretch10', 'stretch', '🌿', 'Flessibili',         '10 sessioni di stretching',       'stretch',      10),
  B('smin60',    'stretch', '🧘', 'Ora zen',            '1 ora di stretching',             'stretchMin',   60),
  B('smin300',   'stretch', '🪷', 'Fiore di loto',      '5 ore di stretching',             'stretchMin',   300),
  B('smin1000',  'stretch', '🤸', 'Elastici',           '1.000 minuti di stretching',      'stretchMin',   1000),
  B('walk1',     'walk',    '👟', 'Si parte',           'La prima camminata',              'walk',         1),
  B('wmin300',   'walk',    '🥾', 'Esploratori',        '5 ore di camminata',              'walkMin',      300),
  B('wmin1200',  'walk',    '🗺️', 'Giramondo',          '20 ore di camminata',             'walkMin',      1200),
  B('wmin3000',  'walk',    '🏔️', 'Pellegrini',         '50 ore di camminata',             'walkMin',      3000),
  B('volley10',  'volley',  '🏖️', 'Re della spiaggia',  '10 partite di beach volley',      'volley',       10),
  B('volley50',  'volley',  '🏆', 'Campioni',           '50 partite di beach volley',      'volley',       50),
];
const GROUPS = [['insieme', 'Insieme'], ['serie', 'Serie'], ['swim', 'Nuoto'], ['stretch', 'Stretching'], ['walk', 'Camminata'], ['volley', 'Beach volley']];

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
  range: 'month', // Progressi stats: 'month' (calendar month) | 'all'
  weekMonday: null, // week shown in "Questa settimana" (its Monday); null = current week
  weekAnim: null,   // 'next' | 'prev': slide direction for the next render
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
const clamp = (n, max = 999) => Math.max(0, Math.min(max, n));
const pool = () => state.settings.pool || 25;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function fmtDist(m) {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} km`;
}
function fmtMin(n) {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60), r = n % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// The logged amount of an entry (vasche or minuti), or null for one-tap activities / old entries.
const amountOf = (e) => (ACTS[e.activity].field ? e[ACTS[e.activity].field] ?? null : null);
// Long form for cards: "40 vasche · 1 km", "1 h 15 min"
function amountLong(act, n) {
  if (act === 'swim') return `${n} vasche · ${fmtDist(n * pool())}`;
  return fmtMin(n);
}
// Totals: "210 vasche", "2 h 30 min"
const amountTotal = (act, n) => (act === 'swim' ? `${n} vasche` : fmtMin(n));

// Two rows of activity dots: first person on top, second below (faint dot = nothing that day).
function dayDots(date) {
  return `<span class="dots2">${PEOPLE.map((p) => {
    const acts = actsOn(date, p);
    return `<span class="dots">${acts.length ? acts.map((a) => `<i class="dot ${a}"></i>`).join('') : '<i class="dot"></i>'}</span>`;
  }).join('')}</span>`;
}

const entryId = (date, person, act) => `${date}_${person}_${act}`;
const findEntry = (date, person, act) => state.entries.find((e) => e.id === entryId(date, person, act));
const entriesOn = (date) => state.entries.filter((e) => e.date === date);
const actsOn = (date, person) => ORDER.filter((a) => entriesOn(date).some((e) => e.activity === a && (!person || e.person === person)));

function lastAmount(person, act) {
  const list = state.entries.filter((e) => e.activity === act && e.person === person && amountOf(e)).sort((a, b) => b.date.localeCompare(a.date));
  return list[0] ? amountOf(list[0]) : null;
}

// streaks('a') / streaks('b'): days that person moved. streaks(): shared, days you BOTH moved.
function activeDays(person) {
  const by = (p) => new Set(state.entries.filter((e) => e.person === p).map((e) => e.date));
  if (person) return by(person);
  const [a, b] = PEOPLE.map(by);
  return new Set([...a].filter((d) => b.has(d)));
}

function streaks(person) {
  const days = activeDays(person);
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
  const s = { total: state.entries.length, vasche: 0, stretchMin: 0, walkMin: 0, swim: 0, volley: 0, stretch: 0, walk: 0, togetherDays: 0, trisDays: 0, pokerDays: 0 };
  const byDay = {};
  for (const e of state.entries) {
    s[e.activity]++;
    if (e.activity === 'swim') s.vasche += e.vasche || 0;
    if (e.activity === 'stretch') s.stretchMin += e.minuti || 0;
    if (e.activity === 'walk') s.walkMin += e.minuti || 0;
    const d = (byDay[e.date] ||= { people: new Set(), acts: new Set() });
    d.people.add(e.person);
    d.acts.add(e.activity);
  }
  for (const d of Object.values(byDay)) {
    if (d.people.size === 2) s.togetherDays++;
    if (d.acts.size >= 3) s.trisDays++;
    if (d.acts.size === ORDER.length) s.pokerDays++;
  }
  s.best = streaks().best;
  return s;
}
const unlockedIds = () => { const s = summary(); return new Set(BADGES.filter((b) => s[b.metric] >= b.target).map((b) => b.id)); };

// "310/500", "3/5 h", "45/60 min", "4/7 giorni"
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function badgeProgress(b, s) {
  const cur = Math.min(s[b.metric], b.target);
  if (b.metric.endsWith('Min')) {
    return b.target >= 120 && b.target % 60 === 0
      ? `${Math.floor(cur / 60)}/${b.target / 60} h`
      : `${thousands(cur)}/${thousands(b.target)} min`;
  }
  if (b.metric === 'best') return `${cur}/${b.target} giorni`;
  return `${thousands(cur)}/${thousands(b.target)}`;
}

/* ================= Icons ================= */

const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="4"/><path d="M8 2.5v4M16 2.5v4M3.5 9.5h17"/><path d="M8.5 14.5l2.2 2.2 4.8-4.7"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.6 13.8L7 22l5-3 5 3-1.6-8.2"/><path d="M12 6.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.6l2-.3z" fill="currentColor" stroke-width="1"/></svg>',
};

const TABS = [['oggi', 'Oggi', 'today'], ['progressi', 'Progressi', 'chart'], ['traguardi', 'Traguardi', 'medal']];

/* ================= Render ================= */

const $app = document.getElementById('app');

const needsOnboarding = () => !state.settings || (syncEnabled && !state.settings.space);

function render() {
  if (needsOnboarding()) {
    if (!$app.querySelector('.onboard')) renderOnboarding(state.joinCode ? 'join' : 'start');
    return;
  }
  // The shell (scroll area + bottom bar) is built once; later renders only swap
  // the content, so the bar never moves and the scroll position is kept.
  let screen = document.getElementById('screen');
  if (!screen) {
    $app.innerHTML = `
      <main class="screen" id="screen"></main>
      <nav class="nav"><div class="nav-inner">
        ${TABS.map(([id, label, icon]) => `<button data-action="tab" data-tab="${id}">${ICON[icon]}<span>${label}</span></button>`).join('')}
      </div></nav>`;
    screen = document.getElementById('screen');
  }
  const enter = screen.dataset.tab !== state.tab;
  screen.dataset.tab = state.tab;
  const view = { oggi: viewToday, progressi: viewProgress, traguardi: viewBadges }[state.tab];
  screen.innerHTML = `<div class="view${enter ? ' enter' : ''}">${view()}</div>`;
  if (enter) screen.scrollTop = 0;
  $app.querySelectorAll('.nav [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Buonanotte';
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function header(eyebrow, title) {
  return `<header class="top">
    <div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>
    <button class="icon-btn" data-action="settings" aria-label="Impostazioni">${ICON.gear}</button>
  </header>`;
}

function streakBanner() {
  const st = streaks();
  const missing = PEOPLE.filter((p) => !actsOn(state.today, p).length);
  const nudge = missing.length === 2 ? 'entrambi' : missing.length ? esc(name(missing[0])) : '';
  const giorni = (n) => `${n} ${n === 1 ? 'giorno' : 'giorni'}`;
  let title, sub, cold = false;
  if (st.cur === 0) {
    title = 'Nuova serie insieme';
    sub = missing.length === 2 ? 'Muovetevi entrambi oggi per accendere la fiamma' : `Manca ${nudge} per accendere la fiamma`;
    cold = true;
  } else if (!st.today) {
    title = `${giorni(st.cur)} di fila insieme`;
    sub = missing.length === 2 ? 'Muovetevi entrambi oggi per non spezzare la serie!' : `Manca ${nudge} per tenere viva la serie!`;
  } else {
    title = `${giorni(st.cur)} di fila insieme`;
    sub = st.cur >= st.best && st.cur > 1 ? 'Nuovo record di coppia! 🏆' : `Record: ${giorni(st.best)}`;
  }
  const mine = PEOPLE.map((p) => `<span><i class="avatar xs ${p}">${initial(p)}</i>🔥 ${streaks(p).cur}</span>`).join('');
  return `<section class="card streak ${cold ? 'cold' : ''}">
    <div class="flame">🔥</div>
    <div class="streak-txt"><strong>${title}</strong><p>${sub}</p><div class="split">${mine}</div></div>
  </section>`;
}

function viewToday() {
  const me = state.settings.me;
  const week = Array.from({ length: 7 }, (_, i) => addDays(state.today, i - 6));
  const sel = state.date;
  const person = state.person;

  const weekHtml = week.map((k) => {
    const d = parse(k);
    return `<button class="day ${k === sel ? 'sel' : ''} ${k === state.today ? 'today' : ''}" data-action="day" data-date="${k}" aria-label="${longDate(k)}">
      <span class="wd">${WD_SHORT[d.getDay()]}</span><span class="num">${d.getDate()}</span>${dayDots(k)}
    </button>`;
  }).join('');

  const actsHtml = ORDER.map((a) => {
    const e = findEntry(sel, person, a);
    const n = e && amountOf(e);
    let sub = ACTS[a].hint || 'Tocca per registrare';
    if (e) sub = n ? amountLong(a, n) : 'Fatto!';
    return `<button class="act ${a} ${e ? 'done' : ''}" data-action="act" data-act="${a}" id="act-${a}">
      <span class="emo">${ACTS[a].emoji}</span>
      <span class="txt"><h3>${ACTS[a].label}</h3><p>${sub}</p></span>
      <span class="check">${ICON.check}</span>
    </button>`;
  }).join('');

  return `
    ${header(greeting(), `Ciao, ${esc(name(me))}`)}
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
    <section class="acts">${actsHtml}</section>`;
}

// Slim tile: label, shared number, then each person's number inline.
function miniStat(emoji, label, total, perPerson) {
  return `<div class="card mini-stat">
    <span class="ms-label">${emoji} ${label}</span>
    <div class="ms-row"><strong>${total}</strong>
      <span class="ms-split">${PEOPLE.map((p, i) => `<span><i class="avatar xs ${p}">${initial(p)}</i>${perPerson[i]}</span>`).join('')}</span>
    </div>
  </div>`;
}

// Chip for one entry in the week card: "🏊 30 vasche", "🧘 15 min", "🏐 volley".
function weekChip(e) {
  const n = amountOf(e);
  const txt = e.activity === 'volley' ? 'volley' : n ? amountTotal(e.activity, n) : '';
  return `<span class="pill ${e.activity}">${ACTS[e.activity].emoji}${txt ? ` ${txt}` : ''}</span>`;
}

// Monday to Sunday of the current week, one row per day, each person on their own line.
const mondayOf = (key) => addDays(key, -((parse(key).getDay() + 6) % 7));

// Move the week card by n weeks (never past the current week).
function shiftWeek(n) {
  const cur = mondayOf(state.today);
  const next = addDays(state.weekMonday || cur, 7 * n);
  if (next > cur) return;
  state.weekMonday = next === cur ? null : next;
  state.weekAnim = n > 0 ? 'next' : 'prev';
  render();
}

function weekCard() {
  const curMonday = mondayOf(state.today);
  const monday = state.weekMonday || curMonday;
  const isCurrent = monday === curMonday;
  const title = isCurrent ? 'Questa settimana' : monday === addDays(curMonday, -7) ? 'Settimana scorsa' : 'Settimana';
  const anim = state.weekAnim;
  state.weekAnim = null;
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sun = parse(days[6]), mon = parse(monday);
  const range = mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${MONTHS[sun.getMonth()].slice(0, 3)}`
    : `${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0, 3)} – ${sun.getDate()} ${MONTHS[sun.getMonth()].slice(0, 3)}`;

  const rows = days.map((k) => {
    const d = parse(k);
    const future = k > state.today;
    const label = `<span class="wk-day"><b>${WD_SHORT[d.getDay()]}</b><small>${k === state.today ? 'oggi' : d.getDate()}</small></span>`;
    if (future) return `<div class="wk-row future">${label}<div class="wk-lines"><span class="none">—</span></div></div>`;
    const lines = PEOPLE.map((p) => {
      const list = ORDER.map((a) => findEntry(k, p, a)).filter(Boolean);
      const empty = k === state.today ? 'ancora niente' : '—';
      return `<div class="wk-line"><i class="avatar xs ${p}">${initial(p)}</i>${list.length ? list.map(weekChip).join('') : `<span class="none">${empty}</span>`}</div>`;
    }).join('');
    return `<button class="wk-row ${k === state.today ? 'today' : ''}" data-action="cal-day" data-date="${k}" aria-label="${longDate(k)}">${label}<div class="wk-lines">${lines}</div></button>`;
  }).join('');

  // Week totals: one line per person.
  const inWeek = state.entries.filter((e) => e.date >= monday && e.date <= days[6]);
  const totalChips = (list) => ORDER.map((a) => {
    const of = list.filter((e) => e.activity === a);
    if (!of.length) return '';
    if (a === 'volley') return `<span class="pill volley">🏐 ${of.length}</span>`;
    const tot = of.reduce((t, e) => t + (amountOf(e) || 0), 0);
    return `<span class="pill ${a}">${ACTS[a].emoji}${tot ? ` ${amountTotal(a, tot)}` : ` ${of.length}×`}</span>`;
  }).join('') || '<span class="none">—</span>';
  const totalLines = PEOPLE.map((p) => `<div class="wk-line"><i class="avatar xs ${p}">${initial(p)}</i>${totalChips(inWeek.filter((e) => e.person === p))}</div>`).join('');

  return `<section class="card week-card">
    <div class="wk-head">
      <button data-action="week-prev" aria-label="Settimana precedente">‹</button>
      <div class="wk-title"><h3>${title}</h3><small>${range}</small></div>
      <button data-action="week-next" aria-label="Settimana successiva" ${isCurrent ? 'disabled' : ''}>›</button>
    </div>
    ${isCurrent ? '' : '<button class="link wk-back" data-action="week-now">Torna a questa settimana</button>'}
    <div class="wk-body ${anim ? `slide-${anim}` : ''}">
      <div class="wk-rows">${rows}</div>
      <div class="wk-row wk-total"><span class="wk-day"><b>Totale</b></span><div class="wk-lines">${totalLines}</div></div>
    </div>
  </section>`;
}

function viewProgress() {
  const st = streaks();
  const month = state.calMonth;
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysIn = new Date(y, m, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // Monday first
  const thisMonth = state.today.slice(0, 7);

  let cells = ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((w) => `<span class="wd">${w}</span>`).join('');
  cells += '<span></span>'.repeat(offset);
  for (let d = 1; d <= daysIn; d++) {
    const k = `${month}-${String(d).padStart(2, '0')}`;
    const acts = actsOn(k);
    const future = k > state.today;
    const both = PEOPLE.every((p) => actsOn(k, p).length);
    cells += future
      ? `<span class="cal-day future">${d}</span>`
      : `<button class="cal-day ${acts.length ? 'active' : ''} ${both ? 'both' : ''} ${k === state.today ? 'today' : ''}" data-action="cal-day" data-date="${k}" aria-label="${longDate(k)}">${d}${acts.length ? dayDots(k) : ''}</button>`;
  }

  // Stats for the calendar's month, or since the beginning.
  const all = state.range === 'all';
  const scope = all ? state.entries : state.entries.filter((e) => e.date.startsWith(month));
  const pstats = PEOPLE.map((p) => {
    const mine = scope.filter((e) => e.person === p);
    const days = new Set(mine.map((e) => e.date)).size;
    const pills = ORDER.map((a) => {
      const list = mine.filter((e) => e.activity === a);
      if (!list.length) return '';
      const tot = list.reduce((t, e) => t + (amountOf(e) || 0), 0);
      return `<span class="pill ${a}">${ACTS[a].emoji} ${list.length}×${tot ? ` · ${amountTotal(a, tot)}` : ''}</span>`;
    }).join('');
    return `<div class="pstat">
      <div class="pstat-head"><span class="avatar ${p}">${initial(p)}</span>${esc(name(p))}
        <small>${days} ${days === 1 ? 'giorno attivo' : 'giorni attivi'} · 🔥 ${streaks(p).cur}</small></div>
      <div class="pills">${pills || `<span class="pill mute">Nessuna attività ${all ? 'ancora' : 'in questo mese'}</span>`}</div>
    </div>`;
  }).join('');
  const sharedDays = new Set(scope.map((e) => e.date)).size;

  return `
    ${header('Insieme', 'Progressi')}
    <section class="stats">
      ${miniStat('🔥', 'Serie insieme', st.cur, PEOPLE.map((p) => streaks(p).cur))}
      ${miniStat('🏆', 'Record insieme', st.best, PEOPLE.map((p) => streaks(p).best))}
    </section>
    ${weekCard()}
    <section class="card">
      <div class="cal-head">
        <button data-action="cal-prev" aria-label="Mese precedente">‹</button>
        <h3>${MONTHS[m - 1]} ${y}</h3>
        <button data-action="cal-next" aria-label="Mese successivo" ${month >= thisMonth ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal">${cells}</div>
      <div class="legend">${ORDER.map((a) => `<span><i class="dot ${a}"></i>${ACTS[a].label}</span>`).join('')}</div>
      <p class="legend-rows">Riga sopra: ${esc(name('a'))} · riga sotto: ${esc(name('b'))} · <span class="both-key"></span> entrambi</p>
    </section>
    <section class="card">
      <div class="section-title">
        <h3>Statistiche</h3>
        <div class="seg mini" role="tablist" aria-label="Periodo">
          <button class="${all ? '' : 'on'}" data-action="range" data-range="month" role="tab" aria-selected="${!all}">${cap(MONTHS[m - 1])}</button>
          <button class="${all ? 'on' : ''}" data-action="range" data-range="all" role="tab" aria-selected="${all}">Da sempre</button>
        </div>
      </div>
      <p class="range-note">${sharedDays} ${sharedDays === 1 ? 'giorno' : 'giorni'} in movimento ${all ? 'da quando avete iniziato' : `a ${MONTHS[m - 1]}`}</p>
      <div class="pstats">${pstats}</div>
    </section>`;
}

function viewBadges() {
  const s = summary();
  const got = unlockedIds();
  const pct = Math.round((got.size / BADGES.length) * 100);

  // The locked badge you're closest to.
  const next = BADGES.filter((b) => !got.has(b.id))
    .map((b) => ({ b, r: s[b.metric] / b.target }))
    .sort((x, y) => y.r - x.r)[0];

  const card = (b) => {
    const on = got.has(b.id);
    const r = Math.min(1, s[b.metric] / b.target);
    return `<div class="badge ${on ? '' : 'locked'}">
      <span class="b-emo">${b.emoji}</span><strong>${b.title}</strong><small>${b.desc}</small>
      ${on ? '' : `<span class="bar"><i style="width:${Math.round(r * 100)}%"></i></span><small class="prog">${badgeProgress(b, s)}</small>`}
    </div>`;
  };

  const groups = GROUPS.map(([g, label]) => {
    const list = BADGES.filter((b) => b.group === g);
    const n = list.filter((b) => got.has(b.id)).length;
    return `<section class="card">
      <div class="section-title"><h3>${label}</h3><small>${n}/${list.length}</small></div>
      <div class="badges">${list.map(card).join('')}</div>
    </section>`;
  }).join('');

  return `
    ${header('Insieme', 'Traguardi')}
    <section class="card trophy">
      <div class="trophy-top">
        <div><strong>${got.size}<span>/${BADGES.length}</span></strong><p>traguardi sbloccati</p></div>
        <div class="trophy-emo">🏅</div>
      </div>
      <span class="bar big"><i style="width:${pct}%"></i></span>
      ${next ? `<p class="next">Prossimo: <b>${next.b.emoji} ${next.b.title}</b> · ${badgeProgress(next.b, s)}</p>` : '<p class="next">Li avete sbloccati tutti! 👑</p>'}
    </section>
    ${groups}`;
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
  stretch: (e) => `ha fatto ${e.minuti ? `${fmtMin(e.minuti)} di ` : ''}stretching 🧘`,
  walk: (e) => `ha camminato${e.minuti ? ` ${fmtMin(e.minuti)}` : ''} 🚶`,
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
      break;
    case 'day': state.date = el.dataset.date; render(); break;
    case 'today': state.date = state.today; render(); break;
    case 'person': state.person = el.dataset.person; render(); break;
    case 'range': state.range = el.dataset.range; render(); break;
    case 'week-prev': shiftWeek(-1); break;
    case 'week-next': shiftWeek(1); break;
    case 'week-now': state.weekAnim = 'next'; state.weekMonday = null; render(); break;
    case 'act': onActivity(el.dataset.act); break;
    case 'settings': openSettings(); break;
    case 'cal-prev': state.calMonth = shiftMonth(state.calMonth, -1); render(); break;
    case 'cal-next': state.calMonth = shiftMonth(state.calMonth, 1); render(); break;
    case 'cal-day':
      state.date = el.dataset.date;
      state.tab = 'oggi';
      render();
      break;
  }
});

let swipe = null;
document.addEventListener('touchstart', (e) => {
  swipe = e.touches.length === 1 && e.target.closest('.week-card')
    ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (!swipe) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
  shiftWeek(dx < 0 ? 1 : -1); // swipe left = newer week, right = older
}, { passive: true });

function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return ymd(d).slice(0, 7);
}

function onActivity(act) {
  const existing = findEntry(state.date, state.person, act);
  if (ACTS[act].field) return openAmount(act, existing);
  if (existing) return openRemove(act);
  logActivity(act);
}

async function refresh() {
  state.entries = await store.all();
  render();
}

async function logActivity(act, amount = null) {
  const before = unlockedIds();
  const streakBefore = streaks().cur;
  const entry = {
    id: entryId(state.date, state.person, act),
    date: state.date,
    person: state.person,
    activity: act,
    vasche: ACTS[act].field === 'vasche' ? amount : null,
    minuti: ACTS[act].field === 'minuti' ? amount : null,
    updatedAt: new Date().toISOString(),
  };
  await store.upsert(entry);
  await refresh();

  document.getElementById(`act-${act}`)?.classList.add('pop');
  confetti(palette(act), 110);
  navigator.vibrate?.(30);

  const st = streaks();
  const sub = st.cur > streakBefore && st.cur > 1 ? `🔥 ${st.cur} giorni di fila` : `${name(state.person)} · ${dayLabel(state.date)}`;
  toast(pick(CHEERS[act](amount)), sub);

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

// Counter sheet for activities with an amount (vasche for swimming, minuti for stretching/camminata).
function openAmount(act, existing) {
  const cfg = ACTS[act];
  const start = (existing && amountOf(existing)) ?? lastAmount(state.person, act) ?? cfg.def;
  const less = cfg.unit === 'vasche' ? 'Una vasca in meno' : `${cfg.step} minuti in meno`;
  const more = cfg.unit === 'vasche' ? 'Una vasca in più' : `${cfg.step} minuti in più`;
  openSheet(`
    ${sheetHead(act)}
    <div class="counter ${act}">
      <button class="round" data-step="-${cfg.step}" aria-label="${less}">−</button>
      <div class="count"><input id="amount" type="number" inputmode="numeric" min="1" max="${cfg.max}" value="${start}" aria-label="${cfg.unit}"><span>${cfg.unit}</span></div>
      <button class="round" data-step="${cfg.step}" aria-label="${more}">+</button>
    </div>
    <p class="meters ${act}" id="detail"></p>
    <div class="chips ${act}">${cfg.chips.map((n) => `<button class="chip" data-set="${n}">${n}</button>`).join('')}</div>
    <div class="sheet-actions">
      ${existing ? '<button class="btn danger small" data-remove>Rimuovi</button>' : ''}
      <button class="btn primary ${act}" data-save>${existing ? 'Aggiorna' : 'Registra'}</button>
    </div>`, (sheet) => {
    const input = sheet.querySelector('#amount');
    const detail = sheet.querySelector('#detail');
    const val = () => clamp(parseInt(input.value, 10) || 0, cfg.max);
    const update = () => {
      const n = val();
      if (act === 'swim') detail.textContent = n ? `≈ ${fmtDist(n * pool())} in vasca da ${pool()} m` : '';
      else detail.textContent = n >= 60 ? fmtMin(n) : '';
      sheet.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', Number(c.dataset.set) === n));
    };
    sheet.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      const set = e.target.closest('[data-set]');
      if (step) { input.value = clamp(val() + Number(step.dataset.step), cfg.max); update(); }
      if (set) { input.value = set.dataset.set; update(); }
      if (e.target.closest('[data-save]')) {
        const n = val();
        if (n < 1) { input.focus(); return; }
        closeSheet();
        logActivity(act, n);
      }
      if (e.target.closest('[data-remove]')) { closeSheet(); removeActivity(act); }
    });
    input.addEventListener('input', update);
    input.addEventListener('focus', () => input.select());
    update();
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
  const all = [v('--swim'), v('--volley'), v('--stretch'), v('--walk'), v('--flame'), '#FFD166'];
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

  if ('serviceWorker' in navigator) {
    // When a new version takes over, reload once so the whole app is the new version.
    // (Skip on the very first install, when there was no previous version.)
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded || document.querySelector('.sheet-wrap')) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Home-screen apps are often resumed, not restarted: check for updates on every resume too.
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      })
      .catch(() => {});
  }
}

init();
