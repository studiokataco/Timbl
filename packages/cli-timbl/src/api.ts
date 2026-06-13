import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

interface Config {
  apiKey: string;
  baseUrl: string;
}

let config: Config | null = null;

async function loadConfig(): Promise<Config> {
  if (config) return config;
  const configPath = join(homedir(), ".config", "timbl", "config.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    config = JSON.parse(raw) as Config;
    return config;
  } catch {
    throw new Error("Run 'timbl init' first");
  }
}

export async function call(
  resource: string,
  verb: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const cfg = await loadConfig();
  const url = `${cfg.baseUrl}/api/public/v1/${resource}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ verb, ...body }),
  });

  if (!res.ok) {
    let message: string;
    try {
      const data = (await res.json()) as { error?: { code?: string } };
      message = data?.error?.code ?? String(res.status);
    } catch {
      message = String(res.status);
    }
    throw new Error(message);
  }

  return res.json();
}
