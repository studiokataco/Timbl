import { Command } from "commander";
import { call } from "../api.js";

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function handle(fn: () => Promise<unknown>) {
  fn().then(out).catch((e: Error) => { console.error(e.message); process.exit(1); });
}

export function registerChannelsCommands(program: Command) {
  const channels = program.command("channels").description("Manage social channels");

  channels
    .command("list")
    .action(() => handle(() => call("channels", "list")));

  channels
    .command("get <id>")
    .action((id: string) => handle(() => call("channels", "get", { id })));
}
