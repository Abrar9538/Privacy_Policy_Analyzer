export type SourceKind = "pdf" | "url" | "text";
export type Mode = "gemini" | "local" | "sample";
export type Concern = "low" | "moderate" | "high";
export type CategoryId = "collection" | "storage" | "sharing" | "consent";
export type Finding = { summary: string; excerpt: string; concern: Concern };
export type Category = { id: CategoryId; label: string; findings: Finding[]; gaps: string[] };
export type Report = {
  id: string; title: string; source: string; mode: Mode;
  categories: Category[]; highlights: string[]; discarded: number;
};
export type Comparison = {
  left: Pick<Report, "title" | "mode">;
  right: Pick<Report, "title" | "mode">;
  rows: { label: string; left: Category; right: Category }[];
};
export type Answer = { status: "supported" | "excerpt" | "unknown"; answer: string; evidence: string[] };

export const modeLabels: Record<Mode, string> = {
  gemini: "Gemini analysis", local: "Local excerpt review", sample: "Fictional sample",
};

function explainError(payload: unknown) {
  if (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string") {
    return payload.detail;
  }
  return "The server couldn’t process that request. Check the input and try again.";
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/" + path, { ...options, cache: "no-store" });
  } catch {
    throw new Error("Couldn’t reach the analysis server. Try again in a moment.");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload === null) {
    if (response.status >= 500 && !payload) throw new Error("The analysis server is unavailable. Try again in a moment.");
    throw new Error(explainError(payload));
  }
  return payload as T;
}

export function post<T>(path: string, body?: object | FormData) {
  return request<T>(path, body instanceof FormData
    ? { method: "POST", body }
    : { method: "POST", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export async function downloadReport(id: string) {
  const response = await fetch("/api/reports/" + id + "/pdf", { cache: "no-store" });
  if (!response.ok) throw new Error(explainError(await response.json().catch(() => null)));
  const link = document.createElement("a");
  const url = URL.createObjectURL(await response.blob());
  link.href = url;
  link.download = "privacylens-report.pdf";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
