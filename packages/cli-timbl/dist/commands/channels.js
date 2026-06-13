import { call } from "../api.js";
function out(data) {
    console.log(JSON.stringify(data, null, 2));
}
function handle(fn) {
    fn().then(out).catch((e) => { console.error(e.message); process.exit(1); });
}
export function registerChannelsCommands(program) {
    const channels = program.command("channels").description("Manage social channels");
    channels
        .command("list")
        .action(() => handle(() => call("channels", "list")));
    channels
        .command("get <id>")
        .action((id) => handle(() => call("channels", "get", { id })));
}
