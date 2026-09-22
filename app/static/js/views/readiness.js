/* آمادگی آزمون — برنامه آزمون آینده، انتخاب مباحث و برآورد آمادگی */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, emptyState, esc, fa, meter, notifyError, num, openModal, options, pct, toast } from '../ui.js';

export default {
  title: 'آمادگی آزمون',
  subtitle: 'برآورد احتمالی از عملکرد آینده به‌همراه فهرست کار و مرور پیشنهادی',

  async render() {
    const plans = await api.get('/plans');
    const tree = await api.get('/topics/tree', { subject_id: store.activeSubjectId() || '' });
    const flat = [];
    (function walk(nodes, depth) {
      nodes.forEach((node) => {
        flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}` });
        if (node.children) walk(node.children, depth + 1);
      });
    }(tree.items || [], 0));

    const cards = (plans.items || []).map((plan) => {
      const details = plan.details || {};
      const components = details.components || {};
      return `
      <div class="card">
        <div class="card-head">
          <h3>${esc(plan.title)}</h3>
          <div class="actions">
            <button class="btn btn-sm btn-primary" data-action="evaluate" data-id="${plan.id}">برآورد مجدد</button>
            <button class="btn btn-sm" data-action="editTopics" data-id="${plan.id}">مباحث</button>
            <button class="btn btn-sm" data-action="edit" data-id="${plan.id}">ویرایش</button>
            <button class="btn btn-sm btn-danger" data-action="remove" data-id="${plan.id}">حذف</button>
          </div>
        </div>
        <div class="grid cols-3">
          <div class="stat ${plan.readiness_estimate >= 70 ? 'ok' : plan.readiness_estimate >= 45 ? 'warn' : 'bad'}">
            <span class="label">برآورد آمادگی</span>
            <div class="value">${plan.readiness_estimate === null ? '—' : pct(plan.readiness_estimate)}</div>
            <span class="hint">اطمینان داده: ${details.confidence === undefined ? '—' : pct(details.confidence)}</span>
          </div>
          <div class="stat"><span class="label">تاریخ آزمون</span>
            <div class="value" style="font-size:1.1rem">${esc(plan.exam_date || 'تعیین نشده')}</div>
            <span class="hint">${plan.days_remaining === null ? '' : `${num(plan.days_remaining)} روز باقی‌مانده`}</span></div>
          <div class="stat"><span class="label">مباحث انتخابی</span>
            <div class="value">${num(plan.topic_count)}</div>
            <span class="hint">${esc((store.state.labels.preparation_status || {})[plan.preparation_status] || plan.preparation_status)}</span></div>
        </div>
        <div class="spacer"></div>
        ${Object.keys(components).length ? `
          <h4>مؤلفه‌های برآورد</h4>
          <div class="table-wrap"><table>
            <thead><tr><th>مؤلفه</th><th>امتیاز</th><th></th><th>توضیح</th></tr></thead>
            <tbody>${Object.entries(components).map(([key, value]) => `<tr>
              <td>${esc(value.label || key)}</td>
              <td>${pct(value.score)}</td>
              <td>${meter(value.score, 100, value.score >= 70 ? 'ok' : value.score >= 45 ? 'warn' : 'bad')}</td>
              <td class="small muted">${esc(value.detail || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <div class="spacer"></div>
        ${(details.recommendations || []).length ? `
          <div class="banner warn"><div>
            <strong>پیشنهادهای کاری</strong>
            <ul style="margin:.3rem 0 0;padding-inline-start:1.1rem">
              ${details.recommendations.map((item) => `<li>${esc(item)}</li>`).join('')}
            </ul></div></div>` : ''}
        <div class="spacer"></div>
        <p class="muted tiny">${esc('این برآورد یک تخمین احتمالی است و تضمین نتیجه آزمون نیست.')}</p>
      </div>`;
    }).join('');

    return `
      <div class="page-head">
        <div><h2>برنامه‌های آزمون آینده</h2>
          <p class="muted small">مباحث را مستقل از کتاب انتخاب کنید؛ برآورد از داده‌های ثبت‌شده محاسبه می‌شود.</p></div>
        <div class="actions">
          <button class="btn btn-primary" data-action="add">برنامه آزمون جدید</button>
        </div>
      </div>
      ${cards || `<div class="card">${emptyState('برنامه‌ای ثبت نشده است',
        'برای آزمون آینده مباحث را انتخاب کنید تا برآورد آمادگی و فهرست کار ساخته شود.')}</div>`}
      <div class="spacer"></div>
      <div class="card">
        <div class="card-head"><h2>تحلیل بدون ذخیره برنامه</h2></div>
        <p class="card-sub">اگر فقط می‌خواهید وضعیت فعلی چند مبحث را ببینید، بدون ساخت برنامه برآورد بگیرید.</p>
        <form data-form="adhoc">
          <div class="form-grid">
            <div class="field"><label>مباحث (چند انتخاب با Ctrl)</label>
              <select name="topic_ids" multiple size="8">${options(flat, '')}</select></div>
            <div class="field"><label>تاریخ آزمون (اختیاری)</label><input name="exam_date" placeholder="1404/08/10"></div>
          </div>
          <div class="spacer"></div>
          <button class="btn btn-primary" type="submit">محاسبه برآورد</button>
        </form>
        <div id="adhoc-result"></div>
      </div>`;
  },

  actions: {
    async add() {
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
        title: 'برنامه آزمون آینده',
        body: `<form data-form="plan">
          <div class="form-grid">
            <div class="field"><label>عنوان *</label><input name="title" required placeholder="آزمون جامع آبان"></div>
            <div class="field"><label>تاریخ آزمون</label><input name="exam_date" placeholder="1404/08/10"></div>
            <div class="field"><label>هدف</label><input name="target" placeholder="مثلاً بالای ۷۰٪"></div>
            <div class="field"><label>وضعیت آماده‌سازی</label><select name="preparation_status">
              ${Object.entries(store.state.labels.preparation_status || {}).map(([value, label]) =>
                `<option value="${value}">${esc(label)}</option>`).join('')}</select></div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>مباحث آزمون (چند انتخاب با Ctrl)</label>
            <select name="topic_ids" multiple size="8">${options(flat, '')}</select></div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label><textarea name="notes" rows="2"></textarea></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ساخت و برآورد</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const form = modal.querySelector('form');
            const data = Object.fromEntries(new FormData(form).entries());
            const topicIds = Array.from(form.querySelector('[name=topic_ids]').selectedOptions)
              .map((option) => Number(option.value));
            if (!topicIds.length) { toast('حداقل یک مبحث انتخاب کنید', 'warn'); return; }
            try {
              await api.post('/plans', {
                title: data.title, exam_date: data.exam_date || null,
                target: data.target || null, preparation_status: data.preparation_status,
                notes: data.notes || null, topic_ids: topicIds, generate_review: true,
              });
              closeModal(); toast('برنامه ساخته و برآورد شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { notifyError(error); }
          });
        },
      });
    },

    async evaluate(element) {
      const result = await api.post(`/plans/${element.dataset.id}/evaluate`, { generate_review: true });
      toast(`برآورد: ${fa(result.readiness_estimate ?? 0)}٪`, 'ok');
      const { rerender } = await import('../app.js'); await rerender();
    },

    async edit(element) {
      const plan = await api.get(`/plans/${element.dataset.id}`);
      openModal({
        title: 'ویرایش برنامه',
        body: `<form data-form="planEdit">
          <div class="form-grid">
            <div class="field"><label>عنوان</label><input name="title" value="${esc(plan.title)}"></div>
            <div class="field"><label>تاریخ آزمون</label><input name="exam_date" value="${esc(plan.exam_date || '')}"></div>
            <div class="field"><label>هدف</label><input name="target" value="${esc(plan.target || '')}"></div>
            <div class="field"><label>وضعیت</label><select name="preparation_status">
              ${Object.entries(store.state.labels.preparation_status || {}).map(([value, label]) =>
                `<option value="${value}" ${plan.preparation_status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}
            </select></div>
          </div>
          <div class="field" style="margin-top:.5rem"><label>یادداشت</label>
            <textarea name="notes" rows="2">${esc(plan.notes || '')}</textarea></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            await api.put(`/plans/${plan.id}`, data);
            closeModal(); toast('ذخیره شد', 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          });
        },
      });
    },

    async editTopics(element) {
      const plan = await api.get(`/plans/${element.dataset.id}`);
      const tree = await api.get('/topics/tree', { subject_id: store.activeSubjectId() || '' });
      const flat = [];
      (function walk(nodes, depth) {
        nodes.forEach((node) => {
          flat.push({ id: node.id, title: `${'— '.repeat(depth)}${node.title}` });
          if (node.children) walk(node.children, depth + 1);
        });
      }(tree.items || [], 0));
      const selected = plan.topics.map((topic) => topic.id);
      openModal({
        title: 'مباحث برنامه',
        body: `<form data-form="planTopics">
          <div class="field"><label>مباحث (چند انتخاب با Ctrl)</label>
            <select name="topic_ids" multiple size="10">
              ${flat.map((option) => `<option value="${option.id}" ${selected.includes(option.id) ? 'selected' : ''}>${esc(option.title)}</option>`).join('')}
            </select></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره و برآورد</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const form = modal.querySelector('form');
            const ids = Array.from(form.querySelector('[name=topic_ids]').selectedOptions)
              .map((option) => Number(option.value));
            await api.put(`/plans/${plan.id}/topics`, { topics: ids.map((id) => ({ topic_id: id })) });
            await api.post(`/plans/${plan.id}/evaluate`, { generate_review: true });
            closeModal(); toast('ذخیره و برآورد شد', 'ok');
            const { rerender } = await import('../app.js'); await rerender();
          });
        },
      });
    },

    async remove(element) {
      const ui = await import('../ui.js');
      const confirmed = await ui.confirmDialog('این برنامه حذف شود؟ موارد مرور ساخته‌شده برای آن آرشیو می‌شوند.');
      if (!confirmed) return;
      await api.del(`/plans/${element.dataset.id}`);
      toast('برنامه حذف شد', 'ok');
      const { rerender } = await import('../app.js'); await rerender();
    },
  },

  async submit(name, form) {
    if (name === 'adhoc') {
      const data = Object.fromEntries(new FormData(form).entries());
      const topicIds = Array.from(form.querySelector('[name=topic_ids]').selectedOptions)
        .map((option) => Number(option.value));
      if (!topicIds.length) { toast('حداقل یک مبحث انتخاب کنید', 'warn'); return; }
      const result = await api.post('/readiness/analyze', {
        topic_ids: topicIds, exam_date: data.exam_date || null,
      });
      document.getElementById('adhoc-result').innerHTML = `
        <div class="spacer"></div>
        <div class="grid cols-4">
          <div class="stat"><span class="label">برآورد آمادگی</span>
            <div class="value">${pct(result.estimate)}</div>
            <span class="hint">اطمینان: ${pct(result.confidence)}</span></div>
          <div class="stat"><span class="label">تست‌های مباحث</span><div class="value">${num(result.summary.questions)}</div></div>
          <div class="stat"><span class="label">تلاش‌شده</span><div class="value">${num(result.summary.attempted)}</div></div>
          <div class="stat"><span class="label">مورد مرور باز</span><div class="value">${num(result.summary.open_reviews)}</div></div>
        </div>
        <div class="spacer"></div>
        <div class="table-wrap"><table>
          <thead><tr><th>مؤلفه</th><th>امتیاز</th><th></th><th>توضیح</th></tr></thead>
          <tbody>${Object.entries(result.components).map(([key, value]) => `<tr>
            <td>${esc(value.label || key)}</td><td>${pct(value.score)}</td>
            <td>${meter(value.score, 100, value.score >= 70 ? 'ok' : value.score >= 45 ? 'warn' : 'bad')}</td>
            <td class="small muted">${esc(value.detail || '')}</td></tr>`).join('')}</tbody></table></div>
        <div class="spacer"></div>
        ${result.recommendations.length ? `<div class="banner warn"><div><strong>پیشنهادها</strong>
          <ul style="margin:.3rem 0 0;padding-inline-start:1.1rem">
            ${result.recommendations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div></div>` : ''}
        <div class="spacer"></div>
        <div class="table-wrap"><table>
          <thead><tr><th>مبحث</th><th>تست</th><th>تلاش</th><th>دقت</th><th>تدریس</th><th>مرور باز</th></tr></thead>
          <tbody>${(result.weak_topics || []).map((topic) => `<tr>
            <td>${esc(topic.title)}</td><td>${num(topic.question_count)}</td><td>${num(topic.attempts)}</td>
            <td>${topic.accuracy === null ? '—' : pct(topic.accuracy)}</td>
            <td>${esc((store.state.labels.taught_status || {})[topic.taught_status] || topic.taught_status)}</td>
            <td>${num(topic.open_items)}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted tiny" style="margin-top:.5rem">${esc(result.disclaimer)}</p>`;
      toast('برآورد محاسبه شد', 'ok');
    }
  },
};
