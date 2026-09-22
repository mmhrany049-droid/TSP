/* جزئیات کتاب — ساختار انعطاف‌پذیر + تست‌های هر گره */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, emptyState, esc, fa, notifyError, num, openModal, options, resultBadge, toast } from '../ui.js';

const NODE_TYPES = ['chapter', 'lesson', 'section', 'subsection', 'test_set',
  'mixed_tests', 'checkup_exam', 'comprehensive_exam', 'entrance_exam', 'other_assessment'];

function nodeTypeOptions(selected) {
  const labels = store.state.labels.node_type || {};
  return NODE_TYPES.map((type) => `<option value="${type}" ${type === selected ? 'selected' : ''}>
    ${esc(labels[type] || type)}</option>`).join('');
}

function renderTree(nodes, depth = 0) {
  return nodes.map((node) => {
    const typeLabel = (store.state.labels.node_type || {})[node.node_type] || node.node_type;
    const isAssessment = ['test_set', 'mixed_tests', 'checkup_exam', 'comprehensive_exam',
      'entrance_exam', 'other_assessment'].includes(node.node_type);
    return `
    <div class="tree-node depth-${Math.min(depth, 3)}" data-node="${node.id}">
      <div class="tree-row">
        <button class="caret" data-action="toggle" data-id="${node.id}">▾</button>
        <span class="title">${esc(node.title)}</span>
        <span class="badge ${isAssessment ? 'info' : ''}">${esc(typeLabel)}</span>
        ${isAssessment ? '<span class="badge warn" title="گره ارزیابی، نه مبحث آموزشی">ارزیابی</span>' : ''}
        <span class="badge primary">${num(node.total_question_count)} تست</span>
        ${node.question_count ? `<span class="badge">${num(node.question_count)} تست مستقیم</span>` : ''}
        <span class="actions">
          <button class="btn btn-sm" data-action="addChild" data-id="${node.id}">زیرشاخه</button>
          <button class="btn btn-sm" data-action="addQuestion" data-id="${node.id}">تست</button>
          <button class="btn btn-sm" data-action="showQuestions" data-id="${node.id}">تست‌ها</button>
          <button class="btn btn-sm" data-action="editNode" data-id="${node.id}">ویرایش</button>
        </span>
      </div>
      <div class="tree-children" data-children="${node.id}">
        ${node.children && node.children.length ? renderTree(node.children, depth + 1) : ''}
      </div>
    </div>`;
  }).join('');
}

