/**
 * @longthinh
 */

const $ = new API("Tracking", true);
let region = "US";
function flag(x) {
  var flags = new Map([
    ["US", ""], // ["US", "🇺🇸"],
    ["VN", ""], // ["VN", "🇻🇳"],
  ]);
  return flags.get(x.toUpperCase());
}

let appId = ["775737172","1312014438","1442620678","1443988620","1462586500","1481781647","1527036273","1548193893"];

if ($.read("appId") != "" && $.read("appId") != undefined) {
  appId = $.read("appId").split(",");
}
if ($.read("region") != "" && $.read("region") != undefined) {
  region = $.read("region");
}

getData(appId);
let notifys = [];
let sentNotifications = {};
let startTime = new Date().getTime();

function getData(x) {
  let matchData = {};
  x.forEach((n) => {
    if (/^[a-zA-Z0-9:/|\-_\s]{1,}$/.test(n)) {
      n = n.replace(/[/|\-_\s]/g, ":");
      let n_n = n.split(":");
      if (n_n.length === 1) {
        if (matchData.hasOwnProperty(region)) {
          matchData[region].push(n_n);
        } else {
          matchData[region] = [];
          matchData[region].push(n_n[0]);
        }
      } else if (n_n.length === 2) {
        if (matchData.hasOwnProperty(n_n[1])) {
          matchData[n_n[1]].push(n_n[0]);
        } else {
          matchData[n_n[1]] = [];
          matchData[n_n[1]].push(n_n[0]);
        }
      } else {
        notifys.push(`appId Invalid: ${n}`);
      }
    } else {
      notifys.push(`appId Invalid: ${n}`);
    }
  });
  if (Object.keys(matchData).length > 0) {
    postData(matchData);
  }
}

async function postData(d) {
  try {
    let showData = $.read("compare");
    if (showData === "" || showData === undefined) {
      showData = {};
    } else {
      showData = JSON.parse(showData);
      $.info(showData);
    }
    let infos = {};
    await Promise.all(
      Object.keys(d).map(async (k) => {
        let config = {
          url:
            "https://itunes.apple.com/lookup?id=" +
            d[k].join(",") +
            "&country=" +
            k,
        };
        await $.http
          .get(config)
          .then((response) => {
            let results = JSON.parse(response.body).results;
            results.sort((a, b) => a.trackName.localeCompare(b.trackName));
            if (Array.isArray(results) && results.length > 0) {
              results.forEach((x) => {
                const prev = showData[x.trackId];
                const shouldUpdate =
                  !prev || compareVersions(x.version, prev.v) >= 0;
                if (shouldUpdate) {
                  infos[x.trackId] = {
                    n: x.trackName,
                    v: x.version,
                    p: x.formattedPrice,
                    pr: x.price,
                  };
                  if (prev) {
                    $.log(
                      `appId= ${x.trackId}\n${x.trackName}\noldPrice= ${prev.p}, newPrice= ${x.formattedPrice}\noldVersion= ${prev.v}, newVersion= ${x.version}`
                    );
                    console.log("----------------------------");
                    if (x.price !== prev.pr) {
                      const notifyMessage = `${x.trackName} ㅤ ${x.formattedPrice}`;
                      notifys.push(notifyMessage);
                      if (!sentNotifications[x.trackId]) {
                        notify([notifyMessage]);
                        sentNotifications[x.trackId] = true;
                      }
                    }
                    if (x.version !== prev.v) {
                      const notifyMessage = `${x.trackName} ㅤ ${x.version}`;
                      notifys.push(notifyMessage);
                      if (!sentNotifications[x.trackId]) {
                        notify([notifyMessage]);
                        sentNotifications[x.trackId] = true;
                      }
                    }
                  } else {
                    const notifyPriceMessage = `${x.trackName} ㅤ ${x.formattedPrice}`;
                    const notifyVersionMessage = `${x.trackName} ㅤ ${x.version}`;
                    notifys.push(notifyPriceMessage, notifyVersionMessage);
                    if (!sentNotifications[x.trackId]) {
                      notify([notifyPriceMessage, notifyVersionMessage]);
                      sentNotifications[x.trackId] = true;
                    }
                  }
                }
              });
            }
            return Promise.resolve();
          })
          .catch((e) => {
            $.error(`Fetch failed: ${e}`);
          });
      })
    );
    $.write(JSON.stringify(infos), "compare");

    let endTime = new Date().getTime();
    let executionTime = endTime - startTime;

    $.log(`Timeout ${executionTime}ms\n`);

    if (notifys.length > 0) {
      $.done();
    } else {
      $.done();
    }
  } catch (e) {
    $.error(`postData exception: ${e}`);
  }
}

