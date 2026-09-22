/* هسته برنامه TSP: مسیریابی، منو، واگذاری رویدادها و راه‌اندازی */

import { api } from './api.js';
import * as store from './store.js';
import { closeModal, esc, fa, openModal, toast } from './ui.js';

import dashboard from './views/dashboard.js';
import books from './views/books.js';
import bookDetail from './views/book_detail.js';
import topics from './views/topics.js';
import questions from './views/questions.js';
import quickEntry from './views/quick_entry.js';
import history from './views/history.js';
import review from './views/review.js';
import teaching from './views/teaching.js';
import exams from './views/exams.js';
import examDetail from './views/exam_detail.js';
import examAttempt from './views/exam_attempt.js';
import readiness from './views/readiness.js';
import analytics from './views/analytics.js';
import settings from './views/settings.js';

const ROUTES = [
  { pattern: /^\/?$/, view: dashboard },
  { pattern: /^\/dashboard$/, view: dashboard },
  { pattern: /^\/books$/, view: books },
  { pattern: /^\/books\/(\d+)$/, view: bookDetail, params: (m) => ({ bookId: Number(m[1]) }) },
  { pattern: /^\/topics$/, view: topics },
  { pattern: /^\/questions$/, view: questions },
  { pattern: /^\/entry$/, view: quickEntry },
  { pattern: /^\/history$/, view: history },
  { pattern: /^\/review$/, view: review },
  { pattern: /^\/teaching$/, view: teaching },
  { pattern: /^\/exams$/, view: exams },
  { pattern: /^\/exams\/(\d+)$/, view: examDetail, params: (m) => ({ examId: Number(m[1]) }) },
  { pattern: /^\/exams\/(\d+)\/attempt\/(\d+)$/, view: examAttempt,
    params: (m) => ({ examId: Number(m[1]), attemptId: Number(m[2]) }) },
  { pattern: /^\/readiness$/, view: readiness },
  { pattern: /^\/analytics$/, view: analytics },
  { pattern: /^\/settings$/, view: settings },
];

const NAV = [
  { href: '#/dashboard', label: 'داشبورد', icon: '▤' },
  { href: '#/entry', label: 'ثبت سؤال', icon: '✎' },
  { href: '#/review', label: 'مرور هوشمند', icon: '↻', badge: 'review' },
  { href: '#/questions', label: 'بانک تست', icon: '≣' },
  { group: 'منابع و مباحث' },
  { href: '#/books', label: 'کتاب‌ها و ساختار', icon: '▥' },
  { href: '#/topics', label: 'مباحث آموزشی', icon: '⌥' },
  { group: 'کار و برنامه' },
  { href: '#/teaching', label: 'تدریس و عقب‌ماندگی', icon: '◷' },
  { href: '#/exams', label: 'آزمون‌ها', icon: '▣' },
  { href: '#/readiness', label: 'آمادگی آزمون', icon: '◎' },
  { href: '#/analytics', label: 'تحلیل و آمار', icon: '◔' },
  { group: 'سابقه و داده' },
  { href: '#/history', label: 'سابقه حل', icon: '⟲' },
  { href: '#/settings', label: 'داده و پشتیبان', icon: '⚙' },
];

const app = {
  view: null,
  current: null,
  context: {},
};

/* --------------------------------------------------------------------------
   ناوبری و مسیریابی
   -------------------------------------------------------------------------- */
function renderNav(activePath) {
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map((item) => {
    if (item.group) return `<div class="nav-group-title">${esc(item.group)}</div>`;
    const isActive = item.href.replace('#', '') === activePath
      || (activePath.startsWith(item.href.replace('#', '') + '/') && item.href !== '#/dashboard');
    return `<a href="${item.href}" class="${isActive ? 'active' : ''}">
      <span class="nav-icon">${item.icon}</span><span>${esc(item.label)}</span>
      ${item.badge ? `<span class="nav-badge" id="nav-badge-${item.badge}">—</span>` : ''}
    </a>`;
  }).join('');
}

