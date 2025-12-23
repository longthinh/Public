/**
 * HTTP客户端 - 提供灵活的HTTP请求功能和钩子系统
 */

class HttpClient {
  // 存储环境适配器
  static _adapters = new Set([
    // 兼容Quantumult X
    ({ $auto, ...op }, handleRes) =>
      $task
        .fetch({ opts: { redirection: $auto }, ...op })
        .then(handleRes, handleRes),

    // 兼容Surge等
    ({ method, $auto, ...op }, handleRes) => {
      op["auto-redirect"] = $auto;
      op.insecure = true;
      $httpClient[method](op, (error, resp, body) => {
        handleRes({ error, ...resp, body });
      });
    },

    //  兼容node
    ({ url, $auto, ["binary-mode"]: binary, ...op }, handleRes) => {
      op.redirect = $auto ? "follow" : "manual";
      fetch(url, op).then(
        async (response) => {
          const responseMethod = binary ? "arrayBuffer" : "text";
          handleRes({
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body: await response[responseMethod](),
          });
        },
        (e) => handleRes({ error: e.message })
      );
    },
  ]);

  /**
   * 获取当前环境可用的适配器
   * @private
   */
  static getAvailableAdapter = (...args) => {
    for (const adapter of this._adapters) {
      try {
        adapter(...args);
        this.getAvailableAdapter = adapter;
        return;
      } catch {}
    }

    throw new Error("当前环境不支持的请求方法");
  };

  /**
   * 注册请求适配器
   * @param {Function} adapter - 请求适配器函数
   */
  static registerAdapter(adapter) {
    this._adapters.add(adapter);
  }

  /**
   * 工厂方法 - 创建并配置客户端实例
   * @param {Object} config - 配置选项
   * @returns {HttpClient} 客户端实例
   */
  static create(config = {}) {
    const client = new HttpClient();
    if (Object.keys(config).length > 0) {
      client.config(config);
    }
    return client;
  }

  _hooks; // 存储请求、成功和失败钩子
  _coreHooks; // 核心钩子引用

  /**
   * 构造函数
   * @param {number} timeout - 默认超时时间(秒)
   */
  constructor() {
    this._hooks = {
      req: new Set(), // 请求前钩子
      ok: new Set(), // 成功响应钩子
      fail: new Set(), // 失败响应钩子
    };

    this._initDefaults(); // 初始化默认设置
    this._initCoreHooks(); // 初始化核心钩子
    return this._initHttpMethods(); // 初始化请求方法
  }

  /**
   * 从当前实例创建新实例
   * @param {Object} extraConfig - 额外配置(可选)
   * @returns {HttpClient} 新客户端实例
   */
  create(extraConfig) {
    // 调用静态create方法
    return HttpClient.create(extraConfig ?? this.defaults);
  }

  /**
   * 运行成功响应钩子
   * @private
   */
  _runOkHook(res, op) {
    return this._runHooks("ok", res, op);
  }

  /**
   * 运行失败响应钩子
   * @private
   */
  _runFailHook(error, reject) {
    if (!this._hooks["fail"].size) reject(error);
    return this._runHooks("fail", error);
  }

  /**
   * 运行请求钩子
   * @private
   */
  _runReqHook(request) {
    return this._runHooks("req", request);
  }

  /**
   * 通用钩子运行函数
   * @private
   */
  async _runHooks(type, ...args) {
    const value = args[0];
    for (let hook of this._hooks[type]) {
      const { isOn = true } = hook;
      if (!isOn) continue;
      args[0] = (await hook(...args)) ?? args[0];
    }

    if (value === args[0] && type === "fail") throw value;
    return args[0];
  }

  /**
   * 添加请求钩子
   */
  useReq(...args) {
    return this._addHook("req", ...args);
  }

  /**
   * 添加响应钩子
   */
  useRes(...args) {
    return this._addHook("ok", ...args);
  }

  /**
   * 添加错误钩子
   */
  useErr(...args) {
    return this._addHook("fail", ...args);
  }

