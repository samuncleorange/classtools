export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // 仅在有请求体时声明 JSON 内容类型;无 body 的请求(DELETE、无体 POST)不带,
  // 避免后端因 application/json + 空 body 报 400(FST_ERR_CTP_EMPTY_JSON_BODY)。
  const hasBody = init?.body != null;
  const res = await fetch(path, {
    ...init,
    credentials: init?.credentials ?? 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let code = 'error';
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
