import { Command } from "commander";
import { call } from "../api.js";

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function handle(fn: () => Promise<unknown>) {
  fn().then(out).catch((e: Error) => { console.error(e.message); process.exit(1); });
}

export function registerIdeationCommands(program: Command) {
  const ideation = program.command("ideation").description("Manage ideation items");

  ideation
    .command("list")
    .option("--status <status>")
    .option("--limit <n>")
    .action((opts: { status?: string; limit?: string }) =>
      handle(() => call("ideation", "list", {
        ...(opts.status && { status: opts.status }),
        ...(opts.limit && { limit: Number(opts.limit) }),
      }))
    );

  ideation
    .command("create")
    .requiredOption("--title <title>")
    .action((opts: { title: string }) =>
      handle(() => call("ideation", "create", { title: opts.title }))
    );

  ideation
    .command("promote <id>")
    .option("--scheduled-date <date>")
    .action((id: string, opts: { scheduledDate?: string }) =>
      handle(() => call("ideation", "promote", {
        id,
        ...(opts.scheduledDate && { scheduledDate: opts.scheduledDate }),
      }))
    );
}
