export type ApiRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (payload: unknown) => void;
  end: (payload?: string) => void;
};

export function sendJson(res: ApiResponse, statusCode: number, payload: unknown) {
  res.setHeader("Content-Type", "application/json");
  res.status(statusCode).json(payload);
}

export function getBearerHeader(headers: ApiRequest["headers"]) {
  const authorization = headers.authorization;
  if (Array.isArray(authorization)) return authorization[0];
  return authorization;
}

export function parseJsonBody<T>(body: unknown): T {
  if (typeof body === "string") {
    return JSON.parse(body) as T;
  }
  return body as T;
}
