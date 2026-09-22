/* کمکی‌های رابط کاربری: قالب‌بندی، مودال، پیام‌ها و اجزای کوچک */

export const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** تبدیل رقم‌های لاتین به فارسی برای نمایش (کدها دست‌نخورده می‌مانند). */
export const fa = (value) => String(value ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

export const num = (value) => (value === null || value === undefined ? '—' : fa(value));

export const pct = (value) => (value === null || value === undefined ? '—' : `${fa(Math.round(value * 10) / 10)}٪`);

export function bytes(size) {
  if (!size && size !== 0) return '—';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  let index = 0;
  let value = size;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${fa(Math.round(value * 10) / 10)} ${units[index]}`;
}

const RESULTS = { correct: 'درست', incorrect: 'غلط', unanswered: 'بی‌پاسخ' };
const RESULT_CLASS = { correct: 'ok', incorrect: 'bad', unanswered: 'warn' };

export const resultLabel = (result) => RESULTS[result] || '—';

export const resultBadge = (result) => result
  ? `<span class="badge ${RESULT_CLASS[result] || ''}">${esc(RESULTS[result] || result)}</span>`
  : '<span class="badge">بدون تلاش</span>';

export function badgeList(reasons, labels) {
  if (!reasons || !reasons.length) return '';
  return reasons.map((reason) => {
    const label = (labels && labels[reason]) || reason;
    const cls = { incorrect: 'bad', unanswered: 'warn', important: 'star', hard: 'flag',
      upcoming_exam: 'primary', goal_remaining: 'info' }[reason] || '';
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  }).join(' ');
}

export function meter(value, max, tone) {
  const ratio = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const cls = tone || (ratio >= 75 ? 'ok' : ratio >= 40 ? '' : ratio > 0 ? 'warn' : 'bad');
  return `<span class="bar-mini"><span style="width:${ratio}%"></span></span>`;
}

export function options(list, selected, { valueKey = 'id', labelKey = 'title', empty } = {}) {
  const parts = [];
  if (empty !== undefined) parts.push(`<option value="">${esc(empty)}</option>`);
  list.forEach((item) => {
    const value = item[valueKey];
    const label = typeof labelKey === 'function' ? labelKey(item) : item[labelKey];
    const isSelected = String(value) === String(selected) ? ' selected' : '';
    parts.push(`<option value="${esc(value)}"${isSelected}>${esc(label)}</option>`);
  });
  return parts.join('');
}

export function flattenTopics(tree, depth = 0, acc = []) {
  tree.forEach((node) => {
    acc.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}`, raw: node });
    if (node.children && node.children.length) flattenTopics(node.children, depth + 1, acc);
  });
  return acc;
}

export function barChart(series, { valueKeys = ['correct', 'incorrect', 'unanswered'], labels = {} } = {}) {
  if (!series || !series.length) return '<p class="muted small">داده‌ای برای نمایش نیست.</p>';
  const max = Math.max(1, ...series.map((row) => valueKeys.reduce((sum, key) => sum + (row[key] || 0), 0)));
  const title = (row) => row.bucket || row.label || '';
  return `
    <div class="chart">
      ${series.map((row) => {
        const total = valueKeys.reduce((sum, key) => sum + (row[key] || 0), 0);
        const height = Math.max(2, Math.round((total / max) * 100));
        return `<div class="col" title="${esc(title(row))}: ${fa(total)} تلاش">
          <div class="seg ${valueKeys[0]}" style="height:${Math.round(height * ((row[valueKeys[0]] || 0) / (total || 1)))}%"></div>
          <div class="seg ${valueKeys[1]}" style="height:${Math.round(height * ((row[valueKeys[1]] || 0) / (total || 1)))}%"></div>
          <div class="seg ${valueKeys[2]}" style="height:${Math.round(height * ((row[valueKeys[2]] || 0) / (total || 1)))}%"></div>
          <span class="lbl">${esc(fa(title(row).slice(-5)))}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="legend">
      <span><i style="background:#34a853"></i>درست</span>
      <span><i style="background:#e8674f"></i>غلط</span>
      <span><i style="background:#f0b429"></i>بی‌پاسخ</span>
    </div>`;
}

export function stat({ label, value, hint, tone = '' }) {
  return `<div class="stat ${tone}">
    <span class="label">${esc(label)}</span>
    <div class="value">${value}</div>
    ${hint ? `<span class="hint">${hint}</span>` : ''}
  </div>`;
}

export function emptyState(title, hint) {
  return `<div class="empty"><strong>${esc(title)}</strong><span>${esc(hint || '')}</span></div>`;
}

/* پیام‌ها ------------------------------------------------------------------ */
export function toast(message, kind = '') {
  const root = document.getElementById('toasts');
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  root.append(node);
  setTimeout(() => { node.style.opacity = '0'; node.style.transition = 'opacity .3s'; }, 3600);
  setTimeout(() => node.remove(), 4200);
}

export const notifyError = (error) => {
  let message = error && error.message ? error.message : 'خطای نامشخص';
  if (error && error.errors) {
    const details = Object.values(error.errors).filter(Boolean).slice(0, 3).join(' | ');
    if (details) message += ` — ${details}`;
  }
  toast(message, 'bad');
  return message;
};

/* مودال ------------------------------------------------------------------- */
let modalStack = [];

export function openModal({ title, body, footer = '', wide = false, onMount }) {
  const root = document.getElementById('modal-root');
  const wrapper = document.createElement('div');
  wrapper.className = `modal ${wide ? 'wide' : ''}`;
  wrapper.innerHTML = `
    <div class="modal-head">
      <h2>${esc(title || '')}</h2>
      <button class="icon-btn close" data-modal-close title="بستن">×</button>
    </div>
    <div class="modal-body">${body || ''}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ''}`;
  root.append(wrapper);
  root.hidden = false;
  modalStack.push(wrapper);
  if (onMount) onMount(wrapper);
  return wrapper;
}

export function closeModal(all = false) {
  const root = document.getElementById('modal-root');
  if (all) { root.innerHTML = ''; modalStack = []; root.hidden = true; return; }
  const last = modalStack.pop();
  if (last) last.remove();
  if (!modalStack.length) root.hidden = true;
}

export function confirmDialog(message, { title = 'تأیید عملیات', confirmLabel = 'تأیید', danger = true } = {}) {
  return new Promise((resolve) => {
    const modal = openModal({
      title,
      body: `<p>${esc(message)}</p>`,
      footer: `<button class="btn" data-modal-close>انصراف</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${esc(confirmLabel)}</button>`,
    });
    modal.querySelector('[data-confirm]').addEventListener('click', () => {
      closeModal();
      resolve(true);
    });
    modal.querySelectorAll('[data-modal-close]').forEach((button) => {
      button.addEventListener('click', () => { closeModal(); resolve(false); });
    });
  });
}

export function formToObject(form) {
  const data = {};
  Array.from(form.elements).forEach((element) => {
    if (!element.name || element.disabled) return;
    if (element.type === 'checkbox') { data[element.name] = element.checked; return; }
    if (element.type === 'radio') { if (element.checked) data[element.name] = element.value; return; }
    if (element.tagName === 'SELECT' && element.multiple) {
      data[element.name] = Array.from(element.selectedOptions).map((option) => option.value);
      return;
    }
    data[element.name] = element.value;
  });
  return data;
}

export function escapeAttr(value) { return esc(value); }
