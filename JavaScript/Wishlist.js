/**
 * @longthinh
 * Last update
 */

const $ = new API("Wishlist", true);

let region = "US";

function flag(x) {
  var flags = new Map([
    ["US", ""], // ["US", "🇺🇸"],
    ["VN", ""], // ["VN", "🇻🇳"],
  ]);
  return flags.get(x.toUpperCase());
}

let appId = ["1573144215"];

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
                infos[x.trackId] = {
                  n: x.trackName,
                  v: x.version,
                  p: x.formattedPrice,
                };

                if (showData.hasOwnProperty(x.trackId)) {
                  if (
                    JSON.stringify(showData[x.trackId]) !==
                    JSON.stringify(infos[x.trackId])
                  ) {
                    if (x.formattedPrice !== showData[x.trackId].p) {
                      const notifyMessage = `${x.trackName} · ${x.formattedPrice}`;
                      notifys.push(notifyMessage);

                      if (!sentNotifications[x.trackId]) {
                        notify([notifyMessage]);
                        sentNotifications[x.trackId] = true;
                      }
                    }

                    if (x.version !== showData[x.trackId].v) {
                      const notifyMessage = `${x.trackName} · ${x.version}`;
                      notifys.push(notifyMessage);

                      if (!sentNotifications[x.trackId]) {
                        notify([notifyMessage]);
                        sentNotifications[x.trackId] = true;
                      }
                    }
                  }
                } else {
                  const notifyPriceMessage = `${x.trackName} · ${x.formattedPrice}`;
                  const notifyVersionMessage = `${x.trackName} · ${x.version}`;
                  notifys.push(notifyPriceMessage);
                  notifys.push(notifyVersionMessage);

                  if (!sentNotifications[x.trackId]) {
                    notify([notifyPriceMessage, notifyVersionMessage]);
                    sentNotifications[x.trackId] = true;
                  }
                }
              });
            }
            return Promise.resolve();
          })
          .catch((e) => {
            console.log(e);
          });
      })
    );

    infos = JSON.stringify(infos);
    $.write(infos, "compare");

    if (notifys.length > 0) {
      $.done();
    } else {
      let endTime = new Date().getTime();
      let executionTime = endTime - startTime;
      let speedNotification = getSpeedNotification(executionTime);
      console.log(
        `\n` +
          "Timeout " +
          executionTime +
          "ms" +
          " - " +
          "Network speed: " +
          speedNotification
      );
      $.done();
    }
  } catch (e) {
    console.log(e);
  }
}

function getSpeedNotification(executionTime) {
  if (executionTime >= 500) {
    return "very slow";
  } else if (executionTime >= 400) {
    return "slow";
  } else if (executionTime >= 300) {
    return "normal";
  } else if (executionTime >= 200) {
    return "fast";
  } else if (executionTime < 100) {
    return "very fast";
  }
  return "unknown";
}

function emoji(x) {
  var emoji = new Map([
    ["emp", ""],
    ["bel", "🔔"],
    ["bud", "🌱"],
  ]);
  return emoji.get(x);
}

function notify(notifys) {
  notifys = notifys.join(`\n`);
  console.log(notifys);
  $.notify(`${flag(region)}App Store${emoji("emp")}`, ``, notifys);
}

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

function HTTP(
  defaultOptions = {
    baseURL: "",
  }
) {
  const { isQX, isLoon, isSurge, isScriptable, isNode } = ENV();
  const methods = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"];
  const URL_REGEX =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

  function send(method, options) {
    options =
      typeof options === "string"
        ? {
            url: options,
          }
        : options;
    const baseURL = defaultOptions.baseURL;
    if (baseURL && !URL_REGEX.test(options.url || "")) {
      options.url = baseURL ? baseURL + options.url : options.url;
    }
    options = {
      ...defaultOptions,
      ...options,
    };
    const timeout = options.timeout;
    const events = {
      ...{
        onRequest: () => {},
        onResponse: (resp) => resp,
        onTimeout: () => {},
      },
      ...options.events,
    };

    events.onRequest(method, options);

    let worker;
    if (isQX) {
      worker = $task.fetch({
        method,
        ...options,
      });
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
      worker = new Promise((resolve, reject) => {
        request
          .loadString()
          .then((body) => {
            resolve({
              statusCode: request.response.statusCode,
              headers: request.response.headers,
              body,
            });
          })
          .catch((err) => reject(err));
      });
    }

    let timeoutid;
    const timer = timeout
      ? new Promise((_, reject) => {
          timeoutid = setTimeout(() => {
            events.onTimeout();
            return reject(
              `${method} URL: ${options.url} exceeds the timeout ${timeout} ms`
            );
          }, timeout);
        })
      : null;

    return (
      timer
        ? Promise.race([timer, worker]).then((res) => {
            clearTimeout(timeoutid);
            return res;
          })
        : worker
    ).then((resp) => events.onResponse(resp));
  }

  const http = {};
  methods.forEach(
    (method) =>
      (http[method.toLowerCase()] = (options) => send(method, options))
  );
  return http;
}

