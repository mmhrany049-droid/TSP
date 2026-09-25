export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const TOKEN_KEY = "tsp.access_token";

export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  return configured || "/api/v1";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function readError(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) return detail;
      if (Array.isArray(detail)) {
        const messages = detail
          .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : ""))
          .filter(Boolean);
        if (messages.length) return messages.join(" ");
      }
    }
  } catch {
    return "درخواست ناموفق بود.";
  }
  return "درخواست ناموفق بود.";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "اتصال به سرور برقرار نشد. بک‌اند را روی پورت ۸۰۰۰ اجرا کنید.");
  }

  if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    clearToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
