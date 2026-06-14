import { call } from "../api.js";
function out(data) {
    console.log(JSON.stringify(data, null, 2));
}
function handle(fn) {
    fn().then(out).catch((e) => { console.error(e.message); process.exit(1); });
}
export function registerApprovalsCommands(program) {
    const approvals = program.command("approvals").description("Manage post approvals");
    approvals
        .command("list")
        .action(() => handle(() => call("approvals", "list")));
    approvals
        .command("request")
        .requiredOption("--post-id <id>")
        .action((opts) => handle(() => call("approvals", "request", { postId: opts.postId })));
    approvals
        .command("decide")
        .requiredOption("--post-id <id>")
        .option("--approved", "Approve the post")
        .option("--rejected", "Reject the post")
        .option("--feedback <text>")
        .action((opts) => {
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
