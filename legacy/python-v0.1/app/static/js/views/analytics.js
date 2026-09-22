/* تحلیل و آمار — چند سطح تحلیل، روند زمانی و بررسی یکپارچگی داده */

import { api } from '../api.js';
import * as store from '../store.js';
import { barChart, esc, fa, meter, num, pct, resultBadge, stat } from '../ui.js';

const state = { level: 'topic', unit: 'day', window: 30 };

const LEVELS = [
  ['overall', 'کلی'], ['subject', 'درس'], ['book', 'کتاب'], ['book_node', 'فصل/بخش'],
  ['topic', 'مبحث'], ['question', 'تست'], ['exam', 'آزمون'],
  ['day', 'روزانه'], ['week', 'هفتگی'], ['month', 'ماهانه'],
];

export default {
  title: 'تحلیل و آمار',
  subtitle: 'همه اعداد از داده خام محاسبه می‌شود، نه از مقدارهای خلاصه ذخیره‌شده',

  async render() {
    const subjectId = store.activeSubjectId();
    const [performance, series, leaderboard, integrity, exams, examRowsData, activity] = await Promise.all([
      api.get('/analytics/performance', { level: state.level, subject_id: subjectId || '' }),
      api.get('/analytics/timeseries', { unit: state.unit, window: state.window, subject_id: subjectId || '' }),
      api.get('/analytics/leaderboard', { subject_id: subjectId || '', limit: 8 }),
      api.get('/integrity'),
      api.get('/analytics/exams', { subject_id: subjectId || '' }),
      api.get('/analytics/performance', { level: 'exam', subject_id: subjectId || '', limit: 20 }),
      api.get('/analytics/activity', { limit: 25 }),
    ]);
    const examPerformance = examRowsData.rows || [];

    const rows = (performance.rows || []).map((row) => `
      <tr>
        <td>${esc(row.title || row.name || row.group_key || '—')}
          ${row.path ? `<div class="muted tiny">${esc(row.path)}</div>` : ''}</td>
        <td>${num(row.questions)}</td>
        <td>${num(row.attempts)}</td>
        <td>${num(row.correct)}</td>
        <td>${num(row.incorrect)}</td>
        <td>${num(row.unanswered)}</td>
        <td>${row.accuracy === null ? '—' : pct(row.accuracy)}</td>
        <td>${meter(row.accuracy || 0, 100, (row.accuracy || 0) >= 70 ? 'ok' : (row.accuracy || 0) >= 50 ? 'warn' : 'bad')}</td>
        <td>${row.average_seconds === null ? '—' : `${fa(Math.round(row.average_seconds))} ثانیه`}</td>
        <td class="tiny">${esc((row.last_attempt_at || '').slice(0, 10) || '—')}</td>
      </tr>`).join('');

    const totals = performance.totals || {};
    const integrityRows = integrity.checks.map((check) => `
      <tr>
        <td>${check.status === 'ok' ? '<span class="badge ok">سالم</span>' : '<span class="badge warn">هشدار</span>'}</td>
        <td>${esc(check.title)}</td>
        <td>${num(check.count)}</td>
        <td class="small muted">${esc(check.rule)}</td>
      </tr>`).join('');

    const examRows = (examPerformance || []).map((row) => `
      <tr>
        <td>${esc(row.title)}</td>
        <td>${row.score_percent === null ? '—' : pct(row.score_percent)}</td>
        <td>${num(row.correct_count)} / ${num(row.incorrect_count)} / ${num(row.unanswered_count)}</td>
        <td class="tiny">${esc((row.at || '').slice(0, 16))}</td>
      </tr>`).join('');

    return `
      <div class="grid cols-4">
        ${stat({ label: 'تست‌های بانک', value: num(totals.bank_questions),
                hint: `${num(totals.bank_untouched)} حل‌نشده` })}
        ${stat({ label: 'تلاش‌ها', value: num(totals.attempts),
                hint: `دقت کل: ${totals.accuracy === null ? '—' : pct(totals.accuracy)}` })}
        ${stat({ label: 'علامت مهم', value: num(totals.bank_important) })}
        ${stat({ label: 'علامت سخت', value: num(totals.bank_hard) })}
      </div>
      <div class="spacer"></div>

      <div class="card">
        <div class="card-head"><h2>روند فعالیت</h2>
          <div class="actions">
            ${['day', 'week', 'month'].map((unit) => `<button class="btn btn-sm ${state.unit === unit ? 'btn-primary' : ''}"
              data-action="unit" data-unit="${unit}">${unit === 'day' ? 'روزانه' : unit === 'week' ? 'هفتگی' : 'ماهانه'}</button>`).join('')}
          </div></div>
        ${barChart(series.series || [])}
        <div class="row" style="margin-top:.6rem">
          <span class="badge">مجموع تلاش: ${num(series.total_attempts)}</span>
          <span class="badge ok">درست: ${num(series.total_correct)}</span>
        </div>
      </div>
      <div class="spacer"></div>

      <div class="card">
        <div class="card-head"><h2>تحلیل چندسطحی</h2>
          <div class="actions">
            ${LEVELS.map(([value, label]) => `<button class="btn btn-sm ${state.level === value ? 'btn-primary' : ''}"
              data-action="level" data-level="${value}">${label}</button>`).join('')}
          </div></div>
        ${rows ? `<div class="table-wrap" style="max-height:60vh;overflow:auto"><table>
          <thead><tr><th>${esc(performance.labels || 'گروه')}</th><th>تست</th><th>تلاش</th><th>درست</th>
          <th>غلط</th><th>بی‌پاسخ</th><th>دقت</th><th></th><th>میانگین زمان</th><th>آخرین</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
          : '<p class="muted small">در این سطح داده‌ای برای نمایش نیست.</p>'}
      </div>
      <div class="spacer"></div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>قوی‌ترین و ضعیف‌ترین مباحث</h2>
            <div class="actions"><span class="badge">${num(leaderboard.sample)} مبحث با تلاش کافی</span></div></div>
          <h4>ضعیف‌ترین</h4>
          ${(leaderboard.weakest || []).map((row) => `<div class="question-line">
            <span>${esc(row.title)}</span>
            <span class="badge ${row.correct_rate >= 60 ? 'ok' : 'bad'}">${pct(row.correct_rate)}</span>
            <span class="muted tiny">${num(row.attempts)} تلاش</span></div>`).join('') || '<p class="muted small">داده کافی نیست.</p>'}
          <div class="spacer"></div>
          <h4>قوی‌ترین</h4>
          ${(leaderboard.strongest || []).map((row) => `<div class="question-line">
            <span>${esc(row.title)}</span>
            <span class="badge ok">${pct(row.correct_rate)}</span>
            <span class="muted tiny">${num(row.attempts)} تلاش</span></div>`).join('') || '<p class="muted small">داده کافی نیست.</p>'}
        </div>

        <div class="card">
          <div class="card-head"><h2>عملکرد آزمون‌ها</h2></div>
          <div class="grid cols-3">
            ${stat({ label: 'اجراها', value: num(exams.attempts || 0) })}
            ${stat({ label: 'میانگین درصد', value: exams.average_score === null ? '—' : pct(exams.average_score) })}
            ${stat({ label: 'بهترین', value: exams.best_score === null ? '—' : pct(exams.best_score) })}
          </div>
          <div class="spacer"></div>
          ${examRows ? `<div class="table-wrap" style="max-height:30vh;overflow:auto"><table>
            <thead><tr><th>آزمون</th><th>درصد</th><th>درست/غلط/بی‌پاسخ</th><th>زمان</th></tr></thead>
            <tbody>${examRows}</tbody></table></div>` : '<p class="muted small">آزمونی برگزار نشده است.</p>'}
          <div class="spacer"></div>
          <h4>رویدادهای اخیر</h4>
          <div class="feed">
            ${(activity.items || []).slice(0, 10).map((item) => `<div class="feed-item">
              <span class="dot"></span><div><div>${esc(item.message)}</div>
              <div class="muted tiny">${esc(item.time_label)}</div></div></div>`).join('')
            || '<p class="muted small">رویدادی ثبت نشده است.</p>'}
          </div>
        </div>
      </div>
      <div class="spacer"></div>

      <div class="card">
        <div class="card-head"><h2>بررسی یکپارچگی داده (قواعد اعتبارسنجی)</h2>
          <div class="actions">
            <span class="badge ok">${num(integrity.passed)} بررسی سالم</span>
            ${integrity.warnings ? `<span class="badge warn">${num(integrity.warnings)} هشدار</span>`
              : '<span class="badge">بدون هشدار</span>'}
            <a class="btn btn-sm" href="#/settings">ابزارهای داده</a>
          </div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>وضعیت</th><th>بررسی</th><th>تعداد</th><th>قاعده مرتبط</th></tr></thead>
          <tbody>${integrityRows}</tbody></table></div>
      </div>`;
  },

  actions: {
    async level(element) {
      state.level = element.dataset.level;
      const { rerender } = await import('../app.js');
      await rerender();
    },
    async unit(element) {
      state.unit = element.dataset.unit;
      const { rerender } = await import('../app.js');
      await rerender();
    },
  },
};
