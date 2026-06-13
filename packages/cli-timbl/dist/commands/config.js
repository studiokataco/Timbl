import { createInterface } from "node:readline";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
function prompt(rl, question) {
    return new Promise((resolve) => rl.question(question, resolve));
}
async function init() {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const apiKey = await prompt(rl, "API key: ");
    const rawUrl = await prompt(rl, "Base URL [https://app.timbl.co]: ");
    rl.close();
    const baseUrl = rawUrl.trim() || "https://app.timbl.co";
    const configDir = join(homedir(), ".config", "timbl");
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "config.json"), JSON.stringify({ apiKey: apiKey.trim(), baseUrl }, null, 2));
    console.log("Configuration saved.");
}
async function installSkill(target) {
    const skillsBase = join(__dirname, "..", "..", "skills");
    if (target === "claude-code") {
        const src = join(skillsBase, "claude-code", "SKILL.md");
        const dest = join(homedir(), ".claude", "skills", "timbl", "SKILL.md");
        await mkdir(dirname(dest), { recursive: true });
        await copyFile(src, dest);
    }
    else {
        const src = join(skillsBase, "codex", "skill.md");
        const dest = join(homedir(), "codex", "skills", "timbl", "skill.md");
        await mkdir(dirname(dest), { recursive: true });
        await copyFile(src, dest);
    }
    console.log("Skill installed.");
}
export function registerConfigCommands(program) {
    program
        .command("init")
        .description("Configure API key and base URL")
        .action(() => init().catch((e) => { console.error(e.message); process.exit(1); }));
    const install = program.command("install").description("Install editor skills");
    install
        .option("--claude-code", "Install Claude Code skill")
        .option("--codex", "Install Codex skill")
        .action((opts) => {
        if (opts.claudeCode) {
            installSkill("claude-code").catch((e) => { console.error(e.message); process.exit(1); });
        }
        else if (opts.codex) {
            installSkill("codex").catch((e) => { console.error(e.message); process.exit(1); });
        }
        else {
            console.error("Specify --claude-code or --codex");
            process.exit(1);
        }
    });
}
