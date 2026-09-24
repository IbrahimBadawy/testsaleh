/* =====================================================================
 *  store.js — الحالة، الحفظ المحلي، التراجع/الإعادة، البيانات التجريبية
 * ===================================================================== */
'use strict';

const STORE_KEY = 'smart-timetable:v1';
const UI_KEY = 'smart-timetable:ui';
const DAY_NAMES = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const ROOM_TYPES = Engine.ROOM_TYPES;
const PALETTE = ['#6366f1', '#f43f5e', '#0ea5e9', '#14b8a6', '#f59e0b', '#22c55e', '#a855f7', '#ec4899', '#f97316', '#8b5cf6', '#3b82f6', '#84cc16', '#06b6d4', '#e11d48', '#d946ef', '#64748b'];
const GRADE_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#f43f5e', '#a855f7', '#22c55e', '#ec4899', '#64748b'];
const SUBJECT_ICONS = ['📖', '➗', '🔤', '🕌', '✝️', '🔍', '🔬', '🌍', '🎨', '⚽', '🎵', '💻', '✍️', '🧮', '📐', '🧪', '🌱', '🏛️', '🗣️', '📚', '🎭', '🧠', '🌐', '🛠️', '🇫🇷', '🧩'];
const GRADE_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

let state = null;
let ui = null;
const hist = { undo: [], redo: [] };

