import { isVixsrcHostname } from "./vixsrc-shared";

/** Origins that 403 from datacenter IPs — use gluetun immediately when configured. */
export const scrapePreferProxyHostname = (hostname: string): boolean => {
  if (!hostname) {
    return false;
  }

  if (isVixsrcHostname(hostname)) {
    return true;
  }

  return (
    hostname === "vidrock.net" ||
    hostname === "multiembed.mov" ||
    hostname === "www.multiembed.mov" ||
    hostname === "streamingnow.mov" ||
    hostname === "www.streamingnow.mov" ||
    hostname === "vidsrc.wtf" ||
    hostname === "www.vidsrc.wtf" ||
    hostname === "api.vidsrc.wtf" ||
    hostname === "viduki.net" ||
    hostname === "www.viduki.net"
  );
};
