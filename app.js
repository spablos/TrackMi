'use strict';
/* TrackMi — מעקב אימונים, תזונה, שתייה, שינה, משקל, תמונות ואתגר ימים.
   כל הנתונים נשמרים על המכשיר: localStorage לנתונים, IndexedDB לתמונות. */

const KEY = 'trackmi.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmt = n => Math.round(n || 0).toLocaleString('he-IL');
const fmt1 = n => (Math.round((n || 0) * 10) / 10).toLocaleString('he-IL', { maximumFractionDigits: 1 });
const liters = ml => (Math.round((ml || 0) / 10) / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 });

/* ---------- תאריכים ---------- */
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const todayKey = () => dkey(new Date());
const isFuture = k => k > todayKey();
const FUTURE_MSG = 'אי אפשר לסמן ליום שעוד לא הגיע';
const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const weekStart = k => addDays(k, -parseKey(k).getDay());
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_S = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const fmtDate = k => { const d = parseKey(k); return `יום ${DAYS[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]}`; };
const fmtShort = k => { const d = parseKey(k); return `${d.getDate()}.${d.getMonth() + 1}`; };
const dayWord = n => (n === 1 ? 'יום' : 'ימים');
const daysText = n => (n === 1 ? 'יום אחד' : n === 2 ? 'יומיים' : `${n} ימים`);

const TYPES = ['כוח', 'ריצה', 'הליכה', 'אירובי', 'פילאטיס / יוגה', 'אחר'];
const SLOTS = ['בוקר', 'ביניים', 'צהריים', 'ערב', 'נשנוש'];
const AUTO = {
  '': 'סימון ידני',
  water: 'אוטומטי: הגעה ליעד המים',
  workout: 'אוטומטי: אימון שסומן כבוצע',
  kcal: 'אוטומטי: אכילה בתוך יעד הקלוריות',
  sleep: 'אוטומטי: הגעה ליעד השינה',
  steps: 'אוטומטי: הגעה ליעד הצעדים',
};

/* ---------- אייקונים ---------- */
const svg = (p, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const I = {
  drop: svg('<path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  scale: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 9.5a5 5 0 0 1 7 0M12 9.5l1.5-2"/>'),
  food: svg('<path d="M3.5 12h17a8.5 8.5 0 0 1-17 0z"/><path d="M9 8.5c0-1.6 1.6-1.9 1.6-3.5M13.5 8.5c0-1.6 1.6-1.9 1.6-3.5"/>'),
  train: svg('<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'),
  steps: svg('<path d="M8.5 3.5c1.9 0 2.8 2 2.6 4.5-.2 2.3-1 3.7-2.6 3.7S6 10.3 5.9 8c-.1-2.5.7-4.5 2.6-4.5zM6.3 14h4.6c.1 2.9-.6 4.6-2.3 4.6s-2.4-1.7-2.3-4.6zM15.5 7.5c1.9 0 2.7 2 2.6 4.5-.1 2.3-1 3.7-2.6 3.7s-2.5-1.4-2.6-3.7c-.1-2.5.7-4.5 2.6-4.5zM13.3 18h4.6c.1 2.9-.6 4.6-2.3 4.6S13.2 20.9 13.3 18z"/>'),
  star: svg('<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>', 'i sm'),
  camera: svg('<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13.2" r="3.3"/>'),
  flag: svg('<path d="M5.5 21V4M5.5 4.5h12l-2.5 4 2.5 4h-12"/>'),
  cup: svg('<path d="M6 4h12l-1.6 15.2a1 1 0 0 1-1 .8H8.6a1 1 0 0 1-1-.8z"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  chevR: svg('<path d="M9 5l7 7-7 7"/>'),
  chevL: svg('<path d="M15 5l-7 7 7 7"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 'i sm'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 'i sm'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', 'i sm'),
};

/* ---------- מצב ושמירה ---------- */
const DEFAULTS = {
  version: 1,
  settings: { kcal: 1800, protein: 110, carbs: 180, fat: 60, waterMl: 2500, cupMl: 250, sleepH: 8, targetWeight: null, stepsGoal: 8000, wakeTime: '07:00', waterEnd: '21:00' },
  days: {},        // 'YYYY-MM-DD' -> { water, sleep, weight }
  workouts: [],    // { id, date, title, type, duration, exercises:[{name,sets,reps,weight}], notes, done }
  templates: [],   // { id, title, type, duration, exercises }
  lifts: [],       // תרגילים { id, name, cat, logs:[{ id, date, w, r }] }
  meals: [],       // { id, date, slot, name, kcal, protein, carbs, fat, eaten }
  favs: [],        // ארוחות מועדפות { id, name, slot, kcal, protein, carbs, fat }
  foods: [],       // ספריית מזונות לבחירה מהירה { name, kcal, protein, carbs, fat }
  challenges: [],  // { id, title, start, length, tasks:[{id,text,auto}], checks:{date:[taskId]}, archived }
};
function merge(d) {
  const s = clone(DEFAULTS);
  if (d && typeof d === 'object') {
    for (const k of Object.keys(DEFAULTS)) if (d[k] !== undefined) s[k] = d[k];
    s.settings = Object.assign({}, DEFAULTS.settings, d.settings || {});
  }
  return s;
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return merge(JSON.parse(raw)); } catch (e) { /* ignore */ }
  return clone(DEFAULTS);
}
let S = load();
/* מעבר מהגרסה עם סטים: כל אימון נשמר כרשומה אחת עם הסט הכבד ביותר */
for (const l of S.lifts || []) {
  l.cat = l.cat || 'אחר';
  l.logs = (l.logs || []).map(g => {
    if (!Array.isArray(g.sets)) return g;
    const top = g.sets.reduce((b, x) => ((x.w || 0) > (b.w || 0) || ((x.w || 0) === (b.w || 0) && (x.r || 0) > (b.r || 0)) ? x : b), { w: 0, r: 0 });
    return { id: g.id, date: g.date, w: top.w || 0, r: top.r || 0 };
  });
  delete l.sets; delete l.reps; delete l.step;
}
let persistAsked = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('השמירה נכשלה. ייתכן שהאחסון בדפדפן מלא או חסום.'); }
  if (!persistAsked && navigator.storage && navigator.storage.persist) { persistAsked = true; navigator.storage.persist().catch(() => {}); }
}

const U = { tab: 'today', date: todayKey(), week: weekStart(todayKey()), lastToday: todayKey() };
try { const t = sessionStorage.getItem('trackmi.tab'); if (t) U.tab = t; } catch (e) { /* ignore */ }

const day = k => S.days[k] || {};
function setDay(k, patch) {
  const d = Object.assign({}, S.days[k], patch);
  for (const f of Object.keys(d)) if (d[f] == null || d[f] === '') delete d[f];
  if (Object.keys(d).length) S.days[k] = d; else delete S.days[k];
  save();
}

