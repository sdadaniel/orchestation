/**
 * `ws` optional deps: `bufferutil`, `utf-8-validate` (native addons).
 * When broken or mis-resolved by Next/Webpack, `ws.send` throws
 * `bufferUtil.mask is not a function` and the gateway process exits.
 * Default to pure-JS masking/validation; set WS_NO_BUFFER_UTIL="" to try native.
 */
if (process.env.WS_NO_BUFFER_UTIL === undefined) {
  process.env.WS_NO_BUFFER_UTIL = "1";
}
if (process.env.WS_NO_UTF_8_VALIDATE === undefined) {
  process.env.WS_NO_UTF_8_VALIDATE = "1";
}
