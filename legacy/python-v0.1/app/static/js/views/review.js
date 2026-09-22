/* مرور هوشمند — فهرست مرور، فیلتر ترکیبی و دسته کار امروز */

import { api } from '../api.js';
import * as store from '../store.js';
import { badgeList, closeModal, emptyState, esc, fa, notifyError, num, openModal, options, resultBadge, toast } from '../ui.js';

const state = { filters: ['incorrect', 'unanswered'], matchAll: false, liveOnly: false, batch: null, page: 1 };

export default {
  title: 'مرور هوشمند',
  subtitle: 'ترکیب دلایل: غلط، بی‌پاسخ، سابقه قبلی، مهم، سخت، باقی‌مانده هدف و آزمون آینده',

  async render() {
    const [summary, filterInfo, items] = await Promise.all([
      api.get('/reviews/summary'),
      api.get('/reviews/filters'),
      api.get('/reviews', { page: state.page, page_size: 40, level: 'question' }),
    ]);
    const topicItems = await api.get('/reviews', { level: 'topic', page_size: 20 });
    const labels = store.state.labels.review_reason || {};

    const reasonTiles = Object.entries(filterInfo.filters || {}).map(([key, label]) => `
      <button class="chip ${state.filters.includes(key) ? 'on' : ''}" data-action="toggleFilter" data-key="${key}">
        ${esc(label)} <span class="badge">${num(summary.by_reason[key] || 0)}</span></button>`).join('');

    const itemRows = (items.items || []).map((item) => `
      <tr>
        <td class="mono">${esc(item.code || '—')}</td>
        <td>${esc(item.display_number || '—')}</td>
        <td class="small">${esc(item.book_title || '—')}</td>
        <td class="small">${esc(item.node_title || '—')}</td>
        <td>${badgeList(item.reasons, labels)}</td>
        <td><span class="badge ${item.priority >= 50 ? 'bad' : item.priority >= 25 ? 'warn' : ''}">${num(item.priority)}</span></td>
        <td>${resultBadge(item.last_result)}</td>
        <td class="tiny">${esc((item.last_attempt_at || '').slice(0, 10) || '—')}</td>
        <td class="actions">
          <button class="btn btn-sm btn-primary" data-action="record" data-id="${item.question_id}"
            data-code="${esc(item.code || '')}">ثبت پاسخ</button>
          <button class="btn btn-sm" data-action="start" data-id="${item.id}">در حال بررسی</button>
          <button class="btn btn-sm" data-action="resolve" data-id="${item.id}">حل شد</button>
        </td>
      </tr>`).join('');

    const topicRows = (topicItems.items || []).map((item) => `
      <tr>
        <td>${esc(item.topic_title || '—')}</td>
        <td>${badgeList(item.reasons, labels)}</td>
        <td class="small">${esc(item.note || '—')}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="openTopicQuestions" data-topic="${item.topic_id}">تست‌های مبحث</button>
          <button class="btn btn-sm" data-action="resolve" data-id="${item.id}">حل شد</button>
        </td>
      </tr>`).join('');

    const liveResults = state.liveOnly && state.filters.length ? await api.post('/reviews/filter-search', {
      filters: state.filters, match_all: state.matchAll, limit: 100,
      subject_id: store.activeSubjectId(),
    }) : null;

    const liveRows = liveResults ? (liveResults.items || []).map((row) => `
      <tr>
        <td class="mono">${esc(row.code)}</td>
        <td>${esc(row.display_number || '—')}</td>
        <td class="small">${esc(row.book_title || '—')}</td>
        <td class="small">${esc(row.node_title || '—')}</td>
        <td>${row.important ? '<span class="badge star">مهم</span>' : ''}${row.hard ? '<span class="badge flag">سخت</span>' : ''}</td>
        <td>${num(row.attempt_count)}</td>
        <td>${resultBadge(row.last_result)}</td>
        <td class="tiny">${esc((row.last_attempt_at || '').slice(0, 10) || '—')}</td>
      </tr>`).join('') : '';

    return `
      <div class="grid cols-4">
        <div class="stat accent"><span class="label">مورد مرور باز (سطح تست)</span>
          <div class="value">${num(summary.question_items)}</div></div>
        <div class="stat"><span class="label">کار مبحثی (هدف/آزمون)</span>
          <div class="value">${num(summary.topic_items)}</div></div>
        <div class="stat ok"><span class="label">حل‌شده</span>
          <div class="value">${num(summary.states.resolved || 0)}</div></div>
        <div class="stat warn"><span class="label">بایگانی‌شده</span>
          <div class="value">${num(summary.states.archived || 0)}</div></div>
      </div>
      <div class="spacer"></div>

      <div class="card">
        <div class="card-head"><h2>معیارهای مرور</h2>
          <div class="actions">
            <button class="btn btn-sm ${state.matchAll ? 'btn-primary' : ''}" data-action="toggleMatchAll">
              ${state.matchAll ? 'ترکیب با «و» (همه معیارها)' : 'ترکیب با «یا» (هر معیار)'}</button>
            <button class="btn btn-sm ${state.liveOnly ? 'btn-primary' : ''}" data-action="toggleLive">
              فیلتر زنده روی بانک تست</button>
            <button class="btn btn-sm" data-action="rebuild">بازسازی فهرست مرور</button>
          </div></div>
        <div class="chip-row">${reasonTiles}</div>
        <div class="spacer"></div>
        <div class="row">
          <button class="btn btn-primary" data-action="buildBatch">ساخت دسته کار امروز</button>
          <span class="muted small">دسته کار بر پایه اولویت و قدمت آخرین تلاش مرتب می‌شود.</span>
        </div>
      </div>
      <div class="spacer"></div>

      ${state.liveOnly ? `
        <div class="card">
          <div class="card-head"><h2>نتیجه فیلتر زنده</h2>
            <div class="actions"><span class="badge primary">${num((liveResults || {}).total || 0)} تست</span></div></div>
          ${liveRows ? `<div class="table-wrap" style="max-height:60vh;overflow:auto"><table>
            <thead><tr><th>کد</th><th>شماره</th><th>کتاب</th><th>محل</th><th>علامت</th><th>تلاش</th><th>آخرین</th><th>تاریخ</th></tr></thead>
            <tbody>${liveRows}</tbody></table></div>`
            : '<p class="muted small">معیاری انتخاب کنید تا نتیجه نمایش داده شود.</p>'}
        </div>
        <div class="spacer"></div>` : ''}

      ${state.batch ? `
        <div class="card">
          <div class="card-head"><h2>دسته کار امروز</h2>
            <div class="actions"><span class="badge primary">${num(state.batch.count)} تست</span>
              <button class="btn btn-sm" data-action="closeBatch">بستن</button></div></div>
          <div class="stack">
            ${(state.batch.items || []).map((row) => `
              <div class="question-line" style="border-bottom:1px dashed var(--border);padding:.4rem 0">
                <span class="mono">${esc(row.code)}</span>
                <span class="muted small">${esc(row.book_title || '')} — ${esc(row.node_title || '')}</span>
                ${badgeList(row.reasons, labels)}
                <span class="badge ${row.priority >= 50 ? 'bad' : 'warn'}">${num(row.priority)}</span>
                <span class="actions" style="margin-inline-start:auto;display:flex;gap:.3rem">
                  <button class="btn btn-sm btn-primary" data-action="record" data-id="${row.id}" data-code="${esc(row.code)}">ثبت پاسخ</button>
                </span>
              </div>`).join('')}
          </div>
        </div>
        <div class="spacer"></div>` : ''}

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>فهرست مرور سطح تست</h2>
            <div class="actions"><span class="badge">${num(items.total)} مورد</span></div></div>
          <p class="card-sub">مرتب‌شده بر پایه اولویت و سپس قدیمی‌ترین تلاش.</p>
          ${itemRows ? `<div class="table-wrap" style="max-height:65vh;overflow:auto"><table>
            <thead><tr><th>کد</th><th>شماره</th><th>کتاب</th><th>محل</th><th>دلایل</th><th>اولویت</th>
            <th>آخرین نتیجه</th><th>تاریخ</th><th></th></tr></thead>
            <tbody>${itemRows}</tbody></table></div>` : emptyState('فهرست مرور خالی است', 'با ثبت تلاش‌های غلط یا بی‌پاسخ، موارد به‌صورت خودکار افزوده می‌شوند.')}
        </div>
        <div class="card">
          <div class="card-head"><h2>کارهای مبحثی</h2>
            <div class="actions"><a class="btn btn-sm" href="#/teaching">مدیریت اهداف</a></div></div>
          <p class="card-sub">«باقی‌مانده از هدف» و «آزمون آینده» به‌صورت کار سطح مبحث ثبت می‌شوند.</p>
          ${topicRows ? `<div class="table-wrap"><table>
            <thead><tr><th>مبحث</th><th>دلایل</th><th>توضیح</th><th></th></tr></thead>
            <tbody>${topicRows}</tbody></table></div>` : '<p class="muted small">کار مبحثی باز وجود ندارد.</p>'}
          <div class="spacer"></div>
          <div class="banner info"><div>
            هر مورد مرور دلیل‌های خود را نگه می‌دارد؛ با «حل شد» فقط وضعیت تغییر می‌کند و سابقه
            تست دست‌نخورده می‌ماند.
          </div></div>
        </div>
      </div>`;
  },

  actions: {
    async toggleFilter(element) {
      const key = element.dataset.key;
      const index = state.filters.indexOf(key);
      if (index > -1) state.filters.splice(index, 1);
      else state.filters.push(key);
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async toggleMatchAll() {
      state.matchAll = !state.matchAll;
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async toggleLive() {
      state.liveOnly = !state.liveOnly;
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async rebuild() {
      const result = await api.post('/reviews/sync');
      toast(`فهرست مرور بازسازی شد — ${fa(result.open_items)} مورد باز`, 'ok');
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async buildBatch() {
      const data = await api.get('/reviews/batch', {
        filters: state.filters.join(','), limit: 20,
        subject_id: store.activeSubjectId() || '',
      });
      state.batch = data;
      if (!data.count) toast('با این معیارها کاری پیدا نشد', 'warn');
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async closeBatch() {
      state.batch = null;
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async resolve(element) {
      await api.patch(`/reviews/${element.dataset.id}`, { state: 'resolved' });
      toast('مورد مرور حل‌شده شد', 'ok');
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async start(element) {
      await api.patch(`/reviews/${element.dataset.id}`, { state: 'in_progress' });
      toast('وضعیت به «در حال بررسی» تغییر کرد', 'ok');
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async openTopicQuestions(element) {
      const topicId = Number(element.dataset.topic);
      const data = await api.get('/questions', { topic_id: topicId, untried: 'true', page_size: 100 });
      openModal({
        wide: true,
        title: 'تست‌های حل‌نشده این مبحث',
        body: data.items.length ? `<div class="table-wrap" style="max-height:60vh;overflow:auto"><table>
          <thead><tr><th>کد</th><th>شماره</th><th>کتاب</th><th>محل</th><th>کلید</th></tr></thead>
          <tbody>${data.items.map((row) => `<tr><td class="mono">${esc(row.code)}</td>
            <td>${esc(row.display_number || '—')}</td><td class="small">${esc(row.book_title || '')}</td>
            <td class="small">${esc(row.node_title || '')}</td><td>${esc(row.correct_answer || '—')}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="muted">تست حل‌نشده‌ای در این مبحث نیست.</p>',
        footer: `<button class="btn" data-modal-close>بستن</button>
                 <a class="btn btn-primary" href="#/questions?topic_id=${topicId}&untried=true">باز کردن در بانک تست</a>`,
      });
    },

    async record(element) {
      const questionId = Number(element.dataset.id);
      openModal({
        title: `ثبت پاسخ مرور — ${esc(element.dataset.code || '')}`,
        body: `<form data-form="record">
          <div class="form-grid">
            <div class="field"><label>پاسخ</label><input name="user_answer" autofocus></div>
            <div class="field"><label>نتیجه</label><select name="result">
              <option value="">خودکار</option><option value="correct">درست</option>
              <option value="incorrect">غلط</option><option value="unanswered">بی‌پاسخ</option></select></div>
            <div class="field"><label>زمان (ثانیه)</label><input name="spent_seconds" inputmode="numeric"></div>
            <div class="field"><label>تاریخ</label><input name="attempted_at" placeholder="خالی = همین حالا"></div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label><textarea name="notes" rows="2"></textarea></div>
          <p class="muted tiny">منبع این ثبت «مرور» علامت می‌خورد تا در تحلیل‌ها قابل تفکیک باشد.</p>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ثبت</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            try {
              await api.post('/attempts', {
                question_id: questionId, user_answer: data.user_answer || null,
                result: data.result || null, spent_seconds: data.spent_seconds || null,
                attempted_at: data.attempted_at || null, notes: data.notes || null,
                source: 'review',
              });
              closeModal(); toast('ثبت شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },
  },
};