  /**
   * 通用添加钩子方法
   * @private
   */
  _addHook(type, ...args) {
    const fn = args.pop();
    if (typeof fn !== "function") return;
    if (args.includes("default")) fn.default = true;
    this._hooks[type].add(fn);
    return {
      remove: () => this._hooks[type].delete(fn),
      disable: (bool) => (fn.isOn = bool),
      status: () => fn.isOn ?? true,
      isDefault: !!fn.default,
    };
  }

  /**
   * 清除钩子
   * @param {string} type - 可选,指定钩子类型
   */
  clear(type) {
    if (type) this._hooks[type]?.clear();
    Object.values(this._hooks).forEach((hookSet) => {
      [...hookSet]
        .filter((fn) => !fn.default)
        .forEach((fn) => hookSet.delete(fn));
    });
  }

  /**
   * 初始化请求方法
   * @private
   */
  _initHttpMethods() {
    /**
     * 发送HTTP请求
     * @param {Object|string} opt - 请求选项或URL
     * @returns {Promise} 请求结果
     */
    const request = async (opt, t = 4) => {
      const { promise, resolve, reject } = Promise.withResolvers();
      // HTTP错误构造器
      const HTTPError = (e, response, request) =>
        Object.assign(new Error(e), {
          name: "HTTPError",
          request,
          response,
        });

      // 处理请求
      const { timeout, ...op } = await this._runReqHook(opt);
      // 响应处理函数
      const handleRes = async (res) => {
        try {
          res.status ??= res.statusCode;
          res.json = () => JSON.parse(res.body);

          resolve(
            await (res.error || res.status < 200 || res.status > 307
              ? this._runFailHook(
                  HTTPError(res.error ?? `${res.status}: Not Found`, res, op),
                  reject
                )
              : this._runOkHook(res, op))
          );
        } catch (e) {
          reject(e);
        }
      };

      // 设置超时
      const timer = setTimeout(
        () => reject(HTTPError("timeout", null, op)),
        (timeout ?? t) * 1000
      );

      // 发送请求
      HttpClient.getAvailableAdapter(op, handleRes);

      // 返回promise并清理超时定时器
      return promise.finally(() => clearTimeout(timer));
    };

    /**
     * 初始化请求方法
     * @private
     */
    const methods = [
      "get",
      "post",
      "put",
      "delete",
      "head",
      "patch",
      "options",
    ];
    methods.forEach((method) => {
      request[method] = (op, t) => {
        if (!op.url) op = { url: op };
        return request({ ...op, method }, t);
      };
    });

    /**
     * 骚操作将request原型该为HttpClient实例
     */
    return Object.setPrototypeOf(request, this);
  }

