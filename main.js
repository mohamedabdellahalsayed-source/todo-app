'use strict';

/* ========== Helpers & constants ========== */
const $ = (s, r = document) => r.querySelector(s);
const KEYS = { tasks: 'todo.tasks.v1', settings: 'todo.settings.v1' };
const PRI_LABEL = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
const PRI_COLOR = { high: '#fb7185', medium: '#fbbf24', low: '#34d399' };
const PRI_ORDER = { high: 0, medium: 1, low: 2 };
const DEFAULT_CATS = [
  { id: 'study', name: 'الدراسة', color: '#60a5fa' },
  { id: 'work', name: 'العمل', color: '#a78bfa' },
  { id: 'personal', name: 'الحياة الشخصية', color: '#f472b6' },
];
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  pin: '<path d="M12 17v5M9 3h6l-1 6 3 4H7l3-4z"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const isColor = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/* ========== State & storage ========== */
const state = {
  tasks: [],
  settings: { theme: 'dark', cats: DEFAULT_CATS.map(c => ({ ...c })) },
  f: { status: 'all', priority: 'all', category: 'all', q: '', sort: 'newest', date: '' },
  editingId: null,
};

function cleanTask(t) {
  if (!t || typeof t !== 'object') return null;
  const title = typeof t.title === 'string' ? t.title.trim().slice(0, 120) : '';
  if (!title) return null;
  const dl = typeof t.deadline === 'string' && !isNaN(new Date(t.deadline)) ? t.deadline : '';
  return {
    id: typeof t.id === 'string' && t.id ? t.id : uid(),
    title,
    desc: typeof t.desc === 'string' ? t.desc.slice(0, 400) : '',
    priority: PRI_LABEL[t.priority] ? t.priority : 'medium',
    category: typeof t.category === 'string' ? t.category : '',
    deadline: dl,
    done: t.done === true,
    pinned: t.pinned === true,
    createdAt: Number.isFinite(t.createdAt) ? t.createdAt : Date.now(),
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.tasks) || '[]');
    if (Array.isArray(raw)) state.tasks = raw.map(cleanTask).filter(Boolean);
  } catch (e) { console.warn('تعذّرت قراءة المهام', e); }
  try {
    const s = JSON.parse(localStorage.getItem(KEYS.settings) || '{}');
    if (s && (s.theme === 'light' || s.theme === 'dark')) state.settings.theme = s.theme;
    if (s && Array.isArray(s.cats)) {
      const cats = s.cats.filter(c => c && typeof c.id === 'string' && typeof c.name === 'string' && c.name.trim() && isColor(c.color))
        .map(c => ({ id: c.id, name: c.name.trim().slice(0, 20), color: c.color }));
      if (cats.length) state.settings.cats = cats;
    }
  } catch (e) { console.warn('تعذّرت قراءة الإعدادات', e); }
}
function save() {
  try {
    localStorage.setItem(KEYS.tasks, JSON.stringify(state.tasks));
    localStorage.setItem(KEYS.settings, JSON.stringify(state.settings));
  } catch (e) { toast('تعذّر الحفظ في المتصفح (قد تكون المساحة ممتلئة)', 'bad'); }
}

/* ========== UI utilities ========== */
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 2800);
}
function confirmDialog(msg) {
  return new Promise(res => {
    const d = $('#confirmDlg');
    $('#confirmMsg').textContent = msg;
    d.addEventListener('close', () => res(d.returnValue === 'yes'), { once: true });
    d.returnValue = 'no';
    d.showModal();
  });
}
const catOf = id => state.settings.cats.find(c => c.id === id) || state.settings.cats[0];
const isLate = t => !t.done && t.deadline && new Date(t.deadline.slice(0, 10) + 'T23:59:59') < new Date();
const fmtDate = d => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('ar-EG', { dateStyle: 'medium' });

