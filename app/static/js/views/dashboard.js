/* داشبورد — خلاصه وضعیت، روند، مرورها، عقب‌ماندگی و آزمون‌های آینده */

import { api } from '../api.js';
import * as store from '../store.js';
import { barChart, esc, fa, meter, num, pct, resultBadge, stat } from '../ui.js';

export default {
  title: 'داشبورد',
  subtitle: 'نمای کلی وضعیت تست‌ها، مرور، اهداف و آزمون‌های آینده',

  async render() {
    const subjectId = store.activeSubjectId();
    const data = await api.get('/dashboard', { subject_id: subjectId || '' });
    const head = data.headline;
    const week = data.week;
    const trend = data.trend;
    const trendClass = (trend.delta_attempts || 0) > 0 ? 'ok' : (trend.delta_attempts || 0) < 0 ? 'warn' : '';

    const subjectCards = (data.subjects || []).map((row) => `
      <tr>
        <td>${esc(row.name || 'بدون درس')}</td>
        <td>${num(row.questions)}</td>
        <td>${num(row.attempts)}</td>
        <td>${row.accuracy === null ? '—' : pct(row.accuracy)}</td>
        <td>${resultBadge(row.accuracy >= 70 ? 'correct' : row.accuracy >= 50 ? 'unanswered' : 'incorrect')}</td>
      </tr>`).join('');

    const behindRows = (data.behind_topics || []).map((row) => `
      <tr>
        <td><a href="#/topics">${esc(row.title)}</a></td>
        <td>${esc((store.state.labels.taught_status || {})[row.taught_status] || row.taught_status)}</td>
        <td>${num(row.done_count)} / ${num(row.target_count)}</td>
        <td>${num(row.remaining)}</td>
        <td>${meter(row.done_count, row.target_count || 1)}</td>
      </tr>`).join('');

    const upcoming = (data.upcoming_exams || []).map((plan) => `
      <tr>
        <td>${esc(plan.title)}</td>
        <td>${plan.exam_date ? esc(plan.exam_date) : '—'}</td>
        <td>${plan.days_remaining === null ? '—' : `${num(plan.days_remaining)} روز`}</td>
        <td>${plan.readiness_estimate === null ? '<span class="badge">برآورد نشده</span>'
          : `<span class="badge primary">${pct(plan.readiness_estimate)}</span>`}</td>
        <td class="actions"><a class="btn btn-sm" href="#/readiness">مشاهده</a></td>
      </tr>`).join('');

    const weak = (data.weakest_topics || []).map((row) => `
      <li class="question-line">
        <span class="title">${esc(row.title)}</span>
        <span class="badge ${row.correct_rate >= 60 ? 'ok' : 'warn'}">${pct(row.correct_rate)}</span>
        <span class="muted tiny">${num(row.attempts)} تلاش</span>
      </li>`).join('');

    const feed = (data.activity || []).map((item) => `
      <div class="feed-item"><span class="dot"></span>
        <div><div>${esc(item.message)}</div>
        <div class="muted tiny">${esc(item.time_label)}</div></div>
      </div>`).join('');

    return `
      <div class="banner info" style="margin-bottom:1rem">
        <div><strong>اصل تاریخچه‌محور:</strong>
        همه آمار این صفحه از داده‌های خام تلاش‌ها محاسبه می‌شود؛ هیچ رکوردی جایگزین یا بازنویسی نمی‌شود.</div>
      </div>

      <div class="grid cols-4">
        ${stat({ label: 'کل تست‌های بانک', value: num(head.questions),
                hint: `${num(head.without_key)} تست بدون کلید | ${num(head.archived_questions)} آرشیوی` })}
        ${stat({ label: 'تست‌های حل‌شده', value: num(head.solved_questions),
                hint: `${num(head.unsolved_questions)} تست هنوز حل نشده` })}
        ${stat({ label: 'تلاش‌ها (همه دوره‌ها)', value: num(head.attempts),
                hint: `${num(head.previous_entries)} سابقه قبلی وارد‌شده` })}
        ${stat({ label: 'مورد مرور باز', value: num(head.open_reviews),
                hint: 'غلط، بی‌پاسخ، مهم، سخت و …', tone: head.open_reviews ? 'warn' : 'ok' })}
      </div>
      <div class="spacer"></div>

      <div class="grid cols-3">
        ${stat({ label: 'امروز', value: num(data.today.attempts),
                hint: `${num(data.today.questions)} تست متفاوت`, tone: 'accent' })}
        ${stat({ label: '۷ روز گذشته', value: num(week.attempts),
                hint: `دقت: ${week.accuracy === null ? '—' : pct(week.accuracy)}`,
                tone: trendClass })}
        ${stat({ label: 'روند نسبت به هفته قبل', value: `${trend.delta_attempts >= 0 ? '+' : ''}${fa(trend.delta_attempts)}`,
                hint: `تغییر دقت: ${trend.delta_accuracy === null ? '—' : pct(trend.delta_accuracy)}` })}
        ${stat({ label: 'زنجیره روزهای فعال', value: `${num(data.streak.total_active_days)} روز`,
                hint: `پشت‌سرهم: ${num(data.streak.active_days_streak)} روز | پاسخ درست متوالی: ${num(data.streak.correct_answer_streak)}` })}
      </div>
      <div class="spacer"></div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>فعالیت ۱۴ روز گذشته</h2>
            <div class="actions"><a class="btn btn-sm" href="#/analytics">تحلیل کامل</a></div></div>
          ${barChart(data.series || [])}
        </div>
        <div class="card">
          <div class="card-head"><h2>مرورها و کارهای عقب‌مانده</h2>
            <div class="actions"><a class="btn btn-sm btn-primary" href="#/review">فهرست مرور</a></div></div>
          <div class="grid cols-2">
            ${stat({ label: 'غلط آخرین تلاش', value: num(data.review.by_reason.incorrect || 0) })}
            ${stat({ label: 'بی‌پاسخ آخرین تلاش', value: num(data.review.by_reason.unanswered || 0) })}
            ${stat({ label: 'غلطِ سابقه قبلی', value: num(data.review.by_reason.incorrect_previous || 0) })}
            ${stat({ label: 'بی‌پاسخِ سابقه قبلی', value: num(data.review.by_reason.unanswered_previous || 0) })}
            ${stat({ label: 'علامت مهم', value: num(data.review.by_reason.important || 0) })}
            ${stat({ label: 'علامت سخت', value: num(data.review.by_reason.hard || 0) })}
          </div>
          <div class="spacer"></div>
          <div class="row">
            ${Object.entries(data.review.by_reason).map(([reason, count]) => count
              ? `<span class="badge">${esc((store.state.labels.review_reason || {})[reason] || reason)}: ${num(count)}</span>`
              : '').join('')}
          </div>
        </div>
      </div>
      <div class="spacer"></div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>عملکرد درس‌ها</h2></div>
          ${subjectCards ? `<div class="table-wrap"><table>
            <thead><tr><th>درس</th><th>تست‌ها</th><th>تلاش‌ها</th><th>دقت</th><th></th></tr></thead>
            <tbody>${subjectCards}</tbody></table></div>`
            : '<p class="muted small">هنوز درسی ثبت نشده است. از بخش «کتاب‌ها» شروع کنید.</p>'}
        </div>
        <div class="card">
          <div class="card-head"><h2>وضعیت تدریس و عقب‌ماندگی</h2>
            <div class="actions"><a class="btn btn-sm" href="#/teaching">مدیریت</a></div></div>
          <div class="grid cols-2">
            ${stat({ label: 'تدریس‌شده', value: num(data.teaching.taught || 0), tone: 'ok' })}
            ${stat({ label: 'در حال تدریس', value: num(data.teaching.in_progress || 0) })}
            ${stat({ label: 'تدریس نشده', value: num(data.teaching.not_started || 0), tone: 'warn' })}
            ${stat({ label: 'باقی‌مانده از اهداف', value: num(data.teaching.remaining || 0) })}
          </div>
          <div class="spacer"></div>
          ${behindRows ? `<div class="table-wrap"><table>
            <thead><tr><th>مبحث</th><th>تدریس</th><th>انجام‌شده/هدف</th><th>باقی‌مانده</th><th></th></tr></thead>
            <tbody>${behindRows}</tbody></table></div>`
            : '<p class="muted small">عقب‌ماندگی‌ای ثبت نشده است.</p>'}
        </div>
      </div>
      <div class="spacer"></div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>آزمون‌های آینده</h2>
            <div class="actions"><a class="btn btn-sm" href="#/readiness">برنامه آمادگی</a></div></div>
          ${upcoming ? `<div class="table-wrap"><table>
            <thead><tr><th>عنوان</th><th>تاریخ</th><th>باقی‌مانده</th><th>برآورد آمادگی</th><th></th></tr></thead>
            <tbody>${upcoming}</tbody></table></div>`
            : '<p class="muted small">برنامه آزمون آینده‌ای ثبت نشده است.</p>'}
          <div class="spacer"></div>
          <div class="grid cols-3">
            ${stat({ label: 'اجرای آزمون', value: num(data.exams.attempts || 0),
                    hint: `میانگین: ${data.exams.average_score === null ? '—' : pct(data.exams.average_score)}` })}
            ${stat({ label: 'بهترین درصد', value: data.exams.best_score === null ? '—' : pct(data.exams.best_score) })}
            ${stat({ label: 'آزمون در جریان', value: num(data.exams.running_attempts || 0) })}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>ضعیف‌ترین مباحث</h2>
            <div class="actions"><a class="btn btn-sm" href="#/analytics">جزئیات</a></div></div>
          ${weak ? `<ul style="list-style:none;padding:0;margin:0">${weak}</ul>`
            : '<p class="muted small">برای محاسبه، حداقل چند تلاش ثبت‌شده لازم است.</p>'}
          <div class="spacer"></div>
          <h3>رویدادهای اخیر</h3>
          <div class="feed">${feed || '<p class="muted small">رویدادی ثبت نشده است.</p>'}</div>
        </div>
      </div>`;
  },

  actions: {
    async refresh() {
      const { rerender } = await import('../app.js');
      await rerender();
    },
  },
};
