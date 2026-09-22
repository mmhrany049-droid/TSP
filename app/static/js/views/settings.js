/* داده و پشتیبان — صدور/ورود، پشتیبان فیزیکی، CSV، داده نمونه و بررسی یکپارچگی */

import { api } from '../api.js';
import * as store from '../store.js';
import { bytes, esc, fa, notifyError, num, toast } from '../ui.js';

export default {
  title: 'داده و پشتیبان',
  subtitle: 'حفظ و انتقال داده‌ها؛ هیچ داده‌ای بدون پشتیبان جایگزین نمی‌شود',

  async render() {
    const [health, backups, integrity, sample] = await Promise.all([
      api.get('/health'),
      api.get('/backups'),
      api.get('/integrity'),
      api.get('/sample/status'),
    ]);
    const backupRows = (backups.items || []).map((item) => `
      <tr>
        <td class="mono">${esc(item.file)}</td>
        <td>${bytes(item.byte_size)}</td>
        <td class="actions"><a class="btn btn-sm" href="${api.fileUrl('/export')}">—</a></td>
      </tr>`).join('');

    return `
      <div class="grid cols-4">
        <div class="stat"><span class="label">نسخه برنامه</span><div class="value" style="font-size:1.1rem">${esc(health.version)}</div></div>
        <div class="stat ${integrity.warnings ? 'warn' : 'ok'}"><span class="label">سلامت داده</span>
          <div class="value" style="font-size:1.1rem">${num(integrity.passed)} / ${num(integrity.total_checks)}</div>
          <span class="hint">${num(integrity.warnings)} هشدار</span></div>
        <div class="stat"><span class="label">پشتیبان‌های موجود</span><div class="value">${num((backups.items || []).length)}</div></div>
        <div class="stat ${sample.available ? 'warn' : ''}"><span class="label">پایگاه داده</span>
          <div class="value" style="font-size:1.1rem">${sample.available ? 'خالی' : 'دارای داده'}</div></div>
      </div>
      <div class="spacer"></div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>پشتیبان‌گیری و صدور داده</h2></div>
          <p class="card-sub">پشتیبان فیزیکی از فایل پایگاه داده گرفته می‌شود؛ صدور JSON برای انتقال بین دستگاه‌ها مناسب است.</p>
          <div class="row">
            <button class="btn btn-primary" data-action="backup">گرفتن پشتیبان فیزیکی</button>
            <a class="btn" href="${api.fileUrl('/export', { download: 1 })}">دریافت صدور کامل JSON</a>
            <a class="btn" href="${api.fileUrl('/export', { download: 1, include_activity: 1 })}">صدور همراه رویدادها</a>
          </div>
          <div class="spacer"></div>
          ${backupRows ? `<div class="table-wrap"><table>
            <thead><tr><th>فایل پشتیبان</th><th>حجم</th><th></th></tr></thead><tbody>${backupRows}</tbody></table></div>`
            : '<p class="muted small">پشتیبانی گرفته نشده است.</p>'}
        </div>

        <div class="card">
          <div class="card-head"><h2>ورود داده</h2></div>
          <form data-form="import">
            <div class="field"><label>فایل بسته JSON</label><input type="file" name="file" accept=".json"></div>
            <div class="field" style="margin-top:.5rem"><label>حالت ورود</label>
              <select name="mode">
                <option value="merge">افزودن (merge) — ردیف‌های تکراری رد می‌شوند</option>
                <option value="replace">جایگزینی (replace) — ابتدا پشتیبان گرفته می‌شود</option>
              </select></div>
            <div class="spacer"></div>
            <button class="btn btn-primary" type="submit">ورود داده</button>
          </form>
          <div class="spacer"></div>
          <div class="banner warn"><div>
            در حالت جایگزینی، پیش از پاک‌سازی، به‌صورت خودکار پشتیبان فیزیکی گرفته می‌شود.
          </div></div>
        </div>
      </div>
      <div class="spacer"></div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>ورود گروهی تست با CSV</h2></div>
          <p class="card-sub">ستون‌ها: کتاب، مسیر گره ساختاری، شماره، کد، کلید، سختی ناشر، مبحث‌ها، مرجع،
          یادداشت، مهم، سخت، نتیجه، پاسخ کاربر. اگر «گره ساختاری» وجود نداشته باشد ساخته می‌شود و
          اگر «نتیجه/پاسخ» پر باشد، به سابقه قبلی هم اضافه می‌شود.</p>
          <div class="row">
            <a class="btn" href="${api.fileUrl('/csv/template')}">دریافت قالب CSV</a>
          </div>
          <div class="spacer"></div>
          <form data-form="csv">
            <div class="field"><label>فایل CSV</label><input type="file" name="file" accept=".csv"></div>
            <div class="spacer"></div>
            <label class="check"><input type="checkbox" name="dry_run"> بررسی بدون ثبت (آزمایشی)</label>
            <div class="spacer"></div>
            <button class="btn btn-primary" type="submit">ورود تست‌ها</button>
          </form>
        </div>

        <div class="card">
          <div class="card-head"><h2>ابزارهای دیگر</h2></div>
          <div class="stack">
            <div>
              <button class="btn" data-action="integrity">اجرای بررسی یکپارچگی</button>
              <button class="btn" data-action="rebuildReview">بازسازی فهرست مرور</button>
            </div>
            <div>
              <button class="btn ${sample.available ? 'btn-primary' : ''}" data-action="loadSample"
                ${sample.available ? '' : 'disabled'}>بارگذاری داده نمونه شیمی ۲ مبتکران</button>
              <p class="muted tiny">بارگذاری نمونه فقط روی پایگاه داده خالی ممکن است تا با داده واقعی مخلوط نشود.</p>
            </div>
            <div class="banner info"><div>
              <strong>پشتیبان‌گیری دوره‌ای:</strong> فایل پایگاه داده در پوشه
              <span class="mono">data/tsp.db</span> قرار دارد و پوشه
              <span class="mono">data/backups</span> نسخه‌های پشتیبان را نگه می‌دارد.
            </div></div>
          </div>
        </div>
      </div>
      <div class="spacer"></div>

      <div class="card">
        <div class="card-head"><h2>نتیجه بررسی یکپارچگی</h2>
          <div class="actions"><span class="badge">${esc(integrity.checked_at)}</span></div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>وضعیت</th><th>بررسی</th><th>تعداد</th><th>قاعده</th></tr></thead>
          <tbody>${integrity.checks.map((check) => `<tr>
            <td>${check.status === 'ok' ? '<span class="badge ok">سالم</span>' : '<span class="badge warn">هشدار</span>'}</td>
            <td>${esc(check.title)}</td><td>${num(check.count)}</td>
            <td class="small muted">${esc(check.rule)}</td></tr>`).join('')}</tbody></table></div>
      </div>`;
  },

  actions: {
    async backup() {
      const result = await api.post('/backup', {});
      toast(`پشتیبان ساخته شد: ${result.file}`, 'ok');
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async integrity() {
      const result = await api.get('/integrity');
      toast(result.warnings ? `${fa(result.warnings)} هشدار در داده‌ها` : 'داده‌ها سالم است',
        result.warnings ? 'warn' : 'ok');
      const { rerender } = await import('../app.js');
      await rerender();
    },

    async rebuildReview() {
      const result = await api.post('/reviews/sync');
      toast(`فهرست مرور بازسازی شد — ${fa(result.open_items)} مورد باز`, 'ok');
    },

    async loadSample() {
      const ui = await import('../ui.js');
      const confirmed = await ui.confirmDialog(
        'داده نمونه شیمی ۲ مبتکران (ساختار فصل ۱ و ۲، تست‌ها، سابقه قبلی و چند تلاش) بارگذاری شود؟',
        { title: 'بارگذاری داده نمونه', confirmLabel: 'بارگذاری', danger: false });
      if (!confirmed) return;
      try {
        const result = await api.post('/sample/load', {});
        toast(`داده نمونه بارگذاری شد — ${fa(result.questions)} تست`, 'ok');
        const { rerender } = await import('../app.js');
        await store.refreshAll();
        window.location.hash = '#/dashboard';
        await rerender();
      } catch (error) { notifyError(error); }
    },
  },

  async submit(name, form) {
    if (name === 'import') {
      const input = form.querySelector('input[type=file]');
      const mode = form.querySelector('[name=mode]').value;
      if (!input.files || !input.files[0]) { toast('فایلی انتخاب نشده است', 'warn'); return; }
      const result = await api.upload('/import/file', input.files[0], { mode });
      const inserted = Object.values(result.inserted || {}).reduce((sum, value) => sum + value, 0);
      toast(`ورود انجام شد — ${fa(inserted)} ردیف افزوده شد`, 'ok');
      await store.refreshAll();
      const { rerender } = await import('../app.js');
      await rerender();
    }
    if (name === 'csv') {
      const input = form.querySelector('input[type=file]');
      const dryRun = form.querySelector('[name=dry_run]').checked;
      if (!input.files || !input.files[0]) { toast('فایلی انتخاب نشده است', 'warn'); return; }
      const result = await api.upload('/csv/questions', input.files[0],
        { dry_run: dryRun ? 'true' : '', book_id: store.activeSubjectId() ? '' : '' });
      toast(`${dryRun ? 'بررسی' : 'ورود'} انجام شد — ${fa(result.created)} تست` +
        (result.errors.length ? ` | خطا: ${fa(result.errors.length)}` : ''),
        result.errors.length ? 'warn' : 'ok');
      await store.refreshAll();
      const { rerender } = await import('../app.js');
      await rerender();
    }
  },
};
