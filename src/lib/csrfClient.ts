export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function csrfFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const csrfToken = getCsrfToken();
  const headers = new Headers(options.headers);

  if (options.method && options.method !== "GET" && options.method !== "HEAD") {
    headers.set("X-CSRF-Token", csrfToken);
  }

  return fetch(url, { ...options, headers });
}
