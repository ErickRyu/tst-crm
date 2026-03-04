// ---------- Byte calculation utility (client-safe) ----------
export function calcMsgType(msg: string): { byteLength: number; msgType: "SMS" | "LMS" } {
  let byteLength = 0;
  for (const ch of msg) {
    byteLength += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  return { byteLength, msgType: byteLength > 90 ? "LMS" : "SMS" };
}
