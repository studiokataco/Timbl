import { call } from "../api.js";
function out(data) {
    console.log(JSON.stringify(data, null, 2));
}
function handle(fn) {
    fn().then(out).catch((e) => { console.error(e.message); process.exit(1); });
}
export function registerCategoriesCommands(program) {
    const categories = program.command("categories").description("Manage post categories");
    categories
        .command("list")
        .action(() => handle(() => call("categories", "list")));
}
