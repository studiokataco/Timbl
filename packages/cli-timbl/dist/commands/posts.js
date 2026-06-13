import { call } from "../api.js";
function out(data) {
    console.log(JSON.stringify(data, null, 2));
}
function handle(fn) {
    fn().then(out).catch((e) => { console.error(e.message); process.exit(1); });
}
export function registerPostsCommands(program) {
    const posts = program.command("posts").description("Manage posts");
    posts
        .command("list")
        .option("--start <date>")
        .option("--end <date>")
        .option("--status <status>")
        .option("--limit <n>")
        .action((opts) => handle(() => call("posts", "list", {
        ...(opts.start && { start: opts.start }),
        ...(opts.end && { end: opts.end }),
        ...(opts.status && { status: opts.status }),
        ...(opts.limit && { limit: Number(opts.limit) }),
    })));
    posts
        .command("get <id>")
        .action((id) => handle(() => call("posts", "get", { id })));
    posts
        .command("create")
        .requiredOption("--scheduled-date <date>")
        .option("--brief <text>")
        .action((opts) => handle(() => call("posts", "create", {
        scheduledDate: opts.scheduledDate,
        ...(opts.brief && { brief: opts.brief }),
    })));
    posts
        .command("update <id>")
        .option("--brief <text>")
        .option("--status <status>")
        .option("--scheduled-date <date>")
        .action((id, opts) => handle(() => call("posts", "update", {
        id,
        ...(opts.brief && { brief: opts.brief }),
        ...(opts.status && { status: opts.status }),
        ...(opts.scheduledDate && { scheduledDate: opts.scheduledDate }),
    })));
    posts
        .command("schedule <id>")
        .option("--scheduled-date <date>")
        .action((id, opts) => handle(() => call("posts", "schedule", {
        id,
        ...(opts.scheduledDate && { scheduledDate: opts.scheduledDate }),
    })));
    posts
        .command("unschedule <id>")
        .action((id) => handle(() => call("posts", "unschedule", { id })));
    posts
        .command("publish-now <id>")
        .action((id) => handle(() => call("posts", "publishNow", { id })));
    posts
        .command("delete <id>")
        .action((id) => handle(() => call("posts", "delete", { id })));
}
