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

let appId = ["6741758667","1619480823","1405459188","1247273887","6742043284","1660167141","6447283144","1512938504","896694807","1312014438","1442620678","1443988620","1462586500","1481781647","1527036273","1548193893"];

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
          matchData[region].push(n_n[0]);
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
        let configReq = {
          url:
            "https://itunes.apple.com/lookup?id=" +
            d[k].join(",") +
            "&country=" +
            k,
        };
        await $.http
          .get(configReq)
          .then((response) => {
            let results = JSON.parse(response.body).results || [];
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

                  let logOutput = `appId= ${x.trackId}\nappName= ${
                    x.trackName
                  }\noldVersion= ${prev ? prev.v : "firstTime"}, newVersion= ${
                    x.version
                  }\noldPrice= ${prev ? prev.p : "firstTime"}, newPrice= ${
                    x.formattedPrice
                  }\n`;

                  if (prev) {
                    if (x.price !== prev.pr) {
                      const notifyMessage = `${x.trackName} ㅤ ${x.formattedPrice}`;
                      notifys.push(notifyMessage);
                      logOutput += `notify= ${notifyMessage}\n`;
                      if (!sentNotifications[x.trackId]) {
                        notify([notifyMessage]);
                        sentNotifications[x.trackId] = true;
                      }
                    }
                    if (x.version !== prev.v) {
                      const notifyMessage = `${x.trackName} ㅤ ${x.version}`;
                      notifys.push(notifyMessage);
                      logOutput += `notify= ${notifyMessage}\n`;
                      if (!sentNotifications[x.trackId]) {
                        notify([notifyMessage]);
                        sentNotifications[x.trackId] = true;
                      }
                    }
                  } else {
                    const notifyPriceMessage = `${x.trackName} ㅤ ${x.formattedPrice}`;
                    const notifyVersionMessage = `${x.trackName} ㅤ ${x.version}`;
                    notifys.push(notifyPriceMessage, notifyVersionMessage);
                    logOutput += `notify= ${notifyPriceMessage}\nnotify= ${notifyVersionMessage}\n`;
                    if (!sentNotifications[x.trackId]) {
                      notify([notifyPriceMessage, notifyVersionMessage]);
                      sentNotifications[x.trackId] = true;
                    }
                  }

                  logOutput += "----------------------------";
                  $.log(logOutput);
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

    showData = { ...showData, ...infos };

    let widgetMessage = "";
    if (notifys.length > 0) {
      widgetMessage = notifys.join("\n");
      scriptableNotify(`${flag(region)}App Store`, widgetMessage);
      showData.lastWidgetMessage = widgetMessage;
    } else {
      widgetMessage = showData.lastWidgetMessage || "No change detected";
      if (ENV().isScriptable) {
        scriptableNotify(`${flag(region)}App Store`, "No change detected");
      }
    }

    $.write(JSON.stringify(showData), "compare");

    let endTime = new Date().getTime();
    let executionTime = endTime - startTime;
    $.log(`Timeout ${executionTime}ms\n`);

    if (ENV().isScriptable) {
      if (config.runsInWidget) {
        let widget = await createWidget(widgetMessage || "No change detected");
        Script.setWidget(widget);
      } else if (config.runsInApp) {
        QuickLook.present(widgetMessage || "No change detected");
      }
      Script.complete();
    }

    $.done();
  } catch (e) {
    $.error(`postData exception: ${e}`);
    if (ENV().isScriptable) {
      try {
        let widget = await createWidget("Error: " + e);
        Script.setWidget(widget);
      } catch (_) {}
      Script.complete();
    }
    $.done();
  }
}

function compareVersions(v1, v2) {
  const s1 = (v1 || "0").split(".").map(Number);
  const s2 = (v2 || "0").split(".").map(Number);
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
  $.notify(`${flag(region)}App Store`, ``, notifys);
}

function scriptableNotify(title, body) {
  if (ENV().isScriptable) {
    let notification = new Notification();
    notification.title = title;
    notification.body = body;
    notification.schedule();
  }
}

async function createWidget(message) {
  let family = config.widgetFamily || "large";
  let w = new ListWidget();
  w.backgroundColor = new Color("#1c1c1e");

  let title = w.addText("App Store");
  title.textColor = Color.white();
  title.font = Font.boldSystemFont(14);
  w.addSpacer(6);

  const msg = (message || "").toString();

  if (family === "small") {
    let body = w.addText(msg);
    body.textColor = Color.white();
    body.font = Font.systemFont(11);
    body.lineLimit = 3;
  } else if (family === "medium") {
    let body = w.addText(msg);
    body.textColor = Color.white();
    body.font = Font.systemFont(12);
    body.lineLimit = 8;
  } else {
    let body = w.addText(msg);
    body.textColor = Color.white();
    body.font = Font.systemFont(12);
    body.lineLimit = 0;
  }

  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return w;
}

