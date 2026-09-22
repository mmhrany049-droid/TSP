/* ثبت سریع سؤال — ثبت تلاش جدید یا سابقه تست‌های قبلاً حل‌شده */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, esc, fa, notifyError, num, openModal, options, resultBadge, toast } from '../ui.js';

/* فرم مشترک: هم در صفحه و هم در مودال استفاده می‌شود */
export async function renderQuickEntryForm(ctx, { compact = false } = {}) {
  const books = store.state.books.length ? store.state.books : await store.loadBooks();
  const topics = store.state.topicTree.length ? store.state.topicTree : await store.loadTopics();
  const flat = [];
  (function walk(nodes, depth) {
    nodes.forEach((node) => {
      flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}` });
      if (node.children) walk(node.children, depth + 1);
    });
  }(topics, 0));
  const now = new Date();
  const localNow = `${fa(now.getFullYear())}/${fa(String(now.getMonth() + 1).padStart(2, '0'))}/${fa(String(now.getDate()).padStart(2, '0'))} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return `
    <form data-form="quick">
      <div class="banner info" style="margin-bottom:.7rem">
        <div>کد تست را وارد کنید (مانند <span class="mono">Q-000012</span>) یا کتاب و محل تست را انتخاب کنید.
        برای ثبت سابقه‌های قدیمی، گزینه «سابقه قبلی» را بزنید.</div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>کد تست (شناسه داخلی)</label>
          <input name="code" placeholder="Q-000012" class="mono" autofocus>
        </div>
        <div class="field">
          <label>یا شماره نمایشی + کتاب</label>
          <input name="display_number" placeholder="17">
        </div>
        <div class="field">
          <label>کتاب</label>
          <select name="book_id" data-change="book">${options(books, '', { empty: '— انتخاب کتاب —' })}</select>
        </div>
        <div class="field">
          <label>محل در ساختار کتاب</label>
          <select name="book_node_id" id="quick-node">${options([], '', { empty: 'ابتدا کتاب را انتخاب کنید' })}</select>
        </div>
      </div>
      <div class="spacer"></div>
      <div class="form-grid">
        <div class="field">
          <label>پاسخ کاربر</label>
          <input name="user_answer" placeholder="مثلاً 3">
        </div>
        <div class="field">
          <label>نتیجه</label>
          <select name="result">
            <option value="">خودکار از مقایسه با کلید</option>
            <option value="correct">درست</option>
            <option value="incorrect">غلط</option>
            <option value="unanswered">بی‌پاسخ</option>
          </select>
        </div>
        <div class="field">
          <label>زمان صرف‌شده (ثانیه یا mm:ss)</label>
          <input name="spent_seconds" placeholder="45 یا 01:30">
        </div>
        <div class="field">
          <label>${compact ? 'وضعیت' : 'نوع ثبت'}</label>
          <select name="kind">
            <option value="new">تلاش جدید (نیازمند تاریخ)</option>
            <option value="previous">سابقه قبلی حل‌شده (بدون تاریخ)</option>
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>تاریخ و ساعت تلاش جدید (شمسی یا میلادی)</label>
          <input name="attempted_at" value="${localNow}" placeholder="1404/06/31 14:30">
          <span class="help">اگر خالی بماند، زمان فعلی ثبت می‌شود.</span>
        </div>
        <div class="field">
          <label>مبحث (برای تست‌های بدون مبحث)</label>
          <select name="topic_id">${options(flat, '', { empty: '— بدون تغییر —' })}</select>
        </div>
        <div class="field" style="align-self:end">
          <label class="check"><input type="checkbox" name="important"> علامت مهم</label>
          <label class="check"><input type="checkbox" name="hard"> علامت سخت</label>
        </div>
      </div>
      <div class="field" style="margin-top:.6rem">
        <label>یادداشت</label>
        <textarea name="notes" rows="2" placeholder="اختیاری"></textarea>
      </div>
    </form>`;
}

export async function submitQuickEntry(form, ctx) {
  const data = Object.fromEntries(new FormData(form).entries());
  const code = (data.code || '').trim();
  const kind = data.kind || 'new';

  let questionId = null;
  if (code) {
    const found = await api.get('/questions', { search: code, page_size: 1 });
    const match = (found.items || []).find((item) => item.code === code) || (found.items || [])[0];
    if (!match) throw new Error(`تستی با کد «${code}» یافت نشد`);
    questionId = match.id;
  } else if (data.book_node_id) {
    // ایجاد سریع تست در محل انتخاب‌شده
    const created = await api.post('/questions', {
      book_node_id: Number(data.book_node_id),
      display_number: data.display_number || null,
      correct_answer: null,
      topic_id: data.topic_id ? Number(data.topic_id) : null,
      topic_ids: data.topic_id ? [Number(data.topic_id)] : [],
      important: !!data.important,
      hard: !!data.hard,
    });
    questionId = created.id;
    if (!data.result && !data.user_answer) {
      toast('تست جدید ساخته شد؛ برای مقایسه خودکار پاسخ، کلید تست را ثبت کنید', 'warn');
    }
  } else {
    throw new Error('کد تست یا محل تست را مشخص کنید');
  }

  const payload = {
    question_id: questionId,
    user_answer: data.user_answer || null,
    result: data.result || null,
    spent_seconds: data.spent_seconds || null,
    notes: data.notes || null,
  };

  if (kind === 'previous') {
    const response = await api.post('/previous-entries', {
      entries: [payload],
      label: 'ثبت سریع سابقه قبلی',
      note: 'از فرم ثبت سریع',
    });
    if (response.skipped) throw new Error(response.errors?.[0]?.error || 'ثبت انجام نشد');
    return response;
  }
  payload.attempted_at = data.attempted_at || null;
  payload.source = 'app';
  return api.post('/attempts', payload);
}

export default {
  title: 'ثبت سریع سؤال',
  subtitle: 'ثبت تلاش جدید یا وارد کردن حل‌های قدیمی، با حفظ کامل سابقه',

  async render() {
    const form = await renderQuickEntryForm({});
    const recent = await api.get('/attempts', { page_size: 8 });
    const previous = await api.get('/previous-entries', { page_size: 5 });
    const labels = store.state.labels.result || {};

    const rows = (recent.items || []).map((row) => `
      <tr>
        <td class="mono">${esc(row.code)}</td>
        <td>${esc(row.book_title || '—')}</td>
        <td>${esc(row.display_number || '—')}</td>
        <td>${esc(row.user_answer || '—')}</td>
        <td>${resultBadge(row.result)}</td>
        <td>${num(row.spent_seconds ? `${row.spent_seconds} ثانیه` : '—')}</td>
        <td class="tiny">${esc(row.attempted_at || '')}</td>
      </tr>`).join('');

    const prevRows = (previous.items || []).map((row) => `
      <tr>
        <td class="mono">${esc(row.code)}</td>
        <td>${esc(row.user_answer || '—')}</td>
        <td>${resultBadge(row.result)}</td>
        <td class="tiny">${esc(row.batch_label || '—')}</td>
      </tr>`).join('');

    return `
      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>فرم ثبت</h2>
            <div class="actions"><button class="btn btn-primary btn-sm" data-action="save">ثبت</button></div></div>
          ${form}
          <div class="spacer"></div>
          <button class="btn btn-primary btn-block" data-action="save">ثبت در سابقه</button>
          <p class="muted tiny" style="margin-top:.5rem">
            «تلاش جدید» همیشه یک رکورد تازه می‌سازد و رکوردهای قبلی را تغییر نمی‌دهد.
            «سابقه قبلی» برای حل‌های پیش از استفاده از برنامه است و تاریخ برای آن اجباری نیست.</p>
        </div>
        <div class="card">
          <div class="card-head"><h2>ثبت گروهی از متن</h2></div>
          <p class="small muted">هر سطر یک تست: <span class="mono">کد تست = پاسخ</span> یا
          <span class="mono">کد تست = پاسخ , درست/غلط/بی‌پاسخ</span></p>
          <form data-form="bulk">
            <div class="field">
              <textarea name="lines" rows="7" class="mono" placeholder="Q-000001 = 2
Q-000002 = 3, incorrect
Q-000003 = , unanswered"></textarea>
            </div>
            <div class="form-grid">
              <div class="field">
                <label>نوع ثبت</label>
                <select name="kind">
                  <option value="new">تلاش جدید</option>
                  <option value="previous">سابقه قبلی</option>
                </select>
              </div>
              <div class="field">
                <label>تاریخ مشترک (برای تلاش جدید)</label>
                <input name="attempted_at" placeholder="خالی = همین حالا">
              </div>
            </div>
            <div class="spacer"></div>
            <button class="btn" type="submit">ثبت گروهی</button>
          </form>
          <div class="spacer"></div>
          <div class="banner info"><div>
            جدول‌های زیر آخرین رکوردهای ثبت‌شده را نشان می‌دهند؛ هیچ رکوردی در این فرم جایگزین نمی‌شود.
          </div></div>
        </div>
      </div>
      <div class="spacer"></div>
      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>آخرین تلاش‌ها</h2>
            <div class="actions"><a class="btn btn-sm" href="#/history">همه سابقه</a></div></div>
          ${rows ? `<div class="table-wrap"><table>
            <thead><tr><th>کد</th><th>کتاب</th><th>شماره</th><th>پاسخ</th><th>نتیجه</th><th>زمان</th><th>تاریخ</th></tr></thead>
            <tbody>${rows}</tbody></table></div>` : '<p class="muted small">هنوز تلاشی ثبت نشده است.</p>'}
        </div>
        <div class="card">
          <div class="card-head"><h2>آخرین سابقه‌های قبلی</h2>
            <div class="actions"><a class="btn btn-sm" href="#/history?tab=previous">مدیریت</a></div></div>
          ${prevRows ? `<div class="table-wrap"><table>
            <thead><tr><th>کد</th><th>پاسخ</th><th>نتیجه</th><th>دسته ورود</th></tr></thead>
            <tbody>${prevRows}</tbody></table></div>` : '<p class="muted small">سابقه قبلی‌ای ثبت نشده است.</p>'}
        </div>
      </div>`;
  },

  changes: {
    async book(element) {
      const select = element.closest('form').querySelector('#quick-node');
      const bookId = element.value;
      if (!bookId) {
        select.innerHTML = '<option value="">ابتدا کتاب را انتخاب کنید</option>';
        return;
      }
      const tree = await api.get(`/books/${bookId}/tree`);
      const flat = [];
      (function walk(nodes, depth) {
        nodes.forEach((node) => {
          const type = (store.state.labels.node_type || {})[node.node_type] || node.node_type;
          flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title} (${type})` });
          if (node.children) walk(node.children, depth + 1);
        });
      }(tree.tree || [], 0));
      select.innerHTML = options(flat, '', { empty: '— انتخاب محل —' });
    },
  },

  actions: {
    async save(element) {
      const card = element.closest('.card');
      const form = card.querySelector('form[data-form="quick"]');
      const result = await submitQuickEntry(form, {});
      toast('ثبت انجام شد', 'ok');
      const { rerender } = await import('../app.js');
      await rerender();
    },
  },

  async submit(name, form) {
    if (name === 'quick') {
      await submitQuickEntry(form, {});
      toast('ثبت انجام شد', 'ok');
      const { rerender } = await import('../app.js');
      await rerender();
      return;
    }
    if (name === 'bulk') {
      const data = Object.fromEntries(new FormData(form).entries());
      const entries = [];
      const errors = [];
      (data.lines || '').split('\n').forEach((line, index) => {
        const text = line.trim();
        if (!text) return;
        const [left, right = ''] = text.split('=');
        const code = (left || '').trim();
        if (!code) { errors.push(`سطر ${index + 1}: کد تست خالی است`); return; }
        const [answerRaw, resultRaw] = right.split(',');
        const userAnswer = (answerRaw || '').trim() || null;
        let result = (resultRaw || '').trim();
        if (!['correct', 'incorrect', 'unanswered'].includes(result)) result = null;
        if (!userAnswer && !result) result = 'unanswered';
        entries.push({ code, user_answer: userAnswer, result });
      });
      if (!entries.length) throw new Error(errors[0] || 'سطری برای ثبت پیدا نشد');

      let response;
      if (data.kind === 'previous') {
        response = await api.post('/previous-entries', {
          entries, label: 'ثبت گروهی سابقه قبلی', note: 'از فرم ثبت گروهی',
        });
      } else {
        response = await api.post('/attempts/bulk', {
          attempts: entries, attempted_at: data.attempted_at || null, source: 'app',
        });
      }
      const skipped = response.skipped || 0;
      toast(`ثبت شد: ${fa(response.created)} | رد‌شده: ${fa(skipped)}`, skipped ? 'warn' : 'ok');
      if (response.errors && response.errors.length) {
        openModal({
          title: 'سطرهای ثبت‌نشده',
          body: `<div class="table-wrap"><table><thead><tr><th>#</th><th>کد</th><th>علت</th></tr></thead>
            <tbody>${response.errors.map((row) => `<tr><td>${num(row.row)}</td>
              <td class="mono">${esc(row.code || '—')}</td><td>${esc(row.error)}</td></tr>`).join('')}</tbody>
            </table></div>`,
        });
      }
      const { rerender } = await import('../app.js');
      await rerender();
      return response;
    }
  },
};
