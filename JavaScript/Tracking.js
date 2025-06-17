/**
 * @longthinh
 * Script theo dõi và thông báo thay đổi giá app trên App Store.
 * Đã sửa lỗi thông báo sai giá bằng cách so sánh giá số (`price`) thay vì chuỗi `formattedPrice`.
 */

const $ = new API("AppStore", true); // Khởi tạo đối tượng tiện ích

let region = "VN"; // Quốc gia mặc định

// Trả về cờ quốc gia (hiện tắt vì để trống)
function flag(x) {
  var flags = new Map([
    ["US", ""], // ["US", "🇺🇸"],
    ["VN", ""], // ["VN", "🇻🇳"],
  ]);
  return flags.get(x.toUpperCase());
}

// Danh sách appId mặc định nếu không có thiết lập
let appId = ["775737172", "1312014438", "1442620678", "1443988620", "1462586500", "1481781647", "1527036273", "1548193893"];

// Ghi đè appId nếu người dùng đã lưu cấu hình trước đó
if ($.read("appId") != "" && $.read("appId") != undefined) {
  appId = $.read("appId").split(",");
}

// Ghi đè khu vực nếu có cấu hình
if ($.read("region") != "" && $.read("region") != undefined) {
  region = $.read("region");
}

getData(appId); // Bắt đầu xử lý dữ liệu

let notifys = []; // Mảng chứa thông báo sẽ gửi
let sentNotifications = {}; // Tránh gửi trùng app
let startTime = new Date().getTime(); // Bắt đầu đo thời gian thực thi

// Chuyển dữ liệu appId thành định dạng theo vùng để gửi request
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
        notifys.push(`appId invalid: ${n}`);
      }
    } else {
      notifys.push(`appId invalid: ${n}`);
    }
  });

  if (Object.keys(matchData).length > 0) {
    postData(matchData);
  }
}

// Hàm chính xử lý dữ liệu từ App Store và gửi thông báo nếu cần
async function postData(d) {
  try {
    // Đọc dữ liệu lần trước đã lưu
    let showData = $.read("compare");
    if (!showData) {
      showData = {};
    } else {
      try {
        showData = JSON.parse(showData);
      } catch (e) {
        $.error(`Failed to parse saved data: ${e}`);
        showData = {};
      }
    }

    let infos = {}; // Dữ liệu mới để lưu lại so sánh

    await Promise.all(
      Object.keys(d).map(async (k) => {
        let config = {
          url: "https://itunes.apple.com/lookup?id=" + d[k].join(",") + "&country=" + k,
        };

        await $.http
          .get(config)
          .then((response) => {
            let results = JSON.parse(response.body).results;

            results.sort((a, b) => a.trackName.localeCompare(b.trackName));

            if (Array.isArray(results) && results.length > 0) {
              results.forEach((x) => {
                // Lưu dữ liệu hiện tại vào object để so sánh và ghi sau cùng
                infos[x.trackId] = {
                  n: x.trackName,
                  v: x.version,
                  p: x.formattedPrice,
                  pr: x.price,
                };

                const prev = showData[x.trackId];

                if (prev) {
                  // Log kiểm tra chi tiết
                  $.log(`→ ${x.trackName}`);
                  $.log(`Price: old=${prev.pr} | new=${x.price}`);
                  $.log(`Version: old=${prev.v} | new=${x.version}`);
                  console.log(""); // Dòng trắng

                  // So sánh giá
                  if (x.price !== prev.pr) {
                    const notifyMessage = `${x.trackName} → ${x.formattedPrice}`;
                    notifys.push(notifyMessage);
                    if (!sentNotifications[x.trackId]) {
                      notify([notifyMessage]);
                      sentNotifications[x.trackId] = true;
                    }
                  }

                  // So sánh version
                  if (x.version !== prev.v) {
                    const notifyMessage = `${x.trackName} → ${x.version}`;
                    notifys.push(notifyMessage);
                    if (!sentNotifications[x.trackId]) {
                      notify([notifyMessage]);
                      sentNotifications[x.trackId] = true;
                    }
                  }
                } else {
                  // App mới hoàn toàn
                  const notifyPriceMessage = `${x.trackName} → ${x.formattedPrice}`;
                  const notifyVersionMessage = `${x.trackName} → ${x.version}`;
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
            $.error(`Failed to fetch App Store data: ${e}`);
          });
      })
    );

    // Ghi lại dữ liệu mới sau khi đã so sánh xong
    $.write(JSON.stringify(infos), "compare");
    $.log("Saved new comparison data");

    // Nếu có thông báo thì kết thúc
    if (notifys.length > 0) {
      $.done();
    } else {
      let endTime = new Date().getTime();
      let executionTime = endTime - startTime;
      let speedNotification = getSpeedNotification(executionTime);
      console.log(`\nTimeout ${executionTime}ms - Network speed: ${speedNotification}\n`);
      $.done();
    }
  } catch (e) {
    $.error(`postData exception: ${e}`);
  }
}


// Tính tốc độ xử lý để log
function getSpeedNotification(executionTime) {
  if (executionTime >= 500) return "very slow";
  else if (executionTime >= 400) return "slow";
  else if (executionTime >= 300) return "normal";
  else if (executionTime >= 200) return "fast";
  else if (executionTime >= 0) return "very fast";
  return "unknown";
}

// Trả về biểu tượng emoji (hiện không dùng nhiều)
function emoji(x) {
  var emoji = new Map([
    ["emp", ""],
    ["bel", "🔔"],
    ["bud", "🌱"],
  ]);
  return emoji.get(x);
}

// Hàm gửi thông báo
function notify(notifys) {
  notifys = notifys.join(`\n`);
  console.log(notifys);
  $.notify(`${flag(region)}App Store${emoji("emp")}`, ``, notifys);
}

// Xác định môi trường QX hay Surge
function ENV() {
  const isQX = typeof $task !== "undefined";
  const isSurge = typeof $httpClient !== "undefined" && typeof $loon === "undefined";
  return {
    isQX,
    isSurge,
  };
}

// Thư viện gửi HTTP request phù hợp với QX/Surge
function HTTP(defaultOptions = { baseURL: "" }) {
  const { isQX, isSurge } = ENV();
  const methods = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"];
  const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

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
          else resolve({
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
            reject(`${method} URL: ${options.url} exceeds timeout ${timeout} ms`);
          }, timeout);
        })
      : null;

    return (timer ? Promise.race([timer, worker]) : worker).then(events.onResponse);
  }

  const http = {};
  methods.forEach((method) => {
    http[method.toLowerCase()] = (options) => send(method, options);
  });
  return http;
}

// Thư viện API tiện ích để đọc/ghi cache, log, notify
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
          content + (options["media-url"] ? "\nmultimedia:" + options["media-url"] : ""),
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
