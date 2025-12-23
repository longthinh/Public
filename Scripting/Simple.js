/**
 * 工具函数：将对象的所有键转换为小写
 * @param {Object} obj - 输入对象
 * @returns {Object} 转换后的对象，键均为小写
 */
const toLowerCaseKeys = (obj) => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {});
};

/**
 * 获取数据类型的工具函数
 * @param {*} data - 要检测的数据
 * @returns {string} 数据类型
 */
const getDataType = (data) => {
  // 处理空值
  if (data === null || data === undefined) {
    return "null";
  }

  // ArrayBuffer
  if (data instanceof ArrayBuffer) {
    return "ArrayBuffer";
  }

  // Uint8Array
  if (data instanceof Uint8Array) {
    return "Uint8Array";
  }

  // 处理对象类型（排除null）
  if (typeof data === "object" && data !== null) {
    return "object";
  }

  // 处理字符串类型 - 智能判断是否为HTML
  if (typeof data === "string") {
    const isHtml = /<[^>]*>/.test(data);
    return isHtml ? "html" : "string";
  }

  // 处理数字类型
  if (typeof data === "number") {
    return "number";
  }

  // 其他类型
  return "other";
};

/**
 * 格式化日志输出的工具函数
 * @param {Request} req - 请求对象
 * @param {Response} res - 响应对象
 * @param {number} duration - 请求处理时间（毫秒）
 * @param {string} format - 日志格式 ('combined', 'common', 'short', 'tiny')
 * @returns {string} 格式化的日志字符串
 */
const formatLog = (req, res, duration, format) => {
  const timestamp = new Date().toISOString();
  const method = req.method.toUpperCase();
  const url = req.url;
  const status = res.statusCode || 200;
  const userAgent = req.get("user-agent") || "-";
  const referer = req.get("referer") || "-";

  switch (format) {
    case "combined":
      return `${timestamp} "${method} ${url}" ${status} ${duration}ms "${referer}" "${userAgent}"`;
    case "common":
      return `${timestamp} "${method} ${url}" ${status} ${duration}ms`;
    case "short":
      return `${method} ${url} ${status} ${duration}ms`;
    case "tiny":
      return `${method} ${url} ${status}`;
    default:
      return `${timestamp} ${method} ${url} ${status} ${duration}ms`;
  }
};

/**
 * 解析查询参数的私有方法
 * @param {string} search - URL的search部分
 * @returns {Object} 解析后的查询参数对象
 */
const parseQuery = (search) => {
  if (!search || search === "?") return {};
  const params = new URLSearchParams(search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
};

/**
 * 路径匹配（支持参数）
 * @param {string} routePath - 路由路径
 * @param {string} requestPath - 请求路径
 * @returns {Object} 匹配结果对象
 * @private
 */
const matchPath = (routePath, requestPath) => {
  if (routePath === "*") return { match: true };

  const keys = [];
  let starIdx = 0;

  const pattern = routePath
    // 未命名 * → params["0"], "1", ...
    .replace(/\/\*/g, () => {
      const key = String(starIdx++);
      keys.push(key);
      return "/(.*)";
    })
    // :name(regex)
    .replace(/:(\w+)\(([^)]+)\)/g, (_, key, pat) => {
      keys.push(key);
      return `(${pat})`;
    })
    // :name+  一或多段
    .replace(/:(\w+)\+/g, (_, key) => {
      keys.push(key);
      return "([^/]+(?:\\/[^/]+)*)";
    })
    // :name*  零或多段
    .replace(/:(\w+)\*/g, (_, key) => {
      keys.push(key);
      return "(.*)?";
    })
    // :name? 可选单段（开头）
    .replace(/^:(\w+)\?/, (_, key) => {
      keys.push(key);
      return "([^/]+)?";
    })
    // :name? 可选单段（带斜杠）
    .replace(/\/:(\w+)\?/, (_, key) => {
      keys.push(key);
      return "(?:/([^/]+))?";
    })
    // 普通 :name
    .replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return "([^/]+)";
    });

  const regex = new RegExp(`^${pattern}$`);
  const match = regex.exec(requestPath);

  if (!match) return { match: false };
  if (keys.length === 0) return { match: true };

  const params = {};
  keys.forEach((k, i) => {
    const val = match[i + 1];
    if (val) params[k] = val;
  });

  return Object.keys(params).length > 0
    ? { match: true, params }
    : { match: true };
};

