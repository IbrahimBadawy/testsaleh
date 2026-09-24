/* =====================================================================
 *  main.js — التنقل، الشريط العلوي، مركز التنبيهات، الاختصارات، التشغيل
 * ===================================================================== */
'use strict';

const PAGES = {
  dashboard: { title: 'لوحة التحكم', sub: 'نظرة شاملة على الجدول المدرسي', icon: 'dashboard', render: () => renderDashboard(), after: r => afterDashboard(r) },
  timetable: { title: 'الجدول الذكي', sub: 'اسحب الحصص وأفلتها — الأخضر متاح والأحمر به تعارض', icon: 'calendar', render: () => renderTimetable(), after: r => afterTimetable(r) },
  settings: { title: 'المواعيد والإعدادات', sub: 'أيام الدراسة، الحصص ومواعيدها، وقواعد الجدولة', icon: 'clock', render: () => renderSettings(), group: 'data' },
  grades: { title: 'الصفوف والفصول', sub: 'السنوات الدراسية وفصولها والأوقات المتاحة لكل صف', icon: 'layers', render: () => renderGrades(), group: 'data' },
  rooms: { title: 'القاعات', sub: 'الفصول والمعامل والملاعب والغرف المتخصصة', icon: 'door', render: () => renderRooms(), group: 'data' },
  subjects: { title: 'المواد الدراسية', sub: 'عدد الحصص الأسبوعية لكل صف والقاعة المطلوبة', icon: 'book', render: () => renderSubjects(), group: 'data' },
  teachers: { title: 'المعلمون', sub: 'التخصصات والصفوف والنصاب وأوقات عدم التواجد', icon: 'users', render: () => renderTeachers(), group: 'data' },
  assign: { nav: 'توزيع المواد', title: 'توزيع المواد على المعلمين', sub: 'من يدرّس ماذا لكل فصل — المادة الواحدة تتوزع على أكثر من معلم', icon: 'link', render: () => renderAssign(), group: 'data' },
};

const App = {
  env: null,
  issues: null,
  compute() {
    App.env = Engine.env(state);
    App.issues = Engine.computeIssues(state, App.env);
  },
  refresh() {
    App.compute();
    // أي إعادة رسم تُنهي وضع الاختيار/الاستهداف
    TT.sel = null; TT.targets = null;
    document.body.classList.remove('targeting');
    hideSelBanner();
    const view = document.getElementById('view');
    const page = PAGES[ui.page] || PAGES.dashboard;
    const keep = {};
    view.querySelectorAll('[data-keep]').forEach(el => { keep[el.dataset.keep] = [el.scrollTop, el.scrollLeft]; });
    const st = view.scrollTop;
    view.innerHTML = page.render();
    view.querySelectorAll('[data-keep]').forEach(el => { const k = keep[el.dataset.keep]; if (k) { el.scrollTop = k[0]; el.scrollLeft = k[1]; } });
    view.scrollTop = st;
    if (page.after) page.after(view);
    App.refreshChrome(true);
  },
  refreshChrome(computed) {
    if (!computed) App.compute();
    renderNav();
    renderTopbar();
    if (document.getElementById('drawer').classList.contains('show')) renderDrawer();
  },
};

function navigate(page) {
  if (!PAGES[page]) page = 'dashboard';
  const changed = ui.page !== page;
  ui.page = page;
  persistUi();
  try { if (location.hash.slice(1) !== page) history.replaceState(null, '', '#' + page); } catch (e) { /* بيئة معزولة */ }
  App.refresh();
  const view = document.getElementById('view');
  if (changed) {
    view.scrollTop = 0;
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  }
  document.body.classList.remove('nav-open');
}