function API(name = "untitled", debug = false) {
  const { isQX, isLoon, isSurge, isNode, isJSBox, isScriptable } = ENV();
  return new (class {
    constructor(name, debug) {
      this.name = name;
      this.debug = debug;
      this.http = HTTP();
      this.env = ENV();
      this.node = (() => {
        if (isNode) {
          const fs = require("fs");

          return {
            fs,
          };
        } else {
          return null;
        }
      })();
      this.initCache();

      const delay = (t, v) =>
        new Promise(function (resolve) {
          setTimeout(resolve.bind(null, v), t);
        });

      Promise.prototype.delay = function (t) {
        return this.then(function (v) {
          return delay(t, v);
        });
      };
    }

    initCache() {
      if (isQX) this.cache = JSON.parse($prefs.valueForKey(this.name) || "{}");
      if (isLoon || isSurge)
        this.cache = JSON.parse($persistentStore.read(this.name) || "{}");

      if (isNode) {
        let fpath = "root.json";
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(
            fpath,
            JSON.stringify({}),
            {
              flag: "wx",
            },
            (err) => console.log(err)
          );
        }
        this.root = {};

        fpath = `${this.name}.json`;
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(
            fpath,
            JSON.stringify({}),
            {
              flag: "wx",
            },
            (err) => console.log(err)
          );
          this.cache = {};
        } else {
          this.cache = JSON.parse(
            this.node.fs.readFileSync(`${this.name}.json`)
          );
        }
      }
    }

    persistCache() {
      const data = JSON.stringify(this.cache, null, 2);
      if (isQX) $prefs.setValueForKey(data, this.name);
      if (isLoon || isSurge) $persistentStore.write(data, this.name);
      if (isNode) {
        this.node.fs.writeFileSync(
          `${this.name}.json`,
          data,
          {
            flag: "w",
          },
          (err) => console.log(err)
        );
        this.node.fs.writeFileSync(
          "root.json",
          JSON.stringify(this.root, null, 2),
          {
            flag: "w",
          },
          (err) => console.log(err)
        );
      }
    }

    write(data, key) {
      this.log(`SET ${key}`);
      if (key.indexOf("#") !== -1) {
        key = key.substr(1);
        if (isSurge || isLoon) {
          return $persistentStore.write(data, key);
        }
        if (isQX) {
          return $prefs.setValueForKey(data, key);
        }
        if (isNode) {
          this.root[key] = data;
        }
      } else {
        this.cache[key] = data;
      }
      this.persistCache();
    }

    read(key) {
      this.log(`READ ${key}`);
      if (key.indexOf("#") !== -1) {
        key = key.substr(1);
        if (isSurge || isLoon) {
          return $persistentStore.read(key);
        }
        if (isQX) {
          return $prefs.valueForKey(key);
        }
        if (isNode) {
          return this.root[key];
        }
      } else {
        return this.cache[key];
      }
    }

    delete(key) {
      this.log(`DELETE ${key}`);
      if (key.indexOf("#") !== -1) {
        key = key.substr(1);
        if (isSurge || isLoon) {
          return $persistentStore.write(null, key);
        }
        if (isQX) {
          return $prefs.removeValueForKey(key);
        }
        if (isNode) {
          delete this.root[key];
        }
      } else {
        delete this.cache[key];
      }
      this.persistCache();
    }

    notify(title, subtitle = "", content = "", options = {}) {
      const openURL = options["open-url"];
      const mediaURL = options["media-url"];

      if (isQX) $notify(title, subtitle, content, options);

      if (isSurge) {
        $notification.post(
          title,
          subtitle,
          content + `${mediaURL ? "\nmultimedia:" + mediaURL : ""}`,
          {
            url: openURL,
          }
        );
      }

      if (isLoon) {
        let opts = {};
        if (openURL) opts["openUrl"] = openURL;
        if (mediaURL) opts["mediaUrl"] = mediaURL;
        if (JSON.stringify(opts) === "{}") {
          $notification.post(title, subtitle, content);
        } else {
          $notification.post(title, subtitle, content, opts);
        }
      }

      if (isNode || isScriptable) {
        const content_ =
          content +
          (openURL ? `\nClick: ${openURL}` : "") +
          (mediaURL ? `\nMultimedia: ${mediaURL}` : "");
        if (isJSBox) {
          const push = require("push");
          push.schedule({
            title: title,
            body: (subtitle ? subtitle + "\n" : "") + content_,
          });
        } else {
          console.log(`${title}\n${subtitle}\n${content_}\n\n`);
        }
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
      if (isQX || isLoon || isSurge) {
        $done(value);
      } else if (isNode && !isJSBox) {
        if (typeof $context !== "undefined") {
          $context.headers = value.headers;
          $context.statusCode = value.statusCode;
          $context.body = value.body;
        }
      }
    }

    stringify(obj_or_str) {
      if (typeof obj_or_str === "string" || obj_or_str instanceof String)
        return obj_or_str;
      else
        try {
          return JSON.stringify(obj_or_str, null, 2);
        } catch (err) {
          return "[object Object]";
        }
    }
  })(name, debug);
}