  /**
   * 初始化核心钩子
   * @private
   */
  _initCoreHooks() {
    this._coreHooks = {
      // 处理默认选项
      useDefaultOpt: this.useReq("default", (req) => {
        if (!req.url) req = { url: req, method: "get" };
        req.$auto ??= true;
        req.headers ??= {};
        return Object.assign(req, JSON.parse(JSON.stringify(this.defaults)));
      }),

      // 处理基础URL
      useBaseURL: this.useReq("default", (req) => {
        if (!req.baseURL && this.defaults?.baseURL) {
          req.baseURL = this.defaults.baseURL;
        }
        if (req.baseURL && req.url && !req.url.match(/^https?:\/\//)) {
          const base = req.baseURL.endsWith("/")
            ? req.baseURL.slice(0, -1)
            : req.baseURL;
          const path = req.url.startsWith("/") ? req.url : "/" + req.url;
          req.url = base + path;
        }
        return req;
      }),

      // 规范化响应头
      useNormHeaders: this.useRes("default", (res) => {
        const { headers = {} } = res;
        const newHeaders = {};
        for (let key in headers) {
          newHeaders[key.toLowerCase()] = headers[key];
        }
        res.headers = newHeaders;
        return res;
      }),

      // 自动处理二进制响应
      useBinaryResponse: this.useRes("default", (res, req) => {
        const { bodyBytes } = res;
        const { headers } = req;
        if (headers["binary-mode"] && bodyBytes) {
          res.body = new Uint8Array(bodyBytes);
        }
        return res;
      }),

      // 自动JSON解析
      useAutoJson: this.useRes("default", (res) => {
        const { headers = {} } = res;
        const content = headers["content-type"] ?? headers["Content-Type"];
        if (content?.includes("application/json")) {
          try {
            res.body = res.json();
          } catch {}
        }
        return res;
      }),
    };
  }

  /**
   * 初始化默认设置
   * @private
   */
  _initDefaults() {
    const hookMap = {};
    const coreHooks = this.coreHooks;

    this.defaults = new Proxy(
      {
        // 暴露钩子添加方法
        transformReq: this.useReq.bind(this),
        transformRes: this.useRes.bind(this),
        transformErr: this.useErr.bind(this),
      },
      {
        set(target, key, value, receiver) {
          if (key.startsWith("transform")) {
            hookMap[key]?.remove?.();
            value === "remove" ||
              (hookMap[key] = Reflect.get(target, key, receiver)(value));
            return true;
          }
          coreHooks.get(key)?.disable(value);
          return Reflect.set(target, key, value);
        },
      }
    );
  }

  /**
   * 核心钩子访问器
   */
  get coreHooks() {
    const set = (obj) => {
      if (typeof obj !== "object" || obj === null) return;
      Object.keys(obj).forEach((key) => {
        if (!obj[key].isDefault && this._coreHooks[key]?.isDefault) {
          obj[key].remove();
          throw new Error(
            `核心钩子 '${key}' 已存在且尝试以非默认方式覆盖，操作被阻止。`
          );
        }
      });

      Object.assign(this._coreHooks, obj);
    };
    const get = (input) => {
      if (input) return this._coreHooks[input];

      return Object.fromEntries(
        Object.entries(this._coreHooks).map(([key, value]) => [
          key,
          value.status(),
        ])
      );
    };

    return { set, get };
  }

  /**
   * 配置客户端
   * @param {Object} opts - 配置选项
   * @returns {HttpClient} 客户端实例(链式调用)
   */
  config(opts) {
    Object.assign(this.defaults, opts);
    return this;
  }
}

export const $http = HttpClient.create();

export const $env = (type) => {
  if (type) return type === $env();
  if ($env.result) return $env.result;

  const envMap = {
    $loon: "Loon",
    $task: "Qx",
    $rocket: "Qhadowrocket",
    "$environment.surge-build": "Surge",
    "$environment.stash-version": "Stash",
  };

  for (const [path, envName] of Object.entries(envMap)) {
    if (path.split(".").reduce((o, k) => o?.[k], globalThis))
      return ($env.result = envName);
  }

  throw new Error("环境不支持");
};

export const $cache = {
  get: globalThis.$prefs?.valueForKey ?? $persistentStore.read,
  getJson: (key) => JSON.parse($cache.get(key), null, 4),
  set: (key, value) =>
    (globalThis.$prefs?.setValueForKey ?? $persistentStore.write)(value, key),
  setJson: (key, obj) => $cache.set(key, JSON.stringify(obj)),
  remove: (key) =>
    $env("Surge")
      ? $cache.set(key, null)
      : (globalThis.$prefs ?? $persistentStore).remove(key),
};

export const $msg = (...a) => {
  const { $open, $copy, $media, ...r } =
    typeof a.at(-1) === "object" && a.pop();
  const [t = "", s = "", b = ""] = a;
  (globalThis.$notify ??= $notification.post)(t, s, b, {
    action: $copy ? "clipboard" : "open-url",
    text: $copy,
    "update-pasteboard": $copy,
    clipboard: $copy,
    "open-url": $open,
    openUrl: $open,
    url: $open,
    mediaUrl: $media,
    "media-url": $media,
    ...r,
  });
};

const format = (...args) => {
  console.log(
    args
      .map((item) => {
        if (item?.stack) {
          return `${item.toString()}\n${item.stack}`;
        }
        if (typeof item === "object") {
          return JSON.stringify(item, null, 4);
        }
        return String(item);
      })
      .join("\n")
  );
};

export const $log = Object.assign(format, {
  time(id) {
    $log.time[id] = Date.now();
  },
  timeEnd(id) {
    $log(`${id ? id + ": " : ""}${Date.now() - $log.time[id]}ms`);
  },
  show(...a) {
    return (b) => b && $log(...a);
  },
});
