/* =====================================================================
 *  timetable.js — الجدول الذكي: العرض، السحب والإفلات، تلوين الخانات،
 *                 التوليد التلقائي، الطباعة والتصدير
 * ===================================================================== */
'use strict';

const TT = { E: null, conflictIds: new Set(), pending: null, drag: null, sel: null, targets: null, suppressClick: false, raf: 0, pt: null };

function ttEnsure() {
  if (!findClass(ui.ttClass)) ui.ttClass = state.classes[0] ? state.classes[0].id : null;
  if (!findTeacher(ui.ttTeacher)) ui.ttTeacher = state.teachers[0] ? state.teachers[0].id : null;
  if (!findRoom(ui.ttRoom)) { const r = state.rooms.find(x => x.type !== 'classroom') || state.rooms[0]; ui.ttRoom = r ? r.id : null; }
}
const ownerId = mode => (mode === 'class' ? ui.ttClass : mode === 'teacher' ? ui.ttTeacher : ui.ttRoom);
const ownerMap = (E, kind) => (kind === 'class' ? E.idx.cls : kind === 'teacher' ? E.idx.tch : E.idx.room);
const lessonById = id => state.lessons.find(l => l.id === id);
const subjOf = l => findSubject(l.subjectId) || { name: '؟', icon: '❔', color: '#94a3b8', short: '؟' };

function conflictText(id) {
  const c = App.issues.conflicts.find(x => x.lesson.id === id);
  return c ? c.msgs.join('\n') : '';
}

