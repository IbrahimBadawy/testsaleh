/* =====================================================================
 *  pages.js — صفحات البيانات: لوحة التحكم، المواعيد، الصفوف، القاعات،
 *             المواد، المعلمون، توزيع المواد
 * ===================================================================== */
'use strict';

const ACT = {};  // أفعال النقر  data-act
const CH = {};   // أحداث التغيير data-ch
const INP = {};  // أحداث الكتابة الحية data-inp

const ROOM_TYPE_COLOR = { classroom: '#6366f1', science: '#22c55e', computer: '#3b82f6', sports: '#f97316', music: '#8b5cf6', art: '#ec4899', library: '#0ea5e9', hall: '#f59e0b' };
const roomTypeOf = id => ROOM_TYPES.find(t => t.id === id) || { id, name: id, icon: '🏷️' };
const clampInt = (v, lo, hi, def) => { const n = parseInt(v, 10); return isNaN(n) ? def : Math.max(lo, Math.min(hi, n)); };
const plural = (n, one, few, many) => (n === 1 ? one : n >= 3 && n <= 10 ? few : many);

function focusNew(selector) {
  requestAnimationFrame(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const card = el.closest('.card');
    if (card) card.classList.add('flash');
    setTimeout(() => { el.focus(); if (el.select) el.select(); }, 250);
  });
}
function emptyState(ic, title, text, btn) {
  return `<div class="empty card"><div class="empty-ic">${icon(ic)}</div><h3>${title}</h3><p>${text}</p>${btn || ''}</div>`;
}

