const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru";

type FrappeResponse<T> = {
  message: T;
};

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token": getCsrfToken(),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API ${res.status}: ${error}`);
  }

  const data: FrappeResponse<T> = await res.json();
  return data.message;
}

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match?.[1] ?? "";
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  method: <T>(method: string, params?: Record<string, unknown>) =>
    request<T>(`/api/method/${method}`, {
      method: "POST",
      body: JSON.stringify(params ?? {}),
    }),
};