/* ---------- חישובים ---------- */
const mealsOn = k => S.meals.filter(m => m.date === k).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
const workoutsOn = k => S.workouts.filter(w => w.date === k);
function sumMeals(list) {
  return list.reduce((t, m) => ({ kcal: t.kcal + (m.kcal || 0), protein: t.protein + (m.protein || 0), carbs: t.carbs + (m.carbs || 0), fat: t.fat + (m.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}
function weights() {
  return Object.entries(S.days).filter(([, d]) => d.weight > 0).map(([k, d]) => ({ k, v: +d.weight })).sort((a, b) => (a.k < b.k ? -1 : 1));
}
const prevWeight = k => weights().filter(p => p.k < k).pop();

const activeCh = () => S.challenges.find(c => !c.archived);
const chEnd = c => addDays(c.start, c.length - 1);
function autoDone(kind, k) {
  const st = S.settings;
  if (kind === 'water') return (day(k).water || 0) >= st.waterMl;
  if (kind === 'sleep') return (day(k).sleep || 0) >= st.sleepH;
  if (kind === 'steps') return (day(k).steps || 0) >= st.stepsGoal;
  if (kind === 'workout') return workoutsOn(k).some(w => w.done);
  if (kind === 'kcal') { const e = mealsOn(k).filter(m => m.eaten); return e.length > 0 && sumMeals(e).kcal <= st.kcal; }
  return false;
}
/* ---------- רצפים ליעדים הכלליים ---------- */
const STREAKS = [
  { kind: 'water', name: 'מים', icon: () => I.drop, color: 'var(--water)' },
  { kind: 'sleep', name: 'שינה', icon: () => I.moon, color: 'var(--sleep)' },
  { kind: 'steps', name: 'צעדים', icon: () => I.steps, color: 'var(--steps)' },
  { kind: 'kcal', name: 'קלוריות', icon: () => I.food, color: 'var(--food)' },
  { kind: 'protein', name: 'חלבון', icon: () => I.food, color: 'var(--food)' },
  { kind: 'workout', name: 'אימון', icon: () => I.train, color: 'var(--train)' },
];
function goalMet(kind, k) {
  if (kind === 'protein') { const e = mealsOn(k).filter(m => m.eaten); return e.length > 0 && sumMeals(e).protein >= S.settings.protein; }
  return autoDone(kind, k);
}
/* רצף נוכחי: ימים רצופים שעמדו ביעד עד היום. אם היום עוד לא הושלם, הרצף נספר עד אתמול ולא נשבר. */
function streakInfo(kind, ref = todayKey()) {
  const metToday = goalMet(kind, ref);
  let cur = 0, k = metToday ? ref : addDays(ref, -1);
  while (cur < 1000 && goalMet(kind, k)) { cur++; k = addDays(k, -1); }
  const keys = Object.keys(S.days).concat(S.meals.map(m => m.date), S.workouts.map(w => w.date)).filter(x => x <= ref).sort();
  let best = cur;
  if (keys.length) {
    let run = 0;
    for (let d = keys[0]; d <= ref; d = addDays(d, 1)) { if (goalMet(kind, d)) { run++; if (run > best) best = run; } else run = 0; }
  }
  return { cur, best, metToday };
}
function streaksCard() {
  const items = STREAKS.map(x => ({ ...x, ...streakInfo(x.kind) }));
  return `<section class="card streaks">
    <div class="card-head"><h2 class="card-title">רצפים</h2><span class="muted tiny">ימים ברצף שעמדת ביעד</span></div>
    <div class="streak-grid">${items.map(x => `<div class="streak ${x.metToday ? 'met' : ''} ${x.cur ? '' : 'zero'}" style="--c:${x.color}">
      <span class="streak-ico">${x.icon()}</span>
      <span class="streak-num">${x.cur}</span>
      <span class="streak-name">${x.name}</span>
      <span class="streak-sub">${x.metToday ? 'היום הושלם' : x.cur ? 'היום עוד לא' : 'מתחילים היום'}${x.best > x.cur ? ` · שיא ${x.best}` : x.cur > 1 ? ' · שיא!' : ''}</span>
    </div>`).join('')}</div>
    <p class="tiny muted">היעדים נקבעים בהגדרות. קלוריות נספרות כשהארוחות שסומנו כ"נאכל" לא עוברות את היעד, וחלבון כשמגיעים ליעד החלבון.</p>
  </section>`;
}

const taskDone = (c, k, t) => (c.checks[k] || []).includes(t.id) || (!!t.auto && autoDone(t.auto, k));
function dayStatus(c, k, ref = todayKey()) {
  if (k < c.start || k > chEnd(c)) return 'out';
  if (k > ref) return 'future';
  const n = c.tasks.filter(t => taskDone(c, k, t)).length;
  if (c.tasks.length && n === c.tasks.length) return 'full';
  if (n > 0) return 'part';
  return k === ref ? 'pending' : 'miss';
}
function chStats(c, ref = todayKey()) {
  const end = chEnd(c);
  const last = ref < end ? ref : end;
  let full = 0, counted = 0;
  for (let k = c.start; k <= last; k = addDays(k, 1)) {
    const s = dayStatus(c, k, ref);
    if (s === 'full') { full++; counted++; } else if (k !== ref) counted++;
  }
  let streak = 0;
  let k = last;
  if (k === ref && dayStatus(c, k, ref) !== 'full') k = addDays(k, -1);
  while (k >= c.start && dayStatus(c, k, ref) === 'full') { streak++; k = addDays(k, -1); }
  return { full, counted, streak, rate: counted ? Math.round((full / counted) * 100) : 0 };
}

/* ---------- רכיבים ---------- */
function checkItem(c, k, t) {
  const on = taskDone(c, k, t);
  const manual = (c.checks[k] || []).includes(t.id);
  const autoOnly = on && !manual;
  return `<li><button class="check-item" role="checkbox" aria-checked="${on}" data-act="ch-check" data-date="${k}" data-task="${t.id}" ${autoOnly || isFuture(k) ? 'aria-disabled="true"' : ''}>
    <span class="check-box">${I.check}</span><span class="txt">${esc(t.text)}</span>${t.auto ? '<span class="auto-tag">אוטומטי</span>' : ''}</button></li>`;
}

function challengeCard(k) {
  const c = activeCh();
  if (!c) {
    return `<section class="card">
      <h2 class="card-title">${I.flag} אתגר ימים</h2>
      <p class="muted">מציבים מטרה, למשל 30 ימים של אימון, שתייה ותפריט, והאפליקציה סופרת כמה ימים נשארו ומה סימנת כל יום.</p>
      <button class="btn primary" data-act="ch-new">יצירת אתגר</button></section>`;
  }
  const end = chEnd(c);
  const dn = diffDays(c.start, k) + 1;
  const st = chStats(c);
  if (k < c.start) {
    const until = diffDays(k, c.start);
    return `<section class="card ch-card"><div class="ch-top"><div><div class="eyebrow">${esc(c.title)}</div>
      <div class="ch-big"><span class="num">${until}</span><span class="lbl">${until === 1 ? 'יום עד ההתחלה' : 'ימים עד ההתחלה'}</span></div>
      <div class="muted small">מתחיל ב${fmtDate(c.start)}</div></div>
      <button class="icon-btn" data-act="tab" data-tab="goal" aria-label="לפרטי האתגר">${I.chevL}</button></div></section>`;
  }
  if (k > end) {
    return `<section class="card ch-card"><div class="ch-top"><div><div class="eyebrow">${esc(c.title)}</div>
      <div class="ch-big"><span class="lbl">האתגר הסתיים</span></div>
      <div class="muted small">${st.full} ימים מלאים מתוך ${c.length} · ${st.rate}% הצלחה</div></div>
      <button class="icon-btn" data-act="tab" data-tab="goal" aria-label="לפרטי האתגר">${I.chevL}</button></div></section>`;
  }
  const left = c.length - dn;
  const doneToday = c.tasks.filter(t => taskDone(c, k, t)).length;
  const pct = Math.round((dn / c.length) * 100);
  return `<section class="card ch-card">
    <div class="ch-top"><div>
      <div class="eyebrow">${esc(c.title)}</div>
      ${left > 0
        ? `<div class="ch-big"><span class="num">${left}</span><span class="lbl">${left === 1 ? 'יום נשאר' : 'ימים נשארו'}</span></div>`
        : `<div class="ch-big"><span class="lbl">זה היום האחרון!</span></div>`}
    </div><span class="ch-day-pill">יום ${dn} מתוך ${c.length}</span></div>
    <div class="progress" role="progressbar" aria-valuenow="${dn}" aria-valuemin="1" aria-valuemax="${c.length}" aria-label="התקדמות באתגר"><span style="width:${pct}%"></span></div>
    <ul class="checklist">${c.tasks.map(t => checkItem(c, k, t)).join('')}</ul>
    <div class="row"><span class="muted small">${doneToday} מתוך ${c.tasks.length} הושלמו · רצף: ${daysText(st.streak)}</span></div>
  </section>`;
}

const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
/* כמה מים "אמורים" להיות עד עכשיו: היעד מתחלק באופן שווה בין שעת ההשכמה לשעת הסיום */
function waterPace(k) {
  if (k !== todayKey()) return null;
  const st = S.settings, a = toMin(st.wakeTime) ?? 420, b = toMin(st.waterEnd) ?? 1260;
  if (b <= a) return null;
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  const f = Math.max(0, Math.min(1, (m - a) / (b - a)));
  return { expected: Math.round((st.waterMl * f) / 10) * 10, f, before: m < a };
}
function waterCard(k) {
  const st = S.settings, ml = day(k).water || 0, cup = st.cupMl || 250;
  const goalCups = Math.max(1, Math.round(st.waterMl / cup));
  const filled = Math.floor(ml / cup);
  const total = Math.min(24, Math.max(goalCups, filled));
  const pace = waterPace(k);
  const dueCups = pace ? Math.min(total, Math.ceil(pace.expected / cup - 0.01)) : 0;
  const cups = Array.from({ length: total }, (_, i) =>
    `<button class="cup ${i < filled ? 'on' : i < dueCups ? 'due' : ''}" data-act="water-set" data-v="${(i + 1) * cup}" aria-label="${fmt((i + 1) * cup)} מ״ל">${I.cup}</button>`).join('');
  return `<section class="card water">
    <div class="card-head"><h2 class="card-title">${I.drop} שתייה</h2>
      <div class="metric-val"><b>${liters(ml)}</b> מתוך ${liters(st.waterMl)} ליטר</div></div>
    ${paceLine(ml, pace, cup)}
    <div class="cups">${cups}</div>
    <div class="row"><button class="btn soft" data-act="water" data-v="-${cup}" aria-label="הורדת כוס">−</button>
      <button class="btn water-btn" data-act="water" data-v="${cup}">+ כוס (${fmt(cup)} מ״ל)</button></div>
  </section>`;
}

function paceLine(ml, pace, cup) {
  if (!pace) return '';
  const goal = S.settings.waterMl;
  if (ml >= goal) return '<div class="pace ok">הגעת ליעד המים של היום</div>';
  if (pace.before) return `<div class="pace">היום מתחילים לספור מ־${esc(S.settings.wakeTime)}</div>`;
  const miss = pace.expected - ml;
  if (miss <= cup / 2) return `<div class="pace ok">בקצב טוב · יעד לשעה זו: ${liters(pace.expected)} ל׳</div>`;
  const n = Math.ceil(miss / cup);
  return `<div class="pace behind">חסרות ${n === 1 ? 'כוס אחת' : n + ' כוסות'} כדי להיות בקצב · יעד לשעה זו: ${liters(pace.expected)} ל׳</div>`;
}

function stepsCard(k) {
  const v = day(k).steps, g = S.settings.stepsGoal || 8000, p = v ? Math.min(100, (v / g) * 100) : 0;
  return `<section class="card steps">
    <div class="card-head"><h2 class="card-title">${I.steps} צעדים</h2>
      <div class="metric-val">יעד ${fmt(g)}</div></div>
    <div class="steps-row"><input id="stepsInput" type="text" inputmode="numeric" placeholder="כמה צעדים?" value="${v ? fmt(v) : ''}" aria-label="מספר צעדים">
      <span class="muted small">${v ? (v >= g ? 'הגעת ליעד!' : `עוד ${fmt(g - v)}`) : 'את המספר רואים באפליקציית Health'}</span></div>
    <div class="progress steps-bar"><span style="width:${p}%"></span></div>
  </section>`;
}

function sleepCard(k) {
  const h = day(k).sleep;
  return `<section class="card sleep">
    <h2 class="card-title">${I.moon} שינה</h2>
    <div class="stepper"><button data-act="sleep" data-v="-0.5" aria-label="פחות חצי שעה">−</button>
      <div class="val"><b>${h != null ? fmt1(h) : '—'}</b><div class="tiny muted">שעות</div></div>
      <button data-act="sleep" data-v="0.5" aria-label="עוד חצי שעה">+</button></div>
    <div class="tiny muted" style="text-align:center">יעד: ${fmt1(S.settings.sleepH)} שעות</div>
  </section>`;
}

function weightCard(k) {
  const w = day(k).weight, prev = prevWeight(k);
  let delta = '';
  if (w && prev) {
    const d = Math.round((w - prev.v) * 10) / 10;
    delta = `<div class="delta ${d < 0 ? 'down' : d > 0 ? 'up' : ''}">${d === 0 ? 'ללא שינוי' : `<span class="ltr">${d > 0 ? '+' : '−'}${fmt1(Math.abs(d))}</span> ק״ג`} <span class="muted">מ־${fmtShort(prev.k)}</span></div>`;
  } else if (!w && prev) {
    delta = `<div class="delta muted">אחרון: ${fmt1(prev.v)} ב־${fmtShort(prev.k)}</div>`;
  }
  return `<section class="card weight">
    <h2 class="card-title">${I.scale} משקל</h2>
    <label class="weight-input"><input id="weightInput" type="text" inputmode="decimal" placeholder="—" value="${w ?? ''}" aria-label="משקל בק״ג"><span class="muted">ק״ג</span></label>
    ${delta}
  </section>`;
}

function kcalRing(eaten, goal, label = 'נאכל') {
  const r = 36, c = 2 * Math.PI * r, p = goal ? Math.min(1, eaten / goal) : 0;
  return `<svg class="ring ${eaten > goal ? 'over' : ''}" viewBox="0 0 84 84" role="img" aria-label="${fmt(eaten)} מתוך ${fmt(goal)} קלוריות">
    <circle class="bgc" cx="42" cy="42" r="${r}"/>
    <circle class="fgc" cx="42" cy="42" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p)).toFixed(1)}" transform="rotate(-90 42 42)"/>
    <text x="42" y="44" text-anchor="middle">${fmt(eaten)}</text>
    <text class="sub" x="42" y="58" text-anchor="middle">${label}</text></svg>`;
}
function macroRow(name, v, goal) {
  const p = goal ? Math.min(100, (v / goal) * 100) : 0;
  return `<div class="macro"><span>${name}</span><div class="progress"><span style="width:${p}%"></span></div><span class="v">${fmt(v)}/${fmt(goal)} ג׳</span></div>`;
}
/* רכיבי ארוחה עם גרמים: [{ name, g }] */
const itemsText = items => (items || []).filter(x => x.name).map(x => (x.g ? `${esc(x.name)} <b class="g">${fmt(x.g)} ג׳</b>` : esc(x.name))).join(' · ');
function compRow(x = {}) {
  return `<div class="comp-row"><input name="cName" value="${esc(x.name || '')}" placeholder="רכיב, למשל אורז" aria-label="רכיב" autocomplete="off">
    <input name="cG" inputmode="decimal" value="${x.g || ''}" placeholder="גרם" aria-label="גרם">
    <button type="button" class="icon-btn small" data-act="row-del" aria-label="הסרת הרכיב">${I.x}</button></div>`;
}
const compEditor = items => `<div class="field"><span class="field-label">כמה גרם מכל דבר</span>
  <div id="compList" class="comp-list">${(items && items.length ? items : [{}]).map(compRow).join('')}</div>
  <button type="button" class="btn soft small" data-act="comp-add">+ רכיב</button></div>`;
const readComps = form => $$('.comp-row', form).map(r => ({ name: $('[name=cName]', r).value.trim(), g: num($('[name=cG]', r).value) || 0 })).filter(x => x.name);
const fillComps = items => { $('#compList').innerHTML = (items && items.length ? items : [{}]).map(compRow).join(''); };

function mealItem(m) {
  return `<li class="item ${m.eaten ? 'done' : ''}">
    <button class="tick" role="checkbox" aria-checked="${!!m.eaten}" ${isFuture(m.date) ? 'aria-disabled="true"' : ''} data-act="meal-toggle" data-id="${m.id}" aria-label="נאכל: ${esc(m.name)}"><span class="check-box">${I.check}</span></button>
    <button class="body" data-act="meal-edit" data-id="${m.id}"><span class="slot-tag">${esc(m.slot)}</span><span class="t">${esc(m.name)}</span>
      ${m.items && m.items.length ? `<span class="comps">${itemsText(m.items)}</span>` : ''}
      ${m.protein || m.carbs || m.fat ? `<span class="s">ח׳ ${fmt(m.protein)} · פ׳ ${fmt(m.carbs)} · ש׳ ${fmt(m.fat)}</span>` : ''}</button>
    <span class="side">${fmt(m.kcal)}</span></li>`;
}
function workoutItem(w) {
  const bits = [];
  if (w.exercises && w.exercises.length) bits.push(w.exercises.length === 1 ? 'תרגיל אחד' : `${w.exercises.length} תרגילים`);
  if (w.duration) bits.push(`${fmt(w.duration)} דק׳`);
  return `<li class="item ${w.done ? 'done' : ''}">
    <button class="tick" role="checkbox" aria-checked="${!!w.done}" ${isFuture(w.date) ? 'aria-disabled="true"' : ''} data-act="wo-toggle" data-id="${w.id}" aria-label="בוצע: ${esc(w.title)}"><span class="check-box">${I.check}</span></button>
    <button class="body" data-act="wo-edit" data-id="${w.id}"><span class="type-tag">${esc(w.type)}</span><span class="t">${esc(w.title)}</span>
      ${bits.length ? `<span class="s">${bits.join(' · ')}</span>` : ''}</button></li>`;
}

function foodDayCard(k) {
  const st = S.settings, list = mealsOn(k), eaten = sumMeals(list.filter(m => m.eaten)), plan = sumMeals(list);
  return `<section class="card food">
    <div class="card-head"><h2 class="card-title">${I.food} תזונה</h2>
      <span class="muted small">מתוכנן ${fmt(plan.kcal)} / ${fmt(st.kcal)}</span></div>
    <div class="kcal-row">${kcalRing(eaten.kcal, st.kcal)}
      <div class="macros">${macroRow('חלבון', eaten.protein, st.protein)}${macroRow('פחמימה', eaten.carbs, st.carbs)}${macroRow('שומן', eaten.fat, st.fat)}</div></div>
    ${list.length ? `<ul class="items">${list.map(mealItem).join('')}</ul>` : '<p class="empty">אין ארוחות מתוכננות ליום הזה.</p>'}
    <div class="add-pair"><button class="add-btn" data-act="meal-new" data-date="${k}">+ הוספת ארוחה</button>
      ${S.favs.length ? `<button class="add-btn fav" data-act="fav-pick" data-date="${k}">${I.star} ממועדפות</button>` : ''}</div>
  </section>`;
}
function trainDayCard(k) {
  const list = workoutsOn(k);
  return `<section class="card train">
    <h2 class="card-title">${I.train} אימון</h2>
    ${list.length ? `<ul class="items">${list.map(workoutItem).join('')}</ul>` : '<p class="empty">אין אימון מתוכנן ליום הזה.</p>'}
    <button class="add-btn" data-act="wo-new" data-date="${k}">+ הוספת אימון</button>
  </section>`;
}

/* ---------- מסכים ---------- */
function vToday() {
  const k = U.date, isToday = k === todayKey();
  const label = isToday ? 'היום' : k === addDays(todayKey(), -1) ? 'אתמול' : k === addDays(todayKey(), 1) ? 'מחר' : `יום ${DAYS[parseKey(k).getDay()]}`;
  return `
  <div class="datebar">
    <button class="icon-btn" data-act="date" data-n="-1" aria-label="יום קודם">${I.chevR}</button>
    <div class="datebar-mid"><div class="datebar-day">${label}</div><div class="datebar-full">${fmtDate(k)}</div></div>
    <button class="icon-btn" data-act="date" data-n="1" aria-label="יום הבא">${I.chevL}</button>
  </div>
  ${isToday ? '' : '<button class="link-btn" data-act="date-today">חזרה להיום</button>'}
  ${challengeCard(k)}
  ${isToday ? streaksCard() : ''}
  ${isFuture(k) ? `<section class="card future-note"><p><b>היום הזה עוד לא הגיע.</b> אפשר לתכנן לו ארוחות ואימונים. שתייה, אכילה, שינה, משקל וצעדים מסמנים רק כשהיום מגיע.</p></section>` : `${waterCard(k)}
  <div class="grid2">${sleepCard(k)}${weightCard(k)}</div>
  ${stepsCard(k)}`}
  ${foodDayCard(k)}
  ${trainDayCard(k)}`;
}

function weekNav() {
  const end = addDays(U.week, 6), cur = U.week === weekStart(todayKey());
  return `<div class="weeknav">
    <button class="icon-btn" data-act="week" data-n="-1" aria-label="שבוע קודם">${I.chevR}</button>
    <div class="mid"><b>${cur ? 'השבוע' : U.week > todayKey() ? 'שבוע הבא' : 'שבוע'}</b><span class="muted small">${fmtShort(U.week)} – ${fmtShort(end)}</span></div>
    <button class="icon-btn" data-act="week" data-n="1" aria-label="שבוע הבא">${I.chevL}</button>
  </div>${cur ? '' : '<button class="link-btn" data-act="week-now">חזרה לשבוע הנוכחי</button>'}`;
}
const weekKeys = () => Array.from({ length: 7 }, (_, i) => addDays(U.week, i));
function dayHead(k, right = '') {
  const d = parseKey(k);
  return `<div class="day-head ${k === todayKey() ? 'is-today' : ''}"><span class="dn">${DAYS[d.getDay()]}<span class="dd">${fmtShort(k)}</span></span>${right}</div>`;
}

function vTrain() {
  const keys = weekKeys(), list = S.workouts.filter(w => w.date >= keys[0] && w.date <= keys[6]);
  const done = list.filter(w => w.done), mins = done.reduce((t, w) => t + (w.duration || 0), 0);
  const days = keys.map(k => {
    const ws = workoutsOn(k);
    return `<div class="day-block">${dayHead(k)}
      ${ws.length ? `<ul class="items">${ws.map(workoutItem).join('')}</ul>` : ''}
      <button class="inline-add" data-act="wo-new" data-date="${k}">+ אימון</button></div>`;
  }).join('');
  const tpl = S.templates.length ? `<section class="card"><h2 class="card-title">תבניות אימון</h2>
    <ul class="items">${S.templates.map(t => `<li class="item"><button class="body" data-act="tpl-use" data-id="${t.id}"><span class="t">${esc(t.title)}</span>
      <span class="s">${esc(t.type)}${t.exercises.length ? ' · ' + t.exercises.length + ' תרגילים' : ''} · הקשה להוספה להיום</span></button>
      <button class="icon-btn small" data-act="confirm" data-do="tpl-del" data-id="${t.id}" aria-label="מחיקת התבנית">${I.x}</button></li>`).join('')}</ul></section>` : '';
  return `${weekNav()}
  <section class="card train">
    <div class="summary">
      <div class="stat"><b>${done.length}/${list.length}</b><span>אימונים בוצעו</span></div>
      <div class="stat"><b>${fmt(mins)}</b><span>דקות אימון</span></div>
      <div class="stat"><b>${new Set(done.map(w => w.date)).size}</b><span>ימים פעילים</span></div>
    </div>
    <div class="row"><button class="btn soft small" data-act="copy-week" data-what="workouts">${I.copy} העתקת התוכנית מהשבוע הקודם</button></div>
  </section>
  <section class="card">${days}</section>
  ${tpl}`;
}

function vFood() {
  const st = S.settings, keys = weekKeys();
  const totals = keys.map(k => sumMeals(mealsOn(k)));
  const planned = totals.filter(t => t.kcal > 0);
  const avg = planned.length ? planned.reduce((a, t) => a + t.kcal, 0) / planned.length : 0;
  const avgP = planned.length ? planned.reduce((a, t) => a + t.protein, 0) / planned.length : 0;
  const days = keys.map((k, i) => {
    const t = totals[i], ms = mealsOn(k), over = t.kcal > st.kcal;
    return `<div class="day-block">${dayHead(k, `<span class="k ${over ? 'over' : ''}">${fmt(t.kcal)} / ${fmt(st.kcal)}</span>`)}
      <div class="progress food ${over ? 'over' : ''}"><span style="width:${Math.min(100, (t.kcal / st.kcal) * 100)}%"></span></div>
      ${ms.length ? `<ul class="items">${ms.map(mealItem).join('')}</ul>` : ''}
      <div class="row"><button class="inline-add" data-act="meal-new" data-date="${k}">+ ארוחה</button>
        ${S.favs.length ? `<button class="inline-add" data-act="fav-pick" data-date="${k}">${I.star} ממועדפות</button>` : ''}</div></div>`;
  }).join('');
  return `${weekNav()}
  <section class="card food">
    <div class="summary">
      <div class="stat"><b>${fmt(avg)}</b><span>ממוצע קלוריות ליום</span></div>
      <div class="stat"><b>${fmt(avgP)}</b><span>ממוצע חלבון (ג׳)</span></div>
      <div class="stat"><b>${planned.length}/7</b><span>ימים מתוכננים</span></div>
    </div>
    <p class="tiny muted">היעד היומי: ${fmt(st.kcal)} קק״ל · חלבון ${fmt(st.protein)} ג׳ · פחמימה ${fmt(st.carbs)} ג׳ · שומן ${fmt(st.fat)} ג׳. אפשר לשנות בהגדרות.</p>
    <div class="row"><button class="btn soft small" data-act="copy-week" data-what="meals">${I.copy} העתקת התפריט מהשבוע הקודם</button></div>
  </section>
  <section class="card">${days}</section>
  ${favsCard()}`;
}

/* ---------- מעקב תרגילים ---------- */
const LIFT_CATS = ['פלג גוף עליון', 'פלג גוף תחתון', 'ישבן', 'בטן', 'גב', 'אירובי', 'גוף מלא', 'אחר'];
const logsOf = l => [...(l.logs || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
const entryText = g => (g.w ? `${fmt1(g.w)} ק״ג · ${g.r || 0} חזרות` : `${g.r || 0} חזרות`);
function liftPR(l) {
  let best = null;
  for (const g of logsOf(l)) if (!best || (g.w || 0) > best.w || ((g.w || 0) === best.w && (g.r || 0) > best.r)) best = { w: g.w || 0, r: g.r || 0, date: g.date };
  return best;
}
const liftVal = (l, g) => (logsOf(l).some(x => x.w > 0) ? g.w || 0 : g.r || 0);
function spark(l) {
  const L = logsOf(l).slice(-12);
  if (L.length < 2) return '';
  const vs = L.map(g => liftVal(l, g));
  const W = 300, H = 44, p = 5, lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const P = vs.map((v, i) => [W - p - (i / (vs.length - 1)) * (W - 2 * p), H - p - ((v - lo) / span) * (H - 2 * p)]);
  const d = P.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
  const e = P[P.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d} L${e[0].toFixed(1)} ${H} L${P[0][0].toFixed(1)} ${H} Z" fill="var(--train)" fill-opacity=".12"/>
    <path d="${d}" fill="none" stroke="var(--train)" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <circle cx="${e[0]}" cy="${e[1]}" r="3.5" fill="var(--train)"/></svg>`;
}
function liftChart(l) {
  const L = logsOf(l);
  if (L.length < 2) return '';
  const byW = L.some(x => x.w > 0), val = g => liftVal(l, g);
  const W = 340, H = 160, pl = 10, pr = 40, pt = 14, pb = 26;
  const t0 = parseKey(L[0].date).getTime(), t1 = parseKey(L[L.length - 1].date).getTime();
  let lo = Math.min(...L.map(val)), hi = Math.max(...L.map(val));
  const step = hi - lo > 30 ? 10 : hi - lo > 12 ? 5 : byW ? 2.5 : 2;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step; if (hi === lo) { hi += step; lo = Math.max(0, lo - step); }
  const x = t => W - pr - ((t - t0) / (t1 - t0 || 1)) * (W - pl - pr), y = v => pt + ((hi - v) / (hi - lo)) * (H - pt - pb);
  const ticks = []; const every = Math.ceil((hi - lo) / step / 4);
  for (let v = lo, i = 0; v <= hi + 1e-9; v += step, i++) if (i % every === 0) ticks.push(v);
  const P = L.map(g => [x(parseKey(g.date).getTime()), y(val(g))]);
  const d = P.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${byW ? 'משקל' : 'חזרות'} לאורך זמן">
    ${ticks.map(v => `<line class="gridl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${W - pr + 6}" y="${y(v) + 3.5}">${fmt1(v)}</text>`).join('')}
    <path d="${d}" fill="none" stroke="var(--train)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    ${P.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${i === P.length - 1 ? 5 : 3}" fill="${i === P.length - 1 ? 'var(--train)' : 'var(--surface)'}" stroke="var(--train)" stroke-width="1.8"/>`).join('')}
    <text x="${W - pr}" y="${H - 8}" text-anchor="end">${fmtShort(L[0].date)}</text>
    <text x="${pl}" y="${H - 8}" text-anchor="start" class="strong">${fmtShort(L[L.length - 1].date)}</text></svg>`;
}
const lastDate = l => { const L = logsOf(l); return L.length ? L[L.length - 1].date : ''; };
function liftListHtml() {
  const q = (U.liftQ || '').trim().toLowerCase(), cat = U.liftCat || '';
  const list = S.lifts.filter(l => (!cat || l.cat === cat) && (!q || l.name.toLowerCase().includes(q)))
    .sort((a, b) => (lastDate(b) < lastDate(a) ? -1 : lastDate(b) > lastDate(a) ? 1 : a.name.localeCompare(b.name, 'he')));
  if (!S.lifts.length) return '<section class="card"><p class="empty">עדיין אין תרגילים. מתחילים מ"+ תרגיל", למשל סקוואט, היפ טראסט או לחיצת כתפיים.</p></section>';
  if (!list.length) return `<section class="card"><p class="empty">לא נמצא תרגיל${q ? ` בשם "${esc(U.liftQ)}"` : ''}${cat ? ` ב${esc(cat)}` : ''}.</p>
    ${q ? `<button class="btn soft small" data-act="lift-new" data-name="${esc(U.liftQ.trim())}">+ הוספת "${esc(U.liftQ.trim())}"</button>` : ''}</section>`;
  return list.map(l => {
    const L = logsOf(l), last = L[L.length - 1], pr = liftPR(l);
    return `<button class="card lift-card" data-act="lift-open" data-id="${l.id}">
      <div class="lift-top"><div style="min-width:0"><span class="type-tag">${esc(l.cat)}</span><div class="lift-name">${esc(l.name)}</div>
        <div class="lift-last">${last ? `אחרון ${fmtShort(last.date)}: ${entryText(last)}` : 'עוד לא נרשם'}</div></div>
        ${pr && pr.w ? `<span class="pr">שיא ${fmt1(pr.w)} ק״ג</span>` : pr && pr.r ? `<span class="pr">שיא ${pr.r} חזרות</span>` : ''}</div>
      ${spark(l)}
    </button>`;
  }).join('');
}
function vLift() {
  const used = LIFT_CATS.filter(c => S.lifts.some(l => l.cat === c));
  return `<section class="card train"><div class="card-head"><h2 class="card-title">${I.train} התרגילים שלי</h2>
      <button class="btn primary small" data-act="lift-new">+ תרגיל</button></div>
    ${S.lifts.length ? `<input id="liftSearch" class="search" type="search" placeholder="חיפוש תרגיל" value="${esc(U.liftQ || '')}" aria-label="חיפוש תרגיל" autocomplete="off">
    ${used.length > 1 ? `<div class="chips">${['', ...used].map(c => `<button class="btn soft small ${(U.liftCat || '') === c ? 'on' : ''}" data-act="lift-cat" data-cat="${esc(c)}">${c || 'הכול'}</button>`).join('')}</div>` : ''}` : ''}
  </section>
  <div id="liftList" class="lift-list">${liftListHtml()}</div>`;
}
function openLift(id) {
  const l = S.lifts.find(x => x.id === id); if (!l) return;
  const L = logsOf(l), last = L[L.length - 1], pr = liftPR(l);
  const hist = [...L].reverse().map(g => `<div class="log"><div style="min-width:0">
      <div class="d">${fmtShort(g.date)} <span class="muted small">יום ${DAYS[parseKey(g.date).getDay()]}</span></div>
      <div class="sets">${entryText(g)}${pr && g.w === pr.w && g.r === pr.r && g.date === pr.date ? ' <span class="best">· שיא</span>' : ''}</div></div>
      <button type="button" class="icon-btn small" data-act="confirm" data-do="liftlog-del" data-id="${l.id}" data-log="${g.id}" aria-label="מחיקת הרישום">${I.x}</button></div>`).join('');
  openSheet(l.name, `<form id="sheetForm" class="form" novalidate>
    <div class="row"><span class="type-tag">${esc(l.cat)}</span><span class="spacer"></span>
      <button type="button" class="btn soft small" data-act="lift-edit" data-id="${l.id}">${I.edit} עריכה</button></div>
    <div class="lift-entry">
      <label class="field"><span>משקל (ק״ג)</span><input name="w" id="lf-w" inputmode="decimal" value="${last && last.w ? last.w : ''}" placeholder="0"></label>
      <label class="field"><span>חזרות</span><input name="r" id="lf-r" inputmode="numeric" value="${last ? last.r || '' : ''}" placeholder="0"></label>
      <label class="field"><span>תאריך</span><input type="date" name="date" id="lf-date" value="${todayKey()}"></label>
    </div>
    <button class="btn primary" type="submit">שמירה</button>
    ${L.length > 1 ? `<div class="field"><span class="field-label">התקדמות</span>${liftChart(l)}</div>` : ''}
    ${L.length ? `<div class="field"><span class="field-label">היסטוריה</span><div>${hist}</div></div>` : ''}
  </form>`, fd => {
    const w = num(fd.get('w')) || 0, r = Math.round(num(fd.get('r')) || 0);
    if (!r && !w) { toast('צריך למלא משקל או חזרות'); return; }
    const prev = liftPR(l);
    l.logs = l.logs || [];
    l.logs.push({ id: uid(), date: fd.get('date') || todayKey(), w, r });
    save(); render(); openLift(l.id);
    toast(prev && w > prev.w ? `שיא חדש: ${fmt1(w)} ק״ג!` : 'נשמר');
  });
}
function openLiftEdit(l, presetName = '') {
  const isNew = !l, v = l || { name: presetName, cat: U.liftCat || 'פלג גוף תחתון' };
  openSheet(isNew ? 'תרגיל חדש' : 'עריכת תרגיל', `<form id="sheetForm" class="form" novalidate>
    <label class="field"><span>שם התרגיל</span><input name="name" id="le-name" value="${esc(v.name)}" placeholder="למשל: היפ טראסט" autocomplete="off"></label>
    <div class="field"><span class="field-label">סוג</span><div class="chips">${LIFT_CATS.map(c => `<label class="chip"><input type="radio" name="cat" value="${c}" ${c === v.cat ? 'checked' : ''}><span>${c}</span></label>`).join('')}</div></div>
    <div class="form-actions"><button class="btn primary" type="submit">${isNew ? 'הוספה' : 'שמירה'}</button>
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="confirm" data-do="lift-del" data-id="${v.id}">מחיקת התרגיל</button>`}</div>
  </form>`, fd => {
    const name = (fd.get('name') || '').trim();
    if (!name) { toast('צריך לתת שם לתרגיל'); return; }
    const data = { name, cat: fd.get('cat') || 'אחר' };
    if (l) { Object.assign(l, data); save(); render(); openLift(l.id); toast('נשמר'); return; }
    const dup = S.lifts.find(x => x.name.trim() === name);
    if (dup) { openLift(dup.id); toast('התרגיל כבר קיים'); return; }
    const n = { id: uid(), ...data, logs: [] }; S.lifts.push(n);
    U.liftQ = ''; save(); render(); openLift(n.id);
  });
}

function favsCard() {
  const list = S.favs.length ? `<ul class="items">${S.favs.map(f => `<li class="item">
      <button class="body" data-act="fav-edit" data-id="${f.id}"><span class="slot-tag">${esc(f.slot)}</span><span class="t">${esc(f.name)}</span>
        ${f.items && f.items.length ? `<span class="comps">${itemsText(f.items)}</span>` : ''}
        <span class="s">${fmt(f.kcal)} קק״ל · ח׳ ${fmt(f.protein)} · פ׳ ${fmt(f.carbs)} · ש׳ ${fmt(f.fat)}</span></button>
      <button class="icon-btn small" data-act="confirm" data-do="fav-del" data-id="${f.id}" aria-label="הסרה מהמועדפות">${I.x}</button></li>`).join('')}</ul>`
    : '<p class="empty">ארוחה שאוכלים הרבה שומרים פה פעם אחת, ואחר כך מוסיפים אותה לכל יום בהקשה, בלי למלא שוב את הפרטים.</p>';
  return `<section class="card food"><div class="card-head"><h2 class="card-title">${I.star} ארוחות מועדפות</h2>
    <button class="btn soft small" data-act="fav-new">+ מועדפת</button></div>${list}</section>`;
}
function favPicker(date) {
  openSheet(`הוספה ממועדפות · ${fmtShort(date)}`, `<div class="form">
    <p class="small muted">הקשה מוסיפה את הארוחה ליום ${esc(DAYS[parseKey(date).getDay()])}. אפשר להוסיף כמה ברצף.</p>
    <ul class="items">${S.favs.map(f => `<li class="item"><button class="body" data-act="fav-add" data-id="${f.id}" data-date="${date}">
      <span class="slot-tag">${esc(f.slot)}</span><span class="t">${esc(f.name)}</span>${f.items && f.items.length ? `<span class="comps">${itemsText(f.items)}</span>` : ''}<span class="s">ח׳ ${fmt(f.protein)} · פ׳ ${fmt(f.carbs)} · ש׳ ${fmt(f.fat)}</span></button>
      <span class="side">${fmt(f.kcal)}</span></li>`).join('')}</ul>
    <button class="btn soft" data-act="meal-new" data-date="${date}">ארוחה אחרת</button></div>`);
}
function favFrom(src) {
  return { name: src.name, slot: src.slot, kcal: src.kcal || 0, protein: src.protein || 0, carbs: src.carbs || 0, fat: src.fat || 0, items: clone(src.items || []) };
}
function upsertFav(data) {
  const i = S.favs.findIndex(f => f.name === data.name);
  if (i >= 0) Object.assign(S.favs[i], favFrom(data)); else S.favs.push({ id: uid(), ...favFrom(data) });
}
function openFav(f) {
  const isNew = !f, v = f || { name: '', slot: 'בוקר', kcal: '', protein: '', carbs: '', fat: '' };
  openSheet(isNew ? 'ארוחה מועדפת חדשה' : 'עריכת ארוחה מועדפת', `<form id="sheetForm" class="form" novalidate>
    <label class="field"><span>שם הארוחה</span><input name="name" id="ff-name" value="${esc(v.name)}" placeholder="למשל: טוסט גבינה וירקות" autocomplete="off"></label>
    <div class="field"><span class="field-label">ארוחה רגילה</span><div class="chips">${SLOTS.map(s => `<label class="chip"><input type="radio" name="slot" value="${s}" ${s === v.slot ? 'checked' : ''}><span>${s}</span></label>`).join('')}</div></div>
    ${compEditor(v.items)}
    <div class="macro-inputs">
      <label class="field"><span>קלוריות</span><input name="kcal" id="ff-kcal" inputmode="numeric" value="${v.kcal ?? ''}" placeholder="0"></label>
      <label class="field"><span>חלבון ג׳</span><input name="protein" id="ff-p" inputmode="decimal" value="${v.protein ?? ''}" placeholder="0"></label>
      <label class="field"><span>פחמימה ג׳</span><input name="carbs" id="ff-c" inputmode="decimal" value="${v.carbs ?? ''}" placeholder="0"></label>
      <label class="field"><span>שומן ג׳</span><input name="fat" id="ff-f" inputmode="decimal" value="${v.fat ?? ''}" placeholder="0"></label>
    </div>
    <div class="form-actions"><button class="btn primary" type="submit">שמירה</button></div>
  </form>`, fd => {
    const name = (fd.get('name') || '').trim();
    if (!name) { toast('צריך לתת שם לארוחה'); return; }
    const data = { name, slot: fd.get('slot') || 'בוקר', kcal: num(fd.get('kcal')) || 0, protein: num(fd.get('protein')) || 0, carbs: num(fd.get('carbs')) || 0, fat: num(fd.get('fat')) || 0, items: readComps($('#sheetForm')) };
    if (f) Object.assign(f, data); else upsertFav(data);
    save(); closeSheet(); render(); toast('נשמר במועדפות');
  });
}

/* ---------- גרפים ---------- */
function weightChart() {
  const pts = weights().slice(-60);
  if (pts.length < 2) return '<p class="empty">אחרי שתי שקילות יופיע כאן גרף. את המשקל מזינים במסך "היום".</p>';
  const W = 340, H = 170, pl = 10, pr = 40, pt = 14, pb = 26;
  const t0 = parseKey(pts[0].k).getTime(), t1 = parseKey(pts[pts.length - 1].k).getTime();
  const tw = S.settings.targetWeight;
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  if (tw) { lo = Math.min(lo, tw); hi = Math.max(hi, tw); }
  const step = hi - lo > 6 ? 2 : hi - lo > 2.5 ? 1 : 0.5;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  if (hi === lo) { hi += step; lo -= step; }
  // ציר הזמן מימין לשמאל: הישן בימין, החדש בשמאל
  const x = t => W - pr - ((t - t0) / (t1 - t0 || 1)) * (W - pl - pr);
  const y = v => pt + ((hi - v) / (hi - lo)) * (H - pt - pb);
  const ticks = [];
  const every = Math.ceil((hi - lo) / step / 4);
  for (let v = lo, i = 0; v <= hi + 1e-9; v += step, i++) if (i % every === 0) ticks.push(Math.round(v * 10) / 10);
  const P = pts.map(p => [x(parseKey(p.k).getTime()), y(p.v)]);
  const line = P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = `${line} L${P[P.length - 1][0].toFixed(1)} ${H - pb} L${P[0][0].toFixed(1)} ${H - pb} Z`;
  const lastP = P[P.length - 1], last = pts[pts.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="גרף משקל: ${fmt1(pts[0].v)} עד ${fmt1(last.v)} ק״ג">
    <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(v => `<line class="gridl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${W - pr + 6}" y="${y(v) + 3.5}">${fmt1(v)}</text>`).join('')}
    ${tw ? `<line class="goal" x1="${pl}" x2="${W - pr}" y1="${y(tw)}" y2="${y(tw)}" stroke="var(--good)"/><text x="${pl + 2}" y="${y(tw) - 5}" style="fill:var(--good)">יעד ${fmt1(tw)}</text>` : ''}
    <path d="${area}" fill="url(#wg)"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    ${P.length <= 20 ? P.slice(0, -1).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="var(--surface)" stroke="var(--accent)" stroke-width="1.6"/>`).join('') : ''}
    <circle cx="${lastP[0]}" cy="${lastP[1]}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>
    <text x="${W - pr}" y="${H - 8}" text-anchor="end">${fmtShort(pts[0].k)}</text>
    <text x="${pl}" y="${H - 8}" text-anchor="start" class="strong">${fmtShort(last.k)}</text>
  </svg>`;
}

function barChart(field, goal, color, fmtv) {
  const n = 14, end = todayKey();
  const keys = Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
  const vals = keys.map(k => +(day(k)[field] || 0));
  if (!vals.some(v => v > 0)) return null;
  const W = 340, H = 150, pl = 6, pr = 6, pt = 18, pb = 22;
  const max = Math.max(goal, ...vals) * 1.12 || 1;
  const bw = (W - pl - pr) / n;
  const y = v => pt + (1 - v / max) * (H - pt - pb);
  const gy = y(goal);
  const bars = keys.map((k, i) => {
    const xi = W - pr - (i + 1) * bw; // הישן בימין
    const v = vals[i], h = H - pb - y(v), isT = k === end;
    const op = v >= goal ? 1 : 0.55;
    return `${v > 0 ? `<rect x="${(xi + bw * 0.16).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${color}" fill-opacity="${op}"/>` : ''}
      ${i % 2 === (n - 1) % 2 ? `<text x="${(xi + bw / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" class="${isT ? 'strong' : ''}">${parseKey(k).getDate()}</text>` : ''}
      ${isT && v > 0 ? `<text x="${(xi + bw / 2).toFixed(1)}" y="${(y(v) - 5).toFixed(1)}" text-anchor="middle" class="strong">${fmtv(v)}</text>` : ''}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="14 הימים האחרונים">
    <line class="gridl" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>
    <line class="goal" x1="${pl}" x2="${W - pr}" y1="${gy}" y2="${gy}" stroke="${color}"/>
    ${bars}
    <text x="${pl}" y="${gy - 5}" class="halo" style="fill:${color}">יעד ${fmtv(goal)}</text></svg>`;
}

/* ---------- תמונות (IndexedDB) ---------- */
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('no idb'));
    const r = indexedDB.open('trackmi', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('photos', mode), req = fn(t.objectStore('photos'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  return {
    all: () => run('readonly', s => s.getAll()),
    put: p => run('readwrite', s => s.put(p)),
    del: id => run('readwrite', s => s.delete(id)),
    clear: () => run('readwrite', s => s.clear()),
  };
})();
let PHOTOS = [];
const PURL = new Map();
async function loadPhotos() {
  try { PHOTOS = (await idb.all()) || []; } catch (e) { PHOTOS = []; }
  PHOTOS.sort((a, b) => (a.date === b.date ? (a.created || 0) - (b.created || 0) : a.date < b.date ? -1 : 1));
  for (const p of PHOTOS) if (!PURL.has(p.id)) PURL.set(p.id, URL.createObjectURL(p.blob));
}
function loadImg(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); };
    img.src = u;
  });
}
async function compress(file, max = 1400) {
  try {
    const img = await loadImg(file);
    const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', 0.82));
  } catch (e) { return file; }
}
async function addPhoto(file) {
  if (!file) return;
  toast('שומרים את התמונה…');
  const blob = await compress(file);
  const p = { id: uid(), date: U.tab === 'today' ? U.date : todayKey(), note: '', blob, created: Date.now() };
  try { await idb.put(p); } catch (e) { toast('לא ניתן היה לשמור את התמונה במכשיר.'); return; }
  await loadPhotos(); render(); toast('התמונה נשמרה');
}
function photosHtml() {
  if (!PHOTOS.length) return '<p class="empty">כאן נאספות תמונות ההתקדמות. כדאי לצלם באותה תאורה ובאותה תנוחה, למשל פעם בשבוע.</p>';
  const first = PHOTOS[0], last = PHOTOS[PHOTOS.length - 1];
  const wAt = k => day(k).weight;
  const cmp = PHOTOS.length > 1 ? `<div class="compare">
    <figure><img src="${PURL.get(first.id)}" alt="תמונה ראשונה, ${fmtShort(first.date)}"><figcaption>התחלה · ${fmtShort(first.date)}${wAt(first.date) ? ' · ' + fmt1(wAt(first.date)) + ' ק״ג' : ''}</figcaption></figure>
    <figure><img src="${PURL.get(last.id)}" alt="תמונה אחרונה, ${fmtShort(last.date)}"><figcaption>אחרונה · ${fmtShort(last.date)}${wAt(last.date) ? ' · ' + fmt1(wAt(last.date)) + ' ק״ג' : ''}</figcaption></figure>
  </div>` : '';
  const grid = [...PHOTOS].reverse().map(p => `<button class="photo-thumb" data-act="photo-open" data-id="${p.id}" aria-label="תמונה מ־${fmtShort(p.date)}">
    <img src="${PURL.get(p.id)}" alt="" loading="lazy"><span>${fmtShort(p.date)}</span></button>`).join('');
  return `${cmp}<div class="photos">${grid}</div>`;
}

function vBody() {
  const ws = weights(), last = ws[ws.length - 1], first = ws[0], st = S.settings;
  let stats = '';
  if (ws.length > 1) {
    const ch = Math.round((last.v - first.v) * 10) / 10;
    stats = `<div class="summary">
      <div class="stat"><b>${ch > 0 ? '+' : ch < 0 ? '−' : ''}${fmt1(Math.abs(ch))}</b><span>שינוי מאז ${fmtShort(first.k)}</span></div>
      <div class="stat"><b>${fmt1(Math.min(...ws.map(p => p.v)))}</b><span>הנמוך ביותר</span></div>
      <div class="stat"><b>${st.targetWeight ? fmt1(Math.abs(last.v - st.targetWeight)) : '—'}</b><span>${st.targetWeight ? 'ק״ג ליעד' : 'אין יעד משקל'}</span></div></div>`;
  }
  const water = barChart('water', st.waterMl, 'var(--water)', v => liters(v));
  const sleep = barChart('sleep', st.sleepH, 'var(--sleep)', v => fmt1(v));
  const steps = barChart('steps', st.stepsGoal || 8000, 'var(--steps)', v => (v >= 1000 ? fmt1(v / 1000) + 'K' : fmt(v)));
  return `
  <section class="card weight"><div class="card-head"><h2 class="card-title">${I.scale} משקל</h2>
    ${last ? `<div class="metric-val"><b>${fmt1(last.v)}</b> ק״ג</div>` : ''}</div>
    ${weightChart()}${stats}</section>
  <section class="card water"><h2 class="card-title">${I.drop} שתייה · 14 ימים אחרונים</h2>
    ${water || '<p class="empty">עדיין לא נרשמה שתייה.</p>'}</section>
  <section class="card sleep"><h2 class="card-title">${I.moon} שינה · 14 ימים אחרונים</h2>
    ${sleep || '<p class="empty">עדיין לא נרשמו שעות שינה.</p>'}</section>
  <section class="card steps"><h2 class="card-title">${I.steps} צעדים · 14 ימים אחרונים</h2>
    ${steps || '<p class="empty">עדיין לא נרשמו צעדים. מזינים אותם במסך "היום".</p>'}</section>
  <section class="card"><div class="card-head"><h2 class="card-title">${I.camera} תמונות מעקב</h2>
    <button class="btn soft small" data-act="photo-add">+ תמונה</button></div>${photosHtml()}</section>`;
}

function vGoal() {
  const c = activeCh(), t = todayKey();
  const history = S.challenges.filter(x => x.archived);
  const histHtml = history.length ? `<section class="card"><h2 class="card-title">אתגרים קודמים</h2>
    ${history.map(h => { const s = chStats(h, chEnd(h) < t ? chEnd(h) : t); return `<div class="hist"><span><b>${esc(h.title)}</b> <span class="muted small">${fmtShort(h.start)}–${fmtShort(chEnd(h))}</span></span><span class="num">${s.full}/${h.length} · ${s.rate}%</span></div>`; }).join('')}</section>` : '';
  if (!c) {
    return `<section class="card"><h2 class="card-title">${I.flag} אתגר ימים</h2>
      <p>בוחרים כמה ימים, מגדירים משימות יומיות ומסמנים כל יום מה הצלחת. משימות כמו מים, שינה, אימון וקלוריות יכולות להסתמן לבד לפי מה שהזנת.</p>
      <button class="btn primary" data-act="ch-new">יצירת אתגר</button></section>${histHtml}`;
  }
  const end = chEnd(c), st = chStats(c), dn = diffDays(c.start, t) + 1;
  const left = t < c.start ? c.length : Math.max(0, c.length - dn);
  let headline;
  if (t < c.start) headline = `<div class="ch-big"><span class="num">${diffDays(t, c.start)}</span><span class="lbl">${dayWord(diffDays(t, c.start))} עד ההתחלה</span></div>`;
  else if (t > end) headline = '<div class="ch-big"><span class="lbl">האתגר הסתיים</span></div>';
  else if (left === 0) headline = '<div class="ch-big"><span class="lbl">זה היום האחרון!</span></div>';
  else headline = `<div class="ch-big"><span class="num">${left}</span><span class="lbl">${left === 1 ? 'יום נשאר' : 'ימים נשארו'}</span></div>`;

  const lead = parseKey(c.start).getDay();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell out"></span>');
  for (let i = 0; i < c.length; i++) {
    const k = addDays(c.start, i), s = dayStatus(c, k);
    const cls = { full: 'full', part: 'part', miss: 'miss', future: 'future', pending: '' }[s] || '';
    cells.push(`<button class="cal-cell ${cls} ${k === t ? 'today' : ''}" data-act="goto-day" data-date="${k}" aria-label="יום ${i + 1}, ${fmtShort(k)}">${i + 1}</button>`);
  }
  const elapsedEnd = t < end ? t : end;
  const taskRows = c.tasks.map(tk => {
    let n = 0, tot = 0;
    for (let k = c.start; k <= elapsedEnd; k = addDays(k, 1)) { tot++; if (taskDone(c, k, tk)) n++; }
    return `<div class="task-stat"><span>${esc(tk.text)}${tk.auto ? ' <span class="auto-tag">אוטומטי</span>' : ''}</span><span class="num muted small">${n}/${tot}</span>
      <div class="progress"><span style="width:${tot ? (n / tot) * 100 : 0}%"></span></div></div>`;
  }).join('');

  return `<section class="card ch-card">
    <div class="ch-top"><div><div class="eyebrow">${esc(c.title)}</div>${headline}
      <div class="muted small">${fmtShort(c.start)} – ${fmtShort(end)} · ${c.length} ימים</div></div>
      <button class="icon-btn" data-act="ch-edit" aria-label="עריכת האתגר">${I.edit}</button></div>
    <div class="progress"><span style="width:${Math.max(0, Math.min(100, ((t < c.start ? 0 : Math.min(dn, c.length)) / c.length) * 100))}%"></span></div>
  </section>
  <section class="card">
    <div class="summary">
      <div class="stat"><b>${st.streak}</b><span>רצף ימים מלאים</span></div>
      <div class="stat"><b>${st.full}</b><span>ימים מלאים</span></div>
      <div class="stat"><b>${st.rate}%</b><span>הצלחה עד עכשיו</span></div>
    </div>
  </section>
  <section class="card">
    <h2 class="card-title">לוח האתגר</h2>
    <div class="cal">${DAYS_S.map(d => `<span class="cal-h">${d}</span>`).join('')}${cells.join('')}</div>
    <div class="legend"><span><i style="background:var(--accent)"></i>הכול הושלם</span><span><i style="background:var(--accent-soft)"></i>חלקי</span><span><i style="background:var(--surface-2);border:1px solid var(--bad)"></i>פוספס</span></div>
    <p class="tiny muted">הקשה על יום פותחת אותו במסך "היום" לסימון.</p>
  </section>
  ${t >= c.start ? `<section class="card"><h2 class="card-title">משימות</h2>${taskRows}</section>` : ''}
  <div class="row">
    ${t > end ? '<button class="btn primary grow" data-act="ch-archive">סיום ושמירה בהיסטוריה</button>' : '<button class="btn soft grow" data-act="confirm" data-do="ch-archive">סיום האתגר עכשיו</button>'}
    <button class="btn danger" data-act="confirm" data-do="ch-del">מחיקה</button>
  </div>
  ${histHtml}`;
}

/* ---------- רינדור ---------- */
const TITLES = { today: 'היום', train: 'אימונים', lift: 'מעקב כוח', food: 'תזונה', body: 'מדדים', goal: 'אתגר' };
const VIEWS = { today: vToday, train: vTrain, lift: vLift, food: vFood, body: vBody, goal: vGoal };
function render() {
  if (!VIEWS[U.tab]) U.tab = 'today';
  $('#view').innerHTML = VIEWS[U.tab]();
  $('#tabTitle').textContent = TITLES[U.tab];
  $$('.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === U.tab ? 'page' : 'false'));
}

/* ---------- גיליון תחתון ---------- */
let onSheetSubmit = null;
function openSheet(title, html, onSubmit) {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = html;
  onSheetSubmit = onSubmit || null;
  $('#sheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheetBody').innerHTML = '';
  onSheetSubmit = null;
  document.body.style.overflow = '';
}
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ---------- טופס אימון ---------- */
function exRow(e = {}) {
  return `<div class="ex-row">
    <input class="exn" name="exName" placeholder="תרגיל, למשל סקוואט" value="${esc(e.name || '')}" aria-label="שם התרגיל">
    <input class="exs" name="exSets" inputmode="numeric" placeholder="סטים" value="${e.sets ?? ''}" aria-label="סטים">
    <input class="exr" name="exReps" placeholder="חזרות" value="${esc(e.reps ?? '')}" aria-label="חזרות">
    <input class="exw" name="exW" inputmode="decimal" placeholder="ק״ג" value="${e.weight ?? ''}" aria-label="משקל בק״ג">
    <button type="button" class="icon-btn small" data-act="row-del" aria-label="הסרת התרגיל">${I.x}</button></div>`;
}
function openWorkout(w, date) {
  const isNew = !w;
  const v = w || { date, title: '', type: 'כוח', duration: '', exercises: [], notes: '', done: false };
  const tpl = isNew && S.templates.length ? `<label class="field"><span>להתחיל מתבנית</span><select id="wf-tpl"><option value="">בלי תבנית</option>
    ${S.templates.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select></label>` : '';
  openSheet(isNew ? 'אימון חדש' : 'עריכת אימון', `<form id="sheetForm" class="form" novalidate>
    ${tpl}
    <label class="field"><span>שם האימון</span><input name="title" id="wf-title" value="${esc(v.title)}" placeholder="למשל: רגליים וישבן" autocomplete="off"></label>
    <div class="grid2">
      <label class="field"><span>תאריך</span><input type="date" name="date" id="wf-date" value="${v.date}"></label>
      <label class="field"><span>משך (דקות)</span><input name="duration" id="wf-dur" inputmode="numeric" value="${v.duration ?? ''}" placeholder="45"></label>
    </div>
    <div class="field"><span class="field-label">סוג</span><div class="chips" id="wf-types">${TYPES.map(t => `<label class="chip"><input type="radio" name="type" value="${t}" ${t === v.type ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
    <div class="field"><span class="field-label">תרגילים</span><div id="exList" class="ex-list">${(v.exercises || []).map(exRow).join('')}</div>
      <button type="button" class="btn soft small" data-act="ex-add">+ תרגיל</button></div>
    <label class="field"><span>הערות</span><textarea name="notes" id="wf-notes" rows="2" placeholder="איך הרגיש, מה לשפר בפעם הבאה">${esc(v.notes)}</textarea></label>
    <label class="check-line"><input type="checkbox" name="done" id="wf-done" ${v.done && !isFuture(v.date) ? 'checked' : ''} ${isFuture(v.date) ? 'disabled' : ''}> האימון בוצע</label>
    ${isNew ? '<label class="check-line"><input type="checkbox" name="saveTpl" id="wf-savetpl"> לשמור גם כתבנית לשימוש חוזר</label>' : ''}
    <div class="form-actions"><button class="btn primary" type="submit">${isNew ? 'הוספה' : 'שמירה'}</button>
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="confirm" data-do="wo-del" data-id="${v.id}">מחיקה</button>`}</div>
  </form>`, (fd, form) => {
    const exercises = $$('.ex-row', form).map(r => ({
      name: $('.exn', r).value.trim(), sets: num($('.exs', r).value), reps: $('.exr', r).value.trim(), weight: num($('.exw', r).value),
    })).filter(e => e.name);
    const data = {
      title: (fd.get('title') || '').trim() || (fd.get('type') || 'אימון'),
      date: fd.get('date') || date || todayKey(),
      type: fd.get('type') || 'אחר',
      duration: num(fd.get('duration')),
      exercises, notes: (fd.get('notes') || '').trim(), done: !!fd.get('done') && !isFuture(fd.get('date') || date || todayKey()),
    };
    if (isNew) {
      S.workouts.push({ id: uid(), ...data });
      if (fd.get('saveTpl')) S.templates.push({ id: uid(), title: data.title, type: data.type, duration: data.duration, exercises: clone(exercises) });
    } else Object.assign(w, data);
    save(); closeSheet(); render(); toast(isNew ? 'האימון נוסף' : 'נשמר');
  });
}

/* ---------- טופס ארוחה ---------- */
function openMeal(m, date) {
  const isNew = !m;
  const hour = new Date().getHours();
  const guess = hour < 10 ? 'בוקר' : hour < 12 ? 'ביניים' : hour < 16 ? 'צהריים' : hour < 21 ? 'ערב' : 'נשנוש';
  const v = m || { date, slot: guess, name: '', kcal: '', protein: '', carbs: '', fat: '', eaten: date <= todayKey() && date === todayKey() };
  const isFav = !!S.favs.find(f => f.name === v.name);
  const favChips = isNew && S.favs.length ? `<div class="field"><span class="field-label">${I.star} ממועדפות</span>
    <div class="chips">${S.favs.map(f => `<button type="button" class="btn soft small" data-act="fav-fill" data-id="${f.id}">${esc(f.name)}</button>`).join('')}</div></div>` : '';
  openSheet(isNew ? 'ארוחה חדשה' : 'עריכת ארוחה', `<form id="sheetForm" class="form" novalidate>
    ${favChips}
    <label class="field"><span>מה אוכלים</span><input name="name" id="mf-name" list="foodList" value="${esc(v.name)}" placeholder="למשל: יוגורט חלבון עם גרנולה" autocomplete="off">
      <datalist id="foodList">${S.foods.map(f => `<option value="${esc(f.name)}"></option>`).join('')}</datalist>
      ${S.foods.length ? '<span class="hint">מזונות שהזנת בעבר מופיעים בהשלמה ומתמלאים לבד.</span>' : ''}</label>
    <div class="field"><span class="field-label">ארוחה</span><div class="chips">${SLOTS.map(s => `<label class="chip"><input type="radio" name="slot" value="${s}" ${s === v.slot ? 'checked' : ''}><span>${s}</span></label>`).join('')}</div></div>
    <label class="field"><span>תאריך</span><input type="date" name="date" id="mf-date" value="${v.date}"></label>
    ${compEditor(v.items)}
    <div class="macro-inputs">
      <label class="field"><span>קלוריות</span><input name="kcal" id="mf-kcal" inputmode="numeric" value="${v.kcal ?? ''}" placeholder="0"></label>
      <label class="field"><span>חלבון ג׳</span><input name="protein" id="mf-p" inputmode="decimal" value="${v.protein ?? ''}" placeholder="0"></label>
      <label class="field"><span>פחמימה ג׳</span><input name="carbs" id="mf-c" inputmode="decimal" value="${v.carbs ?? ''}" placeholder="0"></label>
      <label class="field"><span>שומן ג׳</span><input name="fat" id="mf-f" inputmode="decimal" value="${v.fat ?? ''}" placeholder="0"></label>
    </div>
    <label class="check-line"><input type="checkbox" name="eaten" id="mf-eaten" ${v.eaten && !isFuture(v.date) ? 'checked' : ''} ${isFuture(v.date) ? 'disabled' : ''}> כבר נאכל</label>
    <label class="check-line"><input type="checkbox" name="fav" id="mf-fav" ${isFav ? 'checked' : ''}> שמירה בארוחות המועדפות</label>
    <div class="form-actions"><button class="btn primary" type="submit">${isNew ? 'הוספה' : 'שמירה'}</button>
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="confirm" data-do="meal-del" data-id="${v.id}">מחיקה</button>`}</div>
  </form>`, fd => {
    const name = (fd.get('name') || '').trim();
    if (!name) { toast('צריך לכתוב מה אוכלים'); $('#mf-name').focus(); return; }
    const data = {
      name, slot: fd.get('slot') || 'ביניים', date: fd.get('date') || date || todayKey(),
      kcal: num(fd.get('kcal')) || 0, protein: num(fd.get('protein')) || 0, carbs: num(fd.get('carbs')) || 0, fat: num(fd.get('fat')) || 0,
      items: readComps($('#sheetForm')), eaten: !!fd.get('eaten') && !isFuture(fd.get('date') || date || todayKey()),
    };
    if (isNew) S.meals.push({ id: uid(), ...data }); else Object.assign(m, data);
    const f = { name, kcal: data.kcal, protein: data.protein, carbs: data.carbs, fat: data.fat, items: clone(data.items) };
    const i = S.foods.findIndex(x => x.name === name);
    if (i >= 0) S.foods.splice(i, 1);
    S.foods.unshift(f);
    if (S.foods.length > 300) S.foods.length = 300;
    if (fd.get('fav')) upsertFav(data);
    else if (isFav) S.favs = S.favs.filter(x => x.name !== name);
    save(); closeSheet(); render(); toast(isNew ? 'הארוחה נוספה' : 'נשמר');
  });
}

/* ---------- טופס אתגר ---------- */
function taskRow(t = {}) {
  return `<div class="task-row"><input name="task" value="${esc(t.text || '')}" data-id="${t.id || ''}" placeholder="משימה יומית" aria-label="משימה">
    <button type="button" class="icon-btn small" data-act="row-del" aria-label="הסרת המשימה">${I.x}</button>
    <select name="auto" aria-label="איך מסמנים">${Object.entries(AUTO).map(([k, l]) => `<option value="${k}" ${(t.auto || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
}
function openChallenge(c) {
  const isNew = !c, st = S.settings;
  const v = c || {
    title: 'אתגר 30 יום', start: todayKey(), length: 30,
    tasks: [
      { text: 'אימון של לפחות 30 דקות', auto: 'workout' },
      { text: `לשתות ${liters(st.waterMl)} ליטר`, auto: 'water' },
      { text: 'לעמוד בתפריט', auto: '' },
    ],
  };
  const lens = [7, 14, 21, 30, 60, 90];
  openSheet(isNew ? 'אתגר חדש' : 'עריכת האתגר', `<form id="sheetForm" class="form" novalidate>
    <label class="field"><span>שם האתגר</span><input name="title" id="cf-title" value="${esc(v.title)}" autocomplete="off"></label>
    <div class="grid2">
      <label class="field"><span>מתחילים ב־</span><input type="date" name="start" id="cf-start" value="${v.start}"></label>
      <label class="field"><span>כמה ימים</span><input name="length" id="cf-len" inputmode="numeric" value="${v.length}"></label>
    </div>
    <div class="chips">${lens.map(n => `<button type="button" class="btn soft small" data-act="len" data-v="${n}">${n}</button>`).join('')}</div>
    <div class="field"><span class="field-label">משימות יומיות</span>
      <div id="taskList" class="task-list">${v.tasks.map(taskRow).join('')}</div>
      <span class="hint">משימה אוטומטית מסתמנת לבד כשהנתון מגיע ליעד שבהגדרות. אפשר תמיד לסמן גם ידנית.</span>
      <button type="button" class="btn soft small" data-act="task-add">+ משימה</button></div>
    <div class="form-actions"><button class="btn primary" type="submit">${isNew ? 'יצירת האתגר' : 'שמירה'}</button></div>
  </form>`, (fd, form) => {
    const title = (fd.get('title') || '').trim() || 'האתגר שלי';
    const start = fd.get('start') || todayKey();
    const length = Math.max(1, Math.min(366, parseInt(fd.get('length'), 10) || 30));
    const tasks = $$('.task-row', form).map(r => {
      const inp = $('input', r);
      return { id: inp.dataset.id || uid(), text: inp.value.trim(), auto: $('select', r).value };
    }).filter(t => t.text);
    if (!tasks.length) { toast('צריך לפחות משימה אחת'); return; }
    if (isNew) {
      const old = activeCh(); if (old) old.archived = true;
      S.challenges.unshift({ id: uid(), title, start, length, tasks, checks: {}, archived: false });
    } else {
      Object.assign(c, { title, start, length, tasks });
      const ids = new Set(tasks.map(t => t.id));
      for (const k of Object.keys(c.checks)) { c.checks[k] = c.checks[k].filter(id => ids.has(id)); if (!c.checks[k].length) delete c.checks[k]; }
    }
    save(); closeSheet(); render(); toast(isNew ? 'האתגר התחיל. בהצלחה!' : 'נשמר');
  });
}

/* ---------- הגדרות וגיבוי ---------- */
function openSettings() {
  const s = S.settings;
  const f = (name, label, val, mode = 'numeric', ph = '') => `<label class="field"><span>${label}</span><input name="${name}" id="sf-${name}" inputmode="${mode}" value="${val ?? ''}" placeholder="${ph}"></label>`;
  openSheet('הגדרות ויעדים', `<form id="sheetForm" class="form" novalidate>
    <div class="settings-sec"><h3>תזונה ליום</h3>
      <div class="grid2">${f('kcal', 'קלוריות', s.kcal)}${f('protein', 'חלבון (ג׳)', s.protein)}${f('carbs', 'פחמימה (ג׳)', s.carbs)}${f('fat', 'שומן (ג׳)', s.fat)}</div></div>
    <div class="settings-sec"><h3>שתייה, שינה ומשקל</h3>
      <div class="grid2">${f('waterMl', 'יעד מים (מ״ל)', s.waterMl)}${f('cupMl', 'גודל כוס (מ״ל)', s.cupMl)}${f('sleepH', 'יעד שינה (שעות)', s.sleepH, 'decimal')}${f('targetWeight', 'משקל יעד (ק״ג)', s.targetWeight, 'decimal', 'לא חובה')}${f('stepsGoal', 'יעד צעדים', s.stepsGoal)}</div></div>
    <div class="settings-sec"><h3>קצב שתייה</h3>
      <p class="small muted">יעד המים מתחלק לאורך היום, ובמסך "היום" רואים אם יש פיגור.</p>
      <div class="grid2"><label class="field"><span>מתחילים לשתות</span><input type="time" name="wakeTime" id="sf-wake" value="${esc(s.wakeTime)}"></label>
        <label class="field"><span>מסיימים את היעד עד</span><input type="time" name="waterEnd" id="sf-wend" value="${esc(s.waterEnd)}"></label></div></div>
    <div class="form-actions"><button class="btn primary" type="submit">שמירת היעדים</button></div>
    <div class="settings-sec"><h3>גיבוי</h3>
      <p class="small muted">הנתונים והתמונות נשמרים רק בטלפון הזה. כדאי לייצא גיבוי מדי פעם ולשמור אותו בענן, ככה אפשר לשחזר אם מחליפים טלפון או מוחקים את האפליקציה.</p>
      <div class="row"><button type="button" class="btn soft grow" data-act="export">ייצוא גיבוי</button><button type="button" class="btn soft grow" data-act="import">שחזור מגיבוי</button></div>
    </div>
    <div class="settings-sec"><h3>איפוס</h3>
      <button type="button" class="btn danger" data-act="confirm" data-do="wipe">מחיקת כל הנתונים</button></div>
  </form>`, fd => {
    const g = (k, min, max, def) => { const v = num(fd.get(k)); return v == null ? def : Math.max(min, Math.min(max, v)); };
    Object.assign(S.settings, {
      kcal: g('kcal', 500, 8000, 1800), protein: g('protein', 0, 500, 0), carbs: g('carbs', 0, 1000, 0), fat: g('fat', 0, 400, 0),
      waterMl: g('waterMl', 250, 8000, 2500), cupMl: g('cupMl', 50, 1500, 250), sleepH: g('sleepH', 3, 14, 8),
      stepsGoal: g('stepsGoal', 500, 60000, 8000),
      wakeTime: toMin(fd.get('wakeTime')) != null ? fd.get('wakeTime') : '07:00',
      waterEnd: toMin(fd.get('waterEnd')) != null ? fd.get('waterEnd') : '21:00',
      targetWeight: (() => { const v = num(fd.get('targetWeight')); return v && v > 20 ? v : null; })(),
    });
    save(); closeSheet(); render(); toast('היעדים נשמרו');
  });
}
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
async function exportData() {
  toast('מכינים את הגיבוי…');
  const photos = await Promise.all(PHOTOS.map(async p => ({ id: p.id, date: p.date, note: p.note || '', created: p.created || 0, data: await blobToDataURL(p.blob) })));
  const json = JSON.stringify({ app: 'TrackMi', exported: new Date().toISOString(), state: S, photos });
  const name = `trackmi-backup-${todayKey()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'גיבוי TrackMi' }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function importData(file) {
  if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    if (!obj || obj.app !== 'TrackMi' || !obj.state) throw new Error('bad');
    S = merge(obj.state); save();
    if (Array.isArray(obj.photos)) {
      await idb.clear();
      for (const p of obj.photos) {
        const blob = await (await fetch(p.data)).blob();
        await idb.put({ id: p.id || uid(), date: p.date, note: p.note || '', created: p.created || 0, blob });
      }
      PURL.forEach(u => URL.revokeObjectURL(u)); PURL.clear();
      await loadPhotos();
    }
    closeSheet(); render(); toast('הגיבוי שוחזר');
  } catch (e) { toast('הקובץ הזה לא נראה כמו גיבוי של TrackMi.'); }
}

function openPhoto(id) {
  const p = PHOTOS.find(x => x.id === id); if (!p) return;
  openSheet(`תמונה מ־${fmtShort(p.date)}`, `<form id="sheetForm" class="form" novalidate>
    <img class="photo-full" src="${PURL.get(p.id)}" alt="תמונת מעקב מ־${fmtShort(p.date)}">
    <label class="field"><span>תאריך</span><input type="date" name="date" id="pf-date" value="${p.date}"></label>
    <label class="field"><span>הערה</span><input name="note" id="pf-note" value="${esc(p.note || '')}" placeholder="למשל: אחרי שבועיים של האתגר"></label>
    <div class="form-actions"><button class="btn primary" type="submit">שמירה</button>
      <button type="button" class="btn danger" data-act="confirm" data-do="photo-del" data-id="${p.id}">מחיקה</button></div>
  </form>`, async fd => {
    p.date = fd.get('date') || p.date; p.note = (fd.get('note') || '').trim();
    try { await idb.put(p); } catch (e) { toast('השמירה נכשלה'); return; }
    await loadPhotos(); closeSheet(); render(); toast('נשמר');
  });
}

/* ---------- פעולות ---------- */
function copyWeek(what) {
  const from = addDays(U.week, -7), to = addDays(U.week, -1);
  const src = S[what].filter(x => x.date >= from && x.date <= to);
  if (!src.length) { toast('בשבוע הקודם אין מה להעתיק'); return; }
  for (const x of src) {
    const n = clone(x); n.id = uid(); n.date = addDays(x.date, 7);
    if (what === 'workouts') n.done = false; else n.eaten = false;
    S[what].push(n);
  }
  save(); render(); toast(`הועתקו ${src.length} פריטים לשבוע הזה`);
}
async function doAction(what, ds) {
  const c = activeCh();
  switch (what) {
    case 'wo-del': S.workouts = S.workouts.filter(w => w.id !== ds.id); save(); closeSheet(); render(); toast('האימון נמחק'); break;
    case 'meal-del': S.meals = S.meals.filter(m => m.id !== ds.id); save(); closeSheet(); render(); toast('הארוחה נמחקה'); break;
    case 'fav-del': S.favs = S.favs.filter(f => f.id !== ds.id); save(); render(); toast('הוסר מהמועדפות'); break;
    case 'lift-del': S.lifts = S.lifts.filter(l => l.id !== ds.id); save(); closeSheet(); render(); toast('התרגיל נמחק'); break;
    case 'liftlog-del': { const l = S.lifts.find(x => x.id === ds.id); if (l) { l.logs = l.logs.filter(g => g.id !== ds.log); save(); render(); openLift(l.id); toast('האימון נמחק'); } break; }
    case 'tpl-del': S.templates = S.templates.filter(t => t.id !== ds.id); save(); render(); toast('התבנית נמחקה'); break;
    case 'ch-archive': if (c) { c.archived = true; save(); render(); toast('האתגר נשמר בהיסטוריה'); } break;
    case 'ch-del': if (c) { S.challenges = S.challenges.filter(x => x !== c); save(); render(); toast('האתגר נמחק'); } break;
    case 'photo-del':
      try { await idb.del(ds.id); } catch (e) { /* ignore */ }
      if (PURL.has(ds.id)) { URL.revokeObjectURL(PURL.get(ds.id)); PURL.delete(ds.id); }
      await loadPhotos(); closeSheet(); render(); toast('התמונה נמחקה'); break;
    case 'wipe':
      S = clone(DEFAULTS); save();
      try { await idb.clear(); } catch (e) { /* ignore */ }
      PURL.forEach(u => URL.revokeObjectURL(u)); PURL.clear(); PHOTOS = [];
      closeSheet(); render(); toast('כל הנתונים נמחקו'); break;
  }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const ds = el.dataset, a = ds.act;
  switch (a) {
    case 'tab': U.tab = ds.tab; try { sessionStorage.setItem('trackmi.tab', U.tab); } catch (x) { /* ignore */ } render(); window.scrollTo(0, 0); break;
    case 'date': U.date = addDays(U.date, +ds.n); render(); break;
    case 'date-today': U.date = todayKey(); render(); break;
    case 'goto-day': U.date = ds.date; U.tab = 'today'; render(); window.scrollTo(0, 0); break;
    case 'week': U.week = addDays(U.week, 7 * +ds.n); render(); break;
    case 'week-now': U.week = weekStart(todayKey()); render(); break;
    case 'water': if (isFuture(U.date)) { toast(FUTURE_MSG); break; } setDay(U.date, { water: Math.max(0, (day(U.date).water || 0) + +ds.v) || null }); render(); break;
    case 'water-set': {
      if (isFuture(U.date)) { toast(FUTURE_MSG); break; }
      const cur = day(U.date).water || 0, cup = S.settings.cupMl;
      let v = +ds.v; if (v <= cur && v > cur - cup) v -= cup;
      setDay(U.date, { water: Math.max(0, v) || null }); render(); break;
    }
    case 'sleep': {
      if (isFuture(U.date)) { toast(FUTURE_MSG); break; }
      const h = day(U.date).sleep, step = +ds.v;
      const nv = h == null ? (step > 0 ? S.settings.sleepH : S.settings.sleepH - 0.5) : Math.max(0, Math.min(16, h + step));
      setDay(U.date, { sleep: nv }); render(); break;
    }
    case 'ch-check': {
      if (isFuture(ds.date)) { toast(FUTURE_MSG); break; }
      const c = activeCh(); if (!c) break;
      if (el.getAttribute('aria-disabled') === 'true') { toast('המשימה הזו הושלמה אוטומטית לפי הנתונים'); break; }
      const k = ds.date, list = c.checks[k] || [];
      c.checks[k] = list.includes(ds.task) ? list.filter(x => x !== ds.task) : [...list, ds.task];
      if (!c.checks[k].length) delete c.checks[k];
      save(); render();
      const t = c.tasks.find(x => x.id === ds.task);
      if (t && c.tasks.every(x => taskDone(c, k, x))) toast('כל המשימות של היום הושלמו!');
      break;
    }
    case 'ch-new': openChallenge(null); break;
    case 'ch-edit': { const c = activeCh(); if (c) openChallenge(c); break; }
    case 'ch-archive': doAction('ch-archive', ds); break;
    case 'wo-new': openWorkout(null, ds.date || U.date); break;
    case 'lift-new': openLiftEdit(null, ds.name || ''); break;
    case 'lift-cat': U.liftCat = ds.cat; render(); break;
    case 'lift-open': openLift(ds.id); break;
    case 'lift-edit': { const l = S.lifts.find(x => x.id === ds.id); if (l) openLiftEdit(l); break; }
    case 'wo-edit': { const w = S.workouts.find(x => x.id === ds.id); if (w) openWorkout(w); break; }
    case 'wo-toggle': { const w = S.workouts.find(x => x.id === ds.id); if (w && isFuture(w.date)) { toast(FUTURE_MSG); break; } if (w) { w.done = !w.done; save(); render(); } break; }
    case 'tpl-use': {
      const t = S.templates.find(x => x.id === ds.id); if (!t) break;
      S.workouts.push({ id: uid(), date: todayKey(), title: t.title, type: t.type, duration: t.duration, exercises: clone(t.exercises), notes: '', done: false });
      save(); render(); toast(`"${t.title}" נוסף להיום`); break;
    }
    case 'meal-new': openMeal(null, ds.date || U.date); break;
    case 'fav-pick': favPicker(ds.date || U.date); break;
    case 'fav-new': openFav(null); break;
    case 'fav-edit': { const f = S.favs.find(x => x.id === ds.id); if (f) openFav(f); break; }
    case 'fav-add': {
      const f = S.favs.find(x => x.id === ds.id); if (!f) break;
      S.meals.push({ id: uid(), date: ds.date, ...favFrom(f), eaten: false });
      save(); render(); toast(`"${f.name}" נוסף ל${fmtShort(ds.date)}`); break;
    }
    case 'fav-fill': {
      const f = S.favs.find(x => x.id === ds.id); if (!f) break;
      $('#mf-name').value = f.name; $('#mf-kcal').value = f.kcal || ''; $('#mf-p').value = f.protein || ''; $('#mf-c').value = f.carbs || ''; $('#mf-f').value = f.fat || '';
      $$('#sheetForm input[name=slot]').forEach(r => { r.checked = r.value === f.slot; });
      fillComps(f.items);
      $('#mf-fav').checked = true; break;
    }
    case 'meal-edit': { const m = S.meals.find(x => x.id === ds.id); if (m) openMeal(m); break; }
    case 'meal-toggle': { const m = S.meals.find(x => x.id === ds.id); if (m && isFuture(m.date)) { toast(FUTURE_MSG); break; } if (m) { m.eaten = !m.eaten; save(); render(); } break; }
    case 'copy-week': copyWeek(ds.what); break;
    case 'ex-add': { $('#exList').insertAdjacentHTML('beforeend', exRow()); const rows = $$('#exList .exn'); rows[rows.length - 1].focus(); break; }
    case 'task-add': { $('#taskList').insertAdjacentHTML('beforeend', taskRow()); const rows = $$('#taskList input'); rows[rows.length - 1].focus(); break; }
    case 'row-del': el.closest('.ex-row, .task-row, .comp-row').remove(); break;
    case 'comp-add': { $('#compList').insertAdjacentHTML('beforeend', compRow()); const r = $$('#compList [name=cName]'); r[r.length - 1].focus(); break; }
    case 'len': $('#cf-len').value = ds.v; break;
    case 'settings': openSettings(); break;
    case 'export': exportData(); break;
    case 'import': $('#importInput').click(); break;
    case 'photo-add': $('#photoInput').click(); break;
    case 'photo-open': openPhoto(ds.id); break;
    case 'sheet-close': closeSheet(); break;
    case 'confirm':
      if (!el.dataset.armed) {
        el.dataset.armed = '1'; el.dataset.label = el.innerHTML; el.textContent = 'לאישור, ללחוץ שוב';
        setTimeout(() => { if (el.isConnected && el.dataset.armed) { delete el.dataset.armed; el.innerHTML = el.dataset.label; } }, 3500);
        break;
      }
      doAction(ds.do, ds); break;
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if ((t.id === 'weightInput' || t.id === 'stepsInput') && isFuture(U.date)) { toast(FUTURE_MSG); render(); return; }
  if (t.id === 'mf-date' || t.id === 'wf-date') {
    const box = $(t.id === 'mf-date' ? '#mf-eaten' : '#wf-done');
    if (box) { box.disabled = isFuture(t.value); if (box.disabled) box.checked = false; }
  }
  if (t.id === 'weightInput') {
    const v = num(t.value);
    setDay(U.date, { weight: v && v > 20 && v < 400 ? Math.round(v * 10) / 10 : null });
    render();
  } else if (t.id === 'stepsInput') {
    const v = num(String(t.value).replace(/[^\d]/g, ''));
    setDay(U.date, { steps: v && v > 0 && v < 200000 ? Math.round(v) : null });
    render();
  } else if (t.id === 'wf-tpl') {
    const tp = S.templates.find(x => x.id === t.value); if (!tp) return;
    $('#wf-title').value = tp.title;
    $('#wf-dur').value = tp.duration ?? '';
    $$('#wf-types input').forEach(r => { r.checked = r.value === tp.type; });
    $('#exList').innerHTML = tp.exercises.map(exRow).join('');
  } else if (t.id === 'mf-name') {
    const f = S.foods.find(x => x.name === t.value.trim()); if (!f) return;
    $('#mf-kcal').value = f.kcal || ''; $('#mf-p').value = f.protein || ''; $('#mf-c').value = f.carbs || ''; $('#mf-f').value = f.fat || '';
    if (f.items && f.items.length && !readComps($('#sheetForm')).length) fillComps(f.items);
  } else if (t.id === 'photoInput') {
    const file = t.files && t.files[0]; t.value = ''; addPhoto(file);
  } else if (t.id === 'importInput') {
    const file = t.files && t.files[0]; t.value = ''; importData(file);
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'liftSearch') { U.liftQ = e.target.value; $('#liftList').innerHTML = liftListHtml(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  if (e.key === 'Enter' && (e.target.id === 'weightInput' || e.target.id === 'stepsInput')) e.target.blur();
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'sheetForm') return;
  e.preventDefault();
  if (onSheetSubmit) onSheetSubmit(new FormData(e.target), e.target);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = todayKey();
  if (t !== U.lastToday) { if (U.date === U.lastToday) U.date = t; U.week = weekStart(t); U.lastToday = t; render(); }
});
window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); render(); } });

render();
// רענון כל דקה כדי שקצב השתייה יתעדכן לפי השעה
setInterval(() => {
  if (document.visibilityState !== 'visible' || U.tab !== 'today' || !$('#sheet').hidden) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
  render();
}, 60000);
loadPhotos().then(() => { if (U.tab === 'body') render(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
