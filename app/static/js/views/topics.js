/* مباحث آموزشی — درخت مستقل از ساختار کتاب + اتصال تست‌ها */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, emptyState, esc, fa, meter, notifyError, num, openModal, options, toast } from '../ui.js';

const STATUSES = ['planned', 'active', 'in_progress', 'mastered', 'archived'];

function statusOptions(selected) {
  const labels = store.state.labels.topic_status || {};
  return STATUSES.map((status) => `<option value="${status}" ${status === selected ? 'selected' : ''}>
    ${esc(labels[status] || status)}</option>`).join('');
}

function renderTree(nodes, depth = 0) {
  return nodes.map((node) => {
    const label = (store.state.labels.topic_status || {})[node.status] || node.status;
    const taught = (store.state.labels.taught_status || {})[node.taught_status] || node.taught_status;
    const tone = node.taught_status === 'taught' ? 'ok' : node.taught_status === 'not_started' ? 'warn' : '';
    return `
      <div class="tree-node depth-${Math.min(depth, 3)}" data-topic="${node.id}">
        <div class="tree-row">
          <span class="title">${esc(node.title)}</span>
          <span class="badge ${node.status === 'mastered' ? 'ok' : ''}">${esc(label)}</span>
          <span class="badge ${tone}">${esc(taught)}</span>
          <span class="badge primary">${num(node.total_question_count)} تست</span>
          ${node.total_target_count ? `<span class="badge info">هدف ${num(node.total_target_count)}</span>` : ''}
          <span class="actions">
            <button class="btn btn-sm" data-action="addChild" data-id="${node.id}">زیرمبحث</button>
            <button class="btn btn-sm" data-action="details" data-id="${node.id}">جزئیات</button>
            <button class="btn btn-sm" data-action="edit" data-id="${node.id}">ویرایش</button>
          </span>
        </div>
        <div class="tree-children">${node.children && node.children.length ? renderTree(node.children, depth + 1) : ''}</div>
      </div>`;
  }).join('');
}

