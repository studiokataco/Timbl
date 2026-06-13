import { call } from "../api.js";
function out(data) {
    console.log(JSON.stringify(data, null, 2));
}
function handle(fn) {
    fn().then(out).catch((e) => { console.error(e.message); process.exit(1); });
}
export function registerWebhooksCommands(program) {
    const webhooks = program.command("webhooks").description("Manage webhooks");
    webhooks
        .command("subscribe")
        .requiredOption("--url <url>")
        .requiredOption("--events <events>")
        .action((opts) => handle(() => call("webhooks", "subscribe", {
        url: opts.url,
        events: opts.events.split(",").map((e) => e.trim()),
    })));
    webhooks
        .command("list")
        .action(() => handle(() => call("webhooks", "list")));
}