export default {
  title: 'ساختار کتاب',
  subtitle: 'ساختار اختصاصی هر کتاب و بانک تست همان کتاب',

  async render({ params }) {
    const bookId = params.bookId;
    const [tree, overview, books, topics] = await Promise.all([
      api.get(`/books/${bookId}/tree`),
      api.get(`/books/${bookId}/overview`),
      store.loadBooks(),
      store.loadTopics(),
    ]);
    const book = tree.book;
    const questionPage = await api.get('/questions', { book_id: bookId, page_size: 200 });

    const flat = [];
    (function walk(nodes, depth, parent) {
      nodes.forEach((node) => {
        flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}`, node });
        if (node.children) walk(node.children, depth + 1, node);
      });
    }(tree.tree || [], 0));

    const rows = (questionPage.items || []).map((row) => `
      <tr>
        <td class="mono">${esc(row.code)}</td>
        <td>${esc(row.display_number || '—')}</td>
        <td class="small">${esc(row.node_title || '—')}</td>
        <td class="small">${esc(row.topics || '—')}</td>
        <td>${esc(row.correct_answer || '—')}</td>
        <td>${esc(row.publisher_difficulty || '—')}</td>
        <td>${row.is_important ? '<span class="badge star">مهم</span>' : ''}
            ${row.is_hard ? '<span class="badge flag">سخت</span>' : ''}</td>
        <td>${num(row.attempt_count)}${row.previous_count ? ` <span class="badge">+${num(row.previous_count)} قبلی</span>` : ''}</td>
        <td>${resultBadge(row.last_result)}</td>
        <td class="actions"><button class="btn btn-sm" data-action="questionDetail" data-id="${row.id}">جزئیات</button></td>
      </tr>`).join('');

    const typeBreakdown = Object.entries(overview.node_types || {})
      .map(([type, count]) => `<span class="badge">${esc((store.state.labels.node_type || {})[type] || type)}: ${num(count)}</span>`)
      .join(' ');

    return `
      <div class="page-head">
        <div>
          <h2>${esc(book.title)}</h2>
          <p class="muted small">${esc(book.subject_name || 'بدون درس')} — ${esc(book.publisher || 'بدون ناشر')}
          ${book.edition_year ? ` — ویرایش ${esc(book.edition_year)}` : ''}</p>
        </div>
        <div class="actions">
          <a class="btn btn-sm" href="#/books">فهرست کتاب‌ها</a>
          <button class="btn btn-sm" data-action="addRootNode">افزودن گره سطح اول</button>
          <button class="btn btn-sm btn-primary" data-action="bulkQuestions">ورود گروهی تست</button>
        </div>
      </div>

      <div class="grid cols-4">
        ${['تست‌های کتاب', 'بدون کلید', 'تلاش‌ها', 'سابقه قبلی'].map((label, index) => {
          const values = [overview.question_count, overview.questions_without_key,
            overview.attempt_count, overview.previous_entry_count];
          return `<div class="stat ${index === 1 && values[1] ? 'warn' : ''}">
            <span class="label">${label}</span><div class="value">${num(values[index])}</div></div>`;
        }).join('')}
      </div>
      <div class="spacer"></div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>ساختار کتاب</h2>
            <div class="actions"><span class="muted tiny">${typeBreakdown || ''}</span></div></div>
          <p class="card-sub">گره‌های «آزمون چکاپ»، «آزمون جامع» و «تست‌های مخلوط» گره ارزیابی‌اند و
          به‌صورت خودکار مبحث آموزشی محسوب نمی‌شوند.</p>
          ${(tree.tree || []).length ? `<div class="tree">${renderTree(tree.tree)}</div>`
            : emptyState('ساختاری ثبت نشده است', 'با «افزودن گره سطح اول» فصل‌ها را بسازید.')}
        </div>

        <div class="card">
          <div class="card-head"><h2>تنظیمات ساختار</h2></div>
          <div class="banner info"><div>
            هر گره می‌تواند نوع، والد، عنوان و ترتیب داشته باشد. ترتیب نمایش گره‌ها را می‌توانید
            با دکمه‌های «بالا/پایین» تغییر دهید.
          </div></div>
          <div class="spacer"></div>
          <form data-form="settings">
            <div class="form-grid">
              <div class="field"><label>عنوان کتاب</label><input name="title" value="${esc(book.title)}"></div>
              <div class="field"><label>ناشر</label><input name="publisher" value="${esc(book.publisher || '')}"></div>
              <div class="field"><label>پایه</label><input name="grade" value="${esc(book.grade || '')}"></div>
              <div class="field"><label>ویرایش/سال</label><input name="edition_year" value="${esc(book.edition_year || '')}"></div>
            </div>
            <div class="field" style="margin-top:.5rem"><label>یادداشت</label>
              <textarea name="notes" rows="2">${esc(book.notes || '')}</textarea>
            </div>
            <div class="spacer"></div>
            <button class="btn btn-primary" type="submit">ذخیره مشخصات کتاب</button>
          </form>
        </div>
      </div>
      <div class="spacer"></div>

      <div class="card">
        <div class="card-head"><h2>تست‌های این کتاب</h2>
          <div class="actions">
            <input class="input" id="book-q-search" placeholder="جست‌وجو در کد/شماره/مبحث" data-input="search">
            <button class="btn btn-sm" data-action="printList">نمایش در بانک تست</button>
          </div></div>
        ${rows ? `<div class="table-wrap"><table>
          <thead><tr><th>کد</th><th>شماره</th><th>محل</th><th>مبحث</th><th>کلید</th><th>سختی ناشر</th>
          <th>علامت‌ها</th><th>تلاش</th><th>وضعیت</th><th></th></tr></thead>
          <tbody id="book-question-rows">${rows}</tbody></table></div>
          <p class="muted tiny" style="margin-top:.5rem">نمایش ${num(questionPage.items.length)} از ${num(questionPage.total)} تست</p>`
          : emptyState('تستی ثبت نشده است', 'با «افزودن تست» در هر گره شروع کنید.')}
      </div>`;
  },

  actions: {
    async toggle(element) {
      const id = element.dataset.id;
      const wrapper = document.querySelector(`[data-children="${id}"]`);
      if (!wrapper) return;
      const hidden = wrapper.style.display === 'none';
      wrapper.style.display = hidden ? '' : 'none';
      element.textContent = hidden ? '▾' : '▸';
    },

    async addRootNode(element, ctx) {
      openNodeForm({ bookId: ctx.params.bookId, parentId: null, title: 'افزودن گره سطح اول' });
    },

    async addChild(element, ctx) {
      openNodeForm({ bookId: ctx.params.bookId, parentId: Number(element.dataset.id), title: 'افزودن زیرشاخه' });
    },

    async editNode(element, ctx) {
      const nodeId = Number(element.dataset.id);
      const node = await api.get(`/nodes/${nodeId}`);
      openNodeForm({ bookId: ctx.params.bookId, parentId: node.parent_id, node, title: 'ویرایش گره' });
    },

    async addQuestion(element, ctx) {
      const nodeId = Number(element.dataset.id);
      const topics = await api.get('/topics/tree');
      const flat = [];
      (function walk(nodes, depth) {
        nodes.forEach((item) => {
          flat.push({ id: item.id, title: `${'— '.repeat(depth)}${item.title}` });
          if (item.children) walk(item.children, depth + 1);
        });
      }(topics.items || [], 0));
      openModal({
        title: 'افزودن تست به این گره',
        body: `<form data-form="question">
          <div class="form-grid">
            <div class="field"><label>شماره نمایشی</label><input name="display_number" placeholder="17"></div>
            <div class="field"><label>پاسخ صحیح</label><input name="correct_answer" placeholder="3"></div>
            <div class="field"><label>شناسه داخلی (خالی = خودکار)</label><input name="code" class="mono" placeholder="Q-000184"></div>
            <div class="field"><label>سختی اعلام‌شده ناشر</label><input name="publisher_difficulty" placeholder="آسان / متوسط / سخت"></div>
            <div class="field"><label>مبحث آموزشی</label>
              <select name="topic_id" multiple size="5">${options(flat, '')}</select>
              <span class="help">می‌توانید چند مبحث را نگه دارید (Ctrl).</span></div>
            <div class="field"><label>مباحث دیگر (با ; جدا کنید)</label><input name="topic_paths" placeholder="مباحث مخلوط; روند خواص"></div>
          </div>
          <div class="form-grid" style="margin-top:.5rem">
            <div class="field"><label>منبع/مرجع</label><input name="reference"></div>
            <div class="field" style="align-self:end">
              <label class="check"><input type="checkbox" name="important"> مهم</label>
              <label class="check"><input type="checkbox" name="hard"> سخت</label>
            </div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label><textarea name="notes" rows="2"></textarea></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ثبت تست</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const form = modal.querySelector('form');
            const data = Object.fromEntries(new FormData(form).entries());
            const selected = Array.from(form.querySelector('[name=topic_id]').selectedOptions)
              .map((option) => Number(option.value));
            try {
              const question = await api.post('/questions', {
                book_node_id: nodeId,
                display_number: data.display_number || null,
                correct_answer: data.correct_answer || null,
                code: data.code || null,
                publisher_difficulty: data.publisher_difficulty || null,
                reference: data.reference || null,
                notes: data.notes || null,
                topic_ids: selected,
                important: !!form.querySelector('[name=important]').checked,
                hard: !!form.querySelector('[name=hard]').checked,
              });
              if (data.topic_paths) {
                const created = await api.post('/topics', {
                  title: data.topic_paths.split(';')[0].trim(),
                }).catch(() => null);
                if (created) await api.post(`/topics/${created.id}/questions`,
                  { question_ids: [question.id] }).catch(() => {});
              }
              closeModal();
              toast(`تست ${question.code} ثبت شد`, 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },

    async showQuestions(element, ctx) {
      const nodeId = Number(element.dataset.id);
      const data = await api.get('/questions', { book_node_id: nodeId, page_size: 200 });
      openModal({
        wide: true,
        title: `تست‌های گره (شامل زیرشاخه‌ها): ${num(data.total)} مورد`,
        body: `<div class="table-wrap" style="max-height:60vh;overflow:auto"><table>
          <thead><tr><th>کد</th><th>شماره</th><th>محل</th><th>کلید</th><th>تلاش</th><th>آخرین نتیجه</th><th>علامت</th></tr></thead>
          <tbody>${(data.items || []).map((row) => `<tr>
            <td class="mono">${esc(row.code)}</td><td>${esc(row.display_number || '—')}</td>
            <td class="small">${esc(row.node_title || '—')}</td><td>${esc(row.correct_answer || '—')}</td>
            <td>${num(row.attempt_count)}</td><td>${resultBadge(row.last_result)}</td>
            <td>${row.is_important ? '<span class="badge star">مهم</span>' : ''}${row.is_hard ? '<span class="badge flag">سخت</span>' : ''}</td>
          </tr>`).join('')}</tbody></table></div>`,
        footer: `<button class="btn" data-modal-close>بستن</button>
                 <a class="btn btn-primary" href="#/questions?book_node_id=${nodeId}">باز کردن در بانک تست</a>`,
      });
    },

    async questionDetail(element) {
      const id = Number(element.dataset.id);
      const question = await api.get(`/questions/${id}`);
      const timeline = (question.performance.timeline || []).map((row) => `
        <tr><td>${esc(row.kind === 'previous' ? 'سابقه قبلی' : 'تلاش جدید')}</td>
        <td>${esc(row.user_answer || '—')}</td><td>${resultBadge(row.result)}</td>
        <td>${num(row.spent_seconds || '—')}</td><td class="tiny">${esc(row.at || '')}</td>
        <td class="tiny">${esc(row.notes || '')}</td></tr>`).join('');
      openModal({
        wide: true,
        title: `تست ${question.code}`,
        body: `
          <div class="grid cols-2">
            <div class="kv">
              <dt>کتاب</dt><dd>${esc(question.book_title || '—')}</dd>
              <dt>محل</dt><dd>${esc(question.node_title || '—')}</dd>
              <dt>شماره نمایشی</dt><dd>${esc(question.display_number || '—')}</dd>
              <dt>پاسخ صحیح</dt><dd>${esc(question.correct_answer || '—')}</dd>
              <dt>سختی ناشر</dt><dd>${esc(question.publisher_difficulty || '—')}</dd>
              <dt>مباحث</dt><dd>${esc((question.topics || []).map((t) => t.title).join('، ') || '—')}</dd>
            </div>
            <div>
              <div class="grid cols-2">
                <div class="stat"><span class="label">درست</span><div class="value">${num(question.performance.correct)}</div></div>
                <div class="stat"><span class="label">غلط</span><div class="value">${num(question.performance.incorrect)}</div></div>
                <div class="stat"><span class="label">بی‌پاسخ</span><div class="value">${num(question.performance.unanswered)}</div></div>
                <div class="stat"><span class="label">سابقه قبلی</span><div class="value">${num(question.performance.previous_count)}</div></div>
              </div>
              <div class="spacer"></div>
              <button class="btn btn-sm" data-action="toggleImportant" data-id="${id}">
                ${question.is_important ? 'حذف علامت مهم' : 'علامت مهم'}</button>
              <button class="btn btn-sm" data-action="toggleHard" data-id="${id}">
                ${question.is_hard ? 'حذف علامت سخت' : 'علامت سخت'}</button>
            </div>
          </div>
          <div class="spacer"></div>
          <h3>خط زمانی (به ترتیب)</h3>
          ${timeline ? `<div class="table-wrap" style="max-height:40vh;overflow:auto"><table>
            <thead><tr><th>نوع</th><th>پاسخ</th><th>نتیجه</th><th>ثانیه</th><th>زمان</th><th>یادداشت</th></tr></thead>
            <tbody>${timeline}</tbody></table></div>` : '<p class="muted small">تلاشی ثبت نشده است.</p>'}`,
        footer: `<button class="btn" data-modal-close>بستن</button>`,
      });
    },

    async toggleImportant(element) {
      const id = element.dataset.id;
      const question = await api.get(`/questions/${id}`);
      await api.put(`/questions/${id}/flags`, { important: !question.is_important });
      toast('علامت مهم تغییر کرد', 'ok');
      closeModal();
      const { rerender } = await import('../app.js'); await rerender();
    },

    async toggleHard(element) {
      const id = element.dataset.id;
      const question = await api.get(`/questions/${id}`);
      await api.put(`/questions/${id}/flags`, { hard: !question.is_hard });
      toast('علامت سخت تغییر کرد', 'ok');
      closeModal();
      const { rerender } = await import('../app.js'); await rerender();
    },

    async printList(element, ctx) {
      window.location.hash = `#/questions?book_id=${ctx.params.bookId}`;
    },

    async bulkQuestions(element, ctx) {
      const tree = await api.get(`/books/${ctx.params.bookId}/tree`);
      const flat = [];
      (function walk(nodes, depth) {
        nodes.forEach((node) => {
          const type = (store.state.labels.node_type || {})[node.node_type] || node.node_type;
          flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title} (${type})` });
          if (node.children) walk(node.children, depth + 1);
        });
      }(tree.tree || [], 0));
      openModal({
        wide: true,
        title: 'ورود گروهی تست',
        body: `
          <div class="banner info" style="margin-bottom:.6rem"><div>
            هر سطر یک تست است. قالب: <span class="mono">گره ساختاری | شماره | پاسخ | سختی | مبحث‌ها | کد</span>.
            ستون‌های اختیاری را می‌توانید خالی بگذارید.</div></div>
          <form data-form="bulk">
            <div class="form-grid">
              <div class="field"><label>گره پیش‌فرض (برای سطرهای بدون گره)</label>
                <select name="default_node">${options(flat, '', { empty: '— بدون پیش‌فرض —' })}</select></div>
              <div class="field"><label>سختی پیش‌فرض</label><input name="default_difficulty" placeholder="متوسط"></div>
            </div>
            <div class="field" style="margin-top:.5rem"><label>سطرهای تست</label>
              <textarea name="lines" rows="8" class="mono" placeholder="فصل ۱ / 2. الگوها و روندها / 2-1 جدول تناوبی | 1 | 2 | متوسط | جدول تناوبی و آرایش الکترونی
فصل ۱ / آزمون چکاپ اول | 1 | 3 |  | رفتار عنصرها و شعاع اتمی"></textarea>
            </div>
            <div class="banner warn" style="margin-top:.6rem"><div>
              مسیر گره باید با «/» از هم جدا شود؛ اگر گره‌ای وجود نداشته باشد ساخته می‌شود.</div></div>
          </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ثبت همه</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const form = modal.querySelector('form');
            const data = Object.fromEntries(new FormData(form).entries());
            const rows = (data.lines || '').split('\n').map((line) => line.trim()).filter(Boolean)
              .map((line) => {
                const parts = line.split('|').map((part) => part.trim());
                return {
                  book_node_path: parts[0] || null,
                  book_node_id: parts[0] ? null : (data.default_node ? Number(data.default_node) : null),
                  display_number: parts[1] || null,
                  correct_answer: parts[2] || null,
                  publisher_difficulty: parts[3] || data.default_difficulty || null,
                  topic_paths: parts[4] || null,
                  code: parts[5] || null,
                };
              });
            if (!rows.length) { toast('سطری وارد نشده است', 'warn'); return; }
            try {
              const result = await api.post('/questions/bulk', {
                questions: rows.map((row) => ({
                  ...row, book_id: ctx.params.bookId,
                  topic_ids: [], book_node_path: row.book_node_path,
                })),
              });
              closeModal();
              toast(`ثبت شد: ${fa(result.created)} | خطا: ${fa(result.skipped)}`, result.skipped ? 'warn' : 'ok');
              if (result.errors && result.errors.length) {
                openModal({
                  title: 'سطرهای ثبت‌نشده',
                  body: `<div class="table-wrap"><table><thead><tr><th>سطر</th><th>داده</th><th>علت</th></tr></thead>
                    <tbody>${result.errors.map((row) => `<tr><td>${num(row.row)}</td>
                    <td class="small">${esc(row.data || '')}</td><td>${esc(row.error)}</td></tr>`).join('')}</tbody></table></div>`,
                });
              }
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },
  },

  async submit(name, form, ctx) {
    if (name === 'settings') {
      const data = Object.fromEntries(new FormData(form).entries());
      await api.put(`/books/${ctx.params.bookId}`, data);
      store.invalidateBookTree(ctx.params.bookId);
      toast('مشخصات کتاب ذخیره شد', 'ok');
      const { rerender } = await import('../app.js'); await rerender();
    }
  },

  inputs: {
    async search(element) {
      const term = element.value.trim();
      const bookId = window.location.hash.match(/\d+/)?.[0];
      const data = await api.get('/questions', {
        book_id: bookId, search: term || undefined, page_size: 200,
      });
      const container = document.getElementById('book-question-rows');
      if (!container) return;
      container.innerHTML = (data.items || []).map((row) => `
        <tr>
          <td class="mono">${esc(row.code)}</td>
          <td>${esc(row.display_number || '—')}</td>
          <td class="small">${esc(row.node_title || '—')}</td>
          <td class="small">${esc(row.topics || '—')}</td>
          <td>${esc(row.correct_answer || '—')}</td>
          <td>${esc(row.publisher_difficulty || '—')}</td>
          <td>${row.is_important ? '<span class="badge star">مهم</span>' : ''}
              ${row.is_hard ? '<span class="badge flag">سخت</span>' : ''}</td>
          <td>${num(row.attempt_count)}</td>
          <td>${resultBadge(row.last_result)}</td>
          <td class="actions"><button class="btn btn-sm" data-action="questionDetail" data-id="${row.id}">جزئیات</button></td>
        </tr>`).join('');
    },
  },
};

function openNodeForm({ bookId, parentId, node = null, title }) {
  openModal({
    title,
    body: `<form data-form="node">
      <div class="form-grid">
        <div class="field"><label>عنوان *</label>
          <input name="title" required value="${esc(node ? node.title : '')}" placeholder="فصل ۱ / 2. الگوها و روندها"></div>
        <div class="field"><label>نوع گره</label>
          <select name="node_type">${nodeTypeOptions(node ? node.node_type : 'section')}</select></div>
        <div class="field"><label>ترتیب</label>
          <input name="order_index" value="${node ? node.order_index : ''}" placeholder="خودکار"></div>
        <div class="field"><label>یادداشت</label><input name="notes" value="${esc(node ? node.notes || '' : '')}"></div>
      </div>
      <div class="banner info" style="margin-top:.6rem"><div>
        انواع «آزمون چکاپ»، «آزمون جامع»، «تست‌های مخلوط» و «کنکور» به‌عنوان گره ارزیابی ثبت می‌شوند.
      </div></div>
    </form>`,
    footer: `${node ? '<button class="btn btn-danger" data-delete>آرشیو گره</button>' : ''}
             <button class="btn" data-modal-close>انصراف</button>
             <button class="btn btn-primary" data-save>ذخیره</button>`,
    onMount(modal) {
      modal.querySelector('[data-save]').addEventListener('click', async () => {
        const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
        try {
          const payload = {
            book_id: bookId,
            parent_id: parentId,
            title: data.title,
            node_type: data.node_type,
            order_index: data.order_index || null,
            notes: data.notes || null,
          };
          if (node) await api.put(`/nodes/${node.id}`, payload);
          else await api.post(`/books/${bookId}/nodes`, payload);
          store.invalidateBookTree(bookId);
          closeModal();
          toast('ساختار ذخیره شد', 'ok');
          const { rerender } = await import('../app.js'); await rerender();
        } catch (error) { notifyError(error); }
      });
      const removeButton = modal.querySelector('[data-delete]');
      if (removeButton) {
        removeButton.addEventListener('click', async () => {
          try {
            const result = await api.del(`/nodes/${node.id}`);
            closeModal();
            store.invalidateBookTree(bookId);
            toast(result.archived ? 'گره آرشیو شد (سابقه حفظ شد)' : 'گره حذف شد', 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          } catch (error) { notifyError(error); }
        });
      }
    },
  });
}