// 1. Request 类 - 处理请求相关功能
class Request {
  /**
   * 创建Request实例
   * @param {Object} originalReq - 原始请求对象
   */
  constructor(originalReq) {
    const u = new URL(originalReq.url);
    Object.assign(this, originalReq, {
      method: originalReq.method.toLowerCase(),
      headers: toLowerCaseKeys(originalReq.headers),
      href: u.href,
      origin: u.origin,
      protocol: u.protocol,
      host: u.host,
      pathname: u.pathname,
      port: u.port,
      search: u.search,
      hash: u.hash,
      searchParams: u.searchParams,
      password: u.password,
      path: u.pathname,
      params: {},
      query: parseQuery(u.search),
    });
  }

  /**
   * 获取请求头字段值
   * @param {string} field - 请求头字段名
   * @returns {string} 请求头字段值
   */
  get(field) {
    return this.headers[field.toLowerCase()];
  }

  /**
   * 检查客户端是否接受指定的MIME类型
   * @param {string} type - MIME类型
   * @returns {boolean} 是否接受该类型
   */
  accepts(type) {
    const accept = this.get("accept") || "*/*";
    return accept.includes(type) || accept.includes("*/*");
  }

  /**
   * 检查客户端是否接受指定的字符集
   * @param {string} charset - 字符集
   * @returns {boolean} 是否接受该字符集
   */
  acceptsCharset(charset) {
    const acceptCharset = this.get("accept-charset") || "*";
    return acceptCharset.includes(charset) || acceptCharset.includes("*");
  }

  /**
   * 解析Range头，用于处理部分内容请求
   * @param {number} size - 资源总大小
   * @returns {Object|null} Range对象或null
   */
  range(size) {
    const rangeHeader = this.get("range");
    if (!rangeHeader) return null;

    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return null;

    const start = parseInt(match[1]);
    const end = match[2] ? parseInt(match[2]) : size - 1;

    return { start, end, size };
  }

  /**
   * 获取请求体的Content-Type类型
   * @returns {string|null} Content-Type或null
   */
  contentType() {
    const contentType = this.get("content-type");
    if (!contentType) return null;
    return contentType.split(";")[0].trim();
  }

  /**
   * 获取参数值，按优先级从params、body、query中查找
   * @param {string} name - 参数名
   * @returns {*} 参数值，如果未找到返回undefined
   */
  param(name) {
    // 按优先级顺序查找：params -> body -> query
    if (this.params && this.params[name] !== undefined) {
      return this.params[name];
    }
    if (this.body && this.body[name] !== undefined) {
      return this.body[name];
    }
    if (this.query && this.query[name] !== undefined) {
      return this.query[name];
    }
    return undefined;
  }

  /**
   * 获取原始请求体数据
   * @returns {*} 原始请求体数据
   */
  raw() {
    return this.body;
  }

  /**
   * 获取文本格式的请求体
   * @returns {string} 文本格式的请求体
   */
  text() {
    if (!this.body) return "";
    return typeof this.body === "string" ? this.body : this.body.toString();
  }

  /**
   * 解析JSON格式的请求体
   * @returns {Object} 解析后的JSON对象
   * @throws {Error} 当请求体不是JSON格式或解析失败时
   */
  json() {
    if (this.contentType() !== "application/json") {
      throw new Error("请求体不是JSON格式");
    }
    try {
      const text = this.text();
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error("JSON解析失败: " + error.message);
    }
  }

  /**
   * 解析表单数据
   * @returns {Object} 解析后的表单数据对象
   * @throws {Error} 当请求体不是表单格式时
   */
  formData() {
    if (this.contentType() !== "application/x-www-form-urlencoded") {
      throw new Error("请求体不是表单格式");
    }
    const text = this.text();
    if (!text) return {};

    const params = new URLSearchParams(text);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }
}

