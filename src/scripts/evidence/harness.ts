export interface HttpResult {
  status: number;
  body: unknown;
}

export interface ScenarioRecord {
  id: number;
  name: string;
  method: string;
  path: string;
  requestBody?: unknown;
  status?: number;
  responseBody?: unknown;
  expected: string;
  pass: boolean;
}

export class Harness {
  readonly records: ScenarioRecord[] = [];

  token: string | undefined;

  constructor(public readonly baseUrl: string) {}

  async http(
    method: string,
    path: string,
    body?: unknown,
    token: string | undefined = this.token,
  ): Promise<HttpResult> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? (JSON.parse(text) as unknown) : null };
  }

  record(entry: Omit<ScenarioRecord, 'id'>): ScenarioRecord {
    const full = { id: this.records.length + 1, ...entry };
    this.records.push(full);
    console.log(`${full.pass ? 'PASS' : 'FAIL'}  ${full.id}. ${full.name}`);
    return full;
  }
}

export function dig(value: unknown, ...path: string[]): unknown {
  let cur: unknown = value;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}