// ---------------------------------------------------------------- helpers
function uid(p) { return (p || 'id') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hexToRgb(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [99, 102, 241];
}
function tint(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function cvars(hex) { return `--c:${hex};--t:${tint(hex, 0.12)};--t2:${tint(hex, 0.26)};--t3:${tint(hex, 0.5)}`; }
const byId = (arr, id) => arr.find(x => x.id === id);
const findGrade = id => byId(state.grades, id);
const findClass = id => byId(state.classes, id);
const findSubject = id => byId(state.subjects, id);
const findTeacher = id => byId(state.teachers, id);
const findRoom = id => byId(state.rooms, id);
const activeDays = () => state.days.map((d, i) => (d.on ? i : -1)).filter(i => i >= 0);
const periodsOf = (subj, gradeId) => +((subj.periods || {})[gradeId] || 0);
const teacherOfLesson = l => Engine.teacherOf(state, l);
function stripTitle(name) { return String(name || '').replace(/^(أ\.|أ\/|م\.|د\.|كابتن|الأستاذة?|أستاذة?)\s*/, '').trim(); }
function initials(name) { const s = stripTitle(name); return s ? s[0] : '؟'; }

function fmtTime(min) {
  min = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
}
function periodTimes(st) {
  st = st || state;
  const { count, start, duration, breakAfter, breakDuration } = st.periods;
  const [h, m] = String(start || '07:30').split(':').map(Number);
  let t = (h || 0) * 60 + (m || 0);
  const out = [];
  let brk = null;
  for (let p = 0; p < count; p++) {
    const s = t, e = t + (+duration || 45);
    out.push({ start: fmtTime(s), end: fmtTime(e) });
    t = e;
    if (+breakAfter && p + 1 === +breakAfter && p + 1 < count) {
      brk = { start: fmtTime(t), end: fmtTime(t + (+breakDuration || 0)) };
      t += +breakDuration || 0;
    }
  }
  out.breakTime = brk;
  return out;
}

// ---------------------------------------------------------------- state
function baseState() {
  return {
    version: 1,
    isSample: false,
    school: { name: 'مدرستي', year: '2026 / 2027' },
    days: DAY_NAMES.map((name, i) => ({ name, on: i >= 1 && i <= 5 })),
    periods: { count: 7, start: '07:30', duration: 45, breakAfter: 3, breakDuration: 30 },
    rules: { maxConsecutive: 4, defaultMaxWeek: 24, defaultMaxDay: 6 },
    grades: [], classes: [], rooms: [], subjects: [], teachers: [],
    assign: {}, lessons: [],
  };
}

function makeGrade(st, i) {
  return { id: uid('g'), name: 'الصف ' + (GRADE_ORDINALS[i] || i + 1), short: String(i + 1), color: GRADE_COLORS[i % GRADE_COLORS.length], blocked: [] };
}

function addClassTo(st, grade, withRoom) {
  const n = st.classes.filter(c => c.gradeId === grade.id).length + 1;
  const name = `${grade.short}/${n}`;
  let roomId = null;
  if (withRoom !== false) {
    let rname = `قاعة ${grade.short}${String(n).padStart(2, '0')}`;
    while (st.rooms.some(r => r.name === rname)) rname += '′';
    const room = { id: uid('r'), name: rname, type: 'classroom', capacity: 35 };
    st.rooms.push(room);
    roomId = room.id;
  }
  const cls = { id: uid('c'), gradeId: grade.id, name, roomId };
  st.classes.push(cls);
  return cls;
}

const SAMPLE_SUBJECTS = [
  // الاسم، المختصر، الأيقونة، اللون، نوع القاعة، الحد اليومي، صباحية؟، الحصص الأسبوعية للصفوف 1..6
  ['اللغة العربية', 'عربي', '📖', '#6366f1', '', 2, true, [9, 9, 9, 8, 8, 8]],
  ['الرياضيات', 'رياضيات', '➗', '#f43f5e', '', 2, true, [6, 6, 6, 5, 5, 5]],
  ['اللغة الإنجليزية', 'إنجليزي', '🔤', '#0ea5e9', '', 2, false, [4, 4, 4, 5, 5, 5]],
  ['التربية الدينية', 'دين', '🕌', '#14b8a6', '', 1, false, [3, 3, 3, 2, 2, 2]],
  ['اكتشف (متعدد التخصصات)', 'اكتشف', '🔍', '#f59e0b', '', 1, false, [4, 4, 4, 0, 0, 0]],
  ['العلوم', 'علوم', '🔬', '#22c55e', '', 1, false, [0, 0, 0, 4, 4, 4]],
  ['الدراسات الاجتماعية', 'دراسات', '🌍', '#a855f7', '', 1, false, [0, 0, 0, 3, 3, 3]],
  ['التربية الفنية', 'فنية', '🎨', '#ec4899', 'art', 1, false, [2, 2, 2, 1, 1, 1]],
  ['التربية الرياضية', 'رياضة', '⚽', '#f97316', 'sports', 1, false, [2, 2, 2, 2, 2, 2]],
  ['التربية الموسيقية', 'موسيقى', '🎵', '#8b5cf6', 'music', 1, false, [1, 1, 1, 1, 1, 1]],
  ['تكنولوجيا المعلومات', 'حاسب', '💻', '#3b82f6', 'computer', 1, false, [1, 1, 1, 1, 1, 1]],
];

const SPECIAL_ROOMS = [
  ['معمل الحاسب الآلي', 'computer', 30], ['الملعب الرئيسي', 'sports', 60], ['الصالة المغطاة', 'sports', 40],
  ['غرفة الموسيقى', 'music', 30], ['المرسم', 'art', 30], ['معمل العلوم', 'science', 30],
  ['المكتبة', 'library', 40], ['المسرح المدرسي', 'hall', 200],
];

function addSampleSubjects(st) {
  SAMPLE_SUBJECTS.forEach(([name, short, icon, color, roomType, maxPerDay, morning, per]) => {
    const periods = {};
    st.grades.forEach((g, i) => { if (per[i]) periods[g.id] = per[i]; });
    st.subjects.push({ id: uid('s'), name, short, icon, color, roomType, maxPerDay, morning, periods });
  });
}
function addSpecialRooms(st) {
  SPECIAL_ROOMS.forEach(([name, type, capacity]) => st.rooms.push({ id: uid('r'), name, type, capacity }));
}

function buildSample() {
  const st = baseState();
  st.isSample = true;
  st.school = { name: 'مدرسة النور الابتدائية', year: '2026 / 2027' };
  for (let i = 0; i < 6; i++) st.grades.push(makeGrade(st, i));
  // الصف الأول والثاني ينصرفان مبكراً يوم الخميس
  st.grades[0].blocked = ['5-6'];
  st.grades[1].blocked = ['5-6'];
  st.grades.forEach(g => { for (let c = 0; c < 3; c++) addClassTo(st, g); });
  addSpecialRooms(st);
  addSampleSubjects(st);

  const S = st.subjects.map(s => s.id);
  const G = st.grades.map(g => g.id);
  const low = G.slice(0, 3), up = G.slice(3), all = G;
  const thu = Array.from({ length: 7 }, (_, p) => '5-' + p);
  const TEACHERS = [
    ['أ. محمد عبد الرحمن', [0], low], ['أ. فاطمة الزهراء علي', [0], low], ['أ. أحمد مصطفى', [0], low],
    ['أ. منى إبراهيم', [0], low, ['1-0', '1-1']], ['أ. سعاد حسن', [0], low],
    ['أ. خالد عبد العزيز', [0], up], ['أ. هبة سامي', [0], up], ['أ. ياسر فؤاد', [0], up],
    ['أ. عمرو السيد', [1], low], ['أ. نهى كمال', [1], low], ['أ. طارق محمود', [1], all, ['1-0']],
    ['أ. إيمان رشدي', [1], up], ['أ. شريف عادل', [1], up],
    ['أ. سارة جمال', [2], all], ['أ. مروة عصام', [2], all], ['أ. كريم نبيل', [2], all], ['أ. دينا فتحي', [2], all],
    ['أ. عبد الله حسين', [3], all], ['أ. محمود الشافعي', [3], all], ['أ. مريم يوسف', [3], all, thu],
    ['أ. رانيا صلاح', [4], low], ['أ. هالة مجدي', [4], low],
    ['أ. وليد شوقي', [5], up], ['أ. أسماء حمدي', [5], up],
    ['أ. حسام الدين علي', [6, 5], up], ['أ. نجلاء فاروق', [6], up],
    ['أ. ريهام عبد الحميد', [7], all], ['أ. مصطفى كامل', [7], all],
    ['كابتن هشام زكي', [8], all], ['كابتن أيمن سعيد', [8], all],
    ['أ. نادية لطفي', [9], all, thu], ['أ. إسلام ممدوح', [10], all],
  ];
  TEACHERS.forEach(([name, subs, grades, blocked], i) => st.teachers.push({
    id: uid('t'), name, color: PALETTE[i % PALETTE.length],
    subjectIds: subs.map(k => S[k]), gradeIds: grades.slice(),
    maxWeek: 24, maxDay: 6, blocked: (blocked || []).slice(),
  }));
  syncLessons(st);
  autoAssign(st, { onlyEmpty: true });
  syncLessons(st);
  return st;
}

function newSchoolState() {
  const st = baseState();
  st.school = { name: 'مدرستي الابتدائية', year: '2026 / 2027' };
  for (let i = 0; i < 6; i++) st.grades.push(makeGrade(st, i));
  st.grades.forEach(g => { addClassTo(st, g); addClassTo(st, g); });
  addSpecialRooms(st);
  addSampleSubjects(st);
  syncLessons(st);
  return st;
}

/** مزامنة وحدات الحصص مع (الفصول × المواد × عدد الحصص) */
function syncLessons(st) {
  const classIds = new Set(st.classes.map(c => c.id));
  const subjIds = new Set(st.subjects.map(s => s.id));
  const teacherIds = new Set(st.teachers.map(t => t.id));
  const want = new Map();
  for (const c of st.classes) for (const s of st.subjects) {
    const n = periodsOf(s, c.gradeId);
    if (n > 0) want.set(c.id + '|' + s.id, n);
  }
  const groups = new Map();
  for (const l of st.lessons) {
    const k = l.classId + '|' + l.subjectId;
    if (!want.has(k)) continue;
    (groups.get(k) || groups.set(k, []).get(k)).push(l);
  }
  const rank = l => (l.locked ? 0 : l.day != null ? 1 : 2);
  const keep = [];
  for (const [k, n] of want) {
    const arr = (groups.get(k) || []).sort((a, b) => rank(a) - rank(b));
    const [classId, subjectId] = k.split('|');
    for (let i = 0; i < n; i++) keep.push(arr[i] || { id: uid('l'), classId, subjectId, day: null, period: null, roomId: null, locked: false });
  }
  const P = +st.periods.count;
  for (const l of keep) {
    if (l.day != null && (!st.days[l.day] || !st.days[l.day].on || l.period >= P)) {
      l.day = null; l.period = null; l.roomId = null; l.locked = false;
    }
    if (l.day == null) l.locked = false;
  }
  st.lessons = keep;
  for (const k of Object.keys(st.assign)) {
    const [c, s] = k.split('|');
    if (!classIds.has(c) || !subjIds.has(s) || !teacherIds.has(st.assign[k])) delete st.assign[k];
  }
  const roomIds = new Set(st.rooms.map(r => r.id));
  for (const c of st.classes) if (c.roomId && !roomIds.has(c.roomId)) c.roomId = null;
  for (const l of st.lessons) if (l.roomId && !roomIds.has(l.roomId)) l.roomId = null;
}

function normalize(st) {
  syncLessons(st);
  Engine.normalizeRooms(st);
}

/** توزيع المواد على المعلمين تلقائياً (موازنة النصاب + الاستمرارية داخل الصف) */
function autoAssign(st, opts) {
  opts = opts || {};
  const onlyEmpty = opts.onlyEmpty !== false;
  const tIds = new Set(st.teachers.map(t => t.id));
  const qualified = (t, s, c) => (t.subjectIds || []).includes(s.id) && (t.gradeIds || []).includes(c.gradeId);
  const targets = [];
  for (const c of st.classes) for (const s of st.subjects) {
    const n = periodsOf(s, c.gradeId);
    if (!n) continue;
    if (opts.gradeId && c.gradeId !== opts.gradeId) continue;
    const k = c.id + '|' + s.id;
    const cur = st.assign[k];
    if (onlyEmpty && cur && tIds.has(cur)) continue;
    delete st.assign[k];
    targets.push({ c, s, n, k });
  }
  const load = new Map(st.teachers.map(t => [t.id, 0]));
  for (const k of Object.keys(st.assign)) {
    const tid = st.assign[k];
    if (!load.has(tid)) continue;
    const [cid, sid] = k.split('|');
    const c = byIdIn(st.classes, cid), s = byIdIn(st.subjects, sid);
    if (c && s) load.set(tid, load.get(tid) + periodsOf(s, c.gradeId));
  }
  const gOrder = new Map(st.grades.map((g, i) => [g.id, i]));
  targets.forEach(x => { x.q = st.teachers.filter(t => qualified(t, x.s, x.c)).length; });
  targets.sort((a, b) => a.q - b.q || st.subjects.indexOf(a.s) - st.subjects.indexOf(b.s) ||
    gOrder.get(a.c.gradeId) - gOrder.get(b.c.gradeId) || st.classes.indexOf(a.c) - st.classes.indexOf(b.c));
  let done = 0, missing = 0;
  const maxW = t => +t.maxWeek || 24;
  for (const x of targets) {
    const cands = st.teachers.filter(t => qualified(t, x.s, x.c));
    if (!cands.length) { missing++; continue; }
    const cap = t => maxW(t) - load.get(t.id);
    const same = t => (st.classes.some(c2 => c2.gradeId === x.c.gradeId && st.assign[c2.id + '|' + x.s.id] === t.id) ? 1 : 0);
    const fit = cands.filter(t => cap(t) >= x.n);
    const pick = fit.length
      ? fit.sort((a, b) => same(b) - same(a) || load.get(a.id) / maxW(a) - load.get(b.id) / maxW(b))[0]
      : cands.sort((a, b) => cap(b) - cap(a))[0];
    st.assign[x.k] = pick.id;
    load.set(pick.id, load.get(pick.id) + x.n);
    done++;
  }
  return { done, missing };
}
function byIdIn(arr, id) { return arr.find(x => x.id === id); }

// ---------------------------------------------------------------- persistence + history
let saveTimer = 0;
function persistNow() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
}
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(persistNow, 200); }
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const st = JSON.parse(raw);
    return st && st.version ? upgrade(st) : null;
  } catch (e) { return null; }
}
function upgrade(st) {
  const b = baseState();
  for (const k of Object.keys(b)) if (st[k] == null) st[k] = b[k];
  st.rules = Object.assign(b.rules, st.rules);
  st.periods = Object.assign(b.periods, st.periods);
  return st;
}
function defaultUi() {
  return { page: 'dashboard', ttMode: 'class', ttClass: null, ttTeacher: null, ttRoom: null, ovRows: 'classes', ovGrade: 'all', assignGrade: null, tSearch: '', tFilter: '', roomFilter: '', openAvail: {}, freeDay: null, freePeriod: 0 };
}
function loadUi() { try { return Object.assign(defaultUi(), JSON.parse(localStorage.getItem(UI_KEY) || '{}')); } catch (e) { return defaultUi(); } }
function persistUi() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* ignore */ } }

