/**
* @longthinh
*/

const $ = new API("appstore", true);

let appid = ["1468002765","1267815033","1594213177","1546719359","1556054655","1631459446","845960230","1610634186","1463795397","1536754048","6444911377","6444068649","775737172","1498235191","6467821003","1462586500","6444063249","6446304087","1549224518","1483387513","1623230250","1621919001","1572666937","1511763524","1585833321","1481781647","1435127111","1548193893","502633252","1558391784","1049254261","1463298887","1489698531","450464147","1527036273","1436902243","1254940903","1530968324","1524435907","1510265452","1512938504","1517339257","1423330822","1458212928","1405459188","904237743","1312014438","1459055246","896694807","1252015438","1443988620","918751511","1344204781","1442620678","932747118"];

if ($.read("appid") != "" && $.read("appid") != undefined) {
  appid = $.read("appid").split(",");
}

let region = "VN";
if ($.read("region") != "" && $.read("region") != undefined) {
  region = $.read("region");
}

getData(appid);

let notifys = [];

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
        notifys.push(`ID incorrect: ${n}`);
      }
    } else {
      notifys.push(`ID incorrect: ${n}`);
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
          url: "https://itunes.apple.com/lookup?id=" + d[k] + "&country=" + k,
        };
        await $.http
          .get(config)
          .then((response) => {
            let results = JSON.parse(response.body).results;
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
                      notifys.push(`${x.trackName} ⚡︎ ${x.formattedPrice}`);
                    }
                    if (x.version !== showData[x.trackId].v) {
                      notifys.push(`${x.trackName} ⚓︎ ${x.version}`);
                    }
                  }
                } else {
                  notifys.push(`${x.trackName} · ${x.formattedPrice}`);
                  notifys.push(`${x.trackName} · ${x.version}`);
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
      notify(notifys);
      $.done();
    } else {
      let endTime = new Date().getTime();
      let executionTime = endTime - startTime;
      let speedNotification = getSpeedNotification(executionTime);
      console.log(`\n` + "Timeout " + executionTime + "ms" + " - " + "Network speed: " + speedNotification);
      $.done();
    }
  } catch (e) {
    console.log(e);
  }
}

function getSpeedNotification(executionTime) {
  if (executionTime >= 600) {
    return "very slow";
  } else if (executionTime >= 500) {
    return "slow";
  } else if (executionTime >= 400) {
    return "normal";
  } else if (executionTime >= 300) {
    return "fast";
  } else if (executionTime < 200) {
    return "very fast";
  }
  return "unknown";
}

function notify(notifys) {
  notifys = notifys.join(`\n`);
  console.log(notifys);
  $.notify(`${flag(region)} 𝐋𝐮𝐱𝐲𝐫𝐢𝐞𝐥 𝕏 ${emojis("bud")}`, ``, notifys);
}

function emojis(x) {
  var emojis = new Map([
    ["bud", "🌱"],
    ["bel", "🔔"],
    ["eye", "👀"],
    ["chi", "🐣"],
    ["owl", "🦉"],
    ["ins", "🧩"],
    ["kab", "🎉"],
    ["pri", "🏷"],
  ]);
  return emojis.get(x);
}

function flag(x) {
  var flags = new Map([
    ["CN", "🇨🇳"],
    ["JP", "🇯🇵"],
    ["KR", "🇰🇷"],
    ["SG", "🇸🇬"],
    ["UK", "🇬🇧"],
    ["US", "🇺🇸"],
    ["VN", "🇻🇳"],
  ]);
  return flags.get(x.toUpperCase());
}

function ENV() {
  const isQX = typeof $task !== "undefined";
  const isSurge = typeof $httpClient !== "undefined";
  const isJSBox = typeof require == "function" && typeof $jsbox != "undefined";
  const isNode = typeof require == "function" && !isJSBox;
  const isRequest = typeof $request !== "undefined";
  const isScriptable = typeof importModule !== "undefined";
  return {
    isQX,
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
  const { isQX, isSurge, isScriptable, isNode } = ENV();
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
    } else if (isSurge || isNode) {
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
  const { isQX, isSurge, isNode, isJSBox, isScriptable } = ENV();
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
      if (isSurge)
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
      if (isSurge) $persistentStore.write(data, this.name);
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
        if (isSurge) {
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
        if (isSurge) {
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
        if (isSurge) {
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
      if (isQX || isSurge) {
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
