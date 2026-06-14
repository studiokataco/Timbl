import { Command } from "commander";
import { call } from "../api.js";

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function handle(fn: () => Promise<unknown>) {
  fn().then(out).catch((e: Error) => { console.error(e.message); process.exit(1); });
}

export function registerApprovalsCommands(program: Command) {
  const approvals = program.command("approvals").description("Manage post approvals");

  approvals
    .command("list")
    .action(() => handle(() => call("approvals", "list")));

  approvals
    .command("request")
    .requiredOption("--post-id <id>")
    .action((opts: { postId: string }) =>
      handle(() => call("approvals", "request", { postId: opts.postId }))
    );

  approvals
    .command("decide")
    .requiredOption("--post-id <id>")
    .option("--approved", "Approve the post")
    .option("--rejected", "Reject the post")
    .option("--feedback <text>")
    .action((opts: { postId: string; approved?: boolean; rejected?: boolean; feedback?: string }) => {
      if (!opts.approved && !opts.rejected) {
        console.error("Specify --approved or --rejected");
        process.exit(1);
      }
      handle(() => call("approvals", "decide", {
        postId: opts.postId,
        approved: Boolean(opts.approved),
        ...(opts.feedback && { feedback: opts.feedback }),
      }));
    });
}
