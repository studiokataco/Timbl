import { call } from "../api.js";
function out(data) {
    console.log(JSON.stringify(data, null, 2));
}
function handle(fn) {
    fn().then(out).catch((e) => { console.error(e.message); process.exit(1); });
}
export function registerIdeationCommands(program) {
    const ideation = program.command("ideation").description("Manage ideation items");
    ideation
        .command("list")
        .option("--status <status>")
        .option("--limit <n>")
        .action((opts) => handle(() => call("ideation", "list", {
        ...(opts.status && { status: opts.status }),
        ...(opts.limit && { limit: Number(opts.limit) }),
    })));
    ideation
        .command("create")
        .requiredOption("--title <title>")
        .action((opts) => handle(() => call("ideation", "create", { title: opts.title })));
    ideation
        .command("promote <id>")
        .option("--scheduled-date <date>")
        .action((id, opts) => handle(() => call("ideation", "promote", {
        id,
        ...(opts.scheduledDate && { scheduledDate: opts.scheduledDate }),
    })));
}