/* =========================================================== لوحة التحكم */
function renderDashboard() {
  const iss = App.issues;
  const E = App.env;
  const total = state.lessons.length;
  const placed = total - iss.unplaced.length;
  const pct = total ? Math.round((placed * 100) / total) : 0;
  const days = activeDays();
  const P = +state.periods.count;
  const loads = Engine.teacherLoads(state);
  const noT = iss.noTeacher.length;
  const conflicts = iss.conflicts.length;
  const RC = 2 * Math.PI * 54;

  const banner = state.isSample ? `<div class="banner stagger-i" style="--i:0">
      <span class="banner-ic">🧪</span>
      <div><b>أنت تستخدم بيانات تجريبية</b><span>مدرسة ابتدائية بـ 6 صفوف × 3 فصول و32 معلماً — جرّب كل شيء بحرية، ثم ابدأ مدرستك من الإعدادات.</span></div>
      <button class="btn btn-soft sm" data-act="newSchool">بدء مدرسة جديدة</button>
    </div>` : '';

  const stats = [
    { ic: 'layers', label: 'الصفوف', val: state.grades.length, sub: `${state.classes.length} فصل`, c: '#6366f1', page: 'grades' },
    { ic: 'users', label: 'المعلمون', val: state.teachers.length, sub: `${iss.overload.length ? iss.overload.length + ' تجاوز النصاب' : 'أحمال متوازنة'}`, c: '#0ea5e9', page: 'teachers' },
    { ic: 'book', label: 'المواد', val: state.subjects.length, sub: `${total} حصة أسبوعياً`, c: '#14b8a6', page: 'subjects' },
    { ic: 'door', label: 'القاعات', val: state.rooms.length, sub: `${state.rooms.filter(r => r.type !== 'classroom').length} قاعة متخصصة`, c: '#f59e0b', page: 'rooms' },
    { ic: 'calendar', label: 'حصص موزعة', val: placed, sub: `من ${total} حصة`, c: '#22c55e', page: 'timetable' },
    { ic: 'alert', label: 'تعارضات', val: conflicts, sub: conflicts ? 'تحتاج مراجعة' : 'لا توجد تعارضات 🎉', c: conflicts ? '#ef4444' : '#10b981', act: 'drawer' },
  ];

  const steps = [
    { page: 'settings', ic: 'clock', title: 'المواعيد وأيام الدراسة', desc: `${days.length} أيام × ${P} حصص يومياً`, done: days.length > 0 && P > 0 },
    { page: 'grades', ic: 'layers', title: 'الصفوف والفصول', desc: `${state.grades.length} صفوف • ${state.classes.length} فصل`, done: state.classes.length > 0 },
    { page: 'rooms', ic: 'door', title: 'القاعات', desc: `${state.rooms.length} قاعة`, done: state.rooms.length > 0 },
    { page: 'subjects', ic: 'book', title: 'المواد وعدد الحصص', desc: `${state.subjects.length} مادة • ${total} حصة`, done: total > 0 },
    { page: 'teachers', ic: 'users', title: 'المعلمون وتخصصاتهم', desc: `${state.teachers.length} معلم`, done: state.teachers.length > 0 },
    { page: 'assign', ic: 'link', title: 'توزيع المواد على المعلمين', desc: noT ? `${noT} مادة بدون معلم` : 'كل المواد مسندة ✓', done: total > 0 && !noT },
    { page: 'timetable', ic: 'calendar', title: 'بناء الجدول', desc: `${pct}% موزع • ${conflicts} تعارض`, done: total > 0 && pct === 100 && !conflicts },
  ];
  const doneCount = steps.filter(s => s.done).length;

  const tl = state.teachers.map(t => ({ t, a: loads.get(t.id).assigned, p: loads.get(t.id).placed, m: +t.maxWeek || 24 }))
    .sort((x, y) => y.a / y.m - x.a / x.m).slice(0, 10);

  const fd = ui.freeDay != null && state.days[ui.freeDay] && state.days[ui.freeDay].on ? +ui.freeDay : days[0];
  const fp = Math.min(+ui.freePeriod || 0, Math.max(0, P - 1));
  let freeHtml = '';
  if (fd != null && P) {
    const s = Engine.slotKey(fd, fp);
    const free = state.teachers.filter(t => !(t.blocked || []).includes(fd + '-' + fp) && !(E.idx.tch.get(t.id + '@' + s) || []).length);
    freeHtml = `<div class="free-tools">
        <select data-ch="freeDay">${days.map(d => `<option value="${d}" ${d === fd ? 'selected' : ''}>${esc(state.days[d].name)}</option>`).join('')}</select>
        <select data-ch="freePeriod">${Array.from({ length: P }, (_, p) => `<option value="${p}" ${p === fp ? 'selected' : ''}>الحصة ${p + 1}</option>`).join('')}</select>
        <span class="pill ok">${free.length} متاح</span><span class="pill">${state.teachers.length - free.length} مشغول</span>
      </div>
      <div class="free-list">${free.length ? free.map(t => `<button class="free-chip" data-act="viewTeacher" data-id="${t.id}" style="${cvars(t.color)}">${avatar(t, 'sm')}<span>${esc(t.name)}</span></button>`).join('') : '<p class="muted">لا يوجد معلم متاح في هذا الوقت</p>'}</div>`;
  }

  const gradeRows = state.grades.map(g => {
    const ids = new Set(state.classes.filter(c => c.gradeId === g.id).map(c => c.id));
    const ls = state.lessons.filter(l => ids.has(l.classId));
    const pl = ls.filter(l => l.day != null).length;
    const gp = ls.length ? Math.round((pl * 100) / ls.length) : 0;
    return `<div class="gp-row" style="${cvars(g.color)}"><span class="gp-name">${esc(g.name)}</span><div class="meter"><span style="width:${gp}%"></span></div><b>${gp}%</b></div>`;
  }).join('');

  return `${banner}
  <section class="hero stagger-i" style="--i:1">
    <div class="hero-deco"><span class="fl f1">📖 عربي</span><span class="fl f2">➗ رياضيات</span><span class="fl f3">🔬 علوم</span><span class="fl f4">⚽ رياضة</span></div>
    <div class="hero-text">
      <div class="eyebrow">${icon('school')} العام الدراسي ${esc(state.school.year)}</div>
      <h1>${esc(state.school.name)}</h1>
      <p>نظام ذكي لبناء الجدول المدرسي: يوزّع الحصص تلقائياً في ثوانٍ، ويكشف التعارضات لحظياً، ويتيح لك التعديل بالسحب والإفلات مع تلوين الأماكن المتاحة بالأخضر والمتعارضة بالأحمر.</p>
      <div class="hero-actions">
        <button class="btn btn-light" data-act="generate">${icon('sparkles')} توليد الجدول تلقائياً</button>
        <button class="btn btn-glass" data-act="go" data-page="timetable">${icon('calendar')} فتح الجدول</button>
      </div>
    </div>
    <div class="ring">
      <svg viewBox="0 0 128 128"><circle cx="64" cy="64" r="54" class="ring-bg"/><circle cx="64" cy="64" r="54" class="ring-fg" stroke-dasharray="${RC}" stroke-dashoffset="${RC}" data-offset="${RC * (1 - pct / 100)}"/></svg>
      <div class="ring-in"><b><span data-count="${pct}">0</span>%</b><span>${placed} / ${total} حصة</span></div>
    </div>
  </section>

  <section class="stats">
    ${stats.map((s, i) => `<button class="stat card stagger-i" style="--i:${i + 2};${cvars(s.c)}" data-act="${s.act || 'go'}" data-page="${s.page || ''}">
      <span class="stat-ic">${icon(s.ic)}</span>
      <div><b data-count="${s.val}">0</b><span class="stat-label">${s.label}</span><small>${s.sub}</small></div>
    </button>`).join('')}
  </section>

  <section class="dash-grid">
    <div class="card pad stagger-i" style="--i:8">
      <div class="card-title">${icon('check')} خطوات الإعداد <span class="pill ${doneCount === steps.length ? 'ok' : ''}">${doneCount}/${steps.length}</span></div>
      <div class="steps">${steps.map((s, i) => `<button class="step ${s.done ? 'done' : ''}" data-act="go" data-page="${s.page}">
          <span class="step-num">${s.done ? icon('check') : i + 1}</span>
          <span class="step-text"><b>${s.title}</b><small>${s.desc}</small></span>
          <span class="step-go">${icon(s.ic)}</span></button>`).join('')}</div>
    </div>
    <div class="card pad stagger-i" style="--i:9">
      <div class="card-title">${icon('users')} أحمال المعلمين <button class="link-btn" data-act="go" data-page="teachers">عرض الكل</button></div>
      <div class="loads">${tl.length ? tl.map(x => {
        const r = x.a / x.m;
        const cls = r > 1 ? 'bad' : r > 0.9 ? 'warn' : 'ok';
        return `<div class="load-row" data-act="viewTeacher" data-id="${x.t.id}">${avatar(x.t, 'sm')}<span class="load-name">${esc(x.t.name)}</span>
          <div class="meter ${cls}"><span style="width:${Math.min(100, r * 100)}%"></span></div><b>${x.a}/${x.m}</b></div>`;
      }).join('') : '<p class="muted">لم تتم إضافة معلمين بعد.</p>'}</div>
    </div>
    <div class="card pad stagger-i" style="--i:10">
      <div class="card-title">${icon('search')} من المتاح الآن؟ <small class="muted">للحصص الاحتياطية</small></div>
      ${freeHtml || '<p class="muted">حدد أيام وحصص الدراسة أولاً.</p>'}
    </div>
    <div class="card pad stagger-i" style="--i:11">
      <div class="card-title">${icon('layers')} نسبة اكتمال الصفوف</div>
      <div class="gp">${gradeRows || '<p class="muted">لا توجد صفوف.</p>'}</div>
    </div>
  </section>`;
}
function afterDashboard(root) {
  countUp(root);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('.ring-fg').forEach(c => c.style.strokeDashoffset = c.dataset.offset);
  }));
}
CH.freeDay = el => { ui.freeDay = +el.value; persistUi(); App.refresh(); };
CH.freePeriod = el => { ui.freePeriod = +el.value; persistUi(); App.refresh(); };