function renderNav() {
  const iss = App.issues;
  const badges = {
    timetable: iss.unplaced.length ? `<span class="nb warn">${iss.unplaced.length}</span>` : iss.conflicts.length ? '' : `<span class="nb ok">${icon('check')}</span>`,
    assign: iss.noTeacher.length ? `<span class="nb warn">${iss.noTeacher.length}</span>` : '',
    teachers: iss.overload.length + iss.tCap.length ? `<span class="nb bad">${iss.overload.length + iss.tCap.length}</span>` : '',
  };
  const item = id => {
    const p = PAGES[id];
    return `<a href="#${id}" class="nav-item ${ui.page === id ? 'on' : ''}" data-act="go" data-page="${id}">${icon(p.icon)}<span>${p.nav || p.title}</span>${badges[id] || ''}</a>`;
  };
  document.getElementById('nav').innerHTML = `
    <div class="nav-sec">الجدول</div>${item('dashboard')}${item('timetable')}
    <div class="nav-sec">البيانات الأساسية</div>${['settings', 'grades', 'rooms', 'subjects', 'teachers', 'assign'].map(item).join('')}`;
  document.getElementById('sideFoot').innerHTML = `<div class="sf-school">${icon('school')}<div><b>${esc(state.school.name)}</b><span>${esc(state.school.year)}</span></div></div>
    <div class="sf-save"><i></i>يتم الحفظ تلقائياً</div>`;
}

function renderTopbar() {
  const p = PAGES[ui.page] || PAGES.dashboard;
  const iss = App.issues;
  const red = iss.conflicts.length + iss.overCap.length + iss.tCap.length + iss.subjCap.length + iss.roomCap.length;
  const amber = iss.noTeacher.length + iss.overload.length + (iss.unplaced.length ? 1 : 0);
  document.getElementById('topbar').innerHTML = `
    <button class="icon-btn menu-btn" data-act="toggleNav">${icon('menu')}</button>
    <div class="tb-title"><h2>${p.title}</h2><p>${p.sub}</p></div>
    <div class="tb-actions">
      <button class="icon-btn" data-act="undo" data-tip="تراجع (Ctrl+Z)" ${hist.undo.length ? '' : 'disabled'}>${icon('undo')}</button>
      <button class="icon-btn" data-act="redo" data-tip="إعادة (Ctrl+Y)" ${hist.redo.length ? '' : 'disabled'}>${icon('redo')}</button>
      <button class="alert-btn ${red ? 'bad' : amber ? 'warn' : 'ok'}" data-act="drawer">${icon('bell')}<span>التنبيهات</span>${red || amber ? `<b>${red || amber}</b>` : `<i>${icon('check')}</i>`}</button>
      ${ui.page !== 'timetable' ? `<button class="btn btn-primary shine" data-act="generate">${icon('sparkles')}<span>توليد تلقائي</span></button>` : ''}
    </div>`;
}