/* ========== Task actions ========== */
function resetForm() {
  state.editingId = null;
  $('#taskForm').reset();
  $('#taskForm').classList.remove('editing');
  $('#submitBtn').textContent = 'إضافة مهمة';
  $('#cancelEdit').hidden = true;
  $('#category').value = state.settings.cats[0].id;
}
function submitForm(e) {
  e.preventDefault();
  const titleEl = $('#title');
  const title = titleEl.value.trim();
  if (!title) {
    titleEl.classList.add('bad');
    setTimeout(() => titleEl.classList.remove('bad'), 400);
    titleEl.focus();
    return toast('اكتب عنوان المهمة أولًا', 'warn');
  }
  const data = {
    title, desc: $('#desc').value.trim(), priority: $('#priority').value,
    category: $('#category').value, deadline: $('#deadline').value,
  };
  if (state.editingId) {
    const t = state.tasks.find(x => x.id === state.editingId);
    if (t) Object.assign(t, data);
    const id = state.editingId;
    resetForm(); save(); render(id);
    toast('تم حفظ التعديل');
  } else {
    const t = cleanTask({ ...data, id: uid(), createdAt: Date.now() });
    state.tasks.unshift(t);
    resetForm(); save(); render(t.id);
    toast('تمت إضافة المهمة ✨');
  }
}
function startEdit(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  state.editingId = id;
  $('#title').value = t.title; $('#desc').value = t.desc;
  $('#priority').value = t.priority; $('#category').value = catOf(t.category).id;
  $('#deadline').value = t.deadline.slice(0, 10);
  $('#taskForm').classList.add('editing');
  $('#submitBtn').textContent = 'حفظ التعديل';
  $('#cancelEdit').hidden = false;
  $('#taskForm').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
  $('#title').focus();
}
function toggleDone(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  save(); render(null);
  if (t.done) {
    const all = state.tasks.length && state.tasks.every(x => x.done);
    toast(all ? 'أنجزت كل مهامك! 🎉' : 'أحسنت! تم إنجاز المهمة ✅');
    if (all) confetti();
  } else toast('أُعيدت المهمة إلى غير المكتملة', 'warn');
}
function togglePin(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.pinned = !t.pinned;
  save(); render(null);
  toast(t.pinned ? 'تم تثبيت المهمة 📌' : 'تم إلغاء التثبيت', 'warn');
}
function removeTask(id, el) {
  const finish = () => {
    state.tasks = state.tasks.filter(x => x.id !== id);
    if (state.editingId === id) resetForm();
    save(); render(null);
    toast('تم حذف المهمة', 'bad');
  };
  if (el && !reduced()) { el.classList.add('removing'); setTimeout(finish, 300); } else finish();
}
async function clearCompleted() {
  const n = state.tasks.filter(t => t.done).length;
  if (!n) return toast('لا توجد مهام مكتملة لحذفها', 'warn');
  if (await confirmDialog(`سيتم حذف ${n} من المهام المكتملة نهائيًا. هل أنت متأكد؟`)) {
    state.tasks = state.tasks.filter(t => !t.done);
    save(); render('all');
    toast('تم حذف المهام المكتملة', 'bad');
  }
}

/* ========== Rendering ========== */
function visibleTasks() {
  const { status, priority, category, q, sort, date } = state.f;
  const query = q.trim().toLowerCase();
  const list = state.tasks.filter(t =>
    (status === 'all' || (status === 'done') === t.done) &&
    (priority === 'all' || t.priority === priority) &&
    (category === 'all' || catOf(t.category).id === category) &&
    (!date || (t.deadline && t.deadline.slice(0, 10) === date)) &&
    (!query || (t.title + ' ' + t.desc).toLowerCase().includes(query)));
  const far = Infinity;
  const cmp = {
    newest: (a, b) => b.createdAt - a.createdAt,
    oldest: (a, b) => a.createdAt - b.createdAt,
    priority: (a, b) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority] || b.createdAt - a.createdAt,
    deadline: (a, b) => (a.deadline ? +new Date(a.deadline.slice(0, 10)) : far) - (b.deadline ? +new Date(b.deadline.slice(0, 10)) : far),
  }[sort];
  return list.sort((a, b) => (b.pinned - a.pinned) || cmp(a, b));
}

