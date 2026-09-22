/* تدریس و عقب‌ماندگی — وضعیت تدریس، هدف تست، انجام‌شده و باقی‌مانده */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, emptyState, esc, fa, meter, notifyError, num, openModal, options, toast } from '../ui.js';

const TAUGHT = ['not_started', 'in_progress', 'taught', 'needs_review'];

export default {
  title: 'تدریس و عقب‌ماندگی',
  subtitle: 'وضعیت تدریس هر مبحث، هدف تعداد تست، انجام‌شده، باقی‌مانده و عقب‌ماندگی',

  async render() {
    const subjectId = store.activeSubjectId();
    const [units, overview, goals] = await Promise.all([
      api.get('/teaching/units', { subject_id: subjectId || '' }),
      api.get('/teaching/overview', { subject_id: subjectId || '' }),
      api.get('/teaching/goals', { status: 'all' }),
    ]);
    const labels = store.state.labels.taught_status || {};

    const unitRows = (units.items || []).map((unit) => `
      <tr>
        <td>${esc(unit.title)}<div class="muted tiny">${esc(unit.topic_path || '')}</div></td>
        <td>
          <select data-change="status" data-topic="${unit.topic_id}" style="min-width:130px">
            ${TAUGHT.map((status) => `<option value="${status}" ${unit.taught_status === status ? 'selected' : ''}>
              ${esc(labels[status] || status)}</option>`).join('')}
          </select>
        </td>
        <td class="tiny">${esc(unit.taught_at ? String(unit.taught_at).slice(0, 10) : '—')}</td>
        <td>${num(unit.progress.target_count)}</td>
        <td>${num(unit.progress.done_count)}</td>
        <td class="${unit.progress.remaining_count ? 'badge bad' : 'badge ok'}">${num(unit.progress.remaining_count)}</td>
        <td>${meter(unit.progress.done_count, unit.progress.target_count || 1)}
          <span class="tiny muted">${unit.progress.progress_percent === null ? '' : `${fa(unit.progress.progress_percent)}٪`}</span></td>
        <td class="actions">
          <button class="btn btn-sm" data-action="addGoal" data-topic="${unit.topic_id}">هدف</button>
          <button class="btn btn-sm" data-action="openQuestions" data-topic="${unit.topic_id}">تست‌ها</button>
        </td>
      </tr>`).join('');

    const goalRows = (goals.items || []).map((goal) => `
      <tr>
        <td>${esc(goal.topic_title)}</td>
        <td>${num(goal.target_count)}</td>
        <td>${num(goal.progress.done_count)} / ${num(goal.progress.available_questions)} موجود</td>
        <td>${num(goal.progress.remaining_count)}</td>
        <td><span class="badge ${goal.status === 'active' ? 'primary' : ''}">${esc(goal.status)}</span></td>
        <td>${esc(goal.period_label || '—')}</td>
        <td class="actions"><button class="btn btn-sm btn-danger" data-action="closeGoal" data-id="${goal.id}">بستن</button></td>
      </tr>`).join('');

    const behind = (overview.behind || []).map((row) => `
      <tr>
        <td>${esc(row.topic_path || row.title)}</td>
        <td><span class="badge">${esc(labels[row.taught_status] || row.taught_status)}</span></td>
        <td>${num(row.remaining)}</td>
        <td>${meter(row.done_count, row.target_count || 1)}</td>
        <td class="actions"><a class="btn btn-sm" href="#/review">مرور این مبحث</a></td>
      </tr>`).join('');

    return `
      <div class="grid cols-4">
        ${[['تدریس‌شده', overview.totals.taught, 'ok'], ['در حال تدریس', overview.totals.in_progress, ''],
      ['تدریس نشده', overview.totals.not_started, 'warn'], ['نیاز به مرور', overview.totals.needs_review, '']]
        .map(([label, value, tone]) => `<div class="stat ${tone}">
          <span class="label">${label}</span><div class="value">${num(value)}</div></div>`).join('')}
      </div>
      <div class="spacer"></div>
      <div class="grid cols-3">
        <div class="stat accent"><span class="label">مجموع هدف تست</span><div class="value">${num(overview.totals.target)}</div></div>
        <div class="stat"><span class="label">انجام‌شده</span><div class="value">${num(overview.totals.done)}</div></div>
        <div class="stat ${overview.totals.remaining ? 'bad' : 'ok'}"><span class="label">عقب‌ماندگی (باقی‌مانده)</span>
          <div class="value">${num(overview.totals.remaining)}</div>
          <span class="hint">${overview.totals.progress_percent === null ? '' : `${fa(overview.totals.progress_percent)}٪ پیشرفت`}</span></div>
      </div>
      <div class="spacer"></div>

      <div class="card">
        <div class="card-head"><h2>وضعیت تدریس مباحث</h2>
          <div class="actions">
            <button class="btn btn-sm btn-primary" data-action="addGoal">تعریف هدف جدید</button>
            <a class="btn btn-sm" href="#/topics">مدیریت مباحث</a>
          </div></div>
        ${unitRows ? `<div class="table-wrap"><table>
          <thead><tr><th>مبحث</th><th>وضعیت تدریس</th><th>تاریخ</th><th>هدف</th><th>انجام‌شده</th>
          <th>باقی‌مانده</th><th>پیشرفت</th><th></th></tr></thead><tbody>${unitRows}</tbody></table></div>`
          : emptyState('مبحثی ثبت نشده است', 'ابتدا در بخش «مباحث آموزشی» مبحث بسازید.')}
      </div>
      <div class="spacer"></div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>اهداف تعداد تست</h2></div>
          ${goalRows ? `<div class="table-wrap"><table>
            <thead><tr><th>مبحث</th><th>هدف</th><th>انجام‌شده</th><th>باقی‌مانده</th><th>وضعیت</th><th>بازه</th><th></th></tr></thead>
            <tbody>${goalRows}</tbody></table></div>` : '<p class="muted small">هدفی ثبت نشده است.</p>'}
        </div>
        <div class="card">
          <div class="card-head"><h2>مباحث عقب‌مانده</h2>
            <div class="actions"><span class="badge warn">${num(overview.behind_count)} مبحث</span></div></div>
          ${behind ? `<div class="table-wrap"><table>
            <thead><tr><th>مبحث</th><th>تدریس</th><th>باقی‌مانده</th><th>پیشرفت</th><th></th></tr></thead>
            <tbody>${behind}</tbody></table></div>` : '<p class="muted small">عقب‌ماندگی وجود ندارد.</p>'}
        </div>
      </div>`;
  },

  changes: {
    async status(element) {
      await api.put(`/teaching/units/${element.dataset.topic}`, { taught_status: element.value });
      toast('وضعیت تدریس ذخیره شد', 'ok');
      const { rerender } = await import('../app.js');
      await rerender();
    },
  },

  actions: {
    async addGoal(element) {
      const tree = await api.get('/topics/tree', { subject_id: store.activeSubjectId() || '' });
      const flat = [];
      (function walk(nodes, depth) {
        nodes.forEach((node) => {
          flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}` });
          if (node.children) walk(node.children, depth + 1);
        });
      }(tree.items || [], 0));
      const preset = element && element.dataset.topic ? Number(element.dataset.topic) : '';
      openModal({
        title: 'تعریف هدف تعداد تست',
        body: `<form data-form="goal">
          <div class="form-grid">
            <div class="field"><label>مبحث *</label><select name="topic_id">${options(flat, preset)}</select></div>
            <div class="field"><label>هدف تعداد تست *</label><input name="target_count" type="number" min="0" value="20"></div>
            <div class="field"><label>بازه</label><input name="period_label" placeholder="مهر ۱۴۰۴"></div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label><textarea name="notes" rows="2"></textarea></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            try {
              await api.post('/teaching/goals', {
                topic_id: Number(data.topic_id), target_count: Number(data.target_count),
                period_label: data.period_label || null, notes: data.notes || null,
              });
              closeModal(); toast('هدف ثبت شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },

    async closeGoal(element) {
      await api.del(`/teaching/goals/${element.dataset.id}`);
      toast('هدف بسته شد', 'ok');
      const { rerender } = await import('../app.js');
      await rerender();
    },

    openQuestions(element) {
      window.location.hash = `#/questions?topic_id=${element.dataset.topic}`;
    },
  },
};
