import { call } from "../api.js";
function out(data) {
    console.log(JSON.stringify(data, null, 2));
}
function handle(fn) {
    fn().then(out).catch((e) => { console.error(e.message); process.exit(1); });
}
export function registerMetricsCommands(program) {
    const metrics = program.command("metrics").description("Fetch performance metrics");
    metrics
        .command("window")
        .requiredOption("--start <date>")
        .requiredOption("--end <date>")
        .action((opts) => handle(() => call("metrics", "window", { start: opts.start, end: opts.end })));
}