/* ------------------------------------------------------------------ render */
function renderTimetable() {
  ttEnsure();
  TT.E = App.env;
  TT.conflictIds = App.issues.conflictIds;
  TT.sel = null; TT.targets = null;
  hideSelBanner();
  const mode = ui.ttMode;
  if (!state.lessons.length) {
    return emptyState('calendar', 'لا توجد حصص لجدولتها بعد', 'أضف الصفوف والفصول، ثم المواد وعدد حصصها لكل صف، ثم وزّع المواد على المعلمين — وبعدها سيظهر الجدول هنا.',
      `<button class="btn btn-primary" data-act="go" data-page="grades">${icon('layers')} ابدأ بالصفوف</button> <button class="btn btn-soft" data-act="loadSample">${icon('sparkles')} جرّب البيانات التجريبية</button>`);
  }
  const modes = [['class', 'الفصول', 'layers'], ['teacher', 'المعلمون', 'user'], ['room', 'القاعات', 'door'], ['overview', 'نظرة عامة', 'grid']];
  const top = `<div class="tt-top">
      <div class="seg">${modes.map(([id, label, ic]) => `<button class="${mode === id ? 'on' : ''}" data-act="ttMode" data-m="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</div>
      <div class="legend" id="legend">
        <span class="lg ok"><i></i>متاح</span><span class="lg warn"><i></i>متاح بملاحظة</span><span class="lg swap"><i></i>تبديل</span><span class="lg bad"><i></i>تعارض</span>
      </div>
      <span class="grow"></span>
      <button class="btn btn-primary shine" data-act="generate">${icon('sparkles')} توليد تلقائي</button>
      <button class="icon-btn" data-act="clearTT" data-tip="تفريغ الجدول (عدا الحصص المثبتة)">${icon('eraser')}</button>
      <button class="icon-btn" data-act="printMenu" data-tip="طباعة الجداول">${icon('print')}</button>
      <button class="icon-btn" data-act="exportXls" data-tip="تصدير إلى Excel">${icon('table')}</button>
    </div>`;
  if (mode === 'overview') return top + ttOverview();
  const id = ownerId(mode);
  if (!id) return top + emptyState(mode === 'teacher' ? 'users' : 'door', 'لا توجد بيانات لعرضها', mode === 'teacher' ? 'أضف معلمين أولاً.' : 'أضف قاعات أولاً.');
  return top + ttPicker(mode) + `<div class="tt-body">${ttEntity(mode, id)}${ttPool(mode, id)}</div>`;
}
function afterTimetable(root) {
  if (TT.cascade) {
    root.querySelectorAll('.tt-grid .lesson, .ov-grid .mini').forEach((el, i) => { el.style.setProperty('--i', Math.min(i, 400)); el.classList.add('cascade'); });
    TT.cascade = false;
  }
  if (TT.flash) {
    TT.flash.forEach(id => root.querySelectorAll(`[data-lesson="${id}"]`).forEach(el => el.classList.add('pop')));
    TT.flash = null;
  }
}

function ttPicker(mode) {
  if (mode === 'class') {
    return `<div class="picker card">${state.grades.map(g => {
      const cls = state.classes.filter(c => c.gradeId === g.id);
      if (!cls.length) return '';
      return `<div class="pk-group" style="${cvars(g.color)}"><span class="pk-label">${esc(g.name)}</span>${cls.map(c => {
        const ls = state.lessons.filter(l => l.classId === c.id);
        const pl = ls.filter(l => l.day != null).length;
        const pct = ls.length ? Math.round((pl * 100) / ls.length) : 0;
        const bad = ls.some(l => TT.conflictIds.has(l.id));
        return `<button class="pk-chip ${ui.ttClass === c.id ? 'on' : ''} ${bad ? 'has-bad' : ''} ${pct === 100 ? 'full' : ''}" data-act="ttPick" data-id="${c.id}" data-tip="${pl}/${ls.length} حصة موزعة"><span>${esc(c.name)}</span><i class="pk-ring" style="--p:${pct}"></i></button>`;
      }).join('')}</div>`;
    }).join('')}</div>`;
  }
  if (mode === 'teacher') {
    const loads = Engine.teacherLoads(state);
    return `<div class="picker card"><label class="search sm">${icon('search')}<input placeholder="بحث عن معلم…" data-inp="ttTSearch"></label>
      <div class="pk-scroll">${state.teachers.map(t => {
        const L = loads.get(t.id);
        const full = L.assigned && L.placed === L.assigned;
        return `<button class="pk-chip t ${ui.ttTeacher === t.id ? 'on' : ''} ${full ? 'full' : ''}" style="${cvars(t.color)}" data-act="ttPick" data-id="${t.id}" data-name="${esc(t.name)}">${avatar(t, 'xs')}<span>${esc(t.name)}</span><small>${L.placed}/${L.assigned}</small></button>`;
      }).join('')}</div></div>`;
  }
  return `<div class="picker card">${ROOM_TYPES.map(tp => {
    const rs = state.rooms.filter(r => r.type === tp.id);
    if (!rs.length) return '';
    return `<div class="pk-group" style="${cvars(ROOM_TYPE_COLOR[tp.id])}"><span class="pk-label">${tp.icon} ${tp.name}</span>${rs.map(r => `<button class="pk-chip ${ui.ttRoom === r.id ? 'on' : ''}" data-act="ttPick" data-id="${r.id}"><span>${esc(r.name)}</span></button>`).join('')}</div>`;
  }).join('')}</div>`;
}
INP.ttTSearch = el => {
  const q = el.value.trim();
  document.querySelectorAll('.pk-chip.t').forEach(c => { c.style.display = !q || c.dataset.name.includes(q) ? '' : 'none'; });
};

function ttEntity(mode, id) {
  return `<div class="tt-main card">${ttHead(mode, id)}<div class="tt-scroll" data-keep="tt-scroll">${ttGrid(mode, id)}</div></div>`;
}

function ttHead(mode, id) {
  const kpi = (b, s, extra) => `<div class="kpi ${extra || ''}"><b>${b}</b><span>${s}</span></div>`;
  const acts = `<div class="tt-head-actions">
      <button class="btn btn-soft sm" data-act="fillOne">${icon('wand')} إكمال هذا الجدول</button>
      <button class="btn btn-ghost sm" data-act="clearOne">${icon('eraser')} تفريغ</button>
      <button class="icon-btn sm" data-act="printOne" data-tip="طباعة هذا الجدول">${icon('print')}</button></div>`;
  if (mode === 'class') {
    const c = findClass(id), g = findGrade(c.gradeId) || { name: '', color: '#6366f1' }, room = findRoom(c.roomId);
    const ls = state.lessons.filter(l => l.classId === id);
    const pl = ls.filter(l => l.day != null).length;
    const bad = ls.filter(l => TT.conflictIds.has(l.id)).length;
    const pct = ls.length ? Math.round((pl * 100) / ls.length) : 0;
    return `<div class="tt-head" style="${cvars(g.color)}">
      <div class="tt-title"><span class="tt-badge">${esc(c.name)}</span><div><h3>فصل ${esc(c.name)}</h3><p>${esc(g.name)}${room ? ' • ' + esc(room.name) : ''}</p></div></div>
      <div class="tt-kpis"><div class="kpi prog"><b>${pl}/${ls.length}</b><span>حصة موزعة</span><div class="meter ok"><span style="width:${pct}%"></span></div></div>
        ${bad ? kpi(bad, 'تعارض', 'bad') : kpi('0', 'تعارض', 'good')}</div>${acts}</div>`;
  }
  if (mode === 'teacher') {
    const t = findTeacher(id);
    const ls = state.lessons.filter(l => teacherOfLesson(l) === id);
    const pl = ls.filter(l => l.day != null);
    let gaps = 0;
    const byDay = {};
    pl.forEach(l => { (byDay[l.day] = byDay[l.day] || []).push(l.period); });
    Object.values(byDay).forEach(ps => { ps.sort((a, b) => a - b); gaps += ps[ps.length - 1] - ps[0] + 1 - ps.length; });
    const bad = ls.filter(l => TT.conflictIds.has(l.id)).length;
    const subs = (t.subjectIds || []).map(findSubject).filter(Boolean).map(s => s.icon + ' ' + esc(s.name)).join(' • ');
    return `<div class="tt-head" style="${cvars(t.color)}">
      <div class="tt-title">${avatar(t, 'lg')}<div><h3>${esc(t.name)}</h3><p>${subs || 'لم تُحدد مواد'}</p></div></div>
      <div class="tt-kpis"><div class="kpi prog"><b>${pl.length}/${ls.length}</b><span>النصاب ${t.maxWeek}</span><div class="meter ${ls.length > +t.maxWeek ? 'bad' : 'ok'}"><span style="width:${ls.length ? (pl.length * 100) / ls.length : 0}%"></span></div></div>
        ${kpi(Object.keys(byDay).length, 'أيام عمل')}${kpi(gaps, 'فراغات بين الحصص', gaps > 4 ? 'warn' : '')}${bad ? kpi(bad, 'تعارض', 'bad') : ''}</div>${acts}</div>`;
  }
  const r = findRoom(id), tp = roomTypeOf(r.type);
  const used = state.lessons.filter(l => l.day != null && l.roomId === id).length;
  const total = activeDays().length * +state.periods.count;
  return `<div class="tt-head" style="${cvars(ROOM_TYPE_COLOR[r.type] || '#64748b')}">
    <div class="tt-title"><span class="tt-badge">${tp.icon}</span><div><h3>${esc(r.name)}</h3><p>${tp.name}${r.capacity ? ' • سعة ' + r.capacity : ''}</p></div></div>
    <div class="tt-kpis"><div class="kpi prog"><b>${used}/${total}</b><span>نسبة الإشغال</span><div class="meter"><span style="width:${total ? (used * 100) / total : 0}%"></span></div></div></div>${acts}</div>`;
}

function ttGrid(kind, id) {
  const E = TT.E;
  const days = activeDays();
  const P = +state.periods.count;
  const times = periodTimes();
  const br = +state.periods.breakAfter;
  const hasBr = br > 0 && br < P;
  const cols = ['74px'];
  for (let p = 0; p < P; p++) { cols.push('minmax(98px,1fr)'); if (hasBr && p === br - 1) cols.push('30px'); }
  let blocked = new Set();
  if (kind === 'class') { const c = findClass(id); const g = c && findGrade(c.gradeId); blocked = new Set((g && g.blocked) || []); }
  else if (kind === 'teacher') blocked = new Set(findTeacher(id).blocked || []);
  const map = ownerMap(E, kind);
  let h = `<div class="tt-grid" style="grid-template-columns:${cols.join(' ')}"><div class="tt-corner">اليوم / الحصة</div>`;
  for (let p = 0; p < P; p++) {
    h += `<div class="tt-ph"><b>الحصة ${p + 1}</b><span>${times[p].start} – ${times[p].end}</span></div>`;
    if (hasBr && p === br - 1) h += `<div class="tt-break" style="grid-column:${p + 3};grid-row:1 / span ${days.length + 1}"><span>☕ استراحة ${times.breakTime ? times.breakTime.start : ''}</span></div>`;
  }
  for (const d of days) {
    h += `<div class="tt-day"><span>${esc(state.days[d].name)}</span></div>`;
    for (let p = 0; p < P; p++) {
      const ls = map.get(id + '@' + Engine.slotKey(d, p)) || [];
      const bl = blocked.has(d + '-' + p);
      h += `<div class="cell ${bl ? 'blocked' : ''} ${ls.length > 1 ? 'multi' : ''}" data-cell data-kind="${kind}" data-owner="${id}" data-d="${d}" data-p="${p}">${ls.map(l => lessonCard(l, kind)).join('')}${bl && !ls.length ? '<span class="blk-label">غير متاح</span>' : ''}</div>`;
    }
  }
  return h + '</div>';
}

function lessonCard(L, kind) {
  const E = TT.E;
  const s = subjOf(L), c = E.ctx.classById.get(L.classId);
  const tid = Engine.teacherOf(state, L), t = tid && E.ctx.teacherById.get(tid);
  const r = L.roomId && E.ctx.roomById.get(L.roomId);
  const sub = [];
  if (kind === 'class') { sub.push(t ? esc(t.name) : '<span class="no-t">بدون معلم</span>'); if (r && r.id !== c.roomId) sub.push('📍 ' + esc(r.name)); }
  else if (kind === 'teacher') { sub.push('فصل ' + esc(c.name)); if (r) sub.push(esc(r.name)); }
  else { sub.push('فصل ' + esc(c.name)); if (t) sub.push(esc(t.name)); }
  const bad = TT.conflictIds.has(L.id);
  return `<div class="lesson ${L.locked ? 'locked' : ''} ${bad ? 'conflict' : ''}" data-lesson="${L.id}" data-drag style="${cvars(s.color)}">
    <span class="l-icon">${s.icon}</span>
    <span class="l-body"><b class="l-title">${esc(s.name)}</b><small class="l-sub">${sub.join(' • ')}</small></span>
    <span class="l-tools"><button class="l-btn" data-act="lock" data-id="${L.id}" data-tip="${L.locked ? 'إلغاء التثبيت' : 'تثبيت (لن تتحرك عند التوليد)'}">${icon(L.locked ? 'unlock' : 'lock')}</button><button class="l-btn" data-act="unplace" data-id="${L.id}" data-tip="إرجاع للقائمة">${icon('x')}</button></span>
    ${L.locked ? `<span class="l-pin">${icon('lock')}</span>` : ''}
    ${bad ? `<span class="l-bad" data-tip="${esc(conflictText(L.id))}">!</span>` : ''}
  </div>`;
}

function ttPool(mode, id) {
  const E = TT.E;
  let list = App.issues.unplaced;
  if (mode === 'class') list = list.filter(l => l.classId === id);
  else if (mode === 'teacher') list = list.filter(l => teacherOfLesson(l) === id);
  else {
    const r = findRoom(id);
    list = list.filter(l => { const s = findSubject(l.subjectId), c = findClass(l.classId); return s && r && (s.roomType ? s.roomType === r.type : c && c.roomId === r.id); });
  }
  const groups = new Map();
  for (const l of list) { const k = l.classId + '|' + l.subjectId; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l); }
  const items = [...groups.entries()].map(([k, ls]) => {
    const s = subjOf(ls[0]), c = findClass(ls[0].classId);
    const t = findTeacher(teacherOfLesson(ls[0]));
    const sub = mode === 'class' ? (t ? esc(t.name) : '<span class="no-t">بدون معلم</span>') : `فصل ${esc(c.name)}${t && mode === 'room' ? ' • ' + esc(t.name) : ''}`;
    return `<div class="lesson pool-item" data-drag data-group="${k}" style="${cvars(s.color)}" data-tip="${esc(Engine.explain(E, ls[0]))}">
      <span class="l-icon">${s.icon}</span><span class="l-body"><b class="l-title">${esc(s.name)}</b><small class="l-sub">${sub}</small></span><span class="count">×${ls.length}</span></div>`;
  }).join('');
  return `<aside class="pool card" data-pool>
    <div class="pool-head"><div><h4>حصص غير موزعة</h4><small>اسحبها إلى الجدول</small></div><span class="badge ${list.length ? 'warn' : 'ok'}">${list.length}</span></div>
    <div class="pool-list">${items}</div>
    ${list.length ? `<p class="pool-hint">${icon('info')} اسحب الحصة إلى خانة خضراء — أو اضغط عليها ثم على الخانة.</p>`
      : `<div class="pool-empty"><span>🎉</span><b>كل الحصص موزعة</b><small>اسحب أي حصة من الجدول إلى هنا لإزالتها</small></div>`}
    <div class="pool-drop">${icon('x')} أفلت هنا لإرجاع الحصة إلى القائمة</div>
  </aside>`;
}

function ttOverview() {
  const E = TT.E;
  const days = activeDays();
  const P = +state.periods.count;
  const rowsKind = ui.ovRows === 'teachers' ? 'teachers' : 'classes';
  const gf = ui.ovGrade;
  const tools = `<div class="picker card ov-tools">
      <div class="seg sm"><button class="${rowsKind === 'classes' ? 'on' : ''}" data-act="ovRows" data-r="classes">${icon('layers')}<span>حسب الفصول</span></button><button class="${rowsKind === 'teachers' ? 'on' : ''}" data-act="ovRows" data-r="teachers">${icon('users')}<span>حسب المعلمين</span></button></div>
      ${rowsKind === 'classes' ? `<div class="chips"><button class="chip-toggle sm ${gf === 'all' ? 'on' : ''}" data-act="ovGrade" data-g="all">كل الصفوف</button>${state.grades.map(g => `<button class="chip-toggle sm ${gf === g.id ? 'on' : ''}" style="${cvars(g.color)}" data-act="ovGrade" data-g="${g.id}">${esc(g.name.replace('الصف ', ''))}</button>`).join('')}</div>` : ''}
      <span class="grow"></span><span class="muted sm">${icon('info')} مرّر الماوس على حصة لإبراز كل حصص معلمها • اسحب داخل نفس الصف</span>
    </div>`;
  let h = `<div class="ov-grid" style="grid-template-columns:150px repeat(${days.length * P}, minmax(44px,1fr))">`;
  h += `<div class="ov-corner">${rowsKind === 'classes' ? 'الفصل' : 'المعلم'}</div>`;
  days.forEach(d => { h += `<div class="ov-day" style="grid-column:span ${P}">${esc(state.days[d].name)}</div>`; });
  h += '<div class="ov-corner2"></div>';
  days.forEach(() => { for (let p = 0; p < P; p++) h += `<div class="ov-p ${p === 0 ? 'ds' : ''}">${p + 1}</div>`; });
  const row = (kind, id, label, blocked) => {
    let r = `<div class="ov-label">${label}</div>`;
    const map = ownerMap(E, kind);
    days.forEach(d => {
      for (let p = 0; p < P; p++) {
        const ls = map.get(id + '@' + Engine.slotKey(d, p)) || [];
        r += `<div class="ov-cell cell ${p === 0 ? 'ds' : ''} ${blocked.has(d + '-' + p) ? 'blocked' : ''}" data-cell data-kind="${kind}" data-owner="${id}" data-d="${d}" data-p="${p}">${ls.map(l => miniCard(l, kind)).join('')}</div>`;
      }
    });
    return r;
  };
  if (rowsKind === 'classes') {
    state.grades.filter(g => gf === 'all' || g.id === gf).forEach(g => {
      const cls = state.classes.filter(c => c.gradeId === g.id);
      if (!cls.length) return;
      h += `<div class="ov-grade" style="${cvars(g.color)}"><span>${esc(g.name)}</span></div>`;
      const bl = new Set(g.blocked || []);
      cls.forEach(c => { h += row('class', c.id, `<span class="cls-badge" style="${cvars(g.color)}">${esc(c.name)}</span>`, bl); });
    });
  } else {
    state.teachers.forEach(t => { h += row('teacher', t.id, `${avatar(t, 'xs')}<span class="ov-tname">${esc(t.name)}</span>`, new Set(t.blocked || [])); });
  }
  h += '</div>';
  const legend = `<div class="subj-legend">${state.subjects.map(s => `<span style="${cvars(s.color)}"><i></i>${s.icon} ${esc(s.name)}</span>`).join('')}</div>`;
  return tools + `<div class="card ov-card"><div class="ov-scroll" data-keep="ov-scroll">${h}</div>${legend}</div>`;
}
function miniCard(L, kind) {
  const E = TT.E;
  const s = subjOf(L), c = E.ctx.classById.get(L.classId);
  const tid = Engine.teacherOf(state, L), t = tid && E.ctx.teacherById.get(tid);
  const bad = TT.conflictIds.has(L.id);
  const tip = `${s.name} — فصل ${c.name}${t ? ' — ' + t.name : ''}${bad ? '\n⚠ ' + conflictText(L.id) : ''}`;
  return `<div class="mini ${bad ? 'conflict' : ''} ${L.locked ? 'locked' : ''}" data-lesson="${L.id}" data-drag data-t="${tid || ''}" style="${cvars(s.color)}" data-tip="${esc(tip)}">${esc(kind === 'class' ? s.short || s.name : c.name)}</div>`;
}

/* ------------------------------------------------------------------ actions */
ACT.ttMode = el => { ui.ttMode = el.dataset.m; persistUi(); App.refresh(); };
ACT.ttPick = el => {
  const k = ui.ttMode === 'class' ? 'ttClass' : ui.ttMode === 'teacher' ? 'ttTeacher' : 'ttRoom';
  ui[k] = el.dataset.id; persistUi(); App.refresh();
};
ACT.ovRows = el => { ui.ovRows = el.dataset.r; persistUi(); App.refresh(); };
ACT.ovGrade = el => { ui.ovGrade = el.dataset.g; persistUi(); App.refresh(); };
ACT.lock = el => {
  const L = lessonById(el.dataset.id);
  commit(st => { const l = st.lessons.find(x => x.id === L.id); l.locked = !l.locked; });
  toast(L.locked ? '🔒 تم تثبيت الحصة — لن يحرّكها التوليد التلقائي' : 'تم إلغاء تثبيت الحصة', 'info', 2200);
};
ACT.unplace = el => unplaceLesson(el.dataset.id);
function unplaceLesson(id) {
  const L = lessonById(id);
  if (!L || L.day == null) return;
  commit(st => { const l = st.lessons.find(x => x.id === id); l.day = null; l.period = null; l.roomId = null; l.locked = false; });
  toast(`أُعيدت حصة ${esc(subjOf(L).name)} إلى القائمة`, 'info', 2200);
}
ACT.clearTT = () => askConfirm('تفريغ الجدول بالكامل؟ ستعود كل الحصص (عدا المثبتة 🔒) إلى قائمة غير الموزعة.', () => {
  commit(st => st.lessons.forEach(l => { if (!l.locked) { l.day = null; l.period = null; l.roomId = null; } }));
  toast('تم تفريغ الجدول', 'info');
}, { yes: 'تفريغ' });
function scopeFilter() {
  const m = ui.ttMode, id = ownerId(m);
  if (m === 'class') return l => l.classId === id;
  if (m === 'teacher') return l => teacherOfLesson(l) === id;
  if (m === 'room') { const r = findRoom(id); return l => { const s = findSubject(l.subjectId), c = findClass(l.classId); return l.roomId === id || (l.day == null && s && (s.roomType ? s.roomType === r.type : c && c.roomId === id)); }; }
  return null;
}
ACT.fillOne = () => runGenerate('fill', scopeFilter());
ACT.clearOne = () => {
  const f = scopeFilter();
  askConfirm('تفريغ هذا الجدول؟ (الحصص المثبتة لن تتأثر)', () => commit(st => st.lessons.forEach(l => { if (f(l) && !l.locked) { l.day = null; l.period = null; l.roomId = null; } })), { yes: 'تفريغ' });
};

/* ------------------------------------------------------------------ generate */
ACT.generate = () => {
  if (!state.lessons.length) return toast('لا توجد حصص لتوزيعها — أضف المواد وعدد حصصها لكل صف أولاً', 'warn', 4500);
  const placed = state.lessons.filter(l => l.day != null).length;
  if (!placed) return runGenerate('fill');
  const m = openModal({
    title: `${icon('sparkles')} توليد الجدول تلقائياً`,
    body: `<div class="gen-options">
      <button class="gen-opt" data-mode="fill"><span class="go-ic">🧩</span><b>إكمال الجدول</b><span>يوزّع الحصص المتبقية فقط مع الحفاظ على الجدول الحالي قدر الإمكان.</span></button>
      <button class="gen-opt" data-mode="rebuild"><span class="go-ic">🔄</span><b>إعادة بناء كامل</b><span>يعيد توزيع كل الحصص غير المثبتة 🔒 من جديد للحصول على أفضل توزيع.</span></button>
    </div><p class="hint">${icon('info')} الحصص المثبتة بالقفل 🔒 لا تتحرك أبداً. ويمكنك التراجع بـ Ctrl+Z.</p>`,
  });
  m.el.querySelectorAll('.gen-opt').forEach(b => b.addEventListener('click', () => { m.close(); runGenerate(b.dataset.mode); }));
};
async function runGenerate(mode, scope) {
  showOverlay(mode === 'rebuild' ? 'إعادة بناء الجدول بالكامل' : scope ? 'إكمال الجدول المحدد' : 'جاري توليد الجدول الذكي');
  await wait(380);
  const t0 = performance.now();
  const work = JSON.parse(JSON.stringify(state));
  if (scope) {
    work.lessons = work.lessons.filter(l => scope(l) || l.day != null);
    work.lessons.forEach(l => { if (!scope(l)) l.locked = true; });
  }
  let res;
  try { res = Engine.autoSchedule(work, { rebuild: mode === 'rebuild', timeBudget: 3500 }); }
  catch (e) { console.error(e); hideOverlay(); return toast('حدث خطأ أثناء التوليد', 'error'); }
  const ms = performance.now() - t0;
  await wait(Math.max(0, 1300 - ms));
  commit(st => {
    for (const l of st.lessons) {
      if (scope && !scope(l)) continue;
      const p = res.placements.get(l.id);
      if (!p) continue;
      l.day = p.day; l.period = p.period; l.roomId = p.roomId;
      if (l.day == null) l.locked = false;
    }
  }, { render: false });
  hideOverlay();
  TT.cascade = true;
  if (ui.page !== 'timetable') navigate('timetable'); else App.refresh();
  const left = App.issues.unplaced.length;
  const secs = (ms / 1000).toFixed(2);
  if (!left && !App.issues.conflicts.length) {
    toast(`🎉 تم توزيع جميع الحصص (${state.lessons.length}) بدون أي تعارض في ${secs} ثانية`, 'success', 5500);
    setTimeout(confetti, 250);
  } else if (!left) {
    toast(`تم توزيع كل الحصص — مع ${App.issues.conflicts.length} تعارض قديم في الحصص المثبتة`, 'warn', 5500);
  } else {
    toast(`تم التوزيع في ${secs} ثانية — تبقّت <b>${left}</b> حصة لم يمكن توزيعها. افتح <b>التنبيهات</b> لمعرفة السبب.`, 'warn', 7000);
  }
}

/* ------------------------------------------------------------------ targeting (green / red) */
function judgeCell(E, L, cell) {
  const kind = cell.dataset.kind, owner = cell.dataset.owner;
  const d = +cell.dataset.d, p = +cell.dataset.p;
  const tid = Engine.teacherOf(state, L);
  if (kind === 'class' && owner !== L.classId) return { kind: 'na' };
  if (kind === 'teacher' && owner !== tid) return { kind: 'na' };
  if (kind === 'room') {
    const r = findRoom(owner), s = findSubject(L.subjectId), c = findClass(L.classId);
    const fits = L.roomId === owner || (s && r && (s.roomType ? s.roomType === r.type : c && c.roomId === owner));
    if (!fits) return { kind: 'na' };
  }
  if (L.day === d && L.period === p) return { kind: 'self' };
  const occ = (ownerMap(E, kind).get(owner + '@' + Engine.slotKey(d, p)) || []).filter(m => m.id !== L.id);
  const B = occ[0] || null;
  if (B && B.locked) return { kind: 'bad', B, d, p, res: { bad: [{ msg: `حصة ${subjOf(B).name} في هذه الخانة مثبتة 🔒` }], warn: [] } };
  const res = Engine.evaluateMove(E, L, d, p, B);
  return { kind: res.level === 'bad' ? 'bad' : B ? 'swap' : res.level, res, B, d, p };
}
function paintTargets(L) {
  const E = Engine.env(state);
  TT.E = E;
  TT.targets = new Map();
  let ok = 0;
  document.querySelectorAll('#view [data-cell]').forEach(cell => {
    const r = judgeCell(E, L, cell);
    TT.targets.set(cell, r);
    cell.classList.add('t-' + r.kind);
    if (r.kind === 'ok' || r.kind === 'warn' || r.kind === 'swap') ok++;
  });
  document.body.classList.add('targeting');
  const lg = document.getElementById('legend');
  if (lg) lg.classList.add('live');
  return ok;
}
function clearTargets() {
  document.querySelectorAll('#view [data-cell]').forEach(c => c.classList.remove('t-ok', 't-warn', 't-bad', 't-swap', 't-na', 't-self', 't-hover'));
  document.querySelectorAll('#view .lesson.selected, #view .mini.selected').forEach(c => c.classList.remove('selected'));
  document.body.classList.remove('targeting');
  const lg = document.getElementById('legend');
  if (lg) lg.classList.remove('live');
  const pool = document.querySelector('[data-pool]');
  if (pool) pool.classList.remove('drop-target', 'accept');
  TT.targets = null;
}

function resolveLesson(card) {
  if (card.dataset.lesson) return lessonById(card.dataset.lesson);
  if (card.dataset.group) {
    const [c, s] = card.dataset.group.split('|');
    return state.lessons.find(l => l.classId === c && l.subjectId === s && l.day == null);
  }
  return null;
}

/* ------------------------------------------------------------------ apply move */
function applyTarget(L, r, cell) {
  if (r.kind === 'bad') {
    cell.classList.remove('shake'); void cell.offsetWidth; cell.classList.add('shake');
    toast(`<b>لا يمكن وضع الحصة هنا:</b> ${esc(r.res.bad[0].msg)}`, 'error', 4200);
    return false;
  }
  const kind = cell.dataset.kind, owner = cell.dataset.owner;
  const from = L.day;
  const wasComplete = !App.issues.unplaced.length && !App.issues.conflicts.length;
  const B = r.B;
  commit(st => {
    const l = st.lessons.find(x => x.id === L.id);
    const b = B && st.lessons.find(x => x.id === B.id);
    if (b) {
      if (l.day != null) { b.day = l.day; b.period = l.period; }
      else { b.day = null; b.period = null; b.roomId = null; b.locked = false; }
    }
    l.day = r.d; l.period = r.p;
    if (kind === 'room') l.roomId = owner;
    Engine.reassignRooms(st, [l.id].concat(b ? [b.id] : []));
  }, { render: false });
  TT.flash = [L.id].concat(B ? [B.id] : []);
  App.refresh();
  const where = `${state.days[r.d].name} • الحصة ${r.p + 1}`;
  if (B && from != null) toast(`${icon('swap')} تم التبديل بين <b>${esc(subjOf(L).name)}</b> و<b>${esc(subjOf(B).name)}</b>`, 'success', 2600);
  else if (B) toast(`تم وضع <b>${esc(subjOf(L).name)}</b> في ${where} وإرجاع <b>${esc(subjOf(B).name)}</b> للقائمة`, 'success', 3000);
  else toast(`تم وضع <b>${esc(subjOf(L).name)}</b> في ${where}${r.res.warn.length ? ' — ملاحظة: ' + esc(r.res.warn[0].msg) : ''}`, r.kind === 'warn' ? 'warn' : 'success', 2800);
  if (!wasComplete && !App.issues.unplaced.length && !App.issues.conflicts.length) {
    setTimeout(confetti, 200);
    toast('🎉 اكتمل الجدول بالكامل بدون أي تعارض!', 'success', 4000);
  }
  return true;
}

/* ------------------------------------------------------------------ click-to-move selection */
function selectLesson(card) {
  const L = resolveLesson(card);
  if (!L) return;
  if (L.locked) return toast('هذه الحصة مثبتة 🔒 — ألغِ التثبيت أولاً لتحريكها', 'warn');
  clearTargets();
  TT.sel = L;
  card.classList.add('selected');
  const n = paintTargets(L);
  if (L.day != null) { const pool = document.querySelector('[data-pool]'); if (pool) pool.classList.add('accept'); }
  showSelBanner(`تم اختيار <b>${esc(subjOf(L).name)}</b> — ${n ? `اضغط على خانة <span class="g">خضراء</span> لنقلها` : 'لا توجد خانات متاحة لهذه الحصة'}`);
}
function clearSelection() { TT.sel = null; clearTargets(); hideSelBanner(); }
function showSelBanner(html) {
  let b = document.getElementById('selBanner');
  if (!b) { b = document.createElement('div'); b.id = 'selBanner'; b.className = 'sel-banner'; document.body.appendChild(b); }
  b.innerHTML = `<span class="sb-dot"></span><span>${html}</span><span class="sb-hint">Esc للإلغاء</span><button class="icon-btn sm" data-sb-close>${icon('x')}</button>`;
  requestAnimationFrame(() => b.classList.add('show'));
}
function hideSelBanner() { const b = document.getElementById('selBanner'); if (b) b.classList.remove('show'); }

window.addEventListener('click', e => {
  if (TT.suppressClick) { TT.suppressClick = false; e.stopImmediatePropagation(); e.preventDefault(); return; }
  if (e.target.closest('[data-sb-close]')) { clearSelection(); return; }
  if (ui.page !== 'timetable') return;
  const inView = e.target.closest('#view');
  if (!inView) { if (TT.sel && !e.target.closest('#selBanner')) clearSelection(); return; }
  if (e.target.closest('button, input, select, label, a')) return;
  const cell = e.target.closest('[data-cell]');
  const card = e.target.closest('[data-drag]');
  const pool = e.target.closest('[data-pool]');
  if (TT.sel) {
    const L = lessonById(TT.sel.id);
    if (cell && TT.targets && TT.targets.has(cell)) {
      const r = TT.targets.get(cell);
      if (r.kind === 'self') { clearSelection(); return; }
      if (r.kind !== 'na') { e.stopImmediatePropagation(); if (applyTarget(L, r, cell)) TT.sel = null; return; }
    }
    if (pool && !card && L && L.day != null) { clearSelection(); unplaceLesson(L.id); return; }
  }
  if (card) { selectLesson(card); return; }
  if (TT.sel) clearSelection();
}, true);

/* ------------------------------------------------------------------ drag & drop */
document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || ui.page !== 'timetable') return;
  const card = e.target.closest('#view [data-drag]');
  if (!card || e.target.closest('button, input, select')) return;
  const L = resolveLesson(card);
  if (!L) return;
  e.preventDefault();
  TT.pending = { card, L, x: e.clientX, y: e.clientY };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragUp);
  window.addEventListener('pointercancel', onDragCancel);
});
function detachDrag() {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragUp);
  window.removeEventListener('pointercancel', onDragCancel);
  cancelAnimationFrame(TT.raf);
  document.body.classList.remove('is-dragging');
  document.getElementById('dragTip').classList.remove('show');
}
function onDragMove(e) {
  const pd = TT.pending;
  if (pd && !TT.drag) {
    if (Math.hypot(e.clientX - pd.x, e.clientY - pd.y) < 6) return;
    if (pd.L.locked) { toast('هذه الحصة مثبتة 🔒 — ألغِ التثبيت أولاً لتحريكها', 'warn'); TT.pending = null; detachDrag(); return; }
    startDrag(pd, e);
  }
  if (TT.drag) { TT.pt = { x: e.clientX, y: e.clientY }; moveDrag(e.clientX, e.clientY); }
}
function startDrag(pd, e) {
  if (TT.sel) clearSelection();
  const rect = pd.card.getBoundingClientRect();
  const ghost = pd.card.cloneNode(true);
  ghost.classList.add('ghost');
  ghost.classList.remove('pop', 'cascade', 'selected');
  const w = Math.max(150, Math.min(rect.width, 230));
  ghost.style.width = w + 'px';
  if (pd.card.classList.contains('mini')) { ghost.style.width = '64px'; ghost.style.height = '34px'; }
  document.body.appendChild(ghost);
  const offX = Math.min(e.clientX - rect.left, w - 10);
  const offY = Math.min(e.clientY - rect.top, 30);
  pd.card.classList.add('drag-src');
  TT.drag = { L: pd.L, card: pd.card, ghost, offX, offY, over: null, overPool: false };
  paintTargets(pd.L);
  if (pd.L.day != null) { const pool = document.querySelector('[data-pool]'); if (pool) pool.classList.add('accept'); }
  document.body.classList.add('is-dragging');
  const tip = document.getElementById('tip'); if (tip) tip.classList.remove('show');
  const loop = () => { autoScroll(); TT.raf = requestAnimationFrame(loop); };
  TT.raf = requestAnimationFrame(loop);
}
function moveDrag(x, y) {
  const D = TT.drag;
  D.ghost.style.transform = `translate(${x - D.offX}px, ${y - D.offY}px) rotate(-2.5deg) scale(1.05)`;
  const under = document.elementFromPoint(x, y);
  const cell = under && under.closest('#view [data-cell]');
  const pool = under && under.closest('[data-pool]');
  if (cell !== D.over) {
    if (D.over) D.over.classList.remove('t-hover');
    D.over = cell;
    if (cell) cell.classList.add('t-hover');
  }
  const overPool = !!pool && !cell && D.L.day != null;
  if (overPool !== D.overPool) { D.overPool = overPool; pool && pool.classList.toggle('drop-target', overPool); if (!overPool) document.querySelectorAll('[data-pool]').forEach(p => p.classList.remove('drop-target')); }
  dragTip(x, y, cell ? TT.targets.get(cell) : overPool ? { kind: 'pool' } : null, D.L);
}
function dragTip(x, y, r, L) {
  const tip = document.getElementById('dragTip');
  if (!r || r.kind === 'na' || r.kind === 'self') { tip.classList.remove('show'); return; }
  let html = '', cls = r.kind;
  const ul = arr => (arr.length ? `<ul>${arr.map(w => `<li>${esc(w.msg)}</li>`).join('')}</ul>` : '');
  const where = r.d != null ? `${esc(state.days[r.d].name)} • الحصة ${r.p + 1}` : '';
  if (r.kind === 'pool') { html = '<b>↩ إرجاع الحصة إلى قائمة غير الموزعة</b>'; cls = 'swap'; }
  else if (r.kind === 'ok') html = `<b>✓ متاح</b><span>${where}</span>`;
  else if (r.kind === 'warn') html = `<b>✓ متاح مع ملاحظة</b><span>${where}</span>${ul(r.res.warn)}`;
  else if (r.kind === 'swap') html = `<b>⇄ ${L.day == null ? 'استبدال' : 'تبديل'} مع ${esc(subjOf(r.B).name)}</b><span>${where}${L.day == null ? ' — ستعود الحصة الحالية للقائمة' : ''}</span>${ul(r.res.warn)}`;
  else html = `<b>✕ لا يمكن — يوجد تعارض</b>${ul(r.res.bad)}`;
  tip.className = 'drag-tip show ' + cls;
  tip.innerHTML = html;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let tx = x - tw - 22, ty = y + 20;
  if (tx < 8) tx = x + 22;
  if (ty + th > window.innerHeight - 8) ty = y - th - 16;
  tip.style.transform = `translate(${tx}px, ${ty}px)`;
}
function autoScroll() {
  if (!TT.drag || !TT.pt) return;
  const { x, y } = TT.pt;
  const m = 56, sp = 16;
  const v = document.getElementById('view');
  const vr = v.getBoundingClientRect();
  if (y < vr.top + m) v.scrollTop -= sp; else if (y > vr.bottom - m) v.scrollTop += sp;
  document.querySelectorAll('#view .ov-scroll, #view .tt-scroll').forEach(el => {
    const r = el.getBoundingClientRect();
    if (y < r.top || y > r.bottom) return;
    if (x < r.left + m) el.scrollLeft -= sp; else if (x > r.right - m) el.scrollLeft += sp;
  });
  moveDrag(x, y);
}
function flyBack(D) {
  const g = D.ghost;
  const r = D.card.getBoundingClientRect();
  g.style.transition = 'transform .3s cubic-bezier(.3,.7,.4,1), opacity .3s';
  g.style.transform = `translate(${r.left}px, ${r.top}px) rotate(0) scale(1)`;
  g.style.opacity = '0.4';
  setTimeout(() => { g.remove(); D.card.classList.remove('drag-src'); }, 300);
}
function onDragUp(e) {
  detachDrag();
  TT.pending = null;
  const D = TT.drag;
  if (!D) return;             // نقرة عادية — يعالجها حدث click
  TT.drag = null;
  TT.suppressClick = true;
  setTimeout(() => { TT.suppressClick = false; }, 60);
  const cell = D.over;
  const r = cell && TT.targets ? TT.targets.get(cell) : null;
  if (D.overPool) { D.ghost.remove(); clearTargets(); unplaceLesson(D.L.id); return; }
  if (!r || r.kind === 'na' || r.kind === 'self') { flyBack(D); clearTargets(); return; }
  if (r.kind === 'bad') { flyBack(D); clearTargets(); applyTarget(D.L, r, cell); return; }
  D.ghost.remove();
  clearTargets();
  applyTarget(lessonById(D.L.id), r, cell);
}
function onDragCancel() {
  detachDrag();
  TT.pending = null;
  if (TT.drag) { flyBack(TT.drag); TT.drag = null; clearTargets(); }
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (TT.drag) onDragCancel();
  else if (TT.sel) clearSelection();
});

// إبراز كل حصص نفس المعلم في النظرة العامة
document.addEventListener('mouseover', e => {
  if (ui.page !== 'timetable' || ui.ttMode !== 'overview' || document.body.classList.contains('is-dragging')) return;
  const m = e.target.closest('.mini');
  const grid = document.querySelector('.ov-grid');
  if (!grid) return;
  const tid = m ? m.dataset.t : '';
  if (grid.dataset.hl === tid) return;
  grid.dataset.hl = tid;
  grid.querySelectorAll('.mini.hl').forEach(x => x.classList.remove('hl'));
  grid.classList.toggle('hovering', !!tid);
  if (tid) grid.querySelectorAll(`.mini[data-t="${tid}"]`).forEach(x => x.classList.add('hl'));
});

/* ------------------------------------------------------------------ print & export */
function printTable(kind, id) {
  const E = Engine.env(state);
  const days = activeDays(), P = +state.periods.count, times = periodTimes();
  const br = +state.periods.breakAfter, hasBr = br > 0 && br < P;
  let title = '', sub = '', blocked = new Set(), map = ownerMap(E, kind);
  if (kind === 'class') { const c = findClass(id), g = findGrade(c.gradeId) || {}; title = `جدول فصل ${c.name}`; sub = g.name || ''; blocked = new Set(g.blocked || []); }
  else if (kind === 'teacher') {
    const t = findTeacher(id);
    const n = state.lessons.filter(l => l.day != null && teacherOfLesson(l) === id).length;
    title = `جدول ${t.name}`; sub = `النصاب: ${n} حصة أسبوعياً`; blocked = new Set(t.blocked || []);
  } else { const r = findRoom(id); title = `جدول ${r.name}`; sub = roomTypeOf(r.type).name; }
  let h = `<section class="p-page"><header class="p-head"><div><b>${esc(state.school.name)}</b><span>العام الدراسي ${esc(state.school.year)}</span></div><div class="p-title"><h1>${esc(title)}</h1><span>${esc(sub)}</span></div></header>
    <table class="p-table"><thead><tr><th class="p-day">اليوم</th>`;
  for (let p = 0; p < P; p++) { h += `<th>الحصة ${p + 1}<small>${times[p].start} – ${times[p].end}</small></th>`; if (hasBr && p === br - 1) h += '<th class="p-br">استراحة</th>'; }
  h += '</tr></thead><tbody>';
  for (const d of days) {
    h += `<tr><th class="p-day">${esc(state.days[d].name)}</th>`;
    for (let p = 0; p < P; p++) {
      const ls = map.get(id + '@' + Engine.slotKey(d, p)) || [];
      if (!ls.length) h += `<td class="${blocked.has(d + '-' + p) ? 'p-off' : ''}"></td>`;
      else {
        const l = ls[0], s = subjOf(l), c = findClass(l.classId), t = findTeacher(teacherOfLesson(l)), r = findRoom(l.roomId);
        const line = kind === 'class' ? (t ? t.name : '') + (r && c && r.id !== c.roomId ? ` • ${r.name}` : '') : kind === 'teacher' ? `فصل ${c.name}${r ? ' • ' + r.name : ''}` : `فصل ${c.name}${t ? ' • ' + t.name : ''}`;
        h += `<td style="background:${tint(s.color, 0.16)};border-inline-start:4px solid ${s.color}"><b>${s.icon} ${esc(s.name)}</b><small>${esc(line)}</small></td>`;
      }
      if (hasBr && p === br - 1) h += '<td class="p-br"></td>';
    }
    h += '</tr>';
  }
  h += `</tbody></table><footer class="p-foot">تم الإنشاء بواسطة «جدولي الذكي» — ${new Date().toLocaleDateString('ar-EG')}</footer></section>`;
  return h;
}
function doPrint(pages) {
  const area = document.getElementById('printArea');
  area.innerHTML = pages.join('');
  const clean = () => { area.innerHTML = ''; window.removeEventListener('afterprint', clean); };
  window.addEventListener('afterprint', clean);
  setTimeout(() => window.print(), 50);
}
ACT.printOne = () => { const m = ui.ttMode; doPrint([printTable(m, ownerId(m))]); };
ACT.printMenu = () => {
  const cur = ui.ttMode !== 'overview' && ownerId(ui.ttMode);
  const m = openModal({
    title: `${icon('print')} طباعة الجداول`,
    body: `<div class="gen-options three">
      ${cur ? `<button class="gen-opt" data-p="current"><span class="go-ic">📄</span><b>الجدول الحالي</b><span>الجدول المعروض الآن فقط</span></button>` : ''}
      <button class="gen-opt" data-p="classes"><span class="go-ic">🏫</span><b>كل الفصول</b><span>${state.classes.length} صفحة — جدول لكل فصل</span></button>
      <button class="gen-opt" data-p="teachers"><span class="go-ic">👩‍🏫</span><b>كل المعلمين</b><span>${state.teachers.length} صفحة — جدول لكل معلم</span></button>
      <button class="gen-opt" data-p="rooms"><span class="go-ic">🚪</span><b>القاعات المتخصصة</b><span>المعامل والملاعب والغرف الخاصة</span></button>
    </div><p class="hint">${icon('info')} يمكنك اختيار «حفظ كـ PDF» من نافذة الطباعة.</p>`,
  });
  m.el.querySelectorAll('.gen-opt').forEach(b => b.addEventListener('click', () => {
    m.close();
    const k = b.dataset.p;
    if (k === 'current') ACT.printOne();
    else if (k === 'classes') doPrint(state.classes.map(c => printTable('class', c.id)));
    else if (k === 'teachers') doPrint(state.teachers.map(t => printTable('teacher', t.id)));
    else doPrint(state.rooms.filter(r => r.type !== 'classroom').map(r => printTable('room', r.id)));
  }));
};
ACT.exportXls = () => {
  const E = Engine.env(state);
  const days = activeDays(), P = +state.periods.count, times = periodTimes();
  const table = (kind, id, title) => {
    const map = ownerMap(E, kind);
    let h = `<h3>${esc(title)}</h3><table><tr><th>اليوم</th>${Array.from({ length: P }, (_, p) => `<th>الحصة ${p + 1}<br>${times[p].start} - ${times[p].end}</th>`).join('')}</tr>`;
    for (const d of days) {
      h += `<tr><th>${esc(state.days[d].name)}</th>`;
      for (let p = 0; p < P; p++) {
        const l = (map.get(id + '@' + Engine.slotKey(d, p)) || [])[0];
        if (!l) { h += '<td></td>'; continue; }
        const s = subjOf(l), c = findClass(l.classId), t = findTeacher(teacherOfLesson(l));
        const line = kind === 'class' ? (t ? t.name : '') : `فصل ${c.name}`;
        h += `<td style="background:${tint(s.color, 0.2)}">${esc(s.name)}<br><span style="color:#555">${esc(line)}</span></td>`;
      }
      h += '</tr>';
    }
    return h + '</table><br>';
  };
  let body = `<h2>${esc(state.school.name)} — العام الدراسي ${esc(state.school.year)}</h2><h2>جداول الفصول</h2>`;
  state.classes.forEach(c => { body += table('class', c.id, 'فصل ' + c.name); });
  body += '<h2>جداول المعلمين</h2>';
  state.teachers.forEach(t => { body += table('teacher', t.id, t.name); });
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>الجدول</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    <style>body{font-family:Arial;direction:rtl}table{border-collapse:collapse}th,td{border:1px solid #999;padding:6px 10px;text-align:center;vertical-align:middle;mso-number-format:"\\@"}th{background:#eef0ff}</style></head><body dir="rtl">${body}</body></html>`;
  download('\ufeff' + html, `الجدول المدرسي - ${state.school.name}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  toast('تم تصدير ملف Excel لكل الفصول والمعلمين', 'success');
};
