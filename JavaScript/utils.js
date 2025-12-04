/**
 * HTTP Client - Provides flexible HTTP request functionality and a hook system
 */

class HttpClient {
  // Stores environment adapters
  static _adapters = new Set([
    // Compatible with Quantumult X
    ({ $auto, ...op }, handleRes) =>
      $task
        .fetch({ opts: { redirection: $auto }, ...op })
        .then(handleRes, handleRes),

    // Compatible with Surge, etc.
    ({ method, $auto, ...op }, handleRes) => {
      op["auto-redirect"] = $auto;
      op.insecure = true;
      $httpClient[method](op, (error, resp, body) => {
        handleRes({ error, ...resp, body });
      });
    },

    // Compatible with node
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
   * Get the available adapter for the current environment
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

    throw new Error("Request method unsupported in the current environment");
  };

  /**
   * Register a request adapter
   * @param {Function} adapter - The request adapter function
   */
  static registerAdapter(adapter) {
    this._adapters.add(adapter);
  }

  /**
   * Factory method - Creates and configures a client instance
   * @param {Object} config - Configuration options
   * @returns {HttpClient} Client instance
   */
  static create(config = {}) {
    const client = new HttpClient();
    if (Object.keys(config).length > 0) {
      client.config(config);
    }
    return client;
  }

  _hooks; // Stores request, success, and failure hooks
  _coreHooks; // Reference to core hooks

  /**
   * Constructor
   * @param {number} timeout - Default timeout in seconds
   */
  constructor() {
    this._hooks = {
      req: new Set(), // Pre-request hook
      ok: new Set(), // Successful response hook
      fail: new Set(), // Failed response hook
    };

    this._initDefaults(); // Initialize default settings
    this._initCoreHooks(); // Initialize core hooks
    return this._initHttpMethods(); // Initialize request methods
  }

  /**
   * Create a new instance from the current instance
   * @param {Object} extraConfig - Extra configuration (optional)
   * @returns {HttpClient} New client instance
   */
  create(extraConfig) {
    // Call the static create method
    return HttpClient.create(extraConfig ?? this.defaults);
  }

  /**
   * Run successful response hooks
   * @private
   */
  _runOkHook(res, op) {
    return this._runHooks("ok", res, op);
  }

  /**
   * Run failed response hooks
   * @private
   */
  _runFailHook(error, reject) {
    if (!this._hooks["fail"].size) reject(error);
    return this._runHooks("fail", error);
  }

  /**
   * Run request hooks
   * @private
   */
  _runReqHook(request) {
    return this._runHooks("req", request);
  }

  /**
   * Generic hook execution function
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
   * Add a request hook
   */
  useReq(...args) {
    return this._addHook("req", ...args);
  }

  /**
   * Add a response hook
   */
  useRes(...args) {
    return this._addHook("ok", ...args);
  }

  /**
   * Add an error hook
   */
  useErr(...args) {
    return this._addHook("fail", ...args);
  }

  /**
   * Generic method to add a hook
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
   * Clear hooks
   * @param {string} type - Optional, specifies hook type
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
   * Initialize HTTP methods
   * @private
   */
  _initHttpMethods() {
    /**
     * Send an HTTP request
     * @param {Object|string} opt - Request options or URL
     * @returns {Promise} Request result
     */
    const request = async (opt, t = 4) => {
      const { promise, resolve, reject } = Promise.withResolvers();
      // HTTP Error constructor
      const HTTPError = (e, response, request) =>
        Object.assign(new Error(e), {
          name: "HTTPError",
          request,
          response,
        });

      // Process the request
      const { timeout, ...op } = await this._runReqHook(opt);
      // Response handler function
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

      // Set timeout
      const timer = setTimeout(
        () => reject(HTTPError("timeout", null, op)),
        (timeout ?? t) * 1000
      );

      // Send request
      HttpClient.getAvailableAdapter(op, handleRes);

      // Return the promise and clear the timeout timer
      return promise.finally(() => clearTimeout(timer));
    };

    /**
     * Initialize request methods
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
     * Trick to set the prototype of 'request' to the HttpClient instance
     */
    return Object.setPrototypeOf(request, this);
  }

  /**
   * Initialize core hooks
   * @private
   */
  _initCoreHooks() {
    this._coreHooks = {
      // Handle default options
      useDefaultOpt: this.useReq("default", (req) => {
        if (!req.url) req = { url: req, method: "get" };
        req.$auto ??= true;
        req.headers ??= {};
        return Object.assign(req, JSON.parse(JSON.stringify(this.defaults)));
      }),

      // Handle base URL
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

      // Normalize response headers
      useNormHeaders: this.useRes("default", (res) => {
        const { headers = {} } = res;
        const newHeaders = {};
        for (let key in headers) {
          newHeaders[key.toLowerCase()] = headers[key];
        }
        res.headers = newHeaders;
        return res;
      }),

      // Automatically handle binary response
      useBinaryResponse: this.useRes("default", (res, req) => {
        const { bodyBytes } = res;
        const { headers } = req;
        if (headers["binary-mode"] && bodyBytes) {
          res.body = new Uint8Array(bodyBytes);
        }
        return res;
      }),

      // Automatic JSON parsing
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
   * Initialize default settings
   * @private
   */
  _initDefaults() {
    const hookMap = {};
    const coreHooks = this.coreHooks;

    this.defaults = new Proxy(
      {
        // Expose hook addition methods
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
   * Core hooks accessor
   */
  get coreHooks() {
    const set = (obj) => {
      if (typeof obj !== "object" || obj === null) return;
      Object.keys(obj).forEach((key) => {
        if (!obj[key].isDefault && this._coreHooks[key]?.isDefault) {
          obj[key].remove();
          throw new Error(
            `Core hook '${key}' already exists and an attempt was made to overwrite it in a non-default way, operation blocked.`
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
   * Configure the client
   * @param {Object} opts - Configuration options
   * @returns {HttpClient} Client instance (chainable)
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

  throw new Error("Environment unsupported");
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
