/* =====================================================================
 *  ui.js — أيقونات، إشعارات، نوافذ، تلميحات، مؤثرات
 * ===================================================================== */
'use strict';

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 12.5 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  door: '<path d="M3.5 21h17"/><path d="M6 21V4.2A1.2 1.2 0 0 1 7.2 3h9.6A1.2 1.2 0 0 1 18 4.2V21"/><circle cx="14.5" cy="12.5" r="1"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  users: '<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.2 14.2a6 6 0 0 1 3.3 6.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  link: '<circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="12" r="2.6"/><path d="M8.3 7.2 15.6 11M8.3 16.8l7.3-3.8"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  sparkles: '<path d="M12 3.5 13.8 8.2 18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/><path d="M5 3.5l.6 1.4 1.4.6-1.4.6L5 7.5l-.6-1.4L3 5.5l1.4-.6z"/>',
  alert: '<path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  eraser: '<path d="m7 21-4.3-4.3a1.5 1.5 0 0 1 0-2.1L13.4 3.9a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1L10.4 21"/><path d="M7 21h14M9 11.5l5.5 5.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.5M4 3.5v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3.5M20 20.5v-4h-4"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9.5 9v12"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  wand: '<path d="m15 4 5 5L8 21l-5-5L15 4z"/><path d="m12.5 6.5 5 5"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
  school: '<path d="M3 10.5 12 5l9 5.5-9 5.5-9-5.5z"/><path d="M6.5 12.5V17c0 1.2 2.5 3 5.5 3s5.5-1.8 5.5-3v-4.5"/><path d="M21 10.5V16"/>',
};
function icon(name, cls) {
  return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ---------------------------------------------------------------- toasts
function toast(msg, type, ms) {
  type = type || 'success';
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast t-' + type;
  const ico = { success: icon('check'), error: icon('x'), warn: icon('alert'), info: icon('info') }[type] || icon('info');
  el.innerHTML = `<span class="toast-ico">${ico}</span><div class="toast-msg">${msg}</div><span class="toast-bar" style="animation-duration:${ms || 3200}ms"></span>`;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  requestAnimationFrame(() => el.classList.add('show'));
  const kill = () => { el.classList.remove('show'); el.classList.add('hide'); setTimeout(() => el.remove(), 350); };
  const tm = setTimeout(kill, ms || 3200);
  el.addEventListener('click', () => { clearTimeout(tm); kill(); });
}

// ---------------------------------------------------------------- modal
function openModal(o) {
  const root = document.getElementById('modalRoot');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  const actions = o.actions || [];
  wrap.innerHTML = `<div class="modal ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h3>${o.title || ''}</h3><button class="icon-btn" data-close title="إغلاق">${icon('x')}</button></div>
    <div class="modal-body">${o.body || ''}</div>
    ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.cls || 'btn-soft'}" data-mi="${i}">${a.label}</button>`).join('')}</div>` : ''}
  </div>`;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('show');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => wrap.remove(), 220);
    if (o.onClose) o.onClose();
  };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  wrap.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return close();
    const b = e.target.closest('[data-mi]');
    if (b) {
      const a = actions[+b.dataset.mi];
      if (!a.onClick || a.onClick(wrap) !== false) close();
    }
  });
  document.addEventListener('keydown', onKey, true);
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  const first = wrap.querySelector('input,select,textarea');
  if (first) setTimeout(() => first.focus(), 60);
  return { el: wrap, close };
}
function askConfirm(msg, onYes, opts) {
  opts = opts || {};
  openModal({
    title: opts.title || 'تأكيد',
    body: `<div class="confirm-msg">${opts.danger === false ? '' : `<span class="confirm-ico">${icon('alert')}</span>`}<p>${msg}</p></div>`,
    actions: [
      { label: opts.yes || 'تأكيد', cls: opts.danger === false ? 'btn-primary' : 'btn-danger', onClick: () => { onYes(); } },
      { label: 'إلغاء', cls: 'btn-ghost' },
    ],
  });
}

// ---------------------------------------------------------------- tooltip (data-tip)
(function () {
  let cur = null;
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (el === cur) return;
    cur = el;
    const tip = document.getElementById('tip');
    if (!tip) return;
    if (!el || document.body.classList.contains('is-dragging')) { tip.classList.remove('show'); return; }
    tip.textContent = el.dataset.tip;
    tip.classList.add('show');
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.top - th - 8;
    if (y < 6) y = r.bottom + 8;
    x = Math.max(6, Math.min(window.innerWidth - tw - 6, x));
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
  document.addEventListener('pointerdown', () => { const tip = document.getElementById('tip'); if (tip) tip.classList.remove('show'); cur = null; });
})();

