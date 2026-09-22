/* کتاب‌ها و درس‌ها — مرکز منابع */

import { api } from '../api.js';
import * as store from '../store.js';
import { closeModal, esc, fa, num, openModal, options, toast } from '../ui.js';

export default {
  title: 'کتاب‌ها و ساختار',
  subtitle: 'درس، کتاب و ساختار اختصاصی هر کتاب (فصل، بخش، آزمون‌های داخل کتاب)',

  async render() {
    const [books, subjects] = await Promise.all([store.loadBooks(), store.loadSubjects()]);
    const subjectRows = subjects.map((subject) => `
      <tr>
        <td><strong>${esc(subject.name)}</strong>${subject.color ? ` <span class="badge" style="background:${esc(subject.color)}22;border-color:${esc(subject.color)}55">${esc(subject.grade || '')}</span>` : (subject.grade ? ` <span class="badge">${esc(subject.grade)}</span>` : '')}</td>
        <td>${esc(subject.field_of_study || '—')}</td>
        <td>${num(subject.book_count)}</td>
        <td>${num(subject.topic_count)}</td>
        <td>${num(subject.question_count)}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="editSubject" data-id="${subject.id}">ویرایش</button>
        </td>
      </tr>`).join('');

    const bookCards = books.map((book) => `
      <div class="card">
        <div class="card-head">
          <h3>${esc(book.title)}</h3>
          <div class="actions">
            <a class="btn btn-sm btn-primary" href="#/books/${book.id}">ساختار و تست‌ها</a>
            <button class="btn btn-sm" data-action="editBook" data-id="${book.id}">ویرایش</button>
          </div>
        </div>
        <div class="kv">
          <dt>درس</dt><dd>${esc(book.subject_name || '—')}</dd>
          <dt>ناشر</dt><dd>${esc(book.publisher || '—')}</dd>
          <dt>پایه</dt><dd>${esc(book.grade || '—')}</dd>
          <dt>ویرایش/سال</dt><dd>${esc(book.edition_year || '—')}</dd>
          <dt>گره‌های ساختار</dt><dd>${num(book.node_count)}</dd>
          <dt>تست‌های ثبت‌شده</dt><dd>${num(book.question_count)}</dd>
        </div>
      </div>`).join('');

    return `
      <div class="page-head">
        <div>
          <h2>درس‌ها</h2>
          <p class="muted small">ساختار کتاب در هر درس می‌تواند متفاوت باشد؛ هیچ قالبی تحمیل نمی‌شود.</p>
        </div>
        <div class="actions">
          <button class="btn" data-action="addSubject">افزودن درس</button>
          <button class="btn btn-primary" data-action="addBook">افزودن کتاب</button>
        </div>
      </div>
      <div class="card">
        ${subjectRows ? `<div class="table-wrap"><table>
          <thead><tr><th>درس</th><th>رشته</th><th>کتاب</th><th>مبحث</th><th>تست</th><th></th></tr></thead>
          <tbody>${subjectRows}</tbody></table></div>`
          : '<div class="empty"><strong>هنوز درسی ثبت نشده است</strong><span>برای شروع یک درس (مثلاً شیمی) بسازید.</span></div>'}
      </div>
      <div class="spacer"></div>
      <h2>کتاب‌ها</h2>
      <div class="grid cols-2">${bookCards || '<div class="card"><div class="empty"><strong>کتابی ثبت نشده است</strong><span>کتاب را با ناشر، پایه و سال ویرایش وارد کنید.</span></div></div>'}</div>`;
  },

  actions: {
    addSubject() {
      openModal({
        title: 'افزودن درس',
        body: `<form data-form="subject">
          <div class="form-grid">
            <div class="field"><label>نام درس *</label><input name="name" required placeholder="شیمی"></div>
            <div class="field"><label>پایه</label><input name="grade" placeholder="یازدهم"></div>
            <div class="field"><label>رشته</label><input name="field_of_study" placeholder="ریاضی‌فیزیک"></div>
            <div class="field"><label>رنگ نمایشی</label><input name="color" type="color" value="#2563eb"></div>
          </div>
          <div class="field" style="margin-top:.6rem"><label>یادداشت</label><textarea name="notes" rows="2"></textarea></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const form = modal.querySelector('form');
            const data = Object.fromEntries(new FormData(form).entries());
            try {
              await api.post('/subjects', data);
              closeModal();
              toast('درس ثبت شد', 'ok');
              const { rerender } = await import('../app.js');
              await rerender();
            } catch (error) { const { notifyError } = await import('../ui.js'); notifyError(error); }
          });
        },
      });
    },

    async editSubject(element) {
      const id = element.dataset.id;
      const subject = store.state.subjects.find((item) => String(item.id) === String(id));
      openModal({
        title: `ویرایش درس: ${subject.name}`,
        body: `<form data-form="subject">
          <div class="form-grid">
            <div class="field"><label>نام</label><input name="name" value="${esc(subject.name)}"></div>
            <div class="field"><label>پایه</label><input name="grade" value="${esc(subject.grade || '')}"></div>
            <div class="field"><label>رشته</label><input name="field_of_study" value="${esc(subject.field_of_study || '')}"></div>
            <div class="field"><label>وضعیت</label><select name="state">
              <option value="active">فعال</option><option value="archived">آرشیو</option></select></div>
          </div>
          <div class="field" style="margin-top:.6rem"><label>یادداشت</label>
            <textarea name="notes" rows="2">${esc(subject.notes || '')}</textarea></div>
        </form>`,
        footer: `<button class="btn btn-danger" data-delete>آرشیو درس</button>
                 <button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            try {
              await api.put(`/subjects/${id}`, data);
              closeModal(); toast('ذخیره شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { const { notifyError } = await import('../ui.js'); notifyError(error); }
          });
          modal.querySelector('[data-delete]').addEventListener('click', async () => {
            try {
              const result = await api.del(`/subjects/${id}`);
              closeModal();
              toast(result.archived ? 'درس آرشیو شد' : 'درس حذف شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { const { notifyError } = await import('../ui.js'); notifyError(error); }
          });
        },
      });
    },

    async addBook() {
      if (!store.state.subjects.length) { toast('ابتدا یک درس بسازید', 'warn'); return; }
      openModal({
        title: 'افزودن کتاب',
        body: `<form data-form="book">
          <div class="form-grid">
            <div class="field"><label>عنوان کتاب *</label><input name="title" required placeholder="شیمی ۲ مبتکران"></div>
            <div class="field"><label>درس</label><select name="subject_id">${options(store.state.subjects, store.activeSubjectId())}</select></div>
            <div class="field"><label>ناشر</label><input name="publisher" placeholder="مبتکران"></div>
            <div class="field"><label>پایه</label><input name="grade" placeholder="یازدهم"></div>
            <div class="field"><label>رشته</label><input name="field_of_study" placeholder="ریاضی‌فیزیک"></div>
            <div class="field"><label>ویرایش / سال</label><input name="edition_year" placeholder="1403/1404"></div>
          </div>
          <div class="field" style="margin-top:.6rem"><label>یادداشت</label><textarea name="notes" rows="2"></textarea></div>
        </form>`,
        footer: `<button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            try {
              const book = await api.post('/books', data);
              closeModal(); toast('کتاب ثبت شد', 'ok');
              window.location.hash = `#/books/${book.id}`;
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { const { notifyError } = await import('../ui.js'); notifyError(error); }
          });
        },
      });
    },

    async editBook(element) {
      const id = element.dataset.id;
      const book = store.state.books.find((item) => String(item.id) === String(id));
      openModal({
        title: `ویرایش کتاب: ${book.title}`,
        body: `<form data-form="book">
          <div class="form-grid">
            <div class="field"><label>عنوان</label><input name="title" value="${esc(book.title)}"></div>
            <div class="field"><label>درس</label><select name="subject_id">${options(store.state.subjects, book.subject_id)}</select></div>
            <div class="field"><label>ناشر</label><input name="publisher" value="${esc(book.publisher || '')}"></div>
            <div class="field"><label>پایه</label><input name="grade" value="${esc(book.grade || '')}"></div>
            <div class="field"><label>ویرایش/سال</label><input name="edition_year" value="${esc(book.edition_year || '')}"></div>
            <div class="field"><label>وضعیت</label><select name="state">
              <option value="active" ${book.state === 'active' ? 'selected' : ''}>فعال</option>
              <option value="archived" ${book.state === 'archived' ? 'selected' : ''}>آرشیو</option></select></div>
          </div>
          <div class="field" style="margin-top:.6rem"><label>یادداشت</label>
            <textarea name="notes" rows="2">${esc(book.notes || '')}</textarea></div>
        </form>`,
        footer: `<button class="btn btn-danger" data-delete>آرشیو کتاب</button>
                 <button class="btn" data-modal-close>انصراف</button>
                 <button class="btn btn-primary" data-save>ذخیره</button>`,
        onMount(modal) {
          modal.querySelector('[data-save]').addEventListener('click', async () => {
            const data = Object.fromEntries(new FormData(modal.querySelector('form')).entries());
            try {
              await api.put(`/books/${id}`, data);
              store.invalidateBookTree(Number(id));
              closeModal(); toast('ذخیره شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { const { notifyError } = await import('../ui.js'); notifyError(error); }
          });
          modal.querySelector('[data-delete]').addEventListener('click', async () => {
            try {
              const result = await api.del(`/books/${id}`);
              closeModal();
              toast(result.archived ? 'کتاب آرشیو شد (سابقه حفظ شد)' : 'کتاب حذف شد', 'ok');
              const { rerender } = await import('../app.js'); await rerender();
            } catch (error) { const { notifyError } = await import('../ui.js'); notifyError(error); }
          });
        },
      });
    },
  },
};