// 2. Response 类 - 处理响应相关功能
class Response {
  // HTTP状态码映射表
  static STATUS_CODES = {
    200: "OK",
    201: "Created",
    204: "No Content",
    301: "Moved Permanently",
    302: "Found",
    304: "Not Modified",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };

  #originalRes;

  /**
   * 创建Response实例
   * @param {Object} #originalRes - 原始响应对象
   */
  constructor(originalRes = {}) {
    const { status = 200, headers = {}, body = "" } = originalRes;
    this.#originalRes = { status, headers, body };
  }

  /**
   * 获取响应状态码
   * @returns {number} HTTP状态码
   */
  get statusCode() {
    return this.#originalRes.status;
  }

  /**
   * 设置状态码
   * @param {number} code - HTTP状态码
   * @returns {Response} 支持链式调用
   */
  status(code) {
    this.#originalRes.status = code;
    return this; // 支持链式调用
  }

  /**
   * 发送状态码响应
   * @param {number} statusCode - HTTP状态码
   * @returns {Response} 支持链式调用
   */
  sendStatus(statusCode) {
    const statusText = Response.STATUS_CODES[statusCode] || "Unknown";
    this.status(statusCode);
    this.send(statusText);
    return this;
  }

  /**
   * 获取状态文本
   * @param {number} code - HTTP状态码
   * @returns {string} 状态文本
   */
  getStatusText(code) {
    return Response.STATUS_CODES[code] || "Unknown";
  }

  /**
   * 设置响应头
   * @param {string} name - 响应头名称
   * @param {string} value - 响应头值
   */
  setHeader(name, value) {
    this.#originalRes.headers[name.toLowerCase()] = value;
  }

  /**
   * 设置响应头（支持对象和键值对）
   * @param {string|Object} field - 响应头字段名或对象
   * @param {string} value - 响应头值
   * @returns {Response} 支持链式调用
   */
  set(field, value) {
    if (typeof field === "object") {
      for (const [key, val] of Object.entries(field)) {
        this.setHeader(key, val);
      }
    } else {
      this.setHeader(field, value);
    }
    return this;
  }

  /**
   * 获取响应头
   * @param {string} name - 响应头名称
   * @returns {string} 响应头值
   */
  getHeader(name) {
    return this.#originalRes.headers[name.toLowerCase()];
  }