/** كل تعديل على البيانات يمر من هنا (لتسجيل التراجع والحفظ) */
function commit(mutator, opts) {
  opts = opts || {};
  hist.undo.push(JSON.stringify(state));
  if (hist.undo.length > 80) hist.undo.shift();
  hist.redo.length = 0;
  mutator(state);
  normalize(state);
  persist();
  if (opts.render === false) App.refreshChrome(); else App.refresh();
}
function pushUndoSnapshot(snapshot) {
  hist.undo.push(snapshot);
  if (hist.undo.length > 80) hist.undo.shift();
  hist.redo.length = 0;
}
function undo() {
  if (!hist.undo.length) return toast('لا يوجد ما يمكن التراجع عنه', 'info');
  hist.redo.push(JSON.stringify(state));
  state = JSON.parse(hist.undo.pop());
  persist(); App.refresh();
  toast('تم التراجع عن آخر خطوة', 'info', 1800);
}
function redo() {
  if (!hist.redo.length) return toast('لا يوجد ما يمكن إعادته', 'info');
  hist.undo.push(JSON.stringify(state));
  state = JSON.parse(hist.redo.pop());
  persist(); App.refresh();
  toast('تمت الإعادة', 'info', 1800);
}
function replaceState(st, msg) {
  hist.undo.push(JSON.stringify(state));
  hist.redo.length = 0;
  state = st;
  normalize(state);
  persistNow();
  ui = Object.assign(defaultUi(), { page: ui.page });
  persistUi();
  App.refresh();
  if (msg) toast(msg, 'success');
}
