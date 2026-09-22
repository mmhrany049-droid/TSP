/* اجرای آزمون — پاسخ‌دهی به سؤال‌ها، ثبت نتیجه و تحلیل اجرا */

import { api } from '../api.js';
import * as store from '../store.js';
import { esc, fa, notifyError, num, pct, resultBadge, toast, meter } from '../ui.js';

const answers = {};

export default {
  title: 'اجرای آزمون',
  subtitle: 'پاسخ‌های این اجرا مستقل ذخیره می‌شود و با اجراهای قبلی ادغام نمی‌شود',

  async render({ params }) {
    const attempt = await api.get(`/exam-attempts/${params.attemptId}`);
    const finished = attempt.state === 'finished';
    Object.keys(answers).forEach((key) => delete answers[key]);
    (attempt.answers || []).forEach((answer) => {
      answers[answer.exam_question_id] = answer.user_answer || '';
    });

    const rows = (attempt.answers.length ? attempt.answers : []).map((answer, index) => `
      <tr data-eq="${answer.exam_question_id}">
        <td>${num(index + 1)}</td>
        <td>${answer.code ? `<span class="mono">${esc(answer.code)}</span>` : '<span class="badge">دستی</span>'}</td>
        <td>${esc(answer.display_number || '—')}</td>
        <td class="small">${esc(answer.topic_title || '—')}</td>
        <td>${finished ? esc(answer.user_answer || '—') : `
          <div class="answer-options" data-options="${answer.exam_question_id}">
            ${['1', '2', '3', '4'].map((choice) => `
              <button class="${answers[answer.exam_question_id] === choice ? 'on' : ''}"
                data-action="pick" data-eq="${answer.exam_question_id}" data-value="${choice}">${fa(choice)}</button>`).join('')}
            <button class="${answers[answer.exam_question_id] === '' ? 'on' : ''}"
              data-action="pick" data-eq="${answer.exam_question_id}" data-value="">بی‌پاسخ</button>
          </div>`}
        </td>
        <td>${finished ? esc(answer.correct_answer || '—') : '<span class="muted tiny">پس از ثبت</span>'}</td>
        <td>${finished ? resultBadge(answer.result) : ''}</td>
        <td>${finished ? num(answer.spent_seconds ?? '—') : ''}</td>
      </tr>`).join('');

    const breakdown = (attempt.breakdown.by_topic || []).map((row) => `
      <tr>
        <td>${esc(row.topic_title)}</td>
        <td>${num(row.total)}</td>
        <td>${num(row.correct)}</td>
        <td>${num(row.incorrect)}</td>
        <td>${num(row.unanswered)}</td>
        <td>${row.percent === null ? '—' : pct(row.percent)}
          ${meter(row.percent, 100, row.percent >= 70 ? 'ok' : row.percent >= 50 ? '' : 'bad')}</td>
      </tr>`).join('');

    return `
      <div class="page-head">
        <div><h2>${esc(attempt.exam_title)} — اجرای ${num(attempt.id)}</h2>
          <p class="muted small">شروع: ${esc((attempt.started_at || '').slice(0, 16))}
          ${attempt.finished_at ? ` | پایان: ${esc(attempt.finished_at.slice(0, 16))}` : ''}</p></div>
        <div class="actions">
          <a class="btn btn-sm" href="#/exams/${params.examId}">صفحه آزمون</a>
          ${finished
            ? `<button class="btn btn-sm" data-action="archive">آرشیو این اجرا</button>`
            : `<button class="btn btn-sm btn-primary" data-action="submit">ثبت پاسخ‌ها و پایان</button>`}
        </div>
      </div>

      ${finished ? `
      <div class="grid cols-4">
        <div class="stat ${attempt.score_percent >= 70 ? 'ok' : attempt.score_percent >= 50 ? 'warn' : 'bad'}">
          <span class="label">درصد</span><div class="value">${pct(attempt.score_percent)}</div></div>
        <div class="stat"><span class="label">درست</span><div class="value">${num(attempt.correct_count)}</div></div>
        <div class="stat"><span class="label">غلط</span><div class="value">${num(attempt.incorrect_count)}</div></div>
        <div class="stat"><span class="label">بی‌پاسخ</span><div class="value">${num(attempt.unanswered_count)}</div></div>
      </div>
      <div class="spacer"></div>` : `
      <div class="banner warn"><div>
        پاسخ‌ها را انتخاب کنید و سپس «ثبت پاسخ‌ها و پایان» را بزنید. هر پاسخ با منبع «آزمون» در
        سابقه بانک تست نیز ثبت می‌شود و در مرور هوشمند لحاظ خواهد شد.
      </div></div>
      <div class="spacer"></div>`}

      <div class="card">
        <div class="card-head"><h2>پاسخ‌برگ</h2>
          <div class="actions">
            ${finished ? `<button class="btn btn-sm" data-action="regrade">اصلاح دستی نتیجه</button>` : ''}
            <span class="badge">${num(attempt.answers.length)} سؤال</span>
          </div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>کد</th><th>شماره</th><th>مبحث</th><th>پاسخ</th><th>کلید</th><th>نتیجه</th><th>ثانیه</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
      </div>
      <div class="spacer"></div>

      ${finished ? `
      <div class="card">
        <div class="card-head"><h2>تحلیل اجرا بر پایه مبحث</h2></div>
        ${breakdown ? `<div class="table-wrap"><table>
          <thead><tr><th>مبحث</th><th>سؤال</th><th>درست</th><th>غلط</th><th>بی‌پاسخ</th><th>درصد</th></tr></thead>
          <tbody>${breakdown}</tbody></table></div>` : '<p class="muted small">مبحثی برای این سؤال‌ها تعیین نشده است.</p>'}
        <div class="spacer"></div>
        ${attempt.breakdown.weakest_topic ? `<div class="banner warn"><div>
          ضعیف‌ترین بخش این اجرا: <strong>${esc(attempt.breakdown.weakest_topic.topic_title)}</strong>
          با ${pct(attempt.breakdown.weakest_topic.percent)} پاسخ درست.
          این مبحث در فهرست کار آزمون‌های آینده پیشنهاد می‌شود.</div></div>` : ''}
      </div>` : ''}`;
  },

  actions: {
    async pick(element) {
      const eqId = element.dataset.eq;
      answers[eqId] = element.dataset.value;
      const group = document.querySelector(`[data-options="${eqId}"]`);
      group.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('on', button.dataset.value === element.dataset.value);
      });
    },

    async submit(element, ctx) {
      const payload = Object.entries(answers).map(([examQuestionId, userAnswer]) => ({
        exam_question_id: Number(examQuestionId),
        user_answer: userAnswer === '' ? null : userAnswer,
      }));
      if (!payload.length) { toast('هیچ پاسخی انتخاب نشده است', 'warn'); return; }
      try {
        const result = await api.post(`/exam-attempts/${ctx.params.attemptId}/answers`, {
          answers: payload, record_to_bank: true, finalize: true,
        });
        toast(`ثبت شد — درصد: ${fa(result.score_percent ?? 0)}`, 'ok');
        const { rerender } = await import('../app.js');
        await rerender();
      } catch (error) { notifyError(error); }
    },

    async regrade(element, ctx) {
      const attempt = await api.get(`/exam-attempts/${ctx.params.attemptId}`);
      const modal = await import('../ui.js').then((ui) => ui.openModal({
        wide: true,
        title: 'اصلاح دستی نتیجه سؤال‌ها',
        body: `<div class="table-wrap" style="max-height:55vh;overflow:auto"><table>
          <thead><tr><th>#</th><th>شماره</th><th>کلید</th><th>پاسخ</th><th>نتیجه</th></tr></thead>
          <tbody>${attempt.answers.map((answer, index) => `<tr>
            <td>${num(index + 1)}</td><td>${esc(answer.display_number || '—')}</td>
            <td>${esc(answer.correct_answer || '—')}</td><td>${esc(answer.user_answer || '—')}</td>
            <td><select data-eq-result="${answer.exam_question_id}">
              <option value="correct" ${answer.result === 'correct' ? 'selected' : ''}>درست</option>
              <option value="incorrect" ${answer.result === 'incorrect' ? 'selected' : ''}>غلط</option>
              <option value="unanswered" ${answer.result === 'unanswered' ? 'selected' : ''}>بی‌پاسخ</option>
            </select></td></tr>`).join('')}</tbody></table></div>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ثبت اصلاحات</button>`,
      }));
      modal.querySelector('[data-save]').addEventListener('click', async () => {
        const results = Array.from(modal.querySelectorAll('[data-eq-result]')).map((select) => ({
          exam_question_id: Number(select.dataset.eqResult), result: select.value,
        }));
        await api.post(`/exam-attempts/${ctx.params.attemptId}/grade`, { results });
        const ui = await import('../ui.js');
        ui.closeModal();
        toast('نتیجه اصلاح شد', 'ok');
        const { rerender } = await import('../app.js');
        await rerender();
      });
    },

    async archive(element, ctx) {
      await api.post(`/exam-attempts/${ctx.params.attemptId}/archive`, {});
      toast('اجرا آرشیو شد (سابقه حفظ شد)', 'ok');
      window.location.hash = `#/exams/${ctx.params.examId}`;
    },
  },
};