function compareVersions(v1, v2) {
  const s1 = v1.split(".").map(Number);
  const s2 = v2.split(".").map(Number);
  const len = Math.max(s1.length, s2.length);
  for (let i = 0; i < len; i++) {
    const num1 = s1[i] || 0;
    const num2 = s2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function notify(notifys) {
  notifys = notifys.join(`\n`);
  console.log(notifys);
  $.notify(`${flag(region)}App Store`, ``, notifys);
}

function ENV() {
  const isQX = typeof $task !== "undefined";
  const isSurge =
    typeof $httpClient !== "undefined" && typeof $loon === "undefined";
  return {
    isQX,
    isSurge,
  };
}

// Library for HTTP request
function HTTP(defaultOptions = { baseURL: "" }) {
  const { isQX, isSurge } = ENV();
  const methods = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"];
  const URL_REGEX =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

  function send(method, options) {
    options = typeof options === "string" ? { url: options } : options;
    if (defaultOptions.baseURL && !URL_REGEX.test(options.url || "")) {
      options.url = defaultOptions.baseURL + options.url;
    }

    options = { ...defaultOptions, ...options };

    const timeout = options.timeout;
    const events = {
      onRequest: () => {},
      onResponse: (resp) => resp,
      onTimeout: () => {},
      ...options.events,
    };

    events.onRequest(method, options);

    let worker;
    if (isQX) {
      worker = $task.fetch({ method, ...options });
    } else if (isSurge) {
      worker = new Promise((resolve, reject) => {
        $httpClient[method.toLowerCase()](options, (err, response, body) => {
          if (err) reject(err);
          else
            resolve({
              statusCode: response.status || response.statusCode,
              headers: response.headers,
              body,
            });
        });
      });
    }

    if (!worker) return Promise.reject("Unsupported environment");

    const timer = timeout
      ? new Promise((_, reject) => {
          const timeoutid = setTimeout(() => {
            events.onTimeout();
            reject(
              `${method} URL: ${options.url} exceeds timeout ${timeout} ms`
            );
          }, timeout);
        })
      : null;
    return (timer ? Promise.race([timer, worker]) : worker).then(
      events.onResponse
    );
  }

  const http = {};
  methods.forEach((method) => {
    http[method.toLowerCase()] = (options) => send(method, options);
  });
  return http;
}

// Library API read/write cache, log, notify
function API(name = "untitled", debug = false) {
  const { isQX, isSurge } = ENV();

  return new (class {
    constructor(name, debug) {
      this.name = name;
      this.debug = debug;
      this.http = HTTP();
      this.env = ENV();
      this.cache = {};
      this.initCache();
    }

    initCache() {
      const raw = isQX
        ? $prefs.valueForKey(this.name)
        : isSurge
        ? $persistentStore.read(this.name)
        : null;
      this.cache = raw ? JSON.parse(raw) : {};
    }

    persistCache() {
      const data = JSON.stringify(this.cache, null, 2);
      if (isQX) $prefs.setValueForKey(data, this.name);
      if (isSurge) $persistentStore.write(data, this.name);
    }

    write(data, key) {
      this.log(`SET ${key}`);
      if (key.startsWith("#")) {
        const pureKey = key.substring(1);
        if (isQX) return $prefs.setValueForKey(data, pureKey);
        if (isSurge) return $persistentStore.write(data, pureKey);
      } else {
        this.cache[key] = data;
        this.persistCache();
      }
    }

    read(key) {
      this.log(`READ ${key}`);
      if (key.startsWith("#")) {
        const pureKey = key.substring(1);
        if (isQX) return $prefs.valueForKey(pureKey);
        if (isSurge) return $persistentStore.read(pureKey);
      } else {
        return this.cache[key];
      }
    }

    delete(key) {
      this.log(`DELETE ${key}`);
      if (key.startsWith("#")) {
        const pureKey = key.substring(1);
        if (isQX) return $prefs.removeValueForKey(pureKey);
        if (isSurge) return $persistentStore.write(null, pureKey);
      } else {
        delete this.cache[key];
        this.persistCache();
      }
    }

    notify(title, subtitle = "", content = "", options = {}) {
      if (isQX) {
        $notify(title, subtitle, content, options);
      } else if (isSurge) {
        $notification.post(
          title,
          subtitle,
          content +
            (options["media-url"]
              ? "\nmultimedia:" + options["media-url"]
              : ""),
          { url: options["open-url"] }
        );
      }
    }

    log(msg) {
      if (this.debug) console.log(`[${this.name}] LOG: ${this.stringify(msg)}`);
    }

    info(msg) {
      console.log(`[${this.name}] INFO: ${this.stringify(msg)}`);
    }

    error(msg) {
      console.log(`[${this.name}] ERROR: ${this.stringify(msg)}`);
    }

    wait(millisec) {
      return new Promise((resolve) => setTimeout(resolve, millisec));
    }

    done(value = {}) {
      if (isQX || isSurge) {
        $done(value);
      }
    }

    stringify(obj) {
      if (typeof obj === "string") return obj;
      try {
        return JSON.stringify(obj, null, 2);
      } catch {
        return "[object Object]";
      }
    }
  })(name, debug);
}
