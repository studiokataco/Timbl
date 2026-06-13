import { Command } from "commander";
import { call } from "../api.js";

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function handle(fn: () => Promise<unknown>) {
  fn().then(out).catch((e: Error) => { console.error(e.message); process.exit(1); });
}

export function registerCategoriesCommands(program: Command) {
  const categories = program.command("categories").description("Manage post categories");

  categories
    .command("list")
    .action(() => handle(() => call("categories", "list")));
}