/* ---------------------------------------------------------------- مركز التنبيهات */
function renderDrawer() {
  const iss = App.issues;
  const E = App.env;
  const dn = d => (state.days[d] ? state.days[d].name : '');
  const sec = (cls, ic, title, items, body) => (items ? `<div class="dr-sec ${cls}"><div class="dr-title">${icon(ic)}<b>${title}</b><span class="badge ${cls}">${items}</span></div>${body}</div>` : '');
  let html = '';
  html += sec('bad', 'alert', 'تعارضات في الجدول', iss.conflicts.length, iss.conflicts.slice(0, 60).map(c => {
    const s = findSubject(c.lesson.subjectId), cl = findClass(c.lesson.classId);
    return `<button class="dr-item" data-act="goLesson" data-id="${c.lesson.id}"><span class="dr-dot" style="background:${s ? s.color : '#999'}"></span><div><b>${s ? s.icon + ' ' + esc(s.name) : ''} — فصل ${esc(cl ? cl.name : '')}</b><small>${esc(dn(c.lesson.day))} • الحصة ${c.lesson.period + 1}</small>${c.msgs.map(m => `<p>${esc(m)}</p>`).join('')}</div></button>`;
  }).join(''));
  html += sec('bad', 'layers', 'فصول حصصها أكثر من الأوقات المتاحة', iss.overCap.length, iss.overCap.map(x => `<button class="dr-item" data-act="go" data-page="grades"><div><b>فصل ${esc(x.cls.name)}</b><p>يحتاج ${x.need} حصة أسبوعياً والمتاح ${x.avail} فقط — زد عدد الحصص اليومية أو قلل حصص المواد.</p></div></button>`).join(''));
  html += sec('bad', 'users', 'معلمون نصابهم أكبر من أوقاتهم المتاحة', iss.tCap.length, iss.tCap.map(x => `<button class="dr-item" data-act="viewTeacher" data-id="${x.teacher.id}"><div><b>${esc(x.teacher.name)}</b><p>مسند له ${x.load} حصة، وأقصى ما يمكن جدولته ${x.cap} (الأوقات المتاحة × الحد اليومي).</p></div></button>`).join(''));
  html += sec('bad', 'book', 'مواد يستحيل توزيع حصصها', iss.subjCap.length, iss.subjCap.map(x => `<button class="dr-item" data-act="go" data-page="subjects"><div><b>${x.subj.icon} ${esc(x.subj.name)} — فصل ${esc(x.cls.name)}</b><p>تحتاج ${x.need} حصص لكن الحد الأقصى الممكن ${x.cap} (الحد اليومي ${x.subj.maxPerDay} × ${x.days} أيام متاحة${x.teacher ? ' للمعلم ' + esc(x.teacher.name) : ''}). زد الحد اليومي للمادة أو قلل أوقات عدم التواجد.</p></div></button>`).join(''));
  html += sec('bad', 'door', 'القاعات المتخصصة لا تكفي', iss.roomCap.length, iss.roomCap.map(x => `<button class="dr-item" data-act="go" data-page="rooms"><div><b>${esc(x.typeName)}</b><p>الحصص التي تحتاجها ${x.need} حصة أسبوعياً، وسعة القاعات المتاحة (${x.rooms.map(r => esc(r.name)).join('، ')}) ${x.cap} فقط — أضف قاعة أخرى من نفس النوع أو قلل الحصص.</p></div></button>`).join(''));
  if (iss.unplaced.length) {
    const byClass = new Map();
    iss.unplaced.forEach(l => { if (!byClass.has(l.classId)) byClass.set(l.classId, []); byClass.get(l.classId).push(l); });
    html += sec('warn', 'calendar', 'حصص لم توزع بعد', iss.unplaced.length, [...byClass.entries()].slice(0, 40).map(([cid, ls]) => {
      const c = findClass(cid);
      const per = new Map();
      ls.forEach(l => per.set(l.subjectId, (per.get(l.subjectId) || 0) + 1));
      return `<button class="dr-item" data-act="goClass" data-id="${cid}"><div><b>فصل ${esc(c ? c.name : '')} — ${ls.length} حصة</b><div class="dr-chips">${[...per.entries()].map(([sid, n]) => { const s = findSubject(sid); return `<span style="${cvars(s.color)}">${s.icon} ${esc(s.short || s.name)} ×${n}</span>`; }).join('')}</div><small>${esc(Engine.explain(E, ls[0]))}</small></div></button>`;
    }).join('') + `<div class="dr-cta"><button class="btn btn-primary sm" data-act="generate">${icon('sparkles')} توليد تلقائي للمتبقي</button></div>`);
  }
  if (iss.noTeacher.length) {
    const bySubj = new Map();
    iss.noTeacher.forEach(x => { if (!bySubj.has(x.subj.id)) bySubj.set(x.subj.id, []); bySubj.get(x.subj.id).push(x.cls.name); });
    html += sec('warn', 'link', 'مواد بدون معلم', iss.noTeacher.length, [...bySubj.entries()].map(([sid, names]) => { const s = findSubject(sid); return `<button class="dr-item" data-act="go" data-page="assign"><div><b>${s.icon} ${esc(s.name)}</b><p>الفصول: ${names.map(esc).join('، ')}</p></div></button>`; }).join('') + `<div class="dr-cta"><button class="btn btn-soft sm" data-act="autoAssign" data-mode="empty">${icon('sparkles')} توزيع تلقائي على المعلمين</button></div>`);
  }
  html += sec('warn', 'users', 'معلمون تجاوزوا النصاب', iss.overload.length, iss.overload.map(x => `<button class="dr-item" data-act="viewTeacher" data-id="${x.teacher.id}"><div><b>${esc(x.teacher.name)}</b><p>مسند له ${x.load} حصة والنصاب ${x.teacher.maxWeek}</p></div></button>`).join(''));
  html += sec('info', 'info', 'إسناد لمعلم غير مؤهل', iss.unqualified.length, iss.unqualified.slice(0, 30).map(x => `<button class="dr-item" data-act="go" data-page="assign"><div><b>${esc(x.teacher.name)}</b><p>يدرّس ${esc(x.subj.name)} لفصل ${esc(x.cls.name)} وهي ليست من مواده/صفوفه المحددة.</p></div></button>`).join(''));
  if (!html) html = `<div class="dr-empty"><span>✨</span><b>كل شيء على ما يرام</b><p>لا توجد تعارضات أو حصص متبقية أو مشاكل في البيانات.</p></div>`;
  const d = document.getElementById('drawer');
  d.innerHTML = `<div class="dr-backdrop" data-act="closeDrawer"></div><aside class="dr-panel">
    <div class="dr-head"><div>${icon('bell')}<h3>مركز التنبيهات</h3></div><button class="icon-btn" data-act="closeDrawer">${icon('x')}</button></div>
    <div class="dr-body">${html}</div></aside>`;
}
ACT.drawer = () => { renderDrawer(); document.getElementById('drawer').classList.add('show'); };
ACT.closeDrawer = () => document.getElementById('drawer').classList.remove('show');
ACT.goLesson = el => {
  const L = state.lessons.find(l => l.id === el.dataset.id);
  if (!L) return;
  ACT.closeDrawer();
  ui.ttMode = 'class'; ui.ttClass = L.classId;
  TT.flash = [L.id];
  navigate('timetable');
};
ACT.goClass = el => { ACT.closeDrawer(); ui.ttMode = 'class'; ui.ttClass = el.dataset.id; navigate('timetable'); };

