/* لایه ارتباط با API — همه مسیرها نسبی هستند تا در پیش‌نمایش و شبکه هم کار کند. */

const BASE = '/api';

class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || {};
  }
}

async function request(method, path, body, options = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, Array.isArray(value) ? value.join(',') : value);
      }
    });
  }
  const init = { method, headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new ApiError('ارتباط با سرور برقرار نشد. مطمئن شوید برنامه در حال اجراست.', 0);
  }
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  if (!response.ok) {
    throw new ApiError((payload && (payload.error || payload.message)) || 'خطای نامشخص',
      response.status, payload && payload.errors);
  }
  return payload;
}

export const api = {
  get: (path, query) => request('GET', path, undefined, { query }),
  post: (path, body) => request('POST', path, body === undefined ? {} : body),
  put: (path, body) => request('PUT', path, body === undefined ? {} : body),
  patch: (path, body) => request('PATCH', path, body === undefined ? {} : body),
  del: (path, query) => request('DELETE', path, undefined, { query }),
  upload: (path, file, fields = {}) => {
    const form = new FormData();
    form.append('file', file, file.name);
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') form.append(key, value);
    });
    return request('POST', path, form);
  },
  /** آدرس دانلود/نمایش فایل (بدون fetch تا مرورگر خودش مدیریت کند). */
  fileUrl: (path, query) => {
    const url = new URL(BASE + path, window.location.origin);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
    }
    return url.toString();
  },
};

export { ApiError };
