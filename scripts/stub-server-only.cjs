const Module = require("node:module")
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "server-only" || request === "client-only") {
    return require.resolve("./stub-server-only-empty.cjs")
  }
  return origResolve.call(this, request, parent, ...rest)
}
