/* آزمون دودی رابط کاربری بدون مرورگر
 *
 * با jsdom صفحه واقعی index.html را می‌سازد، ماژول‌های ES رابط را در Node بار می‌کند و
 * همه مسیرهای برنامه را با داده واقعی سرور TSP می‌گذراند؛ هر خطای جاوااسکریپت
 * یا پاسخ خالی/خطای شبکه گزارش می‌شود.
 *
 * پیش‌نیاز:
 *     npm install jsdom            # یک‌بار، بیرون از مخزن یا در /tmp
 *     python3 run.py --port 8787   # سرور در حال اجرا
 * اجرا:
 *     node tests/ui_smoke.mjs [baseUrl]
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch {
  for (const candidate of ['/tmp/node_modules/jsdom', '/usr/lib/node_modules/jsdom']) {
    try { ({ JSDOM } = require(candidate)); break; } catch { /* ادامه */ }
  }
}
if (!JSDOM) {
  console.error('jsdom نصب نیست؛ ابتدا «npm install jsdom» را اجرا کنید.');
  process.exit(2);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const html = readFileSync(resolve(ROOT, 'app/static/index.html'), 'utf8');

const dom = new JSDOM(html, { url: BASE + '/', pretendToBeVisual: true });
const { window } = dom;

/* پیش‌نیازهای مرورگر که jsdom ندارد */
window.FormData = window.FormData || FormData;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
window.scrollTo = () => {};
window.alert = () => {};

for (const key of ['window', 'document', 'navigator', 'location', 'HTMLElement', 'customElements',
  'Event', 'CustomEvent', 'FormData', 'File', 'Blob', 'URL', 'URLSearchParams',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'localStorage',
  'Node', 'NodeList', 'DOMParser', 'matchMedia', 'confirm', 'prompt']) {
  if (!(key in window)) continue;
  try {
    Object.defineProperty(globalThis, key, {
      value: window[key], writable: true, configurable: true,
    });
  } catch { /* برخی ویژگی‌ها فقط‌خواندنی‌اند (مثل navigator) */ }
}
globalThis.window = window;
globalThis.document = window.document;

const errors = [];
window.addEventListener('error', (event) => errors.push(`window.error: ${event.message}`));
window.addEventListener('unhandledrejection', (event) => errors.push(`unhandled: ${event.reason}`));
process.on('unhandledRejection', (reason) => errors.push(`unhandled(node): ${reason}`));

/* رهگیری درخواست‌های ناکام (fetch اصلی پیش از هر بازنویسی ذخیره می‌شود) */
const failed = [];
const nativeFetch = globalThis.fetch.bind(globalThis);
const trackingFetch = async (input, init) => {
  const url = String(input);
  const response = await nativeFetch(input, init);
  if (!response.ok) failed.push(`${(init && init.method) || 'GET'} ${url} → ${response.status}`);
  return response;
};
globalThis.fetch = window.fetch = trackingFetch;

const mod = await import(pathToFileURL(resolve(ROOT, 'app/static/js/app.js')).href);
const app = mod.default || mod.app || window.tspApp;

const routes = [
  ['#/dashboard', 'داشبورد'], ['#/books', 'کتاب'], ['#/topics', 'مبحث'],
  ['#/questions', 'بانک تست'], ['#/entry', 'ثبت سؤال'], ['#/history', 'سابقه'],
  ['#/review', 'مرور'], ['#/teaching', 'تدریس'], ['#/exams', 'آزمون'],
  ['#/readiness', 'آمادگی'], ['#/analytics', 'تحلیل'], ['#/settings', 'داده'],
];

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const results = [];
for (const [hash, expect] of routes) {
  const before = errors.length;
  window.location.hash = hash;
  await sleep(700);
  const main = window.document.querySelector('#view, main, #app, .content') || window.document.body;
  const text = (main.textContent || '').trim();
  results.push({ hash, chars: text.length, expected: text.includes(expect),
                 newErrors: errors.slice(before).length });
}

/* صفحه جزئیات کتاب/آزمون در صورت وجود داده */
const api = async (path) => (await fetch(BASE + '/api' + path)).json();
try {
  const books = await api('/books');
  if (books.items && books.items.length) {
    window.location.hash = `#/books/${books.items[0].id}`;
    await sleep(700);
    const text = (window.document.querySelector('#view, main, #app') || window.document.body).textContent;
    results.push({ hash: `#/books/${books.items[0].id}`, chars: text.trim().length,
                   expected: true, newErrors: 0 });
  }
  const exams = await api('/exams');
  if (exams.items && exams.items.length) {
    const exam = exams.items[0];
    const before = errors.length;
    window.location.hash = `#/exams/${exam.id}`;
    await sleep(700);
    const view = window.document.querySelector('#view');
    results.push({ hash: `#/exams/${exam.id}`, chars: view.textContent.trim().length,
                   expected: view.textContent.includes(exam.title), newErrors: errors.length - before });
    const attempts = await api(`/exam-attempts?exam_id=${exam.id}`);
    const attempt = (attempts.items || [])[0];
    if (attempt) {
      const mark = errors.length;
      window.location.hash = `#/exams/${exam.id}/attempt/${attempt.id}`;
      await sleep(800);
      const panel = window.document.querySelector('#view');
      results.push({ hash: `#/exams/${exam.id}/attempt/${attempt.id}`,
                     chars: panel.textContent.trim().length, expected: true,
                     newErrors: errors.length - mark });
    }
  }
} catch (error) {
  errors.push(`detail routes: ${error}`);
}

/* ---------------------------------------------------------------------------
   تعامل‌های واقعی: کلیک منو، فرم ورود، تغییر فیلترها
   --------------------------------------------------------------------------- */
const interactions = [];
function note(name, ok, extra = '') {
  interactions.push({ name, ok, extra });
}

/* کلیک روی همه گزینه‌های منو */
for (const link of window.document.querySelectorAll('#nav a')) {
  const before = errors.length;
  link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(450);
  const title = window.document.getElementById('page-title').textContent.trim();
  note(`منو → ${link.textContent.trim()}`, title.length > 1 && errors.length === before, title);
}

/* تغییر فیلتر در بانک تست */
window.location.hash = '#/questions';
await sleep(600);
const select = window.document.querySelector('#view select[data-change]');
if (select) {
  const before = errors.length;
  const option = Array.from(select.options).find((item) => item.value);
  select.value = option ? option.value : select.value;
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(600);
  note('تغییر فیلتر بانک تست', errors.length === before,
       option ? option.textContent.trim() : 'بدون گزینه');
} else {
  note('تغییر فیلتر بانک تست', false, 'فیلتر پیدا نشد');
}

/* بازکردن پنجره «ثبت سریع سؤال» */
{
  const before = errors.length;
  const trigger = window.document.querySelector('[data-action="global:quickEntry"]');
  trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(900);
  const modal = window.document.getElementById('modal-root');
  note('پنجره ثبت سریع سؤال',
       !modal.hidden && modal.querySelector('form') !== null && errors.length === before,
       `${modal.querySelectorAll('input,select').length} فیلد`);
  const closer = modal.querySelector('[data-modal-close]');
  if (closer) closer.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(200);
}

console.log('\nتعامل‌ها:');
for (const row of interactions) {
  console.log(`  ${row.ok ? '✔' : '✘'} ${row.name}${row.extra ? ' — ' + row.extra : ''}`);
}
const badInteractions = interactions.filter((row) => !row.ok);

console.log('\nمسیر                      نویسه  انتظار  خطای تازه');
for (const row of results) {
  console.log(`${row.hash.padEnd(24)} ${String(row.chars).padStart(6)}  ${row.expected ? '✔' : '✘'}       ${row.newErrors}`);
}
const emptyViews = results.filter((row) => row.chars < 40);
const missing = results.filter((row) => !row.expected);
console.log('\nدرخواست‌های ناموفق:', failed.length ? failed : 'هیچ');
console.log('خطاهای جاوااسکریپت:', errors.length ? errors : 'هیچ');
console.log('نمای خالی:', emptyViews.length ? emptyViews.map((r) => r.hash) : 'هیچ');
console.log('نمای بی‌متن مورد انتظار:', missing.length ? missing.map((r) => r.hash) : 'هیچ');

const ok = !errors.length && !failed.length && !emptyViews.length && !missing.length
  && !badInteractions.length;
console.log(ok ? '\nنتیجه: رابط کاربری سالم است ✅' : '\nنتیجه: ایراد یافت شد ❌');
process.exit(ok ? 0 : 1);