  /**
   * 获取响应头
   * @param {string} field - 响应头字段名
   * @returns {string} 响应头值
   */
  get(field) {
    return field ? this.getHeader(field) : { ...this.#originalRes.headers };
  }

  /**
   * 结束响应（核心方法，控制流反射）
   * @param {*} data - 响应数据
   * @throws {ResponseEndedError} 响应结束错误
   */
  end(data) {
    this.#originalRes.body = data;
    throw new ResponseEndedError({ ...this.#originalRes });
  }

  /**
   * 发送JSON响应
   * @param {*} data - 要发送的数据
   */
  json(data) {
    this.set("Content-Type", "application/json; charset=utf-8");
    this.end(JSON.stringify(data));
  }

  /**
   * 智能发送响应
   * @param {*} data - 要发送的数据
   */
  send(data) {
    // 获取数据类型用于switch判断
    switch (getDataType(data)) {
      case "null":
        // 处理空值情况
        this.end();
        break;

      case "Uint8Array":
      case "ArrayBuffer":
        // 处理Buffer类型
        this.set("Content-Type", "application/octet-stream").end(data);
        break;

      case "object":
        // 处理对象类型（包括数组）
        this.json(data);
        break;

      case "html":
        // 处理HTML字符串
        this.set("Content-Type", "text/html; charset=utf-8").end(data);
        break;

      case "string":
        // 处理普通字符串
        this.set("Content-Type", "text/plain; charset=utf-8").end(data);
        break;

      case "number":
        // 处理数字类型 - 转换为字符串并设置为纯文本
        this.set("Content-Type", "text/plain; charset=utf-8").end(String(data));
        break;

      default:
        // 处理其他类型 - 转换为字符串
        this.set("Content-Type", "text/plain; charset=utf-8").end(String(data));
        break;
    }
  }
}

// 3. 响应结束错误类
class ResponseEndedError extends Error {
  /**
   * 创建响应结束错误实例
   * @param {*} value - 返回值
   */
  constructor(value) {
    super("ResponseEndedError");
    this.value = value;
  }
}

// 4 中间件错误类
class MiddlewareError extends Error {
  /**
   * 创建中间件错误实例
   * @param {string} message - 错误信息
   */
  constructor(message) {
    super(message);
    this.name = "MiddlewareError";
  }
}

/**
 * 极简Express实现 - 只包含中间件和路由
 * 专注核心功能，保持最大简洁性
 */
export default class SimpleExpress {
  #originalReq; // 原始请求对象
  #originalRes; // 原始响应对象
  #middlewares = []; // 中间件列表
  #errorMiddlewares = []; // 错误处理中间件列表
  #routes = []; // 路由映射

  /**
   * 创建SimpleExpress实例
   * @param {Object} request - 请求对象
   * @param {Object} response - 响应对象
   */
  constructor(request, response) {
    this.#originalReq = request;
    this.#originalRes = response;
    this.#initializeHttpMethods();
  }

  // ==================== 静态中间件方法 ====================

  /**
   * JSON请求体解析中间件
   * @returns {Function} 中间件函数
   */
  static json() {
    return (req, res, next) => {
      try {
        // 检查Content-Type
        const contentType = req.contentType();
        if (!contentType || !contentType.includes("application/json")) {
          return next();
        }

        const jsonData = req.json();
        if (typeof jsonData !== "object") {
          return next(new Error("JSON格式错误：必须是对象或数组"));
        }

        // 设置解析后的数据到req.body
        req.body = jsonData;
        next();
      } catch (error) {
        next(new Error(`JSON解析失败: ${error.message}`));
      }
    };
  }

  /**
   * URL编码数据解析中间件
   * @returns {Function} 中间件函数
   */
  static urlencoded() {
    return (req, res, next) => {
      try {
        // 检查Content-Type
        const contentType = req.contentType();
        if (
          !contentType ||
          !contentType.includes("application/x-www-form-urlencoded")
        ) {
          return next();
        }

        // 解析表单数据
        const formData = req.formData();

        // 设置解析后的数据到req.body
        req.body = formData;
        next();
      } catch (error) {
        next(new Error(`表单数据解析失败: ${error.message}`));
      }
    };
  }

  /**
   * 请求日志记录中间件
   * @param {Object} options - 日志配置选项
   * @param {string} options.format - 日志格式 ('combined', 'common', 'short', 'tiny')
   * @param {Function} options.skip - 跳过日志的条件函数
   * @returns {Function} 中间件函数
   */
  static logger(options = {}) {
    const { format = "combined", skip } = options;

    return (req, res, next) => {
      // 如果有跳过条件且满足，则跳过日志
      if (skip && skip(req, res)) {
        return next();
      }

      const startTime = Date.now();

      // 记录请求开始时间
      req.startTime = startTime;

      // 监听响应结束事件（模拟）
      const originalEnd = res.end;
      res.end = function (...args) {
        const duration = Date.now() - startTime;
        const logData = formatLog(req, res, duration, format);
        console.log(logData);
        return originalEnd.apply(this, args);
      };

      next();
    };
  }

  /**
   * 注册中间件
   * @param {...*} args - 路径和中间件函数
   * @returns {SimpleExpress} 支持链式调用
   */
  use(...args) {
    const handler = args.pop();
    const [path = "*"] = args;

    if (handler.length === 4) {
      // 错误处理中间件（4个参数：err, req, res, next）
      this.#errorMiddlewares.push({ handler });
    } else {
      // 中间件（3个参数：req, res, next）
      this.#middlewares.push({ path, handler });
    }
    return this;
  }

  /**
   * 初始化HTTP方法
   * @private
   */
  #initializeHttpMethods() {
    const methods = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ];
    methods.forEach((method) => {
      method = method.toLowerCase();
      this[method] = (path, ...handlers) => {
        handlers.forEach((handler) => this.#route(method, path, handler));
      };
    });
  }

  /**
   * 注册路由
   * @param {string} method - HTTP方法
   * @param {string} path - 路径
   * @param {Function} handler - 处理函数
   * @returns {SimpleExpress} 支持链式调用
   * @private
   */
  #route(method, path, handler) {
    this.#routes.push({ method, path, handler });
    return this;
  }

  /**
   * 启动方法 - 公共API入口
   * @returns {Promise<*>} 处理结果
   */
  async run() {
    return await this.#handleRequest(
      new Request(this.#originalReq),
      new Response(this.#originalRes)
    );
  }

  /**
   * 处理请求
   * @param {Request} req - 请求对象
   * @param {Response} res - 响应对象
   * @param {Error} error - 错误对象
   * @returns {Promise<*>} 处理结果
   * @private
   */
  async #handleRequest(req, res, error) {
    try {
      error
        ? await this.#errorMiddleware(error, req, res)
        : await this.#runMiddlewares(req, res);
    } catch (error) {
      if (error instanceof ResponseEndedError) return error.value;
      if (!(error instanceof MiddlewareError)) {
        console.log(error.toString());
        console.log(error.stack);
      }
      return this.#handleRequest(req, res, error);
    }
  }

  /**
   * 执行中间件
   * @param {Request} req - 请求对象
   * @param {Response} res - 响应对象
   * @returns {Promise<void>}
   * @private
   */
  async #runMiddlewares(req, res) {
    await this.#createNext(this.#middlewares, req, res); // 1️⃣ 先执行通用中间件
    await this.#createNext(this.#routes, req, res); // 2️⃣ 再执行路由中间件

    // 🚫 兜底404处理：没有匹配的路由
    res.status(404).json({ error: "Not Found" });
  }

