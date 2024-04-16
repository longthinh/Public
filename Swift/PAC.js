/**
 * @longthinh
 */

const CONFIG = {
  proxy: "PROXY 127.0.01:80",
  direct: "DIRECT",
  enable: true,
  mitmall: false,
  mitmhost: [
    "gdmf.apple.com",
    "mesu.apple.com",
    "su.itunes.apple.com",
  ],
};

function FindProxyForURL(url, host) {
  const { enable, mitmall, mitmhost, proxy, direct } = CONFIG;

  if (!enable) {
    return direct;
  }

  if (mitmall) {
    return proxy;
  }

  if (mitmhost.includes(host)) {
    return proxy;
  }

  for (let pattern of mitmhost) {
    if (
      /\*/.test(pattern) &&
      new RegExp(pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")).test(host)
    ) {
      return proxy;
    }
  }

  return direct;
}
