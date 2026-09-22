/* بانک تست — مرور، فیلتر، علامت‌گذاری و ثبت پاسخ سریع */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, emptyState, esc, fa, notifyError, num, openModal, options, resultBadge, toast } from '../ui.js';

const state = { filters: {}, page: 1, pageSize: 50 };

function parseHashQuery() {
  const hash = window.location.hash;
  const index = hash.indexOf('?');
  const params = {};
  if (index > -1) {
    new URLSearchParams(hash.slice(index + 1)).forEach((value, key) => { params[key] = value; });
  }
  return params;
}

export default {
  title: 'بانک تست',
  subtitle: 'جست‌وجو، فیلتر و کار روی تست‌ها با حفظ کامل سابقه',

  async render(ctx) {
    const query = parseHashQuery();
    state.filters = {
      book_id: query.book_id || '',
      book_node_id: query.book_node_id || '',
      topic_id: query.topic_id || '',
      search: query.search || '',
      result: query.result || '',
      important: query.important || '',
      hard: query.hard || '',
      untried: query.untried || '',
    };
    if (query.page) state.page = Number(query.page);
    if (state.filters.book_node_id && !state.filters.book_id) {
      const node = await api.get(`/nodes/${state.filters.book_node_id}`).catch(() => null);
      if (node) state.filters.book_id = String(node.book_id);
    }

    const [books, summary] = await Promise.all([store.loadBooks(), api.get('/questions/summary')]);
    const tree = state.filters.book_id
      ? await api.get(`/books/${state.filters.book_id}/tree`) : { tree: [] };

    let nodes = [];
    (function walk(list, depth) {
      list.forEach((node) => {
        const type = (store.state.labels.node_type || {})[node.node_type] || node.node_type;
        nodes.push({
          id: node.id,
          title: `${'— '.repeat(depth)}${node.title} (${type})${node.total_question_count ? ` — ${node.total_question_count}` : ''}`,
        });
        if (node.children) walk(node.children, depth + 1);
      });
    }(tree.tree || [], 0));

    const topicTree = await api.get('/topics/tree', { subject_id: store.activeSubjectId() || '' });
    const topics = [];
    (function walkTopics(list, depth) {
      list.forEach((topic) => {
        topics.push({ id: topic.id, title: `${'— '.repeat(depth)}${topic.title}` });
        if (topic.children) walkTopics(topic.children, depth + 1);
      });
    }(topicTree.items || [], 0));

    const data = await api.get('/questions', {
      ...cleanQuery(state.filters), page: state.page, page_size: state.pageSize,
      subject_id: store.activeSubjectId() || '',
    });

    const rows = (data.items || []).map((row) => `
      <tr>
        <td class="mono">${esc(row.code)}</td>
        <td>${esc(row.display_number || '—')}</td>
        <td class="small">${esc(row.book_title || '—')}</td>
        <td class="small">${esc(row.node_title || '—')}</td>
        <td class="small">${esc(row.topics || '—')}</td>
        <td>${esc(row.correct_answer || '—')}</td>
        <td>${esc(row.publisher_difficulty || '—')}</td>
        <td>
          <button class="btn btn-sm" data-action="flagImportant" data-id="${row.id}"
            title="علامت مهم">${row.is_important ? '★' : '☆'}</button>
          <button class="btn btn-sm" data-action="flagHard" data-id="${row.id}"
            title="علامت سخت">${row.is_hard ? '⛔' : '○'}</button>
        </td>
        <td>${num(row.attempt_count)}${row.previous_count ? ` <span class="badge">+${num(row.previous_count)}</span>` : ''}</td>
        <td>${resultBadge(row.last_result)}</td>
        <td class="tiny">${esc((row.last_attempt_at || '').slice(0, 10))}</td>
        <td class="actions">
          <button class="btn btn-sm btn-primary" data-action="record" data-id="${row.id}"
            data-code="${esc(row.code)}" data-answer="${esc(row.correct_answer || '')}">ثبت پاسخ</button>
          <button class="btn btn-sm" data-action="detail" data-id="${row.id}">جزئیات</button>
        </td>
      </tr>`).join('');

    const pages = Math.max(1, Math.ceil((data.total || 0) / state.pageSize));
    const pager = Array.from({ length: Math.min(pages, 9) }, (_, index) => {
      const page = index + 1;
      return `<button class="btn btn-sm ${page === state.page ? 'on' : ''}"
        data-action="gotoPage" data-page="${page}">${fa(page)}</button>`;
    }).join('');

    return `
      <div class="grid cols-4">
        <div class="stat"><span class="label">کل تست‌ها</span><div class="value">${num(summary.total)}</div></div>
        <div class="stat"><span class="label">حل‌شده</span><div class="value">${num(summary.attempted)}</div></div>
        <div class="stat ${summary.important ? 'accent' : ''}"><span class="label">علامت مهم</span><div class="value">${num(summary.important)}</div></div>
        <div class="stat ${summary.hard ? 'warn' : ''}"><span class="label">علامت سخت</span><div class="value">${num(summary.hard)}</div></div>
      </div>
      <div class="spacer"></div>

      <div class="card">
        <form data-form="filter">
          <div class="form-grid">
            <div class="field"><label>کتاب</label>
              <select name="book_id" data-change="book">${options(books, state.filters.book_id, { empty: 'همه کتاب‌ها' })}</select></div>
            <div class="field"><label>محل در ساختار</label>
              <select name="book_node_id">${options(nodes, state.filters.book_node_id, { empty: 'همه محل‌ها' })}</select></div>
            <div class="field"><label>مبحث</label>
              <select name="topic_id">${options(topics, state.filters.topic_id, { empty: 'همه مباحث' })}</select></div>
            <div class="field"><label>وضعیت پاسخ</label>
              <select name="result">
                <option value="">همه</option>
                <option value="correct" ${state.filters.result === 'correct' ? 'selected' : ''}>آخرین تلاش درست</option>
                <option value="incorrect" ${state.filters.result === 'incorrect' ? 'selected' : ''}>آخرین تلاش غلط</option>
                <option value="unanswered" ${state.filters.result === 'unanswered' ? 'selected' : ''}>آخرین تلاش بی‌پاسخ</option>
                <option value="solved_any" ${state.filters.result === 'solved_any' ? 'selected' : ''}>هر تست حل‌شده</option>
              </select></div>
            <div class="field"><label>علامت‌ها</label>
              <select name="important"><option value="">مهم: همه</option>
                <option value="true" ${state.filters.important === 'true' ? 'selected' : ''}>فقط مهم</option>
                <option value="false" ${state.filters.important === 'false' ? 'selected' : ''}>بدون علامت مهم</option></select></div>
            <div class="field"><label>سخت</label>
              <select name="hard"><option value="">سخت: همه</option>
                <option value="true" ${state.filters.hard === 'true' ? 'selected' : ''}>فقط سخت</option>
                <option value="false" ${state.filters.hard === 'false' ? 'selected' : ''}>بدون علامت سخت</option></select></div>
            <div class="field"><label>حل‌نشده‌ها</label>
              <select name="untried"><option value="">همه</option>
                <option value="true" ${state.filters.untried === 'true' ? 'selected' : ''}>فقط حل‌نشده</option></select></div>
            <div class="field"><label>جست‌وجو</label>
              <input name="search" value="${esc(state.filters.search)}" placeholder="کد، شماره، مبحث، مرجع"></div>
          </div>
          <div class="spacer"></div>
          <div class="row">
            <button class="btn btn-primary" type="submit">اعمال فیلتر</button>
            <button class="btn" type="button" data-action="clearFilters">حذف فیلترها</button>
            <span class="muted small">${num(data.total)} تست با این فیلتر</span>
          </div>
        </form>
      </div>
      <div class="spacer"></div>

      <div class="card">
        <div class="card-head"><h2>تست‌ها</h2>
          <div class="actions">
            <a class="btn btn-sm" href="#/entry">ثبت سریع</a>
            <button class="btn btn-sm" data-action="exportCsv">دریافت قالب CSV</button>
          </div></div>
        ${rows ? `<div class="table-wrap"><table>
          <thead><tr><th>کد</th><th>شماره</th><th>کتاب</th><th>محل</th><th>مبحث</th><th>کلید</th>
          <th>سختی ناشر</th><th>علامت</th><th>تلاش</th><th>آخرین</th><th>تاریخ</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>
          <div class="pagination">${pager}</div>`
          : emptyState('تستی با این فیلتر پیدا نشد', 'فیلترها را تغییر دهید یا تست جدید ثبت کنید.')}
      </div>`;
  },

  changes: {
    async book(element, ctx) {
      const bookId = element.value;
      const nodeSelect = element.closest('form').querySelector('[name=book_node_id]');
      if (!bookId) { nodeSelect.innerHTML = '<option value="">همه محل‌ها</option>'; return; }
      const tree = await api.get(`/books/${bookId}/tree`);
      const nodes = [];
      (function walk(list, depth) {
        list.forEach((node) => {
          const type = (store.state.labels.node_type || {})[node.node_type] || node.node_type;
          nodes.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title} (${type})` });
          if (node.children) walk(node.children, depth + 1);
        });
      }(tree.tree || [], 0));
      nodeSelect.innerHTML = options(nodes, '', { empty: 'همه محل‌ها' });
    },
  },

  actions: {
    async record(element) {
      const questionId = Number(element.dataset.id);
      const code = element.dataset.code;
      const answer = element.dataset.answer;
      openModal({
        title: `ثبت پاسخ — ${code}`,
        body: `<form data-form="record">
          <div class="banner info" style="margin-bottom:.6rem"><div>
            پاسخ صحیح ثبت‌شده: <strong>${esc(answer || 'ثبت نشده')}</strong> — نتیجه به‌صورت خودکار محاسبه می‌شود.
          </div></div>
          <div class="form-grid">
            <div class="field"><label>پاسخ کاربر</label><input name="user_answer" autofocus placeholder="مثلاً 3"></div>
            <div class="field"><label>نتیجه (اجباری اختیاری)</label>
              <select name="result"><option value="">خودکار</option>
                <option value="correct">درست</option>
                <option value="incorrect">غلط</option>
                <option value="unanswered">بی‌پاسخ</option></select></div>
            <div class="field"><label>زمان (ثانیه)</label><input name="spent_seconds" inputmode="numeric"></div>
            <div class="field"><label>تاریخ و ساعت</label><input name="attempted_at" placeholder="خالی = همین حالا"></div>
            <div class="field"><label>نوع ثبت</label><select name="kind">
              <option value="new">تلاش جدید</option>
              <option value="previous">سابقه قبلی (بدون تاریخ)</option></select></div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label><textarea name="notes" rows="2"></textarea></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ثبت</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const form = modal.querySelector('form');
            const data = Object.fromEntries(new FormData(form).entries());
            const payload = {
              question_id: questionId,
              user_answer: data.user_answer || null,
              result: data.result || null,
              spent_seconds: data.spent_seconds || null,
              notes: data.notes || null,
            };
            try {
              let response;
              if (data.kind === 'previous') {
                response = await api.post('/previous-entries',
                  { entries: [payload], label: 'ثبت از بانک تست' });
              } else {
                payload.attempted_at = data.attempted_at || null;
                response = await api.post('/attempts', payload);
              }
              closeModal();
              const result = response.result || (response.entries && response.entries[0]?.result);
              toast(`ثبت شد — ${(store.state.labels.result || {})[result] || ''}`, 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },

    async detail(element) {
      const question = await api.get(`/questions/${element.dataset.id}`);
      const timeline = (question.performance.timeline || []).map((row) => `
        <tr><td>${row.kind === 'previous' ? 'سابقه قبلی' : 'تلاش جدید'}</td>
        <td>${esc(row.user_answer || '—')}</td><td>${resultBadge(row.result)}</td>
        <td>${num(row.spent_seconds ?? '—')}</td><td class="tiny">${esc(row.at || '')}</td>
        <td class="tiny">${esc(row.notes || '')}</td>
        <td class="actions">${row.kind === 'attempt'
          ? `<button class="btn btn-sm btn-danger" data-action="voidAttempt" data-id="${row.id}">بی‌اعتبار کردن</button>`
          : ''}</td></tr>`).join('');
      const modal = openModal({
        wide: true,
        title: `تست ${question.code} — ${question.book_title || ''}`,
        body: `
          <div class="grid cols-2">
            <div class="kv">
              <dt>محل</dt><dd>${esc(question.node_title || '—')}</dd>
              <dt>شماره</dt><dd>${esc(question.display_number || '—')}</dd>
              <dt>کلید</dt><dd>${esc(question.correct_answer || '—')}</dd>
              <dt>سختی ناشر</dt><dd>${esc(question.publisher_difficulty || '—')}</dd>
              <dt>مباحث</dt><dd>${esc((question.topics || []).map((topic) => topic.title).join('، ') || '—')}</dd>
              <dt>وضعیت</dt><dd>${question.state === 'active' ? 'فعال' : 'آرشیو'}</dd>
            </div>
            <div class="stack">
              <div class="row tight">
                <span class="badge ${question.is_important ? 'star' : ''}">مهم: ${question.is_important ? 'بله' : 'خیر'}</span>
                <span class="badge ${question.is_hard ? 'flag' : ''}">سخت: ${question.is_hard ? 'بله' : 'خیر'}</span>
                <span class="badge">تلاش: ${num(question.performance.attempt_count)}</span>
                <span class="badge">سابقه قبلی: ${num(question.performance.previous_count)}</span>
              </div>
              <div class="row tight">
                <button class="btn btn-sm" data-action="toggleFlag" data-id="${question.id}" data-field="important">
                  ${question.is_important ? 'حذف مهم' : 'علامت مهم'}</button>
                <button class="btn btn-sm" data-action="toggleFlag" data-id="${question.id}" data-field="hard">
                  ${question.is_hard ? 'حذف سخت' : 'علامت سخت'}</button>
                <button class="btn btn-sm" data-action="editQuestion" data-id="${question.id}">ویرایش کلید و مشخصات</button>
                <button class="btn btn-sm" data-action="toggleArchive" data-id="${question.id}" data-state="${question.state}">
                  ${question.state === 'active' ? 'آرشیو تست' : 'بازگرداندن'}</button>
              </div>
              <div class="form-grid">
                <div class="field"><label>افزودن به مبحث</label>
                  <div class="row tight">
                    <input id="add-topic-id" placeholder="شناسه مبحث" style="max-width:130px">
                    <button class="btn btn-sm" data-action="addTopic" data-id="${question.id}">افزودن</button>
                  </div></div>
              </div>
            </div>
          </div>
          <div class="spacer"></div>
          <h3>خط زمانی سابقه</h3>
          ${timeline ? `<div class="table-wrap" style="max-height:40vh;overflow:auto"><table>
            <thead><tr><th>نوع</th><th>پاسخ</th><th>نتیجه</th><th>ثانیه</th><th>زمان</th><th>یادداشت</th><th></th></tr></thead>
            <tbody>${timeline}</tbody></table></div>` : '<p class="muted small">سابقه‌ای ثبت نشده است.</p>'}`,
        footer: `<button class="btn" data-modal-close>بستن</button>`,
      });
    },

    async toggleFlag(element) {
      const id = element.dataset.id;
      const field = element.dataset.field;
      const question = await api.get(`/questions/${id}`);
      const value = field === 'important' ? !question.is_important : !question.is_hard;
      await api.put(`/questions/${id}/flags`, { [field]: value });
      closeModal();
      const { rerender } = await import('../app.js'); await rerender();
    },

    async toggleArchive(element) {
      const id = element.dataset.id;
      if (element.dataset.state === 'active') {
        const result = await api.del(`/questions/${id}`);
        toast(result.note || 'تست آرشیو شد', 'ok');
      } else {
        await api.post(`/questions/${id}/restore`);
        toast('تست به فهرست فعال بازگشت', 'ok');
      }
      closeModal();
      const { rerender } = await import('../app.js'); await rerender();
    },

    async editQuestion(element) {
      const id = element.dataset.id;
      const question = await api.get(`/questions/${id}`);
      openModal({
        title: `ویرایش تست ${question.code}`,
        body: `<form data-form="edit">
          <div class="banner warn" style="margin-bottom:.6rem"><div>
            پاسخ و نتیجه تلاش‌های قبلی بازنویسی نمی‌شود؛ این فرم فقط مشخصات تست را تغییر می‌دهد.
          </div></div>
          <div class="form-grid">
            <div class="field"><label>شماره نمایشی</label><input name="display_number" value="${esc(question.display_number || '')}"></div>
            <div class="field"><label>پاسخ صحیح</label><input name="correct_answer" value="${esc(question.correct_answer || '')}"></div>
            <div class="field"><label>سختی ناشر</label><input name="publisher_difficulty" value="${esc(question.publisher_difficulty || '')}"></div>
            <div class="field"><label>مرجع</label><input name="reference" value="${esc(question.reference || '')}"></div>
            <div class="field"><label>شناسه داخلی</label><input name="code" class="mono" value="${esc(question.code)}"></div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label>
            <textarea name="notes" rows="2">${esc(question.notes || '')}</textarea></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            try {
              await api.put(`/questions/${id}`, data);
              closeModal(true); toast('ذخیره شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },

    async addTopic(element) {
      const id = element.dataset.id;
      const input = document.querySelector('#add-topic-id');
      const topicId = Number(input.value);
      if (!topicId) { toast('شناسه مبحث را وارد کنید', 'warn'); return; }
      await api.post(`/topics/${topicId}/questions`, { question_ids: [Number(id)] });
      toast('تست به مبحث متصل شد', 'ok');
    },

    async voidAttempt(element) {
      openModal({
        title: 'بی‌اعتبار کردن تلاش',
        body: `<p>رکورد حذف نمی‌شود؛ فقط از محاسبه آمار کنار گذاشته می‌شود و قابل بازگردانی است.</p>
          <form data-form="void"><div class="field"><label>دلیل (اختیاری)</label>
          <input name="reason" placeholder="اشتباه در ورود"></div></form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-danger" data-save>بی‌اعتبار کن</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            await api.post(`/attempts/${element.dataset.id}/void`, { reason: data.reason });
            closeModal(true); toast('رکورد بی‌اعتبار شد (سابقه باقی است)', 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          });
        },
      });
    },

    async gotoPage(element) {
      state.page = Number(element.dataset.page);
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async clearFilters() {
      state.filters = {};
      state.page = 1;
      window.location.hash = '#/questions';
      const { rerender } = await import('../app.js');
      await rerender();
    },

    exportCsv() {
      window.open(api.fileUrl('/csv/template'), '_blank');
    },
  },

  async submit(name, form) {
    if (name === 'filter') {
      const data = Object.fromEntries(new FormData(form).entries());
      state.filters = data;
      state.page = 1;
      const { rerender } = await import('../app.js');
      await rerender();
    }
  },
};

function cleanQuery(filters) {
  const output = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) output[key] = value;
  });
  if (output.important) output.important = output.important === 'true' ? 'true' : 'false';
  return output;
}