// ================ ENV + HTTP + API ================
function ENV() {
  const isQX = typeof $task !== "undefined";
  const isLoon = typeof $loon !== "undefined";
  const isSurge = typeof $httpClient !== "undefined" && !isLoon;
  const isJSBox = typeof require == "function" && typeof $jsbox != "undefined";
  const isNode = typeof require == "function" && !isJSBox;
  const isRequest = typeof $request !== "undefined";
  const isScriptable = typeof importModule !== "undefined";
  return {
    isQX,
    isLoon,
    isSurge,
    isNode,
    isJSBox,
    isRequest,
    isScriptable,
  };
}

function HTTP(defaultOptions = { baseURL: "" }) {
  const { isQX, isLoon, isSurge, isScriptable, isNode } = ENV();
  const methods = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"];
  const URL_REGEX =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

  function send(method, options) {
    options = typeof options === "string" ? { url: options } : options;
    const baseURL = defaultOptions.baseURL;
    if (baseURL && !URL_REGEX.test(options.url || "")) {
      options.url = baseURL + options.url;
    }
    options = { ...defaultOptions, ...options };

    let worker;
    if (isQX) {
      worker = $task.fetch({ method, ...options });
    } else if (isLoon || isSurge || isNode) {
      worker = new Promise((resolve, reject) => {
        const request = isNode ? require("request") : $httpClient;
        request[method.toLowerCase()](options, (err, response, body) => {
          if (err) reject(err);
          else
            resolve({
              statusCode: response.status || response.statusCode,
              headers: response.headers,
              body,
            });
        });
      });
    } else if (isScriptable) {
      const request = new Request(options.url);
      request.method = method;
      request.headers = options.headers;
      request.body = options.body;
      worker = request.loadString().then((body) => ({
        statusCode: request.response.statusCode,
        headers: request.response.headers,
        body,
      }));
    }

    return worker;
  }

  const http = {};
  methods.forEach((method) => {
    http[method.toLowerCase()] = (options) => send(method, options);
  });
  return http;
}

function API(name = "untitled", debug = false) {
  const { isQX, isLoon, isSurge, isNode, isJSBox, isScriptable } = ENV();

  function readScriptableStore(key) {
    if (Keychain.contains(key)) {
      try {
        return JSON.parse(Keychain.get(key));
      } catch {
        return {};
      }
    }
    return {};
  }

  function writeScriptableStore(key, data) {
    Keychain.set(key, JSON.stringify(data, null, 2));
  }

  return new (class {
    constructor(name, debug) {
      this.name = name;
      this.debug = debug;
      this.http = HTTP();
      this.env = ENV();
      this.node = (() => {
        if (isNode) {
          const fs = require("fs");
          return { fs };
        }
        return null;
      })();
      this.initCache();
    }

    initCache() {
      if (isQX) this.cache = JSON.parse($prefs.valueForKey(this.name) || "{}");
      if (isLoon || isSurge)
        this.cache = JSON.parse($persistentStore.read(this.name) || "{}");
      if (isNode) {
        let fpath = `${this.name}.json`;
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(fpath, JSON.stringify({}), { flag: "wx" });
        }
        this.cache = JSON.parse(this.node.fs.readFileSync(fpath));
      }
      if (isScriptable) {
        this.cache = readScriptableStore(this.name);
      }
    }

    persistCache() {
      const data = JSON.stringify(this.cache, null, 2);
      if (isQX) $prefs.setValueForKey(data, this.name);
      if (isLoon || isSurge) $persistentStore.write(data, this.name);
      if (isNode)
        this.node.fs.writeFileSync(`${this.name}.json`, data, { flag: "w" });
      if (isScriptable) writeScriptableStore(this.name, this.cache);
    }

    write(data, key) {
      this.log(`SET ${key}`);
      this.cache[key] = data;
      this.persistCache();
    }

    read(key) {
      this.log(`READ ${key}`);
      return this.cache[key];
    }

    delete(key) {
      this.log(`DELETE ${key}`);
      delete this.cache[key];
      this.persistCache();
    }

    notify(title, subtitle = "", content = "", options = {}) {
      if (isQX) $notify(title, subtitle, content, options);
      if (isSurge || isLoon)
        $notification.post(title, subtitle, content, {
          url: options["open-url"],
        });
      if (isNode || isScriptable)
        console.log(`${title}\n${subtitle}\n${content}`);
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

    done(value = {}) {
      if (isQX || isLoon || isSurge) $done(value);
    }

    stringify(obj_or_str) {
      if (typeof obj_or_str === "string") return obj_or_str;
      return JSON.stringify(obj_or_str, null, 2);
    }
  })(name, debug);
}