/* =========================================================== المواعيد والإعدادات */
function renderSettings() {
  const pr = state.periods;
  const times = periodTimes();
  const P = +pr.count;
  let tl = '';
  times.forEach((t, p) => {
    tl += `<div class="tl-item" style="--i:${p}"><b>الحصة ${p + 1}</b><span>${t.start} – ${t.end}</span></div>`;
    if (+pr.breakAfter === p + 1 && times.breakTime) tl += `<div class="tl-item brk"><b>☕ استراحة</b><span>${times.breakTime.start} – ${times.breakTime.end}</span></div>`;
  });
  return `<div class="settings-grid">
    <div class="card pad stagger-i" style="--i:0">
      <div class="card-title">${icon('school')} بيانات المدرسة</div>
      <label class="field"><span>اسم المدرسة</span><input data-ch="school" data-k="name" value="${esc(state.school.name)}"></label>
      <label class="field"><span>العام الدراسي</span><input data-ch="school" data-k="year" value="${esc(state.school.year)}"></label>
    </div>
    <div class="card pad stagger-i" style="--i:1">
      <div class="card-title">${icon('calendar')} أيام الدراسة</div>
      <div class="chips">${state.days.map((d, i) => `<button class="chip-toggle ${d.on ? 'on' : ''}" data-act="toggleDay" data-i="${i}">${d.on ? icon('check') : ''}${esc(d.name)}</button>`).join('')}</div>
      <p class="hint">${icon('info')} عند إلغاء يوم تعود حصصه إلى قائمة «غير الموزعة».</p>
    </div>
    <div class="card pad span-2 stagger-i" style="--i:2">
      <div class="card-title">${icon('clock')} الحصص والمواعيد</div>
      <div class="form-row">
        <div class="field"><span>عدد الحصص يومياً</span>
          <div class="stepper big"><button data-act="periodsCount" data-d="-1">${icon('minus')}</button><b>${P}</b><button data-act="periodsCount" data-d="1">${icon('plus')}</button></div></div>
        <label class="field"><span>بداية اليوم الدراسي</span><input type="time" data-ch="periods" data-k="start" value="${esc(pr.start)}"></label>
        <label class="field"><span>مدة الحصة (دقيقة)</span><input type="number" min="10" max="120" data-ch="periods" data-k="duration" value="${pr.duration}"></label>
        <label class="field"><span>الاستراحة</span><select data-ch="periods" data-k="breakAfter">
          <option value="0">بدون استراحة</option>${Array.from({ length: Math.max(0, P - 1) }, (_, i) => `<option value="${i + 1}" ${+pr.breakAfter === i + 1 ? 'selected' : ''}>بعد الحصة ${i + 1}</option>`).join('')}</select></label>
        <label class="field"><span>مدة الاستراحة (دقيقة)</span><input type="number" min="0" max="120" data-ch="periods" data-k="breakDuration" value="${pr.breakDuration}"></label>
      </div>
      <div class="timeline">${tl}</div>
    </div>
    <div class="card pad stagger-i" style="--i:3">
      <div class="card-title">${icon('wand')} قواعد الجدولة الذكية</div>
      <label class="field"><span>أقصى عدد حصص متتالية للمعلم (تنبيه أصفر)</span><input type="number" min="0" max="12" data-ch="rules" data-k="maxConsecutive" value="${state.rules.maxConsecutive}"></label>
      <label class="field"><span>النصاب الأسبوعي الافتراضي للمعلم الجديد</span><input type="number" min="1" max="60" data-ch="rules" data-k="defaultMaxWeek" value="${state.rules.defaultMaxWeek}"></label>
      <label class="field"><span>أقصى حصص يومياً للمعلم الجديد</span><input type="number" min="1" max="12" data-ch="rules" data-k="defaultMaxDay" value="${state.rules.defaultMaxDay}"></label>
      <p class="hint">${icon('info')} الحد اليومي لكل مادة يُضبط من صفحة المواد، وأوقات عدم التواجد من صفحتي المعلمين والصفوف.</p>
    </div>
    <div class="card pad stagger-i" style="--i:4">
      <div class="card-title">${icon('save')} البيانات والنسخ الاحتياطي</div>
      <p class="hint">${icon('check')} كل التعديلات تُحفظ تلقائياً في هذا المتصفح. خذ نسخة احتياطية لنقل البيانات لجهاز آخر.</p>
      <div class="btn-col">
        <button class="btn btn-soft" data-act="exportJson">${icon('download')} تصدير نسخة احتياطية (JSON)</button>
        <label class="btn btn-soft">${icon('upload')} استيراد نسخة احتياطية<input type="file" accept=".json,application/json" data-ch="importFile" hidden></label>
        <button class="btn btn-soft" data-act="loadSample">${icon('sparkles')} تحميل البيانات التجريبية</button>
        <button class="btn btn-soft" data-act="newSchool">${icon('school')} بدء مدرسة جديدة (6 صفوف + المواد)</button>
        <button class="btn btn-danger-soft" data-act="wipeAll">${icon('trash')} مسح كل البيانات</button>
      </div>
    </div>
  </div>`;
}
CH.school = el => commit(st => { st.school[el.dataset.k] = el.value.trim(); }, { render: false });
CH.rules = el => commit(st => { st.rules[el.dataset.k] = clampInt(el.value, 0, 60, st.rules[el.dataset.k]); }, { render: false });
CH.periods = el => {
  const k = el.dataset.k;
  commit(st => {
    if (k === 'start') st.periods.start = el.value || '07:30';
    else if (k === 'duration') st.periods.duration = clampInt(el.value, 10, 120, 45);
    else if (k === 'breakAfter') st.periods.breakAfter = clampInt(el.value, 0, 15, 0);
    else if (k === 'breakDuration') st.periods.breakDuration = clampInt(el.value, 0, 120, 30);
  });
};
ACT.periodsCount = el => {
  const n = clampInt(+state.periods.count + +el.dataset.d, 1, Engine.STRIDE - 1, 7);
  if (n === +state.periods.count) return;
  const lost = state.lessons.filter(l => l.day != null && l.period >= n).length;
  const run = () => commit(st => { st.periods.count = n; if (+st.periods.breakAfter >= n) st.periods.breakAfter = 0; });
  if (lost) askConfirm(`تقليل عدد الحصص سيعيد <b>${lost}</b> حصة موزعة إلى القائمة. متابعة؟`, run);
  else run();
};
ACT.toggleDay = el => {
  const i = +el.dataset.i;
  const d = state.days[i];
  const lost = state.lessons.filter(l => l.day === i).length;
  const run = () => commit(st => { st.days[i].on = !st.days[i].on; });
  if (d.on && lost) askConfirm(`يوم ${esc(d.name)} به <b>${lost}</b> حصة موزعة ستعود إلى القائمة. متابعة؟`, run);
  else run();
};
ACT.exportJson = () => {
  const name = `جدول-${state.school.name}-${new Date().toISOString().slice(0, 10)}.json`;
  download(JSON.stringify(state, null, 1), name, 'application/json');
  toast('تم تصدير النسخة الاحتياطية', 'success');
};
CH.importFile = el => {
  const f = el.files && el.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const st = JSON.parse(rd.result);
      if (!st || !st.version || !Array.isArray(st.lessons) || !Array.isArray(st.classes)) throw new Error('bad');
      replaceState(upgrade(st), 'تم استيراد البيانات بنجاح');
    } catch (e) { toast('الملف غير صالح — تأكد أنه نسخة احتياطية من هذا البرنامج', 'error'); }
  };
  rd.readAsText(f);
  el.value = '';
};
ACT.loadSample = () => askConfirm('سيتم استبدال البيانات الحالية بالبيانات التجريبية (يمكنك التراجع بـ Ctrl+Z). متابعة؟', () => replaceState(buildSample(), 'تم تحميل البيانات التجريبية'), { danger: false });
ACT.newSchool = () => askConfirm('سيتم إنشاء مدرسة جديدة: 6 صفوف × فصلين، وقائمة المواد الأساسية بعدد حصصها، بدون معلمين. متابعة؟', () => { replaceState(newSchoolState(), 'تم إنشاء مدرسة جديدة — ابدأ بإضافة المعلمين'); navigate('teachers'); }, { danger: false });
ACT.wipeAll = () => askConfirm('سيتم مسح <b>كل</b> البيانات والبدء من الصفر. متابعة؟', () => replaceState(baseState(), 'تم مسح البيانات'), { yes: 'مسح الكل' });

/* =========================================================== الصفوف والفصول */
function roomOptions(selected) {
  const groups = ROOM_TYPES.map(t => {
    const rs = state.rooms.filter(r => r.type === t.id);
    return rs.length ? `<optgroup label="${t.icon} ${t.name}">${rs.map(r => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  return `<option value="">— بدون قاعة ثابتة —</option>${groups}`;
}
function renderGrades() {
  if (!state.grades.length) return emptyState('layers', 'لا توجد صفوف بعد', 'أضف الصفوف الدراسية (مثلاً من الأول إلى السادس) ثم حدد عدد الفصول في كل صف.', `<button class="btn btn-primary" data-act="addGrade">${icon('plus')} إضافة صف</button> <button class="btn btn-soft" data-act="addSixGrades">إضافة 6 صفوف ابتدائية</button>`);
  const days = activeDays(), P = +state.periods.count;
  return `<div class="page-tools">
      <div class="tools-info">${icon('info')} لكل صف: عدد الفصول وقاعة كل فصل، والأوقات المتاحة — <b>اضغط أو اسحب</b> على الخانات لتحديد الأوقات غير المتاحة.</div>
      <button class="btn btn-primary" data-act="addGrade">${icon('plus')} إضافة صف</button>
    </div>
    <div class="grades-grid">${state.grades.map((g, i) => {
      const classes = state.classes.filter(c => c.gradeId === g.id);
      const need = state.subjects.reduce((a, s) => a + periodsOf(s, g.id), 0);
      const blocked = (g.blocked || []).filter(k => { const [d, p] = k.split('-').map(Number); return state.days[d] && state.days[d].on && p < P; }).length;
      const avail = days.length * P - blocked;
      return `<div class="card grade-card stagger-i" style="${cvars(g.color)};--i:${i}">
        <div class="gc-head">
          <span class="gc-badge">${esc(g.short)}</span>
          <input class="gc-name" data-ch="grade" data-id="${g.id}" data-k="name" value="${esc(g.name)}">
          <input type="color" class="color-dot" data-ch="grade" data-id="${g.id}" data-k="color" value="${g.color}" data-tip="لون الصف">
          <button class="icon-btn danger" data-act="delGrade" data-id="${g.id}" data-tip="حذف الصف">${icon('trash')}</button>
        </div>
        <div class="gc-stats">
          <div><b>${classes.length}</b><span>${plural(classes.length, 'فصل', 'فصول', 'فصل')}</span></div>
          <div><b>${need}</b><span>حصة أسبوعياً لكل فصل</span></div>
          <div class="${need > avail ? 'bad' : ''}"><b>${avail}</b><span>وقت متاح${need > avail ? ' ⚠' : ''}</span></div>
        </div>
        <div class="sec-title">الفصول
          <div class="stepper"><button data-act="delLastClass" data-id="${g.id}" data-tip="حذف آخر فصل">${icon('minus')}</button><b>${classes.length}</b><button data-act="addClass" data-id="${g.id}" data-tip="إضافة فصل">${icon('plus')}</button></div>
        </div>
        <div class="class-list">${classes.map(c => `<div class="class-chip">
            <input class="cc-name" data-ch="class" data-id="${c.id}" data-k="name" value="${esc(c.name)}">
            <select data-ch="class" data-id="${c.id}" data-k="roomId" data-tip="القاعة الثابتة للفصل">${roomOptions(c.roomId)}</select>
            <button class="icon-btn sm" data-act="viewClass" data-id="${c.id}" data-tip="عرض جدول الفصل">${icon('eye')}</button>
            <button class="icon-btn sm danger" data-act="delClass" data-id="${c.id}" data-tip="حذف الفصل">${icon('x')}</button>
          </div>`).join('') || '<p class="muted">لا توجد فصول — اضغط + للإضافة</p>'}</div>
        <div class="sec-title">الأوقات المتاحة للصف <span class="legend-inline"><i class="lg-on"></i>متاح <i class="lg-off"></i>غير متاح</span></div>
        ${availGrid('grade', g.id, g.blocked)}
      </div>`;
    }).join('')}</div>`;
}
CH.grade = el => commit(st => { const g = byId(st.grades, el.dataset.id); if (g) g[el.dataset.k] = el.value.trim() || g[el.dataset.k]; }, { render: el.dataset.k === 'color' });
CH.class = el => commit(st => { const c = byId(st.classes, el.dataset.id); if (c) c[el.dataset.k] = el.dataset.k === 'roomId' ? el.value || null : el.value.trim() || c.name; }, { render: el.dataset.k === 'roomId' });
ACT.addGrade = () => {
  const i = state.grades.length;
  commit(st => { const g = makeGrade(st, i); st.grades.push(g); addClassTo(st, g); });
  focusNew('.grade-card:last-child .gc-name');
};
ACT.addSixGrades = () => commit(st => { for (let i = 0; i < 6; i++) { const g = makeGrade(st, i); st.grades.push(g); addClassTo(st, g); addClassTo(st, g); } });
ACT.delGrade = el => {
  const g = findGrade(el.dataset.id);
  const n = state.classes.filter(c => c.gradeId === g.id).length;
  askConfirm(`حذف <b>${esc(g.name)}</b> وفصوله (${n}) وكل حصصها من الجدول؟`, () => commit(st => {
    st.classes = st.classes.filter(c => c.gradeId !== g.id);
    st.grades = st.grades.filter(x => x.id !== g.id);
    st.teachers.forEach(t => { t.gradeIds = (t.gradeIds || []).filter(x => x !== g.id); });
    st.subjects.forEach(s => { if (s.periods) delete s.periods[g.id]; });
  }), { yes: 'حذف' });
};
ACT.addClass = el => commit(st => addClassTo(st, byId(st.grades, el.dataset.id)));
function removeClass(st, id) {
  const c = byId(st.classes, id);
  st.classes = st.classes.filter(x => x.id !== id);
  // حذف قاعة الفصل إن كانت فصلاً دراسياً عادياً غير مستخدم
  const r = c && c.roomId && byId(st.rooms, c.roomId);
  if (r && r.type === 'classroom' && !st.classes.some(x => x.roomId === r.id)) st.rooms = st.rooms.filter(x => x.id !== r.id);
}
ACT.delClass = el => {
  const c = findClass(el.dataset.id);
  const placed = state.lessons.filter(l => l.classId === c.id && l.day != null).length;
  askConfirm(`حذف فصل <b>${esc(c.name)}</b>${placed ? ` و${placed} حصة موزعة له` : ''}؟`, () => commit(st => removeClass(st, c.id)), { yes: 'حذف' });
};
ACT.delLastClass = el => {
  const list = state.classes.filter(c => c.gradeId === el.dataset.id);
  if (!list.length) return;
  ACT.delClass({ dataset: { id: list[list.length - 1].id } });
};
ACT.viewClass = el => { ui.ttMode = 'class'; ui.ttClass = el.dataset.id; navigate('timetable'); };
function toggleLine(kind, id, keys) {
  commit(st => {
    const o = kind === 'grade' ? byId(st.grades, id) : byId(st.teachers, id);
    const set = new Set(o.blocked || []);
    const allOff = keys.every(k => set.has(k));
    keys.forEach(k => (allOff ? set.delete(k) : set.add(k)));
    o.blocked = [...set];
  });
}
ACT.avRow = el => { const d = +el.dataset.d; toggleLine(el.dataset.kind, el.dataset.id, Array.from({ length: +state.periods.count }, (_, p) => d + '-' + p)); };
ACT.avCol = el => { const p = +el.dataset.p; toggleLine(el.dataset.kind, el.dataset.id, activeDays().map(d => d + '-' + p)); };

/* =========================================================== القاعات */
function renderRooms() {
  const f = ui.roomFilter;
  const slotsTotal = activeDays().length * +state.periods.count;
  const used = new Map();
  for (const l of state.lessons) if (l.day != null && l.roomId) used.set(l.roomId, (used.get(l.roomId) || 0) + 1);
  const list = state.rooms.filter(r => !f || r.type === f);
  const counts = {};
  state.rooms.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
  const tools = `<div class="page-tools">
      <div class="chips">
        <button class="chip-toggle ${!f ? 'on' : ''}" data-act="roomFilter" data-t="">الكل <span class="cnt">${state.rooms.length}</span></button>
        ${ROOM_TYPES.filter(t => counts[t.id]).map(t => `<button class="chip-toggle ${f === t.id ? 'on' : ''}" data-act="roomFilter" data-t="${t.id}">${t.icon} ${t.name} <span class="cnt">${counts[t.id]}</span></button>`).join('')}
      </div>
      <button class="btn btn-primary" data-act="addRoom">${icon('plus')} إضافة قاعة</button>
    </div>`;
  if (!state.rooms.length) return tools + emptyState('door', 'لا توجد قاعات', 'أضف الفصول الدراسية والمعامل والملاعب. المواد التي تحتاج قاعة خاصة (كالحاسب والرياضة) سيتم حجز قاعتها تلقائياً.');
  return tools + `<div class="rooms-grid">${list.map((r, i) => {
    const t = roomTypeOf(r.type);
    const u = used.get(r.id) || 0;
    const homes = state.classes.filter(c => c.roomId === r.id).map(c => c.name);
    const pct = slotsTotal ? Math.round((u * 100) / slotsTotal) : 0;
    return `<div class="card room-card stagger-i" style="${cvars(ROOM_TYPE_COLOR[r.type] || '#64748b')};--i:${Math.min(i, 20)}">
      <div class="rc-top"><span class="rc-icon">${t.icon}</span>
        <input class="rc-name" data-ch="room" data-id="${r.id}" data-k="name" value="${esc(r.name)}">
        <button class="icon-btn sm danger" data-act="delRoom" data-id="${r.id}" data-tip="حذف القاعة">${icon('trash')}</button></div>
      <div class="rc-fields">
        <label class="mini-field"><span>النوع</span><select data-ch="room" data-id="${r.id}" data-k="type">${ROOM_TYPES.map(x => `<option value="${x.id}" ${x.id === r.type ? 'selected' : ''}>${x.icon} ${x.name}</option>`).join('')}</select></label>
        <label class="mini-field sm"><span>السعة</span><input type="number" min="0" data-ch="room" data-id="${r.id}" data-k="capacity" value="${r.capacity || 0}"></label>
      </div>
      <div class="rc-home">${homes.length ? `${icon('layers')} قاعة ثابتة لفصل: <b>${homes.map(esc).join('، ')}</b>` : `<span class="muted">غير مرتبطة بفصل</span>`}</div>
      <div class="rc-usage"><div class="meter"><span style="width:${pct}%"></span></div><span>${u} / ${slotsTotal} حصة</span>
        <button class="link-btn" data-act="viewRoom" data-id="${r.id}">${icon('eye')} الجدول</button></div>
    </div>`;
  }).join('')}</div>`;
}
CH.room = el => commit(st => {
  const r = byId(st.rooms, el.dataset.id);
  if (!r) return;
  const k = el.dataset.k;
  r[k] = k === 'capacity' ? clampInt(el.value, 0, 9999, 0) : el.value.trim() || r[k];
}, { render: el.dataset.k === 'type' });
ACT.roomFilter = el => { ui.roomFilter = el.dataset.t; persistUi(); App.refresh(); };
ACT.addRoom = () => {
  const type = ui.roomFilter || 'classroom';
  commit(st => st.rooms.push({ id: uid('r'), name: 'قاعة جديدة', type, capacity: 30 }));
  focusNew('.room-card:last-child .rc-name');
};
ACT.delRoom = el => {
  const r = findRoom(el.dataset.id);
  const homes = state.classes.filter(c => c.roomId === r.id).length;
  askConfirm(`حذف <b>${esc(r.name)}</b>؟${homes ? ' (سيتم فك ارتباطها بالفصل)' : ''}`, () => commit(st => { st.rooms = st.rooms.filter(x => x.id !== r.id); }), { yes: 'حذف' });
};
ACT.viewRoom = el => { ui.ttMode = 'room'; ui.ttRoom = el.dataset.id; navigate('timetable'); };

/* =========================================================== المواد */
function renderSubjects() {
  const tools = `<div class="page-tools">
    <div class="tools-info">${icon('info')} حدد لكل مادة عدد حصصها الأسبوعية في كل صف، والقاعة التي تحتاجها، وأقصى عدد حصص في اليوم.</div>
    <button class="btn btn-primary" data-act="addSubject">${icon('plus')} إضافة مادة</button></div>`;
  if (!state.subjects.length) return tools + emptyState('book', 'لا توجد مواد', 'أضف المواد الدراسية وحدد عدد الحصص الأسبوعية لكل صف.', `<button class="btn btn-soft" data-act="addStdSubjects">إضافة مواد المرحلة الابتدائية</button>`);
  return tools + `<div class="subjects-grid">${state.subjects.map((s, i) => {
    const total = state.classes.reduce((a, c) => a + periodsOf(s, c.gradeId), 0);
    const q = state.teachers.filter(t => (t.subjectIds || []).includes(s.id)).length;
    return `<div class="card subj-card stagger-i" style="${cvars(s.color)};--i:${i}">
      <div class="sc-head">
        <select class="sc-icon" data-ch="subject" data-id="${s.id}" data-k="icon" data-tip="أيقونة المادة">${[...new Set([s.icon, ...SUBJECT_ICONS])].map(ic => `<option ${ic === s.icon ? 'selected' : ''}>${ic}</option>`).join('')}</select>
        <div class="sc-names">
          <input class="sc-name" data-ch="subject" data-id="${s.id}" data-k="name" value="${esc(s.name)}">
          <input class="sc-short" data-ch="subject" data-id="${s.id}" data-k="short" value="${esc(s.short)}" placeholder="اسم مختصر">
        </div>
        <input type="color" class="color-dot" data-ch="subject" data-id="${s.id}" data-k="color" value="${s.color}" data-tip="لون المادة في الجدول">
        <button class="icon-btn sm danger" data-act="delSubject" data-id="${s.id}" data-tip="حذف المادة">${icon('trash')}</button>
      </div>
      <div class="sec-title">الحصص الأسبوعية لكل صف</div>
      <div class="per-grid">${state.grades.map(g => `<label class="per-cell" style="--gc:${g.color}" data-tip="${esc(g.name)}"><span>${esc(g.short)}</span><input type="number" min="0" max="30" data-ch="subjPeriods" data-id="${s.id}" data-g="${g.id}" value="${periodsOf(s, g.id)}"></label>`).join('')}</div>
      <div class="sc-opts">
        <label class="mini-field"><span>القاعة المطلوبة</span><select data-ch="subject" data-id="${s.id}" data-k="roomType">
          <option value="">🏫 الفصل الخاص به</option>${ROOM_TYPES.filter(t => t.id !== 'classroom').map(t => `<option value="${t.id}" ${s.roomType === t.id ? 'selected' : ''}>${t.icon} ${t.name}</option>`).join('')}</select></label>
        <label class="mini-field sm"><span>أقصى/يوم</span><input type="number" min="1" max="10" data-ch="subject" data-id="${s.id}" data-k="maxPerDay" value="${s.maxPerDay || 1}"></label>
      </div>
      <label class="switch"><input type="checkbox" data-ch="subject" data-id="${s.id}" data-k="morning" ${s.morning ? 'checked' : ''}><span class="sw"></span>تفضيل الحصص الأولى (مواد أساسية)</label>
      <div class="sc-foot"><span>${icon('calendar')} ${total} حصة أسبوعياً بالمدرسة</span><span class="${q ? '' : 'bad-text'}">${icon('users')} ${q} ${plural(q, 'معلم', 'معلمين', 'معلم')}</span></div>
    </div>`;
  }).join('')}</div>`;
}
CH.subject = el => {
  const k = el.dataset.k;
  commit(st => {
    const s = byId(st.subjects, el.dataset.id);
    if (!s) return;
    if (k === 'morning') s.morning = el.checked;
    else if (k === 'maxPerDay') s.maxPerDay = clampInt(el.value, 1, 10, 1);
    else if (k === 'roomType') s.roomType = el.value;
    else s[k] = el.value.trim() || s[k];
  }, { render: ['icon', 'color', 'roomType'].includes(k) });
};
CH.subjPeriods = el => commit(st => {
  const s = byId(st.subjects, el.dataset.id);
  s.periods = s.periods || {};
  const n = clampInt(el.value, 0, 30, 0);
  if (n) s.periods[el.dataset.g] = n; else delete s.periods[el.dataset.g];
}, { render: false });
ACT.addSubject = () => {
  const i = state.subjects.length;
  commit(st => st.subjects.push({ id: uid('s'), name: 'مادة جديدة', short: 'جديدة', icon: SUBJECT_ICONS[i % SUBJECT_ICONS.length], color: PALETTE[i % PALETTE.length], roomType: '', maxPerDay: 1, morning: false, periods: {} }));
  focusNew('.subj-card:last-child .sc-name');
};
ACT.addStdSubjects = () => commit(st => addSampleSubjects(st));
ACT.delSubject = el => {
  const s = findSubject(el.dataset.id);
  askConfirm(`حذف مادة <b>${esc(s.name)}</b> وكل حصصها من الجدول؟`, () => commit(st => {
    st.subjects = st.subjects.filter(x => x.id !== s.id);
    st.teachers.forEach(t => { t.subjectIds = (t.subjectIds || []).filter(x => x !== s.id); });
  }), { yes: 'حذف' });
};

/* =========================================================== المعلمون */
function renderTeachers() {
  const loads = Engine.teacherLoads(state);
  const q = (ui.tSearch || '').trim();
  const f = ui.tFilter;
  const list = state.teachers.filter(t => !f || (t.subjectIds || []).includes(f));
  const totalA = state.teachers.reduce((a, t) => a + loads.get(t.id).assigned, 0);
  const tools = `<div class="page-tools">
      <label class="search">${icon('search')}<input placeholder="بحث باسم المعلم…" data-inp="tSearch" value="${esc(q)}"></label>
      <select data-ch="tFilter"><option value="">كل المواد</option>${state.subjects.map(s => `<option value="${s.id}" ${f === s.id ? 'selected' : ''}>${s.icon} ${esc(s.name)}</option>`).join('')}</select>
      <span class="pill">${state.teachers.length} معلم • ${totalA} حصة مسندة</span>
      <span class="grow"></span>
      <button class="btn btn-primary" data-act="addTeacher">${icon('plus')} إضافة معلم</button>
    </div>`;
  if (!state.teachers.length) return tools + emptyState('users', 'لا يوجد معلمون', 'أضف المعلمين، واختر لكل معلم المواد التي يدرّسها والصفوف التي يدرّس لها، ونصابه الأسبوعي.');
  return tools + `<div class="teachers-grid">${list.map((t, i) => {
    const L = loads.get(t.id);
    const m = +t.maxWeek || 0;
    const r = m ? L.assigned / m : 0;
    const cls = r > 1 ? 'bad' : r > 0.9 ? 'warn' : 'ok';
    const open = ui.openAvail[t.id];
    const nb = (t.blocked || []).length;
    const hidden = q && !t.name.includes(q) ? 'style="display:none"' : '';
    return `<div class="card teacher-card stagger-i" data-name="${esc(t.name)}" ${hidden}>
      <div class="tc-head" style="${cvars(t.color)};--i:${Math.min(i, 20)}">
        ${avatar(t, 'lg')}
        <div class="tc-names">
          <input class="tc-name" data-ch="teacher" data-id="${t.id}" data-k="name" value="${esc(t.name)}">
          <div class="tc-meta">${(t.subjectIds || []).map(id => findSubject(id)).filter(Boolean).map(s => s.icon + ' ' + esc(s.short || s.name)).join(' • ') || '<span class="bad-text">لم تُحدد مواد</span>'}</div>
        </div>
        <input type="color" class="color-dot" data-ch="teacher" data-id="${t.id}" data-k="color" value="${t.color}" data-tip="لون المعلم">
        <button class="icon-btn sm" data-act="viewTeacher" data-id="${t.id}" data-tip="عرض جدول المعلم">${icon('eye')}</button>
        <button class="icon-btn sm danger" data-act="delTeacher" data-id="${t.id}" data-tip="حذف المعلم">${icon('trash')}</button>
      </div>
      <div class="tc-load"><div class="meter ${cls}"><span style="width:${Math.min(100, r * 100)}%"></span></div>
        <span><b>${L.assigned}</b> / ${m} حصة مسندة • <b>${L.placed}</b> في الجدول</span></div>
      <div class="sec-title">المواد التي يدرّسها</div>
      <div class="chips">${state.subjects.map(s => `<button class="chip-toggle sm ${(t.subjectIds || []).includes(s.id) ? 'on' : ''}" style="${cvars(s.color)}" data-act="tSubj" data-id="${t.id}" data-s="${s.id}">${s.icon} ${esc(s.short || s.name)}</button>`).join('')}</div>
      <div class="sec-title">الصفوف</div>
      <div class="chips">${state.grades.map(g => `<button class="chip-toggle sm ${(t.gradeIds || []).includes(g.id) ? 'on' : ''}" style="${cvars(g.color)}" data-act="tGrade" data-id="${t.id}" data-g="${g.id}">${esc(g.name.replace('الصف ', ''))}</button>`).join('')}</div>
      <div class="tc-limits">
        <label class="mini-field"><span>النصاب الأسبوعي</span><input type="number" min="0" max="60" data-ch="teacher" data-id="${t.id}" data-k="maxWeek" value="${t.maxWeek}"></label>
        <label class="mini-field"><span>أقصى حصص يومياً</span><input type="number" min="1" max="12" data-ch="teacher" data-id="${t.id}" data-k="maxDay" value="${t.maxDay}"></label>
      </div>
      <button class="collapse-btn ${open ? 'open' : ''}" data-act="toggleAvail" data-id="${t.id}">${icon('clock')} أوقات عدم التواجد ${nb ? `<span class="badge warn">${nb}</span>` : ''}<span class="chev">▾</span></button>
      ${open ? `<div class="av-wrap"><p class="hint">اضغط أو اسحب لتحديد الأوقات التي لا يتواجد فيها المعلم.</p>${availGrid('teacher', t.id, t.blocked)}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}
INP.tSearch = el => {
  ui.tSearch = el.value;
  persistUi();
  const q = el.value.trim();
  document.querySelectorAll('.teacher-card').forEach(c => { c.style.display = !q || c.dataset.name.includes(q) ? '' : 'none'; });
};
CH.tFilter = el => { ui.tFilter = el.value; persistUi(); App.refresh(); };
CH.teacher = el => {
  const k = el.dataset.k;
  commit(st => {
    const t = byId(st.teachers, el.dataset.id);
    if (!t) return;
    if (k === 'maxWeek') t.maxWeek = clampInt(el.value, 0, 60, 24);
    else if (k === 'maxDay') t.maxDay = clampInt(el.value, 1, 12, 6);
    else t[k] = el.value.trim() || t[k];
  }, { render: k !== 'name' });
};
ACT.addTeacher = () => {
  const i = state.teachers.length;
  const id = uid('t');
  commit(st => st.teachers.push({ id, name: 'أ. معلم جديد', color: PALETTE[i % PALETTE.length], subjectIds: ui.tFilter ? [ui.tFilter] : [], gradeIds: st.grades.map(g => g.id), maxWeek: +st.rules.defaultMaxWeek || 24, maxDay: +st.rules.defaultMaxDay || 6, blocked: [] }));
  ui.tSearch = '';
  focusNew(`.tc-name[data-id="${id}"]`);
};
ACT.delTeacher = el => {
  const t = findTeacher(el.dataset.id);
  const n = Engine.teacherLoads(state).get(t.id).assigned;
  askConfirm(`حذف <b>${esc(t.name)}</b>؟${n ? ` سيتم إلغاء إسناد ${n} حصة له.` : ''}`, () => commit(st => { st.teachers = st.teachers.filter(x => x.id !== t.id); }), { yes: 'حذف' });
};
ACT.viewTeacher = el => { ui.ttMode = 'teacher'; ui.ttTeacher = el.dataset.id; navigate('timetable'); };
ACT.tSubj = el => commit(st => {
  const t = byId(st.teachers, el.dataset.id);
  const set = new Set(t.subjectIds || []);
  set.has(el.dataset.s) ? set.delete(el.dataset.s) : set.add(el.dataset.s);
  t.subjectIds = [...set];
});
ACT.tGrade = el => commit(st => {
  const t = byId(st.teachers, el.dataset.id);
  const set = new Set(t.gradeIds || []);
  set.has(el.dataset.g) ? set.delete(el.dataset.g) : set.add(el.dataset.g);
  t.gradeIds = [...set];
});
ACT.toggleAvail = el => { ui.openAvail[el.dataset.id] = !ui.openAvail[el.dataset.id]; persistUi(); App.refresh(); };

/* =========================================================== توزيع المواد على المعلمين */
function renderAssign() {
  if (!state.grades.length || !state.subjects.length) return emptyState('link', 'أضف الصفوف والمواد أولاً', 'بعد إضافة الصفوف والمواد والمعلمين، يمكنك هنا إسناد كل مادة في كل فصل لمعلم — يدوياً أو تلقائياً.');
  if (!findGrade(ui.assignGrade)) ui.assignGrade = state.grades[0].id;
  const g = findGrade(ui.assignGrade);
  const loads = Engine.teacherLoads(state);
  const classes = state.classes.filter(c => c.gradeId === g.id);
  const subjects = state.subjects.filter(s => periodsOf(s, g.id) > 0);
  const missingIn = gid => state.classes.filter(c => c.gradeId === gid).reduce((a, c) => a + state.subjects.filter(s => periodsOf(s, gid) > 0 && !state.assign[c.id + '|' + s.id]).length, 0);
  const qualified = s => state.teachers.filter(t => (t.subjectIds || []).includes(s.id) && (t.gradeIds || []).includes(g.id));
  const opt = (t, sel, bad) => {
    const L = loads.get(t.id);
    return `<option value="${t.id}" ${sel ? 'selected' : ''}>${esc(t.name)} — ${L.assigned}/${t.maxWeek}${bad ? ' (غير مؤهل)' : ''}</option>`;
  };
  const relevant = state.teachers.filter(t => subjects.some(s => (t.subjectIds || []).includes(s.id)) && (t.gradeIds || []).includes(g.id));

  const tabs = `<div class="tabs">${state.grades.map(x => { const m = missingIn(x.id); return `<button class="tab ${x.id === g.id ? 'on' : ''}" style="${cvars(x.color)}" data-act="assignGrade" data-id="${x.id}">${esc(x.name)}${m ? `<span class="badge warn">${m}</span>` : `<span class="tab-ok">${icon('check')}</span>`}</button>`; }).join('')}</div>`;
  const tools = `<div class="page-tools">
      <div class="tools-info">${icon('info')} المادة الواحدة يمكن توزيعها على أكثر من معلم: اختر لكل فصل المعلم المناسب. الرقم بجانب الاسم = الحصص المسندة / النصاب.</div>
      <button class="btn btn-primary" data-act="autoAssign" data-mode="empty">${icon('sparkles')} توزيع تلقائي للخانات الفارغة</button>
      <button class="btn btn-soft" data-act="autoAssign" data-mode="grade">${icon('refresh')} إعادة توزيع ${esc(g.name)}</button>
      <button class="btn btn-ghost" data-act="clearAssign">${icon('eraser')} مسح إسناد الصف</button>
    </div>`;
  if (!classes.length || !subjects.length) return tools + tabs + emptyState('layers', 'لا توجد فصول أو مواد لهذا الصف', 'أضف فصولاً للصف من صفحة الصفوف، وحدد عدد حصص المواد لهذا الصف من صفحة المواد.');

  const table = `<div class="card table-card"><div class="table-wrap"><table class="assign-table">
    <thead><tr><th class="sticky-col">الفصل</th>${subjects.map(s => {
      const qs = qualified(s);
      return `<th style="${cvars(s.color)}"><div class="th-subj"><span class="th-ic">${s.icon}</span><b>${esc(s.name)}</b><small>${periodsOf(s, g.id)} حصص • ${qs.length} ${plural(qs.length, 'معلم', 'معلمين', 'معلم')}</small>
        <select class="th-all" data-ch="assignAll" data-g="${g.id}" data-s="${s.id}"><option value="">تعيين للكل…</option>${qs.map(t => opt(t, false)).join('')}</select></div></th>`;
    }).join('')}</tr></thead>
    <tbody>${classes.map(c => `<tr><th class="sticky-col"><span class="cls-badge" style="${cvars(g.color)}">${esc(c.name)}</span></th>${subjects.map(s => {
      const tid = state.assign[c.id + '|' + s.id];
      const t = tid && findTeacher(tid);
      const qs = qualified(s);
      const extra = t && !qs.includes(t) ? opt(t, true, true) : '';
      const L = t && loads.get(t.id);
      return `<td><label class="as-cell ${t ? '' : 'empty'}" style="${t ? cvars(t.color) : ''}">
        ${t ? avatar(t, 'xs') : '⚠️'}<span class="as-name">${t ? esc(t.name) : 'غير مسند'}</span>${t ? `<span class="as-load">${L.assigned}/${t.maxWeek}</span>` : ''}<span class="as-chev">▾</span>
        <select data-ch="assign" data-c="${c.id}" data-s="${s.id}"><option value="">— غير مسند —</option>${extra}${qs.map(x => opt(x, x.id === tid)).join('')}</select></label></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div></div>`;

  const side = `<aside class="card pad load-panel"><div class="card-title">${icon('users')} أحمال معلمي ${esc(g.name)}</div>
    ${relevant.length ? relevant.sort((a, b) => loads.get(b.id).assigned / (+b.maxWeek || 1) - loads.get(a.id).assigned / (+a.maxWeek || 1)).map(t => {
      const a = loads.get(t.id).assigned, m = +t.maxWeek || 0, r = m ? a / m : 0;
      return `<div class="load-row" data-act="viewTeacher" data-id="${t.id}">${avatar(t, 'sm')}<span class="load-name">${esc(t.name)}</span><div class="meter ${r > 1 ? 'bad' : r > 0.9 ? 'warn' : 'ok'}"><span style="width:${Math.min(100, r * 100)}%"></span></div><b>${a}/${m}</b></div>`;
    }).join('') : `<p class="muted">لا يوجد معلمون مؤهلون لهذا الصف بعد — حدد الصفوف والمواد لكل معلم من صفحة المعلمين.</p>`}</aside>`;
  return tools + tabs + `<div class="assign-layout">${table}${side}</div>`;
}
ACT.assignGrade = el => { ui.assignGrade = el.dataset.id; persistUi(); App.refresh(); };
CH.assign = el => commit(st => {
  const k = el.dataset.c + '|' + el.dataset.s;
  if (el.value) st.assign[k] = el.value; else delete st.assign[k];
});
CH.assignAll = el => {
  if (!el.value) return;
  commit(st => st.classes.filter(c => c.gradeId === el.dataset.g).forEach(c => { st.assign[c.id + '|' + el.dataset.s] = el.value; }));
  toast('تم إسناد المادة لكل فصول الصف', 'success');
};
ACT.autoAssign = el => {
  const mode = el.dataset.mode;
  let res;
  commit(st => { res = autoAssign(st, mode === 'grade' ? { onlyEmpty: false, gradeId: ui.assignGrade } : { onlyEmpty: true }); });
  if (!res.done && !res.missing) toast('كل المواد مسندة بالفعل ✓', 'info');
  else if (res.missing) toast(`تم إسناد ${res.done} — و${res.missing} بدون معلم مؤهل (حدد المواد والصفوف للمعلمين)`, 'warn', 5000);
  else toast(`تم إسناد ${res.done} مادة/فصل تلقائياً بموازنة الأنصبة`, 'success');
};
ACT.clearAssign = () => {
  const g = findGrade(ui.assignGrade);
  askConfirm(`مسح كل إسنادات <b>${esc(g.name)}</b>؟`, () => commit(st => {
    st.classes.filter(c => c.gradeId === g.id).forEach(c => st.subjects.forEach(s => { delete st.assign[c.id + '|' + s.id]; }));
  }), { yes: 'مسح' });
};
