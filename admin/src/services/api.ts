export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Request": "1",
      ...options.headers,
    },
  });
  const data = await response
    .json()
    .catch(() => ({ message: "Invalid server response." }));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(response.status, data.message || "Request failed.");
  }
  return data as T;
}
export type Config = {
  id: string;
  name: string;
  maxWaves: number;
  status: string;
  updatedAt: string;
};
export type Audit = {
  id: string;
  action: string;
  actor: string;
  target: string;
  createdAt: string;
};
export type DashboardData = {
  source: "api";
  metrics: {
    activePlayers: number | null;
    gameSessions: number | null;
    publishedConfiguration: number;
    scheduledEvents: number | null;
    gameplayPerformance: number | null;
  };
  health: { adminApi: string; gameTelemetry: string; storage: string };
  updatedAt: string;
};
export const api = {
  dashboard: () => request<DashboardData>("/dashboard"),
  list: <T>(module: string) =>
    request<{ source: "api"; items: T[]; integration?: string }>(`/${module}`),
  createConfig: (values: { name: string; maxWaves: number }) =>
    request<{ item: Config }>("/configuration", {
      method: "POST",
      body: JSON.stringify(values),
    }),
};
