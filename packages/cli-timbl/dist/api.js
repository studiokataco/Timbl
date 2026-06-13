import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
let config = null;
async function loadConfig() {
    if (config)
        return config;
    const configPath = join(homedir(), ".config", "timbl", "config.json");
    try {
        const raw = await readFile(configPath, "utf-8");
        config = JSON.parse(raw);
        return config;
    }
    catch {
        throw new Error("Run 'timbl init' first");
    }
}
export async function call(resource, verb, body) {
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
        let message;
        try {
            const data = (await res.json());
            message = data?.error?.code ?? String(res.status);
        }
        catch {
            message = String(res.status);
        }
        throw new Error(message);
    }
    return res.json();
}
