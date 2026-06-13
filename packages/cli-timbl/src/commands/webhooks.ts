import { Command } from "commander";
import { call } from "../api.js";

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function handle(fn: () => Promise<unknown>) {
  fn().then(out).catch((e: Error) => { console.error(e.message); process.exit(1); });
}

export function registerWebhooksCommands(program: Command) {
  const webhooks = program.command("webhooks").description("Manage webhooks");

  webhooks
    .command("subscribe")
    .requiredOption("--url <url>")
    .requiredOption("--events <events>")
    .action((opts: { url: string; events: string }) =>
      handle(() => call("webhooks", "subscribe", {
        url: opts.url,
        events: opts.events.split(",").map((e) => e.trim()),
      }))
    );

  webhooks
    .command("list")
    .action(() => handle(() => call("webhooks", "list")));
}