function taskEl(t, animate) {
  const late = isLate(t), cat = catOf(t.category);
  const li = document.createElement('li');
  li.className = 'task' + (animate ? ' in' : '') + (t.done ? ' done' : '') + (t.pinned ? ' pinned' : '') + (late ? ' late' : '');
  li.style.setProperty('--p', PRI_COLOR[t.priority]);

  const chk = document.createElement('button');
  chk.className = 'check'; chk.type = 'button';
  chk.setAttribute('aria-label', t.done ? 'إعادة المهمة' : 'إكمال المهمة');
  chk.innerHTML = icon('check');
  chk.onclick = () => toggleDone(t.id);

  const body = document.createElement('div');
  const title = document.createElement('div');
  title.className = 't-title'; title.textContent = t.title;
  body.append(title);
  if (t.desc) { const d = document.createElement('div'); d.className = 't-desc'; d.textContent = t.desc; body.append(d); }
  const meta = document.createElement('div'); meta.className = 'meta';
  const chip = (txt, cls, style) => { const c = document.createElement('span'); c.className = 'chip ' + cls; c.textContent = txt; if (style) c.style.setProperty('--c', style); meta.append(c); return c; };
  chip(cat.name, 'cat', cat.color);
  chip('الأولوية: ' + PRI_LABEL[t.priority], '');
  if (t.deadline) { const c = chip(fmtDate(t.deadline) + (late ? ' · متأخرة' : ''), late ? 'late' : ''); c.insertAdjacentHTML('afterbegin', icon('clock')); c.querySelector('svg').style.cssText = 'width:13px;height:13px'; }
  body.append(meta);

  const acts = document.createElement('div'); acts.className = 'acts';
  const btn = (cls, ic, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = icon(ic); b.title = label; b.setAttribute('aria-label', label); b.onclick = fn; acts.append(b); return b; };
  btn('pin' + (t.pinned ? ' on' : ''), 'pin', t.pinned ? 'إلغاء التثبيت' : 'تثبيت', () => togglePin(t.id));
  btn('edit', 'edit', 'تعديل', () => startEdit(t.id));
  btn('del', 'trash', 'حذف', () => removeTask(t.id, li));

  li.append(chk, body, acts);
  return li;
}

/* anim: 'all' = animate every card, task id = animate that card, null = none */
function render(anim = 'all') {
  const vis = visibleTasks();
  const late = vis.filter(isLate), rest = vis.filter(t => !isLate(t));
  const fill = (ul, arr) => { ul.replaceChildren(...arr.map(t => taskEl(t, anim === 'all' || anim === t.id))); };
  fill($('#list'), rest); fill($('#overdueList'), late);
  $('#overdueBox').hidden = !late.length;
  $('#overdueCount').textContent = late.length;
  $('#listCount').textContent = rest.length;

  const empty = !vis.length;
  $('#empty').hidden = !empty;
  if (empty) {
    const none = !state.tasks.length;
    $('#emptyTitle').textContent = none ? 'لا توجد مهام بعد' : 'لا توجد نتائج مطابقة';
    $('#emptyText').textContent = none ? 'اكتب أول مهمة في الأعلى وابدأ رحلة الإنجاز.' : 'جرّب تغيير البحث أو الفلاتر.';
  }
  renderStats();
}

function renderStats() {
  const total = state.tasks.length, done = state.tasks.filter(t => t.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  $('#sTotal').textContent = total; $('#sDone').textContent = done;
  $('#sLeft').textContent = total - done; $('#sPct').textContent = pct + '%';
  $('#bar').style.width = pct + '%';
  $('#progress').setAttribute('aria-valuenow', pct);
  $('#motivation').textContent =
    !total ? 'أضف أول مهمة وابدأ يومك 🚀' :
    pct === 100 ? 'أنجزت كل شيء! تستحق استراحة 🎉' :
    pct >= 75 ? 'أنت على وشك إنهاء جميع مهامك! 🔥' :
    pct >= 40 ? 'أنت في منتصف الطريق، لا تتوقف 🌟' :
    pct > 0 ? 'بداية ممتازة! استمر 💪' : 'ابدأ بأسهل مهمة، الخطوة الأولى هي الأصعب ☕';
}

function renderCategories() {
  [['#category', false], ['#fCategory', true]].forEach(([sel, all]) => {
    const el = $(sel), prev = el.value;
    el.replaceChildren();
    if (all) el.append(new Option('كل الفئات', 'all'));
    state.settings.cats.forEach(c => el.append(new Option(c.name, c.id)));
    el.value = [...el.options].some(o => o.value === prev) ? prev : el.options[0].value;
  });
  const ul = $('#catsList'); ul.replaceChildren();
  state.settings.cats.forEach(c => {
    const li = document.createElement('li');
    const name = document.createElement('span'); name.textContent = c.name;
    const col = document.createElement('input'); col.type = 'color'; col.value = c.color; col.setAttribute('aria-label', 'لون ' + c.name);
    col.oninput = () => { c.color = col.value; };
    col.onchange = () => { save(); render(null); };
    li.append(name, col); ul.append(li);
  });
}

function renderTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  $('#themeBtn').innerHTML = icon(state.settings.theme === 'dark' ? 'sun' : 'moon');
}
function renderHeader() {
  const h = new Date().getHours();
  $('#greeting').textContent = (h < 12 ? 'صباح الخير ☀️' : h < 18 ? 'نهارك سعيد 🌤️' : 'مساء الخير 🌙') + '، لنرتّب يومك مع Mo7amed To-Do';
  $('#dateLine').textContent = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/* ========== Confetti ========== */
function confetti() {
  if (reduced()) return;
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ['#8b5cf6', '#38bdf8', '#34d399', '#fbbf24', '#fb7185'];
  const ps = Array.from({ length: 140 }, () => ({
    x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * .4,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[Math.random() * 5 | 0],
    vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: -.2 + Math.random() * .4,
  }));
  const end = performance.now() + 3000;
  (function frame(now) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    if (now < end) requestAnimationFrame(frame); else ctx.clearRect(0, 0, cv.width, cv.height);
  })(performance.now());
}

