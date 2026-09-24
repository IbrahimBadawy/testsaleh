/* =====================================================================
 *  engine.js — محرّك القيود واكتشاف التعارضات + المولّد التلقائي للجدول
 *  مستقل عن المتصفح (يعمل في Node أيضاً للاختبار)
 * ===================================================================== */
(function (global) {
  'use strict';

  const STRIDE = 16; // أقصى عدد حصص في اليوم (يُستخدم لترميز الخانة كرقم واحد)
  const slotKey = (d, p) => d * STRIDE + p;
  const EMPTY = new Set();

  const ROOM_TYPES = [
    { id: 'classroom', name: 'فصل دراسي', icon: '🏫' },
    { id: 'science', name: 'معمل علوم', icon: '🔬' },
    { id: 'computer', name: 'معمل حاسب', icon: '💻' },
    { id: 'sports', name: 'ملعب / صالة رياضية', icon: '⚽' },
    { id: 'music', name: 'غرفة موسيقى', icon: '🎵' },
    { id: 'art', name: 'مرسم / غرفة فنون', icon: '🎨' },
    { id: 'library', name: 'مكتبة', icon: '📚' },
    { id: 'hall', name: 'مسرح / قاعة متعددة', icon: '🎭' },
  ];
  const ROOM_TYPE_NAME = Object.fromEntries(ROOM_TYPES.map(t => [t.id, t.name]));

  const REASONS = {
    off: 'خارج أيام أو حصص الدوام',
    grade_blocked: 'أوقات غير متاحة للصف',
    teacher_blocked: 'أوقات عدم تواجد المعلم',
    class_busy: 'الفصل ممتلئ في الأوقات المتاحة',
    teacher_busy: 'المعلم مشغول مع فصول أخرى',
    room_busy: 'القاعات المطلوبة مشغولة',
    subj_day: 'الحد اليومي للمادة',
    teacher_day: 'الحد اليومي لحصص المعلم',
  };

  function teacherOf(state, l) {
    return state.assign[l.classId + '|' + l.subjectId] || null;
  }

  function push(map, key, v) {
    const a = map.get(key);
    if (a) a.push(v); else map.set(key, [v]);
  }

  function makeCtx(state) {
    const ctx = {
      days: state.days.map((d, i) => (d.on ? i : -1)).filter(i => i >= 0),
      P: Math.min(+state.periods.count || 0, STRIDE),
      classById: new Map(), gradeById: new Map(), subjById: new Map(),
      teacherById: new Map(), roomById: new Map(),
      roomsByType: {}, gradeBlocked: new Map(), teacherBlocked: new Map(),
    };
    ctx.activeDay = new Set(ctx.days);
    for (const g of state.grades) { ctx.gradeById.set(g.id, g); ctx.gradeBlocked.set(g.id, new Set(g.blocked || [])); }
    for (const c of state.classes) ctx.classById.set(c.id, c);
    for (const s of state.subjects) ctx.subjById.set(s.id, s);
    for (const t of state.teachers) { ctx.teacherById.set(t.id, t); ctx.teacherBlocked.set(t.id, new Set(t.blocked || [])); }
    for (const r of state.rooms) { ctx.roomById.set(r.id, r); (ctx.roomsByType[r.type] = ctx.roomsByType[r.type] || []).push(r); }
    return ctx;
  }

  function buildIndex(state) {
    const idx = { cls: new Map(), tch: new Map(), room: new Map(), subjDay: new Map(), tchDay: new Map() };
    for (const l of state.lessons) {
      if (l.day == null) continue;
      const s = slotKey(l.day, l.period);
      const t = teacherOf(state, l);
      push(idx.cls, l.classId + '@' + s, l);
      if (t) { push(idx.tch, t + '@' + s, l); push(idx.tchDay, t + '@' + l.day, l); }
      if (l.roomId) push(idx.room, l.roomId + '@' + s, l);
      push(idx.subjDay, l.classId + '|' + l.subjectId + '@' + l.day, l);
    }
    return idx;
  }

  function env(state) {
    return { state, ctx: makeCtx(state), idx: buildIndex(state) };
  }

  const firstOther = (list, skip) => (list ? list.find(m => !skip(m)) : undefined);
  const countOther = (list, skip) => (list ? list.reduce((a, m) => a + (skip(m) ? 0 : 1), 0) : 0);
  const subjName = (ctx, m) => (m && ctx.subjById.get(m.subjectId) ? ctx.subjById.get(m.subjectId).name : '');
  const clsName = (ctx, m) => (m && ctx.classById.get(m.classId) ? ctx.classById.get(m.classId).name : '');

  /**
   * تقييم وضع حصة L في (اليوم d ، الحصة p)
   * ignore: مجموعة معرفات حصص تُعامل كأنها غير موجودة (للتبديل)
   * يرجع: { level: ok | warn | bad, bad:[{code,msg}], warn:[{code,msg}], roomId }
   */
  function evaluate(E, L, d, p, ignore) {
    const { state, ctx, idx } = E;
    const bad = [], warn = [];
    const skip = m => m.id === L.id || (ignore ? ignore.has(m.id) : false);
    const cls = ctx.classById.get(L.classId);
    const subj = ctx.subjById.get(L.subjectId);
    if (!cls || !subj) return { level: 'bad', bad: [{ code: 'off', msg: 'بيانات الحصة غير مكتملة' }], warn, roomId: null };
    const grade = ctx.gradeById.get(cls.gradeId);
    const tid = teacherOf(state, L);
    const t = tid ? ctx.teacherById.get(tid) : null;
    const k = d + '-' + p, s = slotKey(d, p);
    const dayName = state.days[d] ? state.days[d].name : '';

    if (!ctx.activeDay.has(d) || p >= ctx.P) bad.push({ code: 'off', msg: REASONS.off });
    if (grade && ctx.gradeBlocked.get(grade.id).has(k)) bad.push({ code: 'grade_blocked', msg: `هذا الوقت غير متاح لـ ${grade.name}` });
    if (t && ctx.teacherBlocked.get(t.id).has(k)) bad.push({ code: 'teacher_blocked', msg: `${t.name} غير متاح يوم ${dayName} الحصة ${p + 1}` });

    const cm = firstOther(idx.cls.get(L.classId + '@' + s), skip);
    if (cm) bad.push({ code: 'class_busy', msg: `فصل ${cls.name} لديه حصة ${subjName(ctx, cm)} في هذا الوقت` });

    if (t) {
      const tm = firstOther(idx.tch.get(t.id + '@' + s), skip);
      if (tm) bad.push({ code: 'teacher_busy', msg: `${t.name} يدرّس ${subjName(ctx, tm)} لفصل ${clsName(ctx, tm)} في نفس الوقت` });
    }

    // القاعة
    let roomId = null;
    const typed = subj.roomType ? (ctx.roomsByType[subj.roomType] || []) : [];
    if (typed.length) {
      const free = typed.filter(r => !firstOther(idx.room.get(r.id + '@' + s), skip));
      if (!free.length) {
        const who = typed.map(r => `${r.name} (فصل ${clsName(ctx, firstOther(idx.room.get(r.id + '@' + s), skip))})`).join('، ');
        bad.push({ code: 'room_busy', msg: `لا توجد قاعة «${ROOM_TYPE_NAME[subj.roomType] || subj.roomType}» متاحة: ${who}` });
      } else {
        roomId = (free.find(r => r.id === L.roomId) || free[0]).id;
      }
    } else {
      if (subj.roomType) warn.push({ code: 'no_room', msg: `لا توجد قاعة من نوع «${ROOM_TYPE_NAME[subj.roomType] || subj.roomType}» — ستُعقد في الفصل` });
      if (cls.roomId && ctx.roomById.has(cls.roomId)) {
        const rm = firstOther(idx.room.get(cls.roomId + '@' + s), m => skip(m) || m.classId === L.classId);
        if (rm) bad.push({ code: 'room_busy', msg: `${ctx.roomById.get(cls.roomId).name} مشغولة بفصل ${clsName(ctx, rm)}` });
        roomId = cls.roomId;
      }
    }

    // الحد اليومي للمادة في الفصل
    const sd = countOther(idx.subjDay.get(L.classId + '|' + L.subjectId + '@' + d), skip);
    const maxS = +subj.maxPerDay || 0;
    if (maxS && sd + 1 > maxS) bad.push({ code: 'subj_day', msg: `${subj.name}: الحد الأقصى ${maxS} ${maxS === 1 ? 'حصة' : 'حصص'} في اليوم` });
    else if (sd >= 1) warn.push({ code: 'subj_repeat', msg: `${subj.name} موجودة بالفعل يوم ${dayName}` });

    // المعلم: الحد اليومي + الحصص المتتالية
    if (t) {
      const list = (idx.tchDay.get(t.id + '@' + d) || []).filter(m => !skip(m));
      const maxD = +t.maxDay || 0;
      if (maxD && list.length + 1 > maxD) bad.push({ code: 'teacher_day', msg: `${t.name} وصل للحد الأقصى (${maxD} حصص) يوم ${dayName}` });
      const busy = new Set(list.map(m => m.period));
      let run = 1;
      for (let q = p - 1; busy.has(q); q--) run++;
      for (let q = p + 1; busy.has(q); q++) run++;
      const mc = +(state.rules && state.rules.maxConsecutive) || 0;
      if (mc && run > mc) warn.push({ code: 'consecutive', msg: `${t.name} سيكون لديه ${run} حصص متتالية` });
    } else {
      warn.push({ code: 'no_teacher', msg: 'لم يُسند معلم لهذه المادة بعد' });
    }

    return { level: bad.length ? 'bad' : warn.length ? 'warn' : 'ok', bad, warn, roomId };
  }

  const worst = (a, b) => (a === 'bad' || b === 'bad' ? 'bad' : a === 'warn' || b === 'warn' ? 'warn' : 'ok');

  /** تقييم نقل L إلى (d,p) مع وجود حصة B في الخانة (تبديل/استبدال) */
  function evaluateMove(E, L, d, p, B) {
    if (!B) return evaluate(E, L, d, p, null);
    const ign = new Set([L.id, B.id]);
    const a = evaluate(E, L, d, p, ign);
    if (L.day == null) return Object.assign(a, { replace: true });
    const b = evaluate(E, B, L.day, L.period, ign);
    const pre = `«${subjName(E.ctx, B)}» بعد التبديل: `;
    return {
      level: worst(a.level, b.level),
      bad: a.bad.concat(b.bad.map(x => ({ code: x.code, msg: pre + x.msg }))),
      warn: a.warn.concat(b.warn.filter(x => x.code !== 'no_teacher').map(x => ({ code: x.code, msg: pre + x.msg }))),
      roomId: a.roomId,
    };
  }

  /** إعادة اختيار القاعة لحصص تم تحريكها */
  function reassignRooms(state, ids) {
    for (const id of ids) {
      const L = state.lessons.find(l => l.id === id);
      if (!L) continue;
      if (L.day == null) { L.roomId = null; continue; }
      L.roomId = evaluate(env(state), L, L.day, L.period, null).roomId;
    }
  }

  /** ضبط القاعات بعد أي تعديل في البيانات (قاعة الفصل / نوع قاعة المادة) */
  function normalizeRooms(state) {
    const E = env(state);
    const { ctx, idx } = E;
    const move = (L, s, to) => {
      if (L.roomId) { const a = idx.room.get(L.roomId + '@' + s); if (a) { const i = a.indexOf(L); if (i >= 0) a.splice(i, 1); } }
      L.roomId = to;
      if (to) push(idx.room, to + '@' + s, L);
    };
    for (const L of state.lessons) {
      if (L.day == null) { L.roomId = null; continue; }
      const subj = ctx.subjById.get(L.subjectId), cls = ctx.classById.get(L.classId);
      if (!subj || !cls) continue;
      const s = slotKey(L.day, L.period);
      const typed = subj.roomType ? (ctx.roomsByType[subj.roomType] || []) : [];
      if (typed.length) {
        if (L.roomId && typed.some(r => r.id === L.roomId)) continue;
        const free = typed.find(r => !(idx.room.get(r.id + '@' + s) || []).some(m => m.id !== L.id));
        move(L, s, (free || typed[0]).id);
      } else {
        const want = cls.roomId && ctx.roomById.has(cls.roomId) ? cls.roomId : null;
        if (L.roomId !== want) move(L, s, want);
      }
    }
  }

  function teacherLoads(state) {
    const m = new Map(state.teachers.map(t => [t.id, { assigned: 0, placed: 0 }]));
    for (const l of state.lessons) {
      const o = m.get(teacherOf(state, l));
      if (!o) continue;
      o.assigned++;
      if (l.day != null) o.placed++;
    }
    return m;
  }

  /** كل المشاكل والتنبيهات في البيانات والجدول */
  function computeIssues(state, E) {
    E = E || env(state);
    const { ctx, idx } = E;
    const conflicts = [], conflictIds = new Set();
    for (const L of state.lessons) {
      if (L.day == null) continue;
      const r = evaluate(E, L, L.day, L.period, null);
      const msgs = r.bad.map(b => b.msg);
      if (L.roomId && !r.bad.some(b => b.code === 'room_busy')) {
        const other = (idx.room.get(L.roomId + '@' + slotKey(L.day, L.period)) || []).find(m => m.id !== L.id && m.classId !== L.classId);
        if (other) msgs.push(`${(ctx.roomById.get(L.roomId) || {}).name || 'القاعة'} محجوزة لفصل ${clsName(ctx, other)} في نفس الوقت`);
      }
      if (msgs.length) { conflicts.push({ lesson: L, msgs }); conflictIds.add(L.id); }
    }
    const unplaced = state.lessons.filter(l => l.day == null);

    const noTeacher = [];
    for (const c of state.classes) for (const s of state.subjects) {
      const n = +((s.periods || {})[c.gradeId] || 0);
      if (n > 0 && !state.assign[c.id + '|' + s.id]) noTeacher.push({ cls: c, subj: s, n });
    }

    const loads = teacherLoads(state);
    const overload = state.teachers
      .filter(t => +t.maxWeek && loads.get(t.id).assigned > +t.maxWeek)
      .map(t => ({ teacher: t, load: loads.get(t.id).assigned }));

    const overCap = [];
    for (const c of state.classes) {
      const need = state.subjects.reduce((a, s) => a + +((s.periods || {})[c.gradeId] || 0), 0);
      const gb = ctx.gradeBlocked.get(c.gradeId) || EMPTY;
      let avail = 0;
      for (const d of ctx.days) for (let p = 0; p < ctx.P; p++) if (!gb.has(d + '-' + p)) avail++;
      if (need > avail) overCap.push({ cls: c, need, avail });
    }

    const tCap = [];
    for (const t of state.teachers) {
      const a = loads.get(t.id).assigned;
      if (!a) continue;
      const tb = ctx.teacherBlocked.get(t.id) || EMPTY;
      let cap = 0;
      for (const d of ctx.days) {
        let free = 0;
        for (let p = 0; p < ctx.P; p++) if (!tb.has(d + '-' + p)) free++;
        cap += +t.maxDay ? Math.min(free, +t.maxDay) : free;
      }
      if (a > cap) tCap.push({ teacher: t, load: a, cap });
    }

    // مادة تحتاج حصصاً أكثر من الممكن (الحد اليومي × الأيام المتاحة للصف والمعلم)
    const subjCap = [];
    for (const c of state.classes) for (const s of state.subjects) {
      const need = +((s.periods || {})[c.gradeId] || 0);
      if (!need) continue;
      const tid = state.assign[c.id + '|' + s.id];
      const tb = (tid && ctx.teacherBlocked.get(tid)) || EMPTY;
      const gb = ctx.gradeBlocked.get(c.gradeId) || EMPTY;
      const maxS = +s.maxPerDay || 99;
      let cap = 0, days = 0;
      for (const d of ctx.days) {
        let free = 0;
        for (let p = 0; p < ctx.P; p++) if (!tb.has(d + '-' + p) && !gb.has(d + '-' + p)) free++;
        if (free) days++;
        cap += Math.min(free, maxS);
      }
      if (need > cap) subjCap.push({ cls: c, subj: s, need, cap, days, teacher: tid ? ctx.teacherById.get(tid) : null });
    }

    // سعة القاعات المتخصصة (مثلاً: حصص الفنية أكثر من أوقات المرسم)
    const roomCap = [];
    const needByType = {};
    for (const l of state.lessons) {
      const s = ctx.subjById.get(l.subjectId);
      if (s && s.roomType && (ctx.roomsByType[s.roomType] || []).length) needByType[s.roomType] = (needByType[s.roomType] || 0) + 1;
    }
    for (const type of Object.keys(needByType)) {
      const rooms = ctx.roomsByType[type];
      const cap = rooms.length * ctx.days.length * ctx.P;
      if (needByType[type] > cap) roomCap.push({ type, typeName: ROOM_TYPE_NAME[type] || type, need: needByType[type], cap, rooms });
    }

    const unqualified = [];
    for (const k of Object.keys(state.assign)) {
      const [cid, sid] = k.split('|');
      const t = ctx.teacherById.get(state.assign[k]), c = ctx.classById.get(cid), s = ctx.subjById.get(sid);
      if (!t || !c || !s || !+((s.periods || {})[c.gradeId] || 0)) continue;
      if (!(t.subjectIds || []).includes(sid) || !(t.gradeIds || []).includes(c.gradeId)) unqualified.push({ teacher: t, cls: c, subj: s });
    }

    return { conflicts, conflictIds, unplaced, noTeacher, overload, overCap, tCap, subjCap, roomCap, unqualified };
  }

  /** شرح سبب عدم إمكانية توزيع حصة */
  function explain(E, L) {
    const counts = {};
    let ok = 0, swappable = 0;
    for (const d of E.ctx.days) for (let p = 0; p < E.ctx.P; p++) {
      const r = evaluate(E, L, d, p, null);
      if (r.level !== 'bad') { ok++; continue; }
      const codes = r.bad.map(b => b.code).filter(c => c !== 'class_busy');
      if (!codes.length) { swappable++; continue; }
      for (const c of codes) counts[c] = (counts[c] || 0) + 1;
    }
    if (ok) return `يوجد ${ok} مكان متاح — اسحبها إلى الجدول`;
    if (swappable) return `الفصل ممتلئ — يمكن التبديل مع حصة أخرى في ${swappable} خانة`;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => REASONS[c] || c);
    return top.length ? 'السبب: ' + top.join(' + ') : 'لا توجد أوقات متاحة';
  }

  // ---------------------------------------------------------------------
  //  المولّد التلقائي: ترتيب "الأصعب أولاً" + اختيار أفضل خانة بدرجات
  //  + سلاسل إزاحة (ejection chains) لحل الانسدادات + عدة محاولات عشوائية
  // ---------------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function autoSchedule(state, opts) {
    opts = opts || {};
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const t0 = now();
    const budget = opts.timeBudget != null ? opts.timeBudget : 2500;
    const maxAttempts = opts.maxAttempts || 60;
    const ctx = makeCtx(state);
    const P = ctx.P;
    const NS = 7 * STRIDE;
    const slots = [];
    for (const d of ctx.days) for (let p = 0; p < P; p++) slots.push(slotKey(d, p));
    const validSlot = new Uint8Array(NS);
    for (const s of slots) validSlot[s] = 1;

    const cMap = new Map(), tMap = new Map(), rMap = new Map(), kMap = new Map();
    const idOf = (m, k) => { let v = m.get(k); if (v === undefined) { v = m.size; m.set(k, v); } return v; };
    const roomIds = state.rooms.map(r => r.id);
    roomIds.forEach(id => idOf(rMap, id));

    const src = state.lessons.filter(l => ctx.classById.has(l.classId) && ctx.subjById.has(l.subjectId));
    const n = src.length;
    const tCount = new Map();
    for (const l of src) { const t = teacherOf(state, l); if (t && ctx.teacherById.has(t)) tCount.set(t, (tCount.get(t) || 0) + 1); }

    const info = src.map(l => {
      const cls = ctx.classById.get(l.classId), subj = ctx.subjById.get(l.subjectId);
      const tid = teacherOf(state, l);
      const t = tid ? ctx.teacherById.get(tid) : null;
      const typed = subj.roomType ? (ctx.roomsByType[subj.roomType] || []) : [];
      const gb = ctx.gradeBlocked.get(cls.gradeId) || EMPTY;
      const tb = t ? ctx.teacherBlocked.get(t.id) : EMPTY;
      const avail = new Uint8Array(NS);
      let dom = 0;
      for (const s of slots) {
        const k = (s >> 4) + '-' + (s & 15);
        if (!gb.has(k) && !tb.has(k)) { avail[s] = 1; dom++; }
      }
      return {
        l, avail, dom,
        ci: idOf(cMap, l.classId),
        ti: t ? idOf(tMap, t.id) : -1,
        si: idOf(kMap, l.classId + '|' + l.subjectId),
        ri: typed.map(r => rMap.get(r.id)),
        hi: !typed.length && cls.roomId && rMap.has(cls.roomId) ? rMap.get(cls.roomId) : -1,
        subjMax: +subj.maxPerDay || 99,
        maxDay: t ? (+t.maxDay || 99) : 99,
        morning: !!subj.morning,
        locked: !!l.locked && l.day != null,
        load: t ? tCount.get(t.id) / Math.max(1, +t.maxWeek || 24) : 0,
      };
    });
    const NC = Math.max(1, cMap.size), NT = Math.max(1, tMap.size), NR = Math.max(1, rMap.size), NK = Math.max(1, kMap.size);

    function attempt(rand) {
      const clsOcc = new Int32Array(NC * NS).fill(-1);
      const tOcc = new Int32Array(NT * NS).fill(-1);
      const rOcc = new Int32Array(NR * NS).fill(-1);
      const sd = new Uint8Array(NK * 7), td = new Uint8Array(NT * 7);
      const pos = new Int32Array(n).fill(-1), room = new Int32Array(n).fill(-1);
      const fixedOut = new Uint8Array(n);

      const put = (i, s, r) => {
        const f = info[i], d = s >> 4;
        pos[i] = s; room[i] = r;
        clsOcc[f.ci * NS + s] = i;
        if (f.ti >= 0) { tOcc[f.ti * NS + s] = i; td[f.ti * 7 + d]++; }
        if (r >= 0) rOcc[r * NS + s] = i;
        sd[f.si * 7 + d]++;
      };
      const take = i => {
        const s = pos[i];
        if (s < 0) return;
        const f = info[i], d = s >> 4;
        clsOcc[f.ci * NS + s] = -1;
        if (f.ti >= 0) { tOcc[f.ti * NS + s] = -1; td[f.ti * 7 + d]--; }
        if (room[i] >= 0) rOcc[room[i] * NS + s] = -1;
        sd[f.si * 7 + d]--;
        pos[i] = -1; room[i] = -1;
      };
      const roomFor = (f, s) => {
        if (f.ri.length) { for (const r of f.ri) if (rOcc[r * NS + s] < 0) return r; return -2; }
        if (f.hi >= 0) return rOcc[f.hi * NS + s] < 0 ? f.hi : -2;
        return -1;
      };
      // يرجع رقم القاعة، أو -1 (لا تحتاج قاعة)، أو -2 (غير ممكن)
      const can = (i, s) => {
        const f = info[i];
        if (!f.avail[s] || clsOcc[f.ci * NS + s] >= 0) return -2;
        if (f.ti >= 0 && tOcc[f.ti * NS + s] >= 0) return -2;
        const d = s >> 4;
        if (sd[f.si * 7 + d] >= f.subjMax) return -2;
        if (f.ti >= 0 && td[f.ti * 7 + d] >= f.maxDay) return -2;
        return roomFor(f, s);
      };

      // 1) الحصص الموضوعة مسبقاً (المثبّتة أولاً)
      const queue = [];
      const order0 = [...Array(n).keys()].sort((a, b) => info[b].locked - info[a].locked);
      for (const i of order0) {
        const f = info[i], l = f.l;
        const keep = l.day != null && (f.locked || !opts.rebuild);
        if (!keep) { queue.push(i); continue; }
        const s = slotKey(l.day, l.period);
        let r = validSlot[s] ? can(i, s) : -2;
        if (r === -2) { if (f.locked) fixedOut[i] = 1; else queue.push(i); continue; }
        if (f.ri.length && l.roomId && rMap.has(l.roomId)) {
          const or = rMap.get(l.roomId);
          if (f.ri.includes(or) && rOcc[or * NS + s] < 0) r = or;
        }
        put(i, s, r);
      }

      // 2) ترتيب الأصعب أولاً
      const pri = new Float64Array(n);
      for (const i of queue) {
        const f = info[i];
        pri[i] = f.dom - f.load * 14 - (f.ri.length ? 8 : 0) + rand() * 3;
      }
      queue.sort((a, b) => pri[a] - pri[b]);

      const score = (i, s) => {
        const f = info[i], d = s >> 4, p = s & 15;
        let sc = rand() * 2.5 + sd[f.si * 7 + d] * 14;
        if (f.morning) sc += p * 1.6;
        if (f.ti >= 0) {
          sc += td[f.ti * 7 + d] * 1.5;
          const b = f.ti * NS + (d << 4);
          if ((p > 0 && tOcc[b + p - 1] >= 0) || (p < P - 1 && tOcc[b + p + 1] >= 0)) sc -= 1.2;
        }
        return sc;
      };
      // هل للحصة المُزاحة مكان بديل مباشر؟ (نظرة للأمام تقلل التذبذب)
      const altCount = (j, except) => {
        let c = 0;
        for (const s2 of slots) {
          if (s2 === except || s2 === pos[j]) continue;
          if (can(j, s2) !== -2 && ++c >= 2) break;
        }
        return c;
      };
      const pickOnDay = (occ, row, d, pred) => {
        const c = [];
        for (let p = 0; p < P; p++) { const j = occ[row * NS + (d << 4) + p]; if (j >= 0 && pred(j)) c.push(j); }
        return c.length ? c[(rand() * c.length) | 0] : -1;
      };

      // 3) التوزيع مع سلاسل الإزاحة
      const stack = [];
      let head = 0, steps = 0;
      const last = new Int32Array(n).fill(-99999);
      const failed = [];
      const maxSteps = opts.maxSteps || Math.max(4000, n * 40);
      const CHAIN_MAX = opts.chainMax || 150; // حد أقصى لطول سلسلة الإزاحة لكل حصة
      let chain = 0;
      while ((stack.length || head < queue.length) && steps < maxSteps) {
        steps++;
        let i;
        if (stack.length) {
          i = stack.pop();
          // سلسلة طويلة جداً = غالباً حصة مستحيلة تتنقل بلا نهاية → نتوقف عندها
          if (++chain > CHAIN_MAX) { failed.push(i); failed.push(...stack.splice(0)); chain = 0; continue; }
        } else { i = queue[head++]; chain = 0; }
        const f = info[i];
        let bs = -1, br = -1, bsc = Infinity;
        for (const s of slots) {
          const r = can(i, s);
          if (r === -2) continue;
          const sc = score(i, s);
          if (sc < bsc) { bsc = sc; bs = s; br = r; }
        }
        if (bs >= 0) { put(i, bs, br); last[i] = steps; continue; }

        let es = -1, er = -1, ebl = null, ecost = Infinity;
        for (const s of slots) {
          if (!f.avail[s]) continue;
          const d = s >> 4;
          const bl = [];
          const add = j => { if (j >= 0 && !bl.includes(j)) bl.push(j); };
          add(clsOcc[f.ci * NS + s]);
          if (f.ti >= 0) add(tOcc[f.ti * NS + s]);
          let r = -1;
          if (f.ri.length) {
            r = -2;
            for (const x of f.ri) { const o = rOcc[x * NS + s]; if (o < 0 || bl.includes(o)) { r = x; break; } }
            if (r === -2) { r = f.ri[(rand() * f.ri.length) | 0]; add(rOcc[r * NS + s]); }
          } else if (f.hi >= 0) { r = f.hi; add(rOcc[r * NS + s]); }
          // إزاحة نسخة مطابقة من نفس الحصة (نفس الفصل والمادة) لا تفيد بشيء
          if (bl.some(j => info[j].si === f.si)) continue;
          if (sd[f.si * 7 + d] >= f.subjMax) continue;
          if (f.ti >= 0) {
            let tdc = td[f.ti * 7 + d];
            for (const j of bl) if (info[j].ti === f.ti) tdc--;
            if (tdc >= f.maxDay) {
              const j = pickOnDay(tOcc, f.ti, d, j => !bl.includes(j) && !info[j].locked);
              if (j < 0) continue;
              add(j);
            }
          }
          let blocked = false, cost = rand() * 6;
          for (const j of bl) {
            if (info[j].locked) { blocked = true; break; }
            const a = altCount(j, s);
            cost += a === 0 ? 26 : a === 1 ? 8 : 3;
            if (steps - last[j] < 12) cost += 30;
          }
          if (blocked) continue;
          if (cost < ecost) { ecost = cost; es = s; er = r; ebl = bl; }
        }
        if (es < 0) { failed.push(i); continue; }
        for (const j of ebl) { take(j); stack.push(j); }
        put(i, es, er);
        last[i] = steps;
      }

      // 4) تحسين محلي: تقليل فراغات المعلمين وتكرار المادة في نفس اليوم
      //    (نقل/تبديل حصص داخل نفس الفصل مع الحفاظ على كل القيود)
      if (opts.improve !== false) {
        const W_GAP = 1, W_REP = 1.5, W_MORN = 0.2;
        const tGap = (ti, d) => {
          if (ti < 0) return 0;
          const b = ti * NS + (d << 4);
          let first = -1, lastP = -1, cnt = 0;
          for (let p = 0; p < P; p++) if (tOcc[b + p] >= 0) { if (first < 0) first = p; lastP = p; cnt++; }
          return cnt ? lastP - first + 1 - cnt : 0;
        };
        const sRep = (si, d) => { const c = sd[si * 7 + d]; return c > 1 ? (c - 1) * (c - 1) : 0; };
        const localCost = (i, j, d1, d2) => {
          const fi = info[i], fj = j >= 0 ? info[j] : null;
          let c = 0;
          const days2 = d1 === d2 ? 1 : 2;
          for (let k = 0; k < days2; k++) {
            const d = k ? d2 : d1;
            c += tGap(fi.ti, d) * W_GAP + sRep(fi.si, d) * W_REP;
            if (fj) { if (fj.ti !== fi.ti) c += tGap(fj.ti, d) * W_GAP; c += sRep(fj.si, d) * W_REP; }
          }
          if (fi.morning && pos[i] >= 0) c += (pos[i] & 15) * W_MORN;
          if (fj && fj.morning && pos[j] >= 0) c += (pos[j] & 15) * W_MORN;
          return c;
        };
        const iters = opts.improveIters || n * 60;
        for (let it = 0; it < iters; it++) {
          const i = (rand() * n) | 0;
          if (pos[i] < 0 || info[i].locked || fixedOut[i]) continue;
          const fi = info[i];
          const s1 = pos[i];
          const s2 = slots[(rand() * slots.length) | 0];
          if (s2 === s1 || !fi.avail[s2]) continue;
          const j = clsOcc[fi.ci * NS + s2];
          if (j >= 0 && (info[j].locked || fixedOut[j] || info[j].si === fi.si || !info[j].avail[s1])) continue;
          const d1 = s1 >> 4, d2 = s2 >> 4;
          const before = localCost(i, j, d1, d2);
          const r1 = room[i], r2 = j >= 0 ? room[j] : -1;
          take(i);
          if (j >= 0) take(j);
          let ok = false;
          const ri = can(i, s2);
          if (ri !== -2) {
            put(i, s2, ri);
            if (j < 0) ok = true;
            else {
              const rj = can(j, s1);
              if (rj !== -2) { put(j, s1, rj); ok = true; } else take(i);
            }
          }
          if (ok) {
            if (localCost(i, j, d1, d2) <= before) continue; // قبول التحسين (أو التساوي للاستكشاف)
            take(i);
            if (j >= 0) take(j);
          }
          put(i, s1, r1);
          if (j >= 0) put(j, s2, r2);
        }
      }

      const out = new Map();
      let unplaced = 0;
      for (let i = 0; i < n; i++) {
        const l = info[i].l;
        if (fixedOut[i]) out.set(l.id, { day: l.day, period: l.period, roomId: l.roomId });
        else if (pos[i] >= 0) out.set(l.id, { day: pos[i] >> 4, period: pos[i] & 15, roomId: room[i] >= 0 ? roomIds[room[i]] : null });
        else { out.set(l.id, { day: null, period: null, roomId: null }); unplaced++; }
      }
      return { out, unplaced };
    }

    let best = null, attempts = 0;
    const seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
    for (;;) {
      attempts++;
      const res = attempt(mulberry32(seed + attempts * 7919));
      if (!best || res.unplaced < best.unplaced) best = res;
      if (best.unplaced === 0 || attempts >= maxAttempts || now() - t0 > budget) break;
    }
    return { placements: best ? best.out : new Map(), unplaced: best ? best.unplaced : 0, total: n, attempts, ms: now() - t0 };
  }

  global.Engine = {
    STRIDE, slotKey, ROOM_TYPES, ROOM_TYPE_NAME, REASONS,
    teacherOf, env, evaluate, evaluateMove, reassignRooms, normalizeRooms,
    teacherLoads, computeIssues, explain, autoSchedule,
  };
})(typeof window !== 'undefined' ? window : globalThis);
