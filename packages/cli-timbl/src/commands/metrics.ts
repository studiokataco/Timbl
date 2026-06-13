import { Command } from "commander";
import { call } from "../api.js";

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function handle(fn: () => Promise<unknown>) {
  fn().then(out).catch((e: Error) => { console.error(e.message); process.exit(1); });
}

export function registerMetricsCommands(program: Command) {
  const metrics = program.command("metrics").description("Fetch performance metrics");

  metrics
    .command("window")
    .requiredOption("--start <date>")
    .requiredOption("--end <date>")
    .action((opts: { start: string; end: string }) =>
      handle(() => call("metrics", "window", { start: opts.start, end: opts.end }))
    );
}