/* ========== Events ========== */
function bind() {
  $('#taskForm').addEventListener('submit', submitForm);
  $('#cancelEdit').onclick = resetForm;
  $('#desc').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#taskForm').requestSubmit(); });
  $('#themeBtn').onclick = toggleTheme;

  $('#search').addEventListener('input', e => { state.f.q = e.target.value; render('all'); });
  $('#fPriority').onchange = e => { state.f.priority = e.target.value; render('all'); };
  $('#fCategory').onchange = e => { state.f.category = e.target.value; render('all'); };
  $('#fDate').onchange = e => { state.f.date = e.target.value; $('#clearDate').hidden = !e.target.value; render('all'); };
  $('#clearDate').onclick = () => { $('#fDate').value = ''; state.f.date = ''; $('#clearDate').hidden = true; render('all'); };
  $('#sort').onchange = e => { state.f.sort = e.target.value; render('all'); };
  $('#statusSeg').addEventListener('click', e => {
    const b = e.target.closest('button[data-status]');
    if (!b) return;
    state.f.status = b.dataset.status;
    document.querySelectorAll('#statusSeg button').forEach(x => x.classList.toggle('on', x === b));
    render('all');
  });
  $('#clearDone').onclick = clearCompleted;

  $('#catsBtn').onclick = () => $('#catsDlg').showModal();
  $('#catsClose').onclick = () => $('#catsDlg').close();
  $('#catForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#catName').value.trim();
    if (!name) return toast('اكتب اسم الفئة', 'warn');
    if (state.settings.cats.some(c => c.name === name)) return toast('هذه الفئة موجودة بالفعل', 'warn');
    state.settings.cats.push({ id: uid(), name, color: $('#catColor').value });
    $('#catName').value = '';
    save(); renderCategories(); render(null);
    toast('تمت إضافة الفئة');
  });

  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === 'Escape') { if (state.editingId) resetForm(); document.activeElement.blur(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
    else if (e.key.toLowerCase() === 'n') { e.preventDefault(); $('#title').focus(); }
    else if (e.key.toLowerCase() === 't') toggleTheme();
  });
  setInterval(() => { render(null); renderHeader(); }, 60000); // تحديث حالة التأخير والتاريخ
}
function toggleTheme() {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  renderTheme(); save();
}

/* ========== Init ========== */
load();
bind();
renderTheme();
renderHeader();
renderCategories();
render('all');

/* ========== PWA: العمل بدون إنترنت + التحديث التلقائي ========== */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller; // false عند أول زيارة
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return; // لا تعيد التحميل في أول تثبيت
    reloading = true;
    toast('تم تحديث التطبيق ✨');
    setTimeout(() => location.reload(), 1200);
  });
  addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      // افحص وجود نسخة جديدة كلما رجع المستخدم للتطبيق
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(e => console.warn('SW', e));
  });
}