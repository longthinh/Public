const CONFIG = {
  eproxy: "PROXY 127.0.01:80",
  efinal: "DIRECT",
  enable: true,
  mitmall: false,
  mitmhost: [
    "gdmf.apple.com",
    "mesu.apple.com",
    "updates.cdn-apple.com",
    "updates-http.cdn-apple.com",
    "su.itunes.apple.com",
  ],
};

function FindProxyForURL(url, host) {
  if (CONFIG.enable === false) {
    return CONFIG.efinal;
  }
  if (CONFIG.mitmall) {
    return CONFIG.eproxy;
  }
  if (CONFIG.mitmhost.indexOf(host) !== -1) {
    return CONFIG.eproxy;
  }
  for (let h of CONFIG.mitmhost) {
    if (
      /\*/.test(h) &&
      new RegExp(h.replace(/\./g, "\\.").replace(/\*/g, ".*")).test(host)
    ) {
      return CONFIG.eproxy;
    }
  }
  return CONFIG.efinal;
}
