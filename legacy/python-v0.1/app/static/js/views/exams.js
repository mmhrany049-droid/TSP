/* آزمون‌ها — فهرست آزمون‌ها، ساخت آزمون تک‌درس و آزمایشی چنددرس */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, emptyState, esc, fa, notifyError, num, openModal, options, pct, resultBadge, toast } from '../ui.js';

export default {
  title: 'آزمون‌ها',
  subtitle: 'آزمون تک‌درس و آزمایشی چنددرس، با امکان چند اجرای مستقل برای هر آزمون',

  async render() {
    const data = await api.get('/exams', { page_size: 100 });
    const attempts = await api.get('/exam-attempts', { page_size: 10 });

    const examRows = (data.items || []).map((exam) => `
      <tr>
        <td><a href="#/exams/${exam.id}">${esc(exam.title)}</a>
          <div class="muted tiny">${esc(exam.subject_name || 'بدون درس')}</div></td>
        <td><span class="badge">${esc((store.state.labels.exam_type || {})[exam.exam_type] || exam.exam_type)}</span></td>
        <td><span class="badge ${exam.status === 'planned' ? 'primary' : exam.status === 'held' ? 'ok' : ''}">
          ${esc((store.state.labels.exam_state || {})[exam.status] || exam.status)}</span></td>
        <td class="tiny">${esc(exam.planned_date || '—')}</td>
        <td>${num(exam.question_count)}</td>
        <td>${num(exam.topic_count)}</td>
        <td>${num(exam.attempt_count)}${exam.last_score !== null && exam.last_score !== undefined
          ? ` <span class="badge ${exam.last_score >= 70 ? 'ok' : 'warn'}">${pct(exam.last_score)}</span>` : ''}</td>
        <td>${num(exam.asset_count)} فایل</td>
        <td class="actions">
          <a class="btn btn-sm btn-primary" href="#/exams/${exam.id}">مدیریت و اجرا</a>
        </td>
      </tr>`).join('');

    const attemptRows = (attempts.items || []).map((row) => `
      <tr>
        <td><a href="#/exams/${row.exam_id}">${esc(row.exam_title)}</a></td>
        <td>${num(row.id)}</td>
        <td>${row.score_percent === null || row.score_percent === undefined ? '—' : pct(row.score_percent)}</td>
        <td>${resultBadge(row.correct_count > row.incorrect_count ? 'correct' : 'incorrect')}</td>
        <td class="tiny">${esc((row.finished_at || row.started_at || '').slice(0, 16))}</td>
        <td><span class="badge">${row.state === 'finished' ? 'پایان‌یافته' : row.state === 'running' ? 'در جریان' : 'آرشیو'}</span></td>
        <td class="actions">
          <a class="btn btn-sm" href="#/exams/${row.exam_id}/attempt/${row.id}">مشاهده اجرا</a>
        </td>
      </tr>`).join('');

    return `
      <div class="page-head">
        <div><h2>${num(data.total)} آزمون</h2>
          <p class="muted small">هر اجرا یک ExamAttempt مستقل است و سابقه اجراهای قبلی حفظ می‌شود.</p></div>
        <div class="actions">
          <button class="btn btn-primary" data-action="addExam">آزمون جدید</button>
        </div>
      </div>
      <div class="card">
        ${examRows ? `<div class="table-wrap"><table>
          <thead><tr><th>عنوان</th><th>نوع</th><th>وضعیت</th><th>تاریخ</th><th>سؤال</th><th>مبحث</th>
          <th>اجرا</th><th>فایل</th><th></th></tr></thead><tbody>${examRows}</tbody></table></div>`
          : emptyState('آزمونی ثبت نشده است', 'یک آزمون بسازید یا از دل کتاب سؤال‌های آن را اضافه کنید.')}
      </div>
      <div class="spacer"></div>
      <div class="card">
        <div class="card-head"><h2>آخرین اجراها</h2>
          <div class="actions"><a class="btn btn-sm" href="#/analytics">تحلیل عملکرد آزمون‌ها</a></div></div>
        ${attemptRows ? `<div class="table-wrap"><table>
          <thead><tr><th>آزمون</th><th>اجرا</th><th>درصد</th><th></th><th>زمان</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>${attemptRows}</tbody></table></div>` : '<p class="muted small">اجرایی ثبت نشده است.</p>'}
      </div>`;
  },

  actions: {
    async addExam() {
      const subjects = store.state.subjects.length ? store.state.subjects : await store.loadSubjects();
      const tree = await api.get('/topics/tree', { subject_id: store.activeSubjectId() || '' });
      const flat = [];
      (function walk(nodes, depth) {
        nodes.forEach((node) => {
          flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}` });
          if (node.children) walk(node.children, depth + 1);
        });
      }(tree.items || [], 0));
      openModal({
        wide: true,
        title: 'ساخت آزمون جدید',
        body: `<form data-form="exam">
          <div class="form-grid">
            <div class="field"><label>عنوان *</label><input name="title" required placeholder="آزمون آزمایشی مهر - شیمی"></div>
            <div class="field"><label>نوع آزمون</label><select name="exam_type">
              <option value="single_subject">آزمون تک‌درس</option>
              <option value="mock_multi_subject">آزمون آزمایشی چنددرس/چندمبحث</option>
              <option value="book_assessment">آزمون داخل کتاب</option>
              <option value="other">سایر</option></select></div>
            <div class="field"><label>درس</label>
              <select name="subject_id">${options(subjects, store.activeSubjectId(), { empty: '— بدون درس —' })}</select></div>
            <div class="field"><label>تاریخ برنامه‌ریزی‌شده</label><input name="planned_date" placeholder="1404/07/15"></div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>مباحث آزمون (چند انتخاب با Ctrl)</label>
            <select name="topic_ids" multiple size="6">${options(flat, '')}</select></div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label><textarea name="notes" rows="2"></textarea></div>
          <div class="banner info" style="margin-top:.6rem"><div>
            فایل سؤال (PDF یا تصویر) را پس از ساخت آزمون، در صفحه آزمون بارگذاری کنید.</div></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ساخت آزمون</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const form = modal.querySelector('form');
            const data = Object.fromEntries(new FormData(form).entries());
            const topicIds = Array.from(form.querySelector('[name=topic_ids]').selectedOptions)
              .map((option) => Number(option.value));
            try {
              const exam = await api.post('/exams', {
                title: data.title, exam_type: data.exam_type,
                subject_id: data.subject_id ? Number(data.subject_id) : null,
                planned_date: data.planned_date || null, notes: data.notes || null,
                topic_ids: topicIds,
              });
              closeModal();
              toast('آزمون ساخته شد', 'ok');
              window.location.hash = `#/exams/${exam.id}`;
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },
  },
};
