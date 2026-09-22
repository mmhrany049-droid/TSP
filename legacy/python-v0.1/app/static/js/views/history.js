/* سابقه حل — تلاش‌های جدید، سابقه‌های قبلی و دسته‌های ورود */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, emptyState, esc, fa, notifyError, num, openModal, resultBadge, toast } from '../ui.js';

const state = { tab: 'attempts', filters: {} };

export default {
  title: 'سابقه حل',
  subtitle: 'همه تلاش‌ها با حفظ کامل تاریخچه؛ هیچ رکوردی بازنویسی نمی‌شود',

  async render() {
    const hash = window.location.hash;
    if (hash.includes('tab=previous')) state.tab = 'previous';
    const labels = store.state.labels;

    const attempts = state.tab === 'attempts'
      ? await api.get('/attempts', { page_size: 100, ...state.filters }) : { items: [] };
    const previous = state.tab === 'previous'
      ? await api.get('/previous-entries', { page_size: 100, ...state.filters }) : { items: [] };
    const batches = state.tab === 'batches' ? await api.get('/batches') : { items: [] };

    const attemptRows = (attempts.items || []).map((row) => `
      <tr>
        <td class="mono">${esc(row.code)}</td>
        <td class="small">${esc(row.book_title || '—')}</td>
        <td>${esc(row.display_number || '—')}</td>
        <td>${esc(row.user_answer || '—')}</td>
        <td>${resultBadge(row.result)}</td>
        <td>${num(row.spent_seconds ?? '—')}</td>
        <td class="tiny">${esc(row.attempted_at || '')}</td>
        <td><span class="badge">${esc({ app: 'برنامه', review: 'مرور', exam: 'آزمون', other: 'سایر' }[row.source] || row.source)}</span></td>
        <td class="tiny">${esc(row.notes || '')}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="editNote" data-id="${row.id}">یادداشت</button>
          ${row.state === 'active'
            ? `<button class="btn btn-sm btn-danger" data-action="voidAttempt" data-id="${row.id}">بی‌اعتبار</button>`
            : `<button class="btn btn-sm" data-action="restoreAttempt" data-id="${row.id}">بازگردانی</button>`}
        </td>
      </tr>`).join('');

    const previousRows = (previous.items || []).map((row) => `
      <tr>
        <td class="mono">${esc(row.code)}</td>
        <td class="small">${esc(row.book_title || '—')}</td>
        <td>${esc(row.display_number || '—')}</td>
        <td>${esc(row.user_answer || '—')}</td>
        <td>${resultBadge(row.result)}</td>
        <td class="tiny">${esc(row.batch_label || '—')}</td>
        <td class="tiny">${esc(row.note || '')}</td>
        <td class="actions">
          ${row.state === 'active'
            ? `<button class="btn btn-sm btn-danger" data-action="voidPrevious" data-id="${row.id}">بی‌اعتبار</button>`
            : '<span class="badge">بی‌اعتبار شده</span>'}
        </td>
      </tr>`).join('');

    const batchRows = (batches.items || []).map((row) => `
      <tr>
        <td>${esc(row.label || row.kind)}</td>
        <td><span class="badge">${esc(row.kind)}</span></td>
        <td class="tiny">${esc(row.created_at || '')}</td>
        <td>${num((row.counts_parsed || {}).created)} ایجاد</td>
        <td>${num((row.counts_parsed || {}).skipped)} رد‌شده</td>
      </tr>`).join('');

    return `
      <div class="tabs">
        <button class="tab ${state.tab === 'attempts' ? 'active' : ''}" data-action="tab" data-tab="attempts">تلاش‌های جدید</button>
        <button class="tab ${state.tab === 'previous' ? 'active' : ''}" data-action="tab" data-tab="previous">سابقه قبلی (پیش از نرم‌افزار)</button>
        <button class="tab ${state.tab === 'batches' ? 'active' : ''}" data-action="tab" data-tab="batches">دسته‌های ورود</button>
      </div>

      ${state.tab !== 'batches' ? `
      <div class="card">
        <form data-form="filter">
          <div class="form-grid">
            <div class="field"><label>نتیجه</label><select name="result">
              <option value="">همه</option>
              <option value="correct" ${state.filters.result === 'correct' ? 'selected' : ''}>درست</option>
              <option value="incorrect" ${state.filters.result === 'incorrect' ? 'selected' : ''}>غلط</option>
              <option value="unanswered" ${state.filters.result === 'unanswered' ? 'selected' : ''}>بی‌پاسخ</option>
            </select></div>
            <div class="field"><label>جست‌وجوی کد/شماره</label><input name="search" value="${esc(state.filters.search || '')}"></div>
            ${state.tab === 'attempts' ? `
            <div class="field"><label>منبع</label><select name="source">
              <option value="">همه</option>
              <option value="app" ${state.filters.source === 'app' ? 'selected' : ''}>برنامه</option>
              <option value="review" ${state.filters.source === 'review' ? 'selected' : ''}>مرور</option>
              <option value="exam" ${state.filters.source === 'exam' ? 'selected' : ''}>آزمون</option>
            </select></div>
            <div class="field"><label>از تاریخ (ISO)</label><input name="date_from" value="${esc(state.filters.date_from || '')}" placeholder="2026-09-01"></div>
            <div class="field"><label>تا تاریخ</label><input name="date_to" value="${esc(state.filters.date_to || '')}" placeholder="2026-09-30"></div>
            <div class="field"><label>نمایش بی‌اعتبارها</label><select name="include_voided">
              <option value="">خیر</option><option value="true">بله</option></select></div>` : ''}
          </div>
          <div class="spacer"></div>
          <button class="btn btn-primary" type="submit">اعمال</button>
        </form>
      </div>
      <div class="spacer"></div>` : ''}

      <div class="card">
        ${state.tab === 'attempts' ? `
          <div class="card-head"><h2>تلاش‌های ثبت‌شده</h2>
            <div class="actions"><button class="btn btn-sm btn-primary" data-action="addAttempt">ثبت تلاش</button></div></div>
          ${attemptRows ? `<div class="table-wrap" style="max-height:70vh;overflow:auto"><table>
            <thead><tr><th>کد</th><th>کتاب</th><th>شماره</th><th>پاسخ</th><th>نتیجه</th><th>ثانیه</th>
            <th>زمان</th><th>منبع</th><th>یادداشت</th><th></th></tr></thead><tbody>${attemptRows}</tbody></table></div>`
            : emptyState('تلاشی ثبت نشده است', 'از فرم «ثبت سؤال» شروع کنید.')}`
        : state.tab === 'previous' ? `
          <div class="card-head"><h2>سابقه تست‌های قبلاً حل‌شده</h2>
            <div class="actions"><button class="btn btn-sm btn-primary" data-action="addPrevious">ورود سابقه</button></div></div>
          <p class="card-sub">این رکوردها تاریخ حل ندارند و با تلاش عادی یکی نیستند؛ غلط و بی‌پاسخ آن‌ها وارد فرآیند مرور می‌شود.</p>
          ${previousRows ? `<div class="table-wrap" style="max-height:70vh;overflow:auto"><table>
            <thead><tr><th>کد</th><th>کتاب</th><th>شماره</th><th>پاسخ</th><th>نتیجه</th><th>دسته</th><th>یادداشت</th><th></th></tr></thead>
            <tbody>${previousRows}</tbody></table></div>`
            : emptyState('سابقه قبلی‌ای ثبت نشده است', 'تست‌هایی که پیش از استفاده از برنامه حل کرده‌اید اینجا وارد کنید.')}`
        : `
          <div class="card-head"><h2>دسته‌های ورود سابقه</h2></div>
          ${batchRows ? `<div class="table-wrap"><table>
            <thead><tr><th>عنوان</th><th>نوع</th><th>زمان</th><th>ایجاد</th><th>رد‌شده</th></tr></thead>
            <tbody>${batchRows}</tbody></table></div>` : '<p class="muted small">دسته‌ای ثبت نشده است.</p>'}`}
      </div>`;
  },

  actions: {
    async tab(element) {
      state.tab = element.dataset.tab;
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async editNote(element) {
      const id = element.dataset.id;
      const attempt = await api.get(`/attempts/${id}`);
      openModal({
        title: 'یادداشت تلاش',
        body: `<div class="banner warn" style="margin-bottom:.6rem"><div>
          پاسخ، نتیجه و زمان قابل تغییر نیستند (اصل تاریخچه‌محور). فقط یادداشت ویرایش می‌شود.</div></div>
          <form data-form="note"><div class="field"><label>یادداشت</label>
          <textarea name="notes" rows="3">${esc(attempt.notes || '')}</textarea></div></form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            await api.patch(`/attempts/${id}`, { notes: data.notes });
            closeModal(); toast('ذخیره شد', 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          });
        },
      });
    },

    async voidAttempt(element) {
      openModal({
        title: 'بی‌اعتبار کردن تلاش',
        body: `<p class="small">رکورد حذف نمی‌شود؛ فقط در محاسبه آمار شمرده نمی‌شود و هر زمان قابل بازگردانی است.</p>
          <form data-form="void"><div class="field"><label>دلیل</label><input name="reason"></div></form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-danger" data-save>بی‌اعتبار کن</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            await api.post(`/attempts/${element.dataset.id}/void`, { reason: data.reason });
            closeModal(); toast('رکورد بی‌اعتبار شد', 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          });
        },
      });
    },

    async restoreAttempt(element) {
      await api.post(`/attempts/${element.dataset.id}/restore`);
      toast('رکورد بازگردانی شد', 'ok');
      const { rerender } = await import('../app.js'); await rerender();
    },

    async voidPrevious(element) {
      await api.post(`/previous-entries/${element.dataset.id}/void`, {});
      toast('سابقه قبلی بی‌اعتبار شد (رکورد باقی است)', 'ok');
      const { rerender } = await import('../app.js'); await rerender();
    },

    addAttempt() { window.location.hash = '#/entry'; },
    addPrevious() { window.location.hash = '#/entry'; },
  },

  async submit(name, form) {
    if (name === 'filter') {
      const data = Object.fromEntries(new FormData(form).entries());
      state.filters = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== ''));
      const { rerender } = await import('../app.js');
      await rerender();
    }
  },
};
