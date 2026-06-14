import { Command } from "commander";
import { call } from "../api.js";

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function handle(fn: () => Promise<unknown>) {
  fn().then(out).catch((e: Error) => { console.error(e.message); process.exit(1); });
}

export function registerPostsCommands(program: Command) {
  const posts = program.command("posts").description("Manage posts");

  posts
    .command("list")
    .option("--start <date>")
    .option("--end <date>")
    .option("--status <status>")
    .option("--limit <n>")
    .action((opts: { start?: string; end?: string; status?: string; limit?: string }) =>
      handle(() => call("posts", "list", {
        ...(opts.start && { start: opts.start }),
        ...(opts.end && { end: opts.end }),
        ...(opts.status && { status: opts.status }),
        ...(opts.limit && { limit: Number(opts.limit) }),
      }))
    );

  posts
    .command("get <id>")
    .action((id: string) => handle(() => call("posts", "get", { id })));

  posts
    .command("create")
    .requiredOption("--scheduled-date <date>")
    .option("--brief <text>")
    .action((opts: { scheduledDate: string; brief?: string }) =>
      handle(() => call("posts", "create", {
        scheduledDate: opts.scheduledDate,
        ...(opts.brief && { brief: opts.brief }),
      }))
    );

  posts
    .command("update <id>")
    .option("--brief <text>")
    .option("--status <status>")
    .option("--scheduled-date <date>")
    .action((id: string, opts: { brief?: string; status?: string; scheduledDate?: string }) =>
      handle(() => call("posts", "update", {
        id,
        ...(opts.brief && { brief: opts.brief }),
        ...(opts.status && { status: opts.status }),
        ...(opts.scheduledDate && { scheduledDate: opts.scheduledDate }),
      }))
    );

  posts
    .command("schedule <id>")
    .option("--scheduled-date <date>")
    .action((id: string, opts: { scheduledDate?: string }) =>
      handle(() => call("posts", "schedule", {
        id,
        ...(opts.scheduledDate && { scheduledDate: opts.scheduledDate }),
      }))
    );

  posts
    .command("unschedule <id>")
    .action((id: string) => handle(() => call("posts", "unschedule", { id })));

  posts
    .command("publish-now <id>")
    .action((id: string) => handle(() => call("posts", "publish_now", { id })));

  posts
    .command("delete <id>")
    .action((id: string) => handle(() => call("posts", "delete", { id })));
}