async function navigate() {
  const path = window.location.hash.replace(/^#/, '') || '/dashboard';
  let matched = null;
  for (const route of ROUTES) {
    const found = route.pattern.exec(path);
    if (found) {
      matched = { view: route.view, params: route.params ? route.params(found) : {} };
      break;
    }
  }
  if (!matched) {
    document.getElementById('view').innerHTML =
      `<div class="card"><div class="empty"><strong>صفحه یافت نشد</strong>
       <span>مسیر «${esc(path)}» وجود ندارد.</span></div></div>`;
    return;
  }
  if (app.view && app.view.destroy) {
    try { app.view.destroy(); } catch { /* بی‌اهمیت */ }
  }
  closeModal(true);
  app.view = matched.view;
  app.current = path;
  renderNav(path);
  const title = document.getElementById('page-title');
  const subtitle = document.getElementById('page-subtitle');
  title.textContent = matched.view.title || 'TSP';
  subtitle.textContent = matched.view.subtitle || '';
  const container = document.getElementById('view');
  container.innerHTML = '<div class="card"><p class="muted">در حال بارگذاری…</p></div>';
  const context = { params: matched.params, api, store, path, render: navigate };
  app.context = context;
  try {
    const html = await matched.view.render(context);
    container.innerHTML = html;
    if (matched.view.afterRender) await matched.view.afterRender(context, container);
  } catch (error) {
    container.innerHTML = `<div class="banner bad"><div><strong>خطا در بارگذاری صفحه</strong>
      <p>${esc(error.message || 'خطای نامشخص')}</p></div></div>`;
  }
  updateBadges();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

async function rerender() {
  if (!app.view) return navigate();
  const container = document.getElementById('view');
  const html = await app.view.render(app.context);
  container.innerHTML = html;
  if (app.view.afterRender) await app.view.afterRender(app.context, container);
  updateBadges();
}

export async function reloadView() { return rerender(); }

async function updateBadges() {
  const badge = document.getElementById('nav-badge-review');
  if (!badge) return;
  try {
    const summary = await api.get('/reviews/summary', { sync: 'false' });
    badge.textContent = fa(summary.open_items || 0);
  } catch { badge.textContent = '—'; }
}

/* --------------------------------------------------------------------------
   واگذاری رویدادها
   -------------------------------------------------------------------------- */
function handleGlobalAction(action, element) {
  if (action === 'global:openSettings') { window.location.hash = '#/settings'; return true; }
  if (action === 'global:quickEntry') { openQuickEntryModal(); return true; }
  if (action === 'global:toggleMenu') {
    document.getElementById('sidebar').classList.toggle('open');
    return true;
  }
  if (action === 'nav:goto') { window.location.hash = element.dataset.href; return true; }
  return false;
}

document.addEventListener('click', async (event) => {
  const closer = event.target.closest('[data-modal-close]');
  if (closer) { closeModal(); return; }
  if (event.target.id === 'modal-root') { closeModal(); return; }
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const action = trigger.dataset.action;
  if (handleGlobalAction(action, trigger)) return;
  const view = app.view;
  if (!view || !view.actions) return;
  const handler = view.actions[action];
  if (!handler) return;
  event.preventDefault();
  try {
    await handler(trigger, app.context, event);
  } catch (error) {
    if (error && error.__handled) return;
    const { notifyError } = await import('./ui.js');
    notifyError(error);
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const view = app.view;
  const name = form.dataset.form;
  if (!view || !view.submit || !view.submit[name]) return;
  const submitButton = form.querySelector('[type=submit]');
  if (submitButton) submitButton.disabled = true;
  try {
    await view.submit[name](form, app.context);
  } catch (error) {
    const { notifyError } = await import('./ui.js');
    notifyError(error);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

document.addEventListener('change', async (event) => {
  if (event.target.id === 'subject-filter') {
    await store.setSubject(event.target.value);
    await rerender();
    return;
  }
  const trigger = event.target.closest('[data-change]');
  if (!trigger) return;
  const view = app.view;
  const handler = view && view.changes && view.changes[trigger.dataset.change];
  if (!handler) return;
  try {
    await handler(trigger, app.context, event);
  } catch (error) {
    const { notifyError } = await import('./ui.js');
    notifyError(error);
  }
});

let searchTimer = null;
document.addEventListener('input', (event) => {
  if (event.target.id === 'global-search') {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const term = event.target.value.trim();
      const view = app.view;
      if (view && view.onSearch) {
        view.onSearch(term, app.context).then(rerender).catch(() => {});
        return;
      }
      if (term) window.location.hash = `#/questions?search=${encodeURIComponent(term)}`;
    }, 350);
    return;
  }
  const trigger = event.target.closest('[data-input]');
  if (!trigger) return;
  const view = app.view;
  const handler = view && view.inputs && view.inputs[trigger.dataset.input];
  if (handler) handler(trigger, app.context, event).catch(() => {});
});

/* --------------------------------------------------------------------------
   ثبت سریع سؤال (از هر جای برنامه)
   -------------------------------------------------------------------------- */
async function openQuickEntryModal() {
  try {
    const [{ renderQuickEntryForm, submitQuickEntry }] = await Promise.all([
      import('./views/quick_entry.js'),
    ]);
    const html = await renderQuickEntryForm({ api, store, params: {} });
    const modal = openModal({
      title: 'ثبت سریع سؤال',
      body: html,
      footer: `<button class="btn" data-modal-close>بستن</button>
               <button class="btn btn-primary" data-quick-save>ثبت تلاش</button>`,
      wide: false,
    });
    modal.querySelector('[data-quick-save]').addEventListener('click', async () => {
      const form = modal.querySelector('form');
      try {
        const result = await submitQuickEntry(form, { api, store, modal });
        if (result !== false) { closeModal(); toast('تلاش ثبت شد', 'ok'); rerender(); }
      } catch (error) {
        const { notifyError } = await import('./ui.js');
        notifyError(error);
      }
    });
  } catch (error) {
    toast(`خطا در بازکردن فرم: ${error.message}`, 'bad');
  }
}

/* --------------------------------------------------------------------------
   راه‌اندازی
   -------------------------------------------------------------------------- */
async function boot() {
  try {
    await store.loadMeta();
    await store.refreshAll();
  } catch (error) {
    document.getElementById('view').innerHTML =
      `<div class="banner bad"><div><strong>ارتباط با سرور برقرار نشد</strong>
        <p>${esc(error.message)}</p></div></div>`;
    return;
  }
  window.addEventListener('hashchange', navigate);
  await navigate();
  if (store.state.sampleAvailable && !localStorage.getItem('tsp.sampleHintShown')) {
    localStorage.setItem('tsp.sampleHintShown', '1');
    toast('پایگاه داده خالی است. برای آشنایی می‌توانید از «داده و پشتیبان» داده نمونه را بارگذاری کنید.', 'warn');
  }
}

export { api, navigate, rerender, openQuickEntryModal };
window.tspApp = { api, navigate, rerender, store, openModal, closeModal };
boot();