// ---------------------------------------------------------------- generation overlay
let overlayTimer = 0;
function showOverlay(title) {
  const ov = document.getElementById('overlay');
  const cells = Array.from({ length: 35 }, (_, i) => `<i style="--d:${((i * 17) % 35) * 38}ms;--c:${PALETTE[(i * 7) % 11]}"></i>`).join('');
  ov.innerHTML = `<div class="gen-card">
    <div class="gen-grid">${cells}</div>
    <h3>${title}</h3>
    <p id="ovStep">تحليل القيود والمواعيد…</p>
    <div class="gen-bar"><span></span></div>
  </div>`;
  ov.classList.add('show');
  const steps = ['تحليل القيود والمواعيد…', 'ترتيب الحصص الأصعب أولاً…', 'توزيع الحصص على الأيام…', 'حل التعارضات بسلاسل الإزاحة…', 'موازنة أحمال المعلمين…', 'اللمسات الأخيرة…'];
  let i = 0;
  clearInterval(overlayTimer);
  overlayTimer = setInterval(() => { const p = document.getElementById('ovStep'); if (p) p.textContent = steps[++i % steps.length]; }, 420);
}
function hideOverlay() {
  clearInterval(overlayTimer);
  document.getElementById('overlay').classList.remove('show');
}

// ---------------------------------------------------------------- confetti
function confetti() {
  const cv = document.getElementById('confetti');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  cv.classList.add('show');
  const parts = [];
  for (const ox of [0.25, 0.5, 0.75]) {
    for (let k = 0; k < 70; k++) {
      parts.push({
        x: innerWidth * ox, y: innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
        c: PALETTE[(Math.random() * PALETTE.length) | 0],
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35,
      });
    }
  }
  const t0 = performance.now();
  (function frame(t) {
    const el = t - t0;
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalAlpha = Math.max(0, 1 - el / 2600);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    }
    if (el < 2600) requestAnimationFrame(frame);
    else { g.clearRect(0, 0, innerWidth, innerHeight); cv.classList.remove('show'); }
  })(t0);
}

// ---------------------------------------------------------------- small helpers
function avatar(t, cls) {
  return `<span class="avatar ${cls || ''}" style="${cvars(t.color || '#6366f1')}">${esc(initials(t.name))}</span>`;
}
function countUp(root) {
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count;
    const t0 = performance.now();
    const dur = 700;
    (function f(t) {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  });
}
function download(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- availability grid (paint by drag)
function availGrid(kind, id, blocked) {
  const days = activeDays();
  const P = +state.periods.count;
  const set = new Set(blocked || []);
  let h = `<div class="av-grid" style="grid-template-columns:74px repeat(${P},1fr)"><span class="av-corner"></span>`;
  for (let p = 0; p < P; p++) h += `<button class="av-per" data-act="avCol" data-kind="${kind}" data-id="${id}" data-p="${p}" data-tip="تبديل الحصة ${p + 1} في كل الأيام">${p + 1}</button>`;
  for (const d of days) {
    h += `<button class="av-day" data-act="avRow" data-kind="${kind}" data-id="${id}" data-d="${d}" data-tip="تبديل يوم ${esc(state.days[d].name)} بالكامل">${esc(state.days[d].name)}</button>`;
    for (let p = 0; p < P; p++) h += `<span class="av-cell ${set.has(d + '-' + p) ? 'off' : ''}" data-kind="${kind}" data-id="${id}" data-k="${d}-${p}"></span>`;
  }
  return h + '</div>';
}
function avOwner(kind, id) { return kind === 'grade' ? findGrade(id) : findTeacher(id); }

(function () {
  let paint = null;
  const apply = cell => {
    if (!paint || !cell || cell.dataset.kind !== paint.kind || cell.dataset.id !== paint.id) return;
    const o = avOwner(paint.kind, paint.id);
    if (!o) return;
    const k = cell.dataset.k;
    const set = new Set(o.blocked || []);
    if (paint.block) set.add(k); else set.delete(k);
    o.blocked = [...set];
    cell.classList.toggle('off', paint.block);
  };
  document.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.av-cell');
    if (!cell || e.button !== 0) return;
    e.preventDefault();
    paint = { kind: cell.dataset.kind, id: cell.dataset.id, block: !cell.classList.contains('off'), snap: JSON.stringify(state) };
    apply(cell);
  });
  document.addEventListener('pointermove', e => {
    if (!paint) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    apply(el && el.closest('.av-cell'));
  });
  const end = () => {
    if (!paint) return;
    pushUndoSnapshot(paint.snap);
    paint = null;
    normalize(state);
    persist();
    App.refresh();
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();