  /**
   * 错误中间件处理
   * @param {Error} error - 错误对象
   * @param {Request} req - 请求对象
   * @param {Response} res - 响应对象
   * @returns {Promise<void>}
   * @private
   */
  async #errorMiddleware(error, req, res) {
    await this.#createNext(this.#errorMiddlewares, req, res, error);
    // 🚫 兜底500处理：服务器错误
    res.status(500).json({ error: error.message });
  }

  /**
   * 创建next函数生成器
   * @param {Array} tasks - 任务列表
   * @param {Request} req - 请求对象
   * @param {Response} res - 响应对象
   * @param {Error} error - 错误对象
   * @returns {Promise<void>}
   * @private
   */
  async #createNext(tasks, req, res, error) {
    for (let i = 0, j = 0; i < tasks.length; j++) {
      if (j > i) throw new Error("请使用next传递下一个中间件");
      const { path = "*", handler, method } = tasks[i];
      const { match, params } = matchPath(path, req.path);
      if (!match || (method && method !== req.method)) {
        i++;
        continue;
      }
      params && (req.params = params);
      const next = (input) => {
        i++;
        if (input && input !== "route") {
          const inputError = new MiddlewareError(input?.message ?? input);
          if (error) {
            // 错误中间件，继续传递错误
            error = inputError;
          } else {
            //普通中间件跳转到错误中间件
            throw inputError;
          }
        }

        // 关键字匹配成功，跳过下一个中间件
        if (input === "route" && method) i++, j++;
      };

      error
        ? await handler(error, req, res, next)
        : await handler(req, res, next);
    }
  }
}

//测试代码;
// $request.url = "https://api.exchangerate-api.com/v4/latest/CNY";

// const app = new SimpleExpress($request);

// app.use(SimpleExpress.json());

// app.use((req, res, next) => {
//   console.log(req.method, req.path);
//   next();
// });

// app.post("/", (req, res, next) => {
//   // console.log(typeof req.body);
//   res.send("我很屌呀");
// });

// app.post("/v4/latest/CNY", (req, res, next) => {
//   // console.log(typeof req.body);
//   res.send("我很屌");
// });

// app.run().then(result => {
//   $done(result);
// });