export default {
  title: 'مباحث آموزشی',
  subtitle: 'ساختار مباحث جدا از ساختار کتاب؛ یک تست می‌تواند به چند مبحث متصل باشد',

  async render() {
    const tree = await store.loadTopics();
    const goals = await api.get('/teaching/goals');
    const goalRows = (goals.items || []).map((goal) => `
      <tr>
        <td>${esc(goal.topic_title)}</td>
        <td>${num(goal.target_count)}</td>
        <td>${num(goal.progress.done_count)}</td>
        <td>${num(goal.progress.remaining_count)}</td>
        <td>${meter(goal.progress.done_count, goal.target_count || 1)}
            <span class="tiny muted">${goal.progress.progress_percent === null ? '' : `${fa(goal.progress.progress_percent)}٪`}</span></td>
        <td class="actions">
          <button class="btn btn-sm" data-action="editGoal" data-id="${goal.id}">ویرایش</button>
          <button class="btn btn-sm btn-danger" data-action="closeGoal" data-id="${goal.id}">بستن هدف</button>
        </td>
      </tr>`).join('');

    return `
      <div class="page-head">
        <div><h2>درخت مباحث</h2>
          <p class="muted small">«آزمون چکاپ»، «آزمون جامع» و «تست‌های مخلوط» را اینجا نسازید؛ آن‌ها گره ساختاری کتاب‌اند.</p></div>
        <div class="actions">
          <button class="btn" data-action="add">افزودن مبحث</button>
          <button class="btn btn-primary" data-action="addGoal">تعریف هدف تست</button>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>مباحث</h2>
            <div class="actions"><span class="badge">${num(countTopics(tree))} مبحث</span></div></div>
          ${tree.length ? `<div class="tree">${renderTree(tree)}</div>`
            : emptyState('مبحثی ثبت نشده است', 'مباحث آموزشی را مستقل از فصل‌های کتاب بسازید.')}
        </div>
        <div class="card">
          <div class="card-head"><h2>اهداف تعداد تست</h2></div>
          ${goalRows ? `<div class="table-wrap"><table>
            <thead><tr><th>مبحث</th><th>هدف</th><th>انجام‌شده</th><th>باقی‌مانده</th><th>پیشرفت</th><th></th></tr></thead>
            <tbody>${goalRows}</tbody></table></div>` : '<p class="muted small">هدفی تعریف نشده است.</p>'}
          <div class="spacer"></div>
          <div class="banner info"><div>
            «باقی‌مانده از هدف» به‌صورت خودکار در فهرست مرور همین مبحث ظاهر می‌شود.
          </div></div>
        </div>
      </div>`;
  },

  actions: {
    add() { openTopicForm({ parentId: null }); },

    async addChild(element) { openTopicForm({ parentId: Number(element.dataset.id) }); },

    async edit(element) {
      const topic = await api.get(`/topics/${element.dataset.id}`);
      openTopicForm({ topic });
    },

    async details(element) {
      const topicId = Number(element.dataset.id);
      const [topic, stats, linked] = await Promise.all([
        api.get(`/topics/${topicId}`), api.get(`/topics/${topicId}/stats`),
        api.get(`/topics/${topicId}/questions`),
      ]);
      const questions = (linked.items || []).slice(0, 60).map((row) => `
        <tr><td class="mono">${esc(row.code)}</td><td>${esc(row.display_number || '—')}</td>
        <td class="small">${esc(row.book_title || '—')}</td><td class="small">${esc(row.node_title || '—')}</td>
        <td><span class="badge">${esc((store.state.labels.relation_type || {})[row.relation_type] || row.relation_type)}</span></td>
        <td><button class="btn btn-sm btn-danger" data-action="unlink" data-id="${topicId}" data-qid="${row.id}">حذف اتصال</button></td></tr>`).join('');
      const modal = openModal({
        wide: true,
        title: `مبحث: ${topic.title}`,
        body: `
          <div class="grid cols-4">
            <div class="stat"><span class="label">تست‌های مبحث</span><div class="value">${num(stats.question_count)}</div></div>
            <div class="stat"><span class="label">تلاش‌ها</span><div class="value">${num(stats.attempt_count)}</div></div>
            <div class="stat"><span class="label">درست / غلط / بی‌پاسخ</span>
              <div class="value" style="font-size:1rem">${num(stats.correct)} / ${num(stats.incorrect)} / ${num(stats.unanswered)}</div></div>
            <div class="stat ${stats.remaining_to_target ? 'warn' : 'ok'}">
              <span class="label">باقی‌مانده از هدف</span><div class="value">${num(stats.remaining_to_target)}</div></div>
          </div>
          <div class="spacer"></div>
          <div class="row">
            <span class="badge">مهم: ${num(stats.important_count)}</span>
            <span class="badge">سخت: ${num(stats.hard_count)}</span>
            <span class="badge">مرور باز: ${num(stats.open_review_items)}</span>
            <span class="badge">سابقه قبلی: ${num(stats.previous_entry_count)}</span>
          </div>
          <div class="spacer"></div>
          <h3>اتصال تست‌ها</h3>
          <form data-form="attach">
            <div class="form-grid">
              <div class="field"><label>افزودن تست با کد</label>
                <input name="codes" placeholder="Q-000001, Q-000002"></div>
              <div class="field"><label>نوع رابطه</label>
                <select name="relation_type">${options(Object.entries(store.state.labels.relation_type || {})
                  .map(([value, label]) => ({ value, label })), 'primary', { valueKey: 'value', labelKey: 'label' })}</select></div>
              <div class="field" style="align-self:end">
                <button class="btn" type="submit">اتصال</button></div>
            </div>
          </form>
          <div class="spacer"></div>
          ${questions ? `<div class="table-wrap" style="max-height:40vh;overflow:auto"><table>
            <thead><tr><th>کد</th><th>شماره</th><th>کتاب</th><th>محل</th><th>رابطه</th><th></th></tr></thead>
            <tbody>${questions}</tbody></table></div>` : '<p class="muted small">تستی به این مبحث متصل نیست.</p>'}`,
        footer: `<button class="btn" data-modal-close>بستن</button>`,
      });
      modal.dataset.topicId = String(topicId);
    },

    async unlink(element) {
      await api.del(`/topics/${element.dataset.id}/questions/${element.dataset.qid}`);
      toast('اتصال حذف شد', 'ok');
      closeModal();
    },

    async addGoal() {
      const flat = await topicChoiceList();
      openModal({
        title: 'تعریف هدف تعداد تست',
        body: `<form data-form="goal">
          <div class="form-grid">
            <div class="field"><label>مبحث *</label><select name="topic_id">${options(flat, '')}</select></div>
            <div class="field"><label>هدف تعداد تست *</label><input name="target_count" type="number" min="0" value="20"></div>
            <div class="field"><label>بازه هدف</label><input name="period_label" placeholder="مهر ۱۴۰۴"></div>
            <div class="field"><label>از تاریخ</label><input name="period_start" placeholder="1404/07/01"></div>
            <div class="field"><label>تا تاریخ</label><input name="period_end" placeholder="1404/07/30"></div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label><textarea name="notes" rows="2"></textarea></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = cleanForm(modal);
            try {
              await api.post('/teaching/goals', data);
              closeModal(); toast('هدف ثبت شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },

    async editGoal(element) {
      const goal = await api.get(`/teaching/goals/${element.dataset.id}`);
      const flat = await topicChoiceList();
      openModal({
        title: 'ویرایش هدف',
        body: `<form data-form="goal">
          <div class="form-grid">
            <div class="field"><label>مبحث</label><select name="topic_id">${options(flat, goal.topic_id)}</select></div>
            <div class="field"><label>هدف تعداد تست</label><input name="target_count" type="number" value="${goal.target_count}"></div>
            <div class="field"><label>بازه</label><input name="period_label" value="${esc(goal.period_label || '')}"></div>
            <div class="field"><label>وضعیت</label><select name="status">
              <option value="active" ${goal.status === 'active' ? 'selected' : ''}>فعال</option>
              <option value="done" ${goal.status === 'done' ? 'selected' : ''}>پایان‌یافته</option>
              <option value="archived" ${goal.status === 'archived' ? 'selected' : ''}>آرشیو</option></select></div>
          </div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = cleanForm(modal);
            try {
              await api.put(`/teaching/goals/${goal.id}`, data);
              closeModal(); toast('ذخیره شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },

    async closeGoal(element) {
      await api.del(`/teaching/goals/${element.dataset.id}`);
      toast('هدف بسته شد', 'ok');
      const { rerender } = await import('../app.js'); await rerender();
    },
  },

  async submit(name, form) {
    if (name === 'attach') {
      const data = Object.fromEntries(new FormData(form).entries());
      const topicId = Number(form.closest('.modal').dataset.topicId);
      const codes = (data.codes || '').split(/[,،\s]+/).filter(Boolean);
      const ids = [];
      for (const code of codes) {
        const found = await api.get('/questions', { search: code, page_size: 1 });
        const match = (found.items || []).find((item) => item.code === code);
        if (match) ids.push(match.id);
      }
      if (!ids.length) throw new Error('تستی با این کدها یافت نشد');
      await api.post(`/topics/${topicId}/questions`,
        { question_ids: ids, relation_type: data.relation_type || 'primary' });
      toast(`${fa(ids.length)} تست متصل شد`, 'ok');
      closeModal();
    }
  },
};

function countTopics(nodes) {
  return nodes.reduce((sum, node) => sum + 1 + countTopics(node.children || []), 0);
}

async function topicChoiceList() {
  const tree = await api.get('/topics/tree', { subject_id: store.activeSubjectId() || '' });
  const flat = [];
  (function walk(nodes, depth) {
    nodes.forEach((node) => {
      flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}` });
      if (node.children) walk(node.children, depth + 1);
    });
  }(tree.items || [], 0));
  return flat;
}

function cleanForm(modal) {
  const raw = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
  const data = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (value === '' || value === undefined) return;
    data[key] = key.endsWith('_id') || key === 'target_count' ? Number(value) : value;
  });
  return data;
}

function openTopicForm({ parentId = null, topic = null }) {
  openModal({
    title: topic ? `ویرایش مبحث: ${topic.title}` : 'افزودن مبحث آموزشی',
    body: `<form data-form="topic">
      <div class="form-grid">
        <div class="field"><label>عنوان *</label><input name="title" required value="${esc(topic ? topic.title : '')}"></div>
        <div class="field"><label>درس</label>
          <select name="subject_id">${options(store.state.subjects, topic ? topic.subject_id : store.activeSubjectId(),
            { empty: '— بدون درس —' })}</select></div>
        <div class="field"><label>وضعیت</label><select name="status">${statusOptions(topic ? topic.status : 'active')}</select></div>
        <div class="field"><label>ترتیب</label><input name="order_index" value="${topic ? topic.order_index : ''}"></div>
      </div>
      <div class="field" style="margin-top:.5rem"><label>یادداشت</label>
        <textarea name="notes" rows="2">${esc(topic ? topic.notes || '' : '')}</textarea></div>
    </form>`,
    footer: `${topic ? '<button class="btn btn-danger" data-delete>آرشیو مبحث</button>' : ''}
             <button class="btn" data-modal-close>انصراف</button>
             <button class="btn btn-primary" data-save>ذخیره</button>`,
    onMount(modal) {
      modal.querySelector('[data-save]').addEventListener('click', async () => {
        const raw = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
        const payload = {
          title: raw.title,
          subject_id: raw.subject_id ? Number(raw.subject_id) : null,
          parent_id: parentId,
          status: raw.status,
          order_index: raw.order_index ? Number(raw.order_index) : null,
          notes: raw.notes || null,
        };
        try {
          if (topic) await api.put(`/topics/${topic.id}`, payload);
          else await api.post('/topics', payload);
          closeModal(); toast('مبحث ذخیره شد', 'ok');
          const { rerender } = await import('../app.js'); await rerender();
        } catch (error) { notifyError(error); }
      });
      const remove = modal.querySelector('[data-delete]');
      if (remove) {
        remove.addEventListener('click', async () => {
          const result = await api.del(`/topics/${topic.id}`);
          closeModal();
          toast(result.archived ? 'مبحث آرشیو شد' : 'مبحث حذف شد', 'ok');
          const { rerender } = await import('../app.js'); await rerender();
        });
      }
    },
  });
}
