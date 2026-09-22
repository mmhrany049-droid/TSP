/* جزئیات آزمون — سؤال‌ها، مبحث‌ها، فایل سؤال و اجرای آزمون */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, emptyState, esc, fa, notifyError, num, openModal, options, pct, resultBadge, toast } from '../ui.js';

export default {
  title: 'آزمون',
  subtitle: 'تعریف سؤال‌ها، مبحث‌ها، فایل سؤال و اجرای مستقل آزمون',

  async render({ params }) {
    const exam = await api.get(`/exams/${params.examId}`);
    const tree = await api.get('/topics/tree', { subject_id: store.activeSubjectId() || '' });
    const flat = [];
    (function walk(nodes, depth) {
      nodes.forEach((node) => {
        flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}` });
        if (node.children) walk(node.children, depth + 1);
      });
    }(tree.items || [], 0));

    const questionRows = (exam.questions || []).map((row, index) => `
      <tr>
        <td>${num(index + 1)}</td>
        <td>${row.code ? `<span class="mono">${esc(row.code)}</span>` : '<span class="badge warn">سؤال دستی</span>'}</td>
        <td>${esc(row.display_number || '—')}</td>
        <td>${esc(row.correct_answer || '—')}</td>
        <td class="small">${esc(row.topic_title || '—')}</td>
        <td class="small">${esc(row.book_title || '—')}</td>
        <td>${num(row.points)}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="editQuestion" data-id="${row.id}"
            data-answer="${esc(row.correct_answer || '')}" data-points="${row.points}">ویرایش</button>
          <button class="btn btn-sm btn-danger" data-action="removeQuestion" data-id="${row.id}">حذف</button>
        </td>
      </tr>`).join('');

    const topicRows = (exam.topics || []).map((topic) => `
      <tr><td>${esc(topic.path || topic.title)}</td><td>${num(topic.weight)}</td>
      <td class="actions"><button class="btn btn-sm" data-action="addFromTopic"
        data-topic="${topic.id}" data-title="${esc(topic.title)}">افزودن سؤال از این مبحث</button></td></tr>`).join('');

    const assetRows = (exam.assets || []).map((asset) => `
      <tr>
        <td>${esc(asset.original_name || asset.file_path)}</td>
        <td><span class="badge">${esc(asset.file_type)}</span></td>
        <td>${num(asset.byte_size ? Math.round(asset.byte_size / 1024) : 0)} کیلوبایت</td>
        <td class="actions">
          <a class="btn btn-sm" target="_blank" href="${api.fileUrl(`/files/${asset.id}`)}">نمایش</a>
          <a class="btn btn-sm" href="${api.fileUrl(`/files/${asset.id}`, { download: 1 })}">دریافت</a>
          <button class="btn btn-sm btn-danger" data-action="deleteAsset" data-id="${asset.id}">حذف</button>
        </td>
      </tr>`).join('');

    const attemptRows = (exam.attempts || []).map((attempt) => `
      <tr>
        <td>${num(attempt.id)}</td>
        <td>${attempt.score_percent === null ? 'در جریان' : pct(attempt.score_percent)}</td>
        <td>${num(attempt.correct_count)} / ${num(attempt.incorrect_count)} / ${num(attempt.unanswered_count)}</td>
        <td class="tiny">${esc((attempt.finished_at || attempt.started_at || '').slice(0, 16))}</td>
        <td><span class="badge">${attempt.state === 'finished' ? 'پایان‌یافته' : attempt.state === 'running' ? 'در جریان' : 'آرشیو'}</span></td>
        <td class="actions">
          <a class="btn btn-sm" href="#/exams/${exam.id}/attempt/${attempt.id}">
            ${attempt.state === 'finished' ? 'نتیجه' : 'ادامه اجرا'}</a>
        </td>
      </tr>`).join('');

    return `
      <div class="page-head">
        <div><h2>${esc(exam.title)}</h2>
          <p class="muted small">${esc(exam.subject_name || 'بدون درس')} —
          ${esc((store.state.labels.exam_type || {})[exam.exam_type] || exam.exam_type)}
          ${exam.planned_date ? ` — تاریخ: ${esc(exam.planned_date)}` : ''}</p></div>
        <div class="actions">
          <a class="btn btn-sm" href="#/exams">فهرست آزمون‌ها</a>
          <button class="btn btn-sm" data-action="editExam">ویرایش آزمون</button>
          <button class="btn btn-sm btn-primary" data-action="startAttempt">شروع اجرای جدید</button>
        </div>
      </div>

      <div class="grid cols-4">
        <div class="stat"><span class="label">سؤال‌ها</span><div class="value">${num(exam.questions.length)}</div></div>
        <div class="stat"><span class="label">مباحث</span><div class="value">${num(exam.topics.length)}</div></div>
        <div class="stat"><span class="label">اجراها</span><div class="value">${num(exam.summary.attempt_count)}</div></div>
        <div class="stat ${exam.summary.trend === 'up' ? 'ok' : exam.summary.trend === 'down' ? 'warn' : ''}">
          <span class="label">آخرین درصد</span>
          <div class="value">${exam.summary.last_score === null ? '—' : pct(exam.summary.last_score)}</div>
          <span class="hint">بهترین: ${exam.summary.best_score === null ? '—' : pct(exam.summary.best_score)}</span></div>
      </div>
      <div class="spacer"></div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>سؤال‌های آزمون</h2>
            <div class="actions">
              <button class="btn btn-sm" data-action="addFromBank">افزودن از بانک تست</button>
              <button class="btn btn-sm" data-action="addManual">سؤال دستی (بدون بانک)</button>
            </div></div>
          ${questionRows ? `<div class="table-wrap" style="max-height:60vh;overflow:auto"><table>
            <thead><tr><th>#</th><th>کد</th><th>شماره</th><th>کلید</th><th>مبحث</th><th>کتاب</th><th>بارم</th><th></th></tr></thead>
            <tbody>${questionRows}</tbody></table></div>`
            : emptyState('سؤالی اضافه نشده است', 'از بانک تست، از یک مبحث، یا به‌صورت دستی سؤال اضافه کنید.')}
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-head"><h2>مباحث آزمون</h2>
              <div class="actions"><button class="btn btn-sm" data-action="editTopics">ویرایش مباحث</button></div></div>
            ${topicRows ? `<div class="table-wrap"><table>
              <thead><tr><th>مبحث</th><th>وزن</th><th></th></tr></thead><tbody>${topicRows}</tbody></table></div>`
              : '<p class="muted small">مبحثی انتخاب نشده است.</p>'}
          </div>
          <div class="card">
            <div class="card-head"><h2>فایل سؤال (PDF یا تصویر)</h2></div>
            <form data-form="asset">
              <div class="field"><label>انتخاب فایل</label><input type="file" name="file" accept=".pdf,image/*"></div>
              <div class="spacer"></div>
              <button class="btn" type="submit">بارگذاری</button>
            </form>
            <div class="spacer"></div>
            ${assetRows ? `<div class="table-wrap"><table>
              <thead><tr><th>فایل</th><th>نوع</th><th>حجم</th><th></th></tr></thead><tbody>${assetRows}</tbody></table></div>`
              : '<p class="muted small">فایلی بارگذاری نشده است.</p>'}
          </div>
        </div>
      </div>
      <div class="spacer"></div>

      <div class="card">
        <div class="card-head"><h2>سابقه اجراهای آزمون</h2>
          <div class="actions"><button class="btn btn-sm btn-primary" data-action="startAttempt">اجرای جدید</button></div></div>
        ${attemptRows ? `<div class="table-wrap"><table>
          <thead><tr><th>اجرا</th><th>درصد</th><th>درست/غلط/بی‌پاسخ</th><th>زمان</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>${attemptRows}</tbody></table></div>`
          : '<p class="muted small">هنوز اجرایی ثبت نشده است.</p>'}
        <div class="spacer"></div>
        <div class="banner info"><div>
          هر اجرا مستقل است: با اجرای جدید، نتایج قبلی دست‌نخورده می‌ماند.
          پاسخ‌های آزمون با منبع «آزمون» در سابقه بانک تست هم ثبت می‌شوند.</div></div>
      </div>`;
  },

  actions: {
    async startAttempt(element, ctx) {
      const attempt = await api.post(`/exams/${ctx.params.examId}/attempts`, {});
      window.location.hash = `#/exams/${ctx.params.examId}/attempt/${attempt.id}`;
    },

    async editExam(element, ctx) {
      const exam = await api.get(`/exams/${ctx.params.examId}`);
      openModal({
        title: 'ویرایش آزمون',
        body: `<form data-form="exam">
          <div class="form-grid">
            <div class="field"><label>عنوان</label><input name="title" value="${esc(exam.title)}"></div>
            <div class="field"><label>نوع</label><select name="exam_type">
              ${['single_subject', 'mock_multi_subject', 'book_assessment', 'other'].map((type) =>
                `<option value="${type}" ${exam.exam_type === type ? 'selected' : ''}>${esc((store.state.labels.exam_type || {})[type] || type)}</option>`).join('')}
            </select></div>
            <div class="field"><label>وضعیت</label><select name="status">
              ${['planned', 'ready', 'held', 'analyzed', 'archived'].map((status) =>
                `<option value="${status}" ${exam.status === status ? 'selected' : ''}>${esc((store.state.labels.exam_state || {})[status] || status)}</option>`).join('')}
            </select></div>
            <div class="field"><label>تاریخ</label><input name="planned_date" value="${esc(exam.planned_date || '')}"></div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label>
            <textarea name="notes" rows="2">${esc(exam.notes || '')}</textarea></div>
        </form>`,
        footer: `<button class="btn btn-danger" data-archive>آرشیو آزمون</button>
                 <button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            try {
              await api.put(`/exams/${exam.id}`, data);
              closeModal(); toast('ذخیره شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
          modal.querySelector('[data-archive]').addEventListener('click', async () => {
            const result = await api.del(`/exams/${exam.id}`);
            closeModal();
            toast(`آزمون آرشیو شد — ${fa(result.attempts_kept)} اجرا حفظ شد`, 'ok');
            window.location.hash = '#/exams';
          });
        },
      });
    },

    async editTopics(element, ctx) {
      const exam = await api.get(`/exams/${ctx.params.examId}`);
      const tree = await api.get('/topics/tree', { subject_id: store.activeSubjectId() || '' });
      const flat = [];
      (function walk(nodes, depth) {
        nodes.forEach((node) => {
          flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}` });
          if (node.children) walk(node.children, depth + 1);
        });
      }(tree.items || [], 0));
      const selected = exam.topics.map((topic) => topic.id);
      openModal({
        title: 'مباحث آزمون',
        body: `<form data-form="topics">
          <div class="field"><label>مباحث (چند انتخاب با Ctrl)</label>
            <select name="topic_ids" multiple size="10">
              ${flat.map((option) => `<option value="${option.id}" ${selected.includes(option.id) ? 'selected' : ''}>${esc(option.title)}</option>`).join('')}
            </select></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const form = modal.querySelector('form');
            const ids = Array.from(form.querySelector('[name=topic_ids]').selectedOptions)
              .map((option) => Number(option.value));
            await api.put(`/exams/${exam.id}/topics`, { topics: ids.map((id) => ({ topic_id: id })) });
            closeModal(); toast('مباحث ذخیره شد', 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          });
        },
      });
    },

    async addFromBank(element, ctx) {
      const examId = ctx.params.examId;
      const data = await api.get('/questions', { page_size: 200, subject_id: store.activeSubjectId() || '' });
      openModal({
        wide: true,
        title: 'افزودن سؤال از بانک تست',
        body: `<form data-form="bank">
          <div class="field"><label>جست‌وجو</label><input id="exam-q-search" placeholder="کد، شماره، مبحث"></div>
          <div class="table-wrap" style="max-height:55vh;overflow:auto;margin-top:.5rem"><table>
            <thead><tr><th></th><th>کد</th><th>شماره</th><th>کتاب</th><th>محل</th><th>کلید</th></tr></thead>
            <tbody>${(data.items || []).map((row) => `<tr>
              <td><input type="checkbox" name="picked" value="${row.id}"></td>
              <td class="mono">${esc(row.code)}</td><td>${esc(row.display_number || '—')}</td>
              <td class="small">${esc(row.book_title || '')}</td><td class="small">${esc(row.node_title || '')}</td>
              <td>${esc(row.correct_answer || '—')}</td></tr>`).join('')}</tbody></table></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>افزودن انتخاب‌شده‌ها</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const picked = Array.from(modal.querySelectorAll('input[name=picked]:checked'))
              .map((input) => Number(input.value));
            if (!picked.length) { toast('سؤالی انتخاب نشده است', 'warn'); return; }
            await api.post(`/exams/${examId}/questions`,
              { questions: picked.map((id) => ({ question_id: id })) });
            closeModal(); toast(`${fa(picked.length)} سؤال اضافه شد`, 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          });
        },
      });
    },

    async addFromTopic(element, ctx) {
      openModal({
        title: `افزودن سؤال از مبحث: ${element.dataset.title}`,
        body: `<form data-form="fromtopic">
          <div class="form-grid">
            <div class="field"><label>تعداد</label><input name="limit" type="number" value="10" min="1" max="200"></div>
            <div class="field"><label>معیار انتخاب</label><select name="strategy">
              <option value="untried">تست‌های حل‌نشده</option>
              <option value="important">تست‌های مهم</option>
              <option value="incorrect">تست‌های غلط</option>
            </select></div>
          </div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>افزودن</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            try {
              const result = await api.post(`/exams/${ctx.params.examId}/questions/from-topic`, {
                topic_id: Number(element.dataset.topic), limit: Number(data.limit),
                strategy: data.strategy,
              });
              closeModal(); toast(`${fa(result.created)} سؤال اضافه شد`, 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },

    async addManual(element, ctx) {
      openModal({
        title: 'افزودن سؤال دستی',
        body: `<form data-form="manual">
          <p class="muted small">برای سؤال‌هایی که در بانک تست ثبت نشده‌اند؛ نتیجه با کلید وارد‌شده سنجیده می‌شود.</p>
          <div class="form-grid">
            <div class="field"><label>شماره سؤال *</label><input name="display_number" required></div>
            <div class="field"><label>کلید پاسخ</label><input name="correct_answer"></div>
            <div class="field"><label>بارم</label><input name="points" type="number" step="0.25" value="1"></div>
          </div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>افزودن</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            await api.post(`/exams/${ctx.params.examId}/questions`, {
              questions: [{ display_number: data.display_number,
                correct_answer: data.correct_answer || null, points: Number(data.points) }],
            });
            closeModal(); toast('سؤال اضافه شد', 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          });
        },
      });
    },

    async editQuestion(element) {
      openModal({
        title: 'ویرایش سؤال آزمون',
        body: `<form data-form="eq">
          <div class="form-grid">
            <div class="field"><label>کلید پاسخ</label><input name="correct_answer" value="${esc(element.dataset.answer)}"></div>
            <div class="field"><label>بارم</label><input name="points" type="number" step="0.25" value="${esc(element.dataset.points)}"></div>
          </div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            await api.patch(`/exam-questions/${element.dataset.id}`, {
              correct_answer: data.correct_answer, points: Number(data.points),
            });
            closeModal(); toast('ذخیره شد', 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          });
        },
      });
    },

    async removeQuestion(element) {
      try {
        await api.del(`/exam-questions/${element.dataset.id}`);
        toast('سؤال از آزمون حذف شد', 'ok');
        const { rerender } = await import('../app.js'); await rerender();
      } catch (error) { notifyError(error); }
    },

    async deleteAsset(element) {
      await api.del(`/exam-assets/${element.dataset.id}`);
      toast('فایل حذف شد', 'ok');
      const { rerender } = await import('../app.js'); await rerender();
    },
  },

  async submit(name, form, ctx) {
    if (name === 'asset') {
      const input = form.querySelector('input[type=file]');
      if (!input.files || !input.files[0]) { toast('فایلی انتخاب نشده است', 'warn'); return; }
      await api.upload(`/exams/${ctx.params.examId}/assets`, input.files[0]);
      toast('فایل بارگذاری شد', 'ok');
      const { rerender } = await import('../app.js'); await rerender();
    }
  },
};