/* ---------------------------------------------------------------- global actions */
ACT.go = el => { if (el.dataset.page) { ACT.closeDrawer(); navigate(el.dataset.page); } };
ACT.undo = () => undo();
ACT.redo = () => redo();
ACT.toggleNav = () => document.body.classList.toggle('nav-open');

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  if (el.dataset.act !== 'go' && el.closest('#drawer') && !['closeDrawer', 'goLesson', 'goClass'].includes(el.dataset.act)) ACT.closeDrawer();
  fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-ch]');
  if (el && CH[el.dataset.ch]) CH[el.dataset.ch](el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-inp]');
  if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el, e);
});
document.addEventListener('keydown', e => {
  const typing = e.target.closest('input, textarea, select');
  if ((e.ctrlKey || e.metaKey) && !typing) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  }
  if (e.key === 'Escape') ACT.closeDrawer();
  if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox]):not([type=file])')) e.target.blur();
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (PAGES[h] && h !== ui.page) navigate(h); });
window.addEventListener('beforeunload', persistNow);

/* ---------------------------------------------------------------- init */
(function init() {
  let first = false;
  state = loadState();
  if (!state) { state = buildSample(); first = true; }
  normalize(state);
  if (first) persistNow();
  ui = loadUi();
  const h = location.hash.slice(1);
  if (PAGES[h]) ui.page = h;
  App.refresh();
  document.getElementById('view').classList.add('enter');
  document.body.classList.add('ready');
  if (first) setTimeout(() => toast('👋 أهلاً بك! تم تحميل بيانات تجريبية لمدرسة ابتدائية — اضغط <b>«توليد تلقائي»</b> لترى السحر ✨', 'info', 8000), 700);
})();
