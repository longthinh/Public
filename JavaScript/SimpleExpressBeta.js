/**
 * Utility function: Converts all keys of an object to lowercase.
 * @param {Object} obj - The input object.
 * @returns {Object} The converted object, with all keys in lowercase.
 */
const toLowerCaseKeys = (obj) => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {});
};

/**
 * Utility function to get the data type.
 * @param {*} data - The data to be checked.
 * @returns {string} The data type.
 */
const getDataType = (data) => {
  // Handle null values
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

  // Handle object type (excluding null)
  if (typeof data === "object" && data !== null) {
    return "object";
  }

  // Handle string type - intelligently check if it's HTML
  if (typeof data === "string") {
    const isHtml = /<[^>]*>/.test(data);
    return isHtml ? "html" : "string";
  }

  // Handle number type
  if (typeof data === "number") {
    return "number";
  }

  // Other types
  return "other";
};

/**
 * Utility function to format log output.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @param {number} duration - The request processing time (milliseconds).
 * @param {string} format - The log format ('combined', 'common', 'short', 'tiny').
 * @returns {string} The formatted log string.
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
 * Private method to parse query parameters.
 * @param {string} search - The search part of the URL.
 * @returns {Object} The parsed query parameter object.
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
 * Path matching (supports parameters).
 * @param {string} routePath - The route path.
 * @param {string} requestPath - The request path.
 * @returns {Object} The matching result object.
 * @private
 */
const matchPath = (routePath, requestPath) => {
  if (routePath === "*") return { match: true };

  const keys = [];
  let starIdx = 0;

  const pattern = routePath
    // Unnamed * → params["0"], "1", ...
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
    // :name+  One or more segments
    .replace(/:(\w+)\+/g, (_, key) => {
      keys.push(key);
      return "([^/]+(?:\\/[^/]+)*)";
    })
    // :name*  Zero or more segments
    .replace(/:(\w+)\*/g, (_, key) => {
      keys.push(key);
      return "(.*)?";
    })
    // :name? Optional single segment (at the start)
    .replace(/^:(\w+)\?/, (_, key) => {
      keys.push(key);
      return "([^/]+)?";
    })
    // :name? Optional single segment (with slash)
    .replace(/\/:(\w+)\?/, (_, key) => {
      keys.push(key);
      return "(?:/([^/]+))?";
    })
    // Normal :name
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

// 1. Request Class - Handles request-related functionality
class Request {
  /**
   * Creates a Request instance.
   * @param {Object} originalReq - The original request object.
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
   * Gets the request header field value.
   * @param {string} field - The request header field name.
   * @returns {string} The request header field value.
   */
  get(field) {
    return this.headers[field.toLowerCase()];
  }

  /**
   * Checks if the client accepts the specified MIME type.
   * @param {string} type - The MIME type.
   * @returns {boolean} Whether the type is accepted.
   */
  accepts(type) {
    const accept = this.get("accept") || "*/*";
    return accept.includes(type) || accept.includes("*/*");
  }

  /**
   * Checks if the client accepts the specified character set.
   * @param {string} charset - The character set.
   * @returns {boolean} Whether the character set is accepted.
   */
  acceptsCharset(charset) {
    const acceptCharset = this.get("accept-charset") || "*";
    return acceptCharset.includes(charset) || acceptCharset.includes("*");
  }

  /**
   * Parses the Range header for partial content requests.
   * @param {number} size - The total size of the resource.
   * @returns {Object|null} The Range object or null.
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
   * Gets the Content-Type of the request body.
   * @returns {string|null} The Content-Type or null.
   */
  contentType() {
    const contentType = this.get("content-type");
    if (!contentType) return null;
    return contentType.split(";")[0].trim();
  }

  /**
   * Gets a parameter value, searching by priority: params, body, query.
   * @param {string} name - The parameter name.
   * @returns {*} The parameter value, or undefined if not found.
   */
  param(name) {
    // Search in order of priority: params -> body -> query
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
   * Gets the raw request body data.
   * @returns {*} The raw request body data.
   */
  raw() {
    return this.body;
  }

  /**
   * Gets the request body in text format.
   * @returns {string} The request body in text format.
   */
  text() {
    if (!this.body) return "";
    return typeof this.body === "string" ? this.body : this.body.toString();
  }

  /**
   * Parses the request body in JSON format.
   * @returns {Object} The parsed JSON object.
   * @throws {Error} When the request body is not in JSON format or parsing fails.
   */
  json() {
    if (this.contentType() !== "application/json") {
      throw new Error("Request body is not in JSON format");
    }
    try {
      const text = this.text();
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error("JSON parsing failed: " + error.message);
    }
  }

  /**
   * Parses form data.
   * @returns {Object} The parsed form data object.
   * @throws {Error} When the request body is not in form format.
   */
  formData() {
    if (this.contentType() !== "application/x-www-form-urlencoded") {
      throw new Error("Request body is not in form format");
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

// 2. Response Class - Handles response-related functionality
class Response {
  // HTTP status code mapping table
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
   * Creates a Response instance.
   * @param {Object} #originalRes - The original response object.
   */
  constructor(originalRes = {}) {
    const { status = 200, headers = {}, body = "" } = originalRes;
    this.#originalRes = { status, headers, body };
  }

  /**
   * Gets the response status code.
   * @returns {number} The HTTP status code.
   */
  get statusCode() {
    return this.#originalRes.status;
  }

  /**
   * Sets the status code.
   * @param {number} code - The HTTP status code.
   * @returns {Response} Supports chaining.
   */
  status(code) {
    this.#originalRes.status = code;
    return this; // Supports chaining
  }

  /**
   * Sends a status code response.
   * @param {number} statusCode - The HTTP status code.
   * @returns {Response} Supports chaining.
   */
  sendStatus(statusCode) {
    const statusText = Response.STATUS_CODES[statusCode] || "Unknown";
    this.status(statusCode);
    this.send(statusText);
    return this;
  }

  /**
   * Gets the status text.
   * @param {number} code - The HTTP status code.
   * @returns {string} The status text.
   */
  getStatusText(code) {
    return Response.STATUS_CODES[code] || "Unknown";
  }

  /**
   * Sets a response header.
   * @param {string} name - The response header name.
   * @param {string} value - The response header value.
   */
  setHeader(name, value) {
    this.#originalRes.headers[name.toLowerCase()] = value;
  }

  /**
   * Sets response headers (supports object and key-value pairs).
   * @param {string|Object} field - The response header field name or object.
   * @param {string} value - The response header value.
   * @returns {Response} Supports chaining.
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
   * Gets a response header.
   * @param {string} name - The response header name.
   * @returns {string} The response header value.
   */
  getHeader(name) {
    return this.#originalRes.headers[name.toLowerCase()];
  }

  /**
   * Gets a response header.
   * @param {string} field - The response header field name.
   * @returns {string} The response header value.
   */
  get(field) {
    return field ? this.getHeader(field) : { ...this.#originalRes.headers };
  }

  /**
   * Ends the response (core method, control flow reflection).
   * @param {*} data - The response data.
   * @throws {ResponseEndedError} Response ended error.
   */
  end(data) {
    this.#originalRes.body = data;
    throw new ResponseEndedError({ ...this.#originalRes });
  }

  /**
   * Sends a JSON response.
   * @param {*} data - The data to send.
   */
  json(data) {
    this.set("Content-Type", "application/json; charset=utf-8");
    this.end(JSON.stringify(data));
  }

  /**
   * Smartly sends a response.
   * @param {*} data - The data to send.
   */
  send(data) {
    // Get data type for switch case
    switch (getDataType(data)) {
      case "null":
        // Handle null value case
        this.end();
        break;

      case "Uint8Array":
      case "ArrayBuffer":
        // Handle Buffer type
        this.set("Content-Type", "application/octet-stream").end(data);
        break;

      case "object":
        // Handle object type (including arrays)
        this.json(data);
        break;

      case "html":
        // Handle HTML string
        this.set("Content-Type", "text/html; charset=utf-8").end(data);
        break;

      case "string":
        // Handle plain string
        this.set("Content-Type", "text/plain; charset=utf-8").end(data);
        break;

      case "number":
        // Handle number type - convert to string and set as plain text
        this.set("Content-Type", "text/plain; charset=utf-8").end(String(data));
        break;

      default:
        // Handle other types - convert to string
        this.set("Content-Type", "text/plain; charset=utf-8").end(String(data));
        break;
    }
  }
}

// 3. Response Ended Error Class
class ResponseEndedError extends Error {
  /**
   * Creates a Response Ended Error instance.
   * @param {*} value - The return value.
   */
  constructor(value) {
    super("ResponseEndedError");
    this.value = value;
  }
}

// 4. Middleware Error Class
class MiddlewareError extends Error {
  /**
   * Creates a Middleware Error instance.
   * @param {string} message - The error message.
   */
  constructor(message) {
    super(message);
    this.name = "MiddlewareError";
  }
}

/**
 * Minimalist Express implementation - includes only middleware and routing.
 * Focuses on core functionality, maintaining maximum simplicity.
 */
export default class SimpleExpress {
  #originalReq; // Original request object
  #originalRes; // Original response object
  #middlewares = []; // List of middlewares
  #errorMiddlewares = []; // List of error handling middlewares
  #routes = []; // Route mapping

  /**
   * Creates a SimpleExpress instance.
   * @param {Object} request - The request object.
   * @param {Object} response - The response object.
   */
  constructor(request, response) {
    this.#originalReq = request;
    this.#originalRes = response;
    this.#initializeHttpMethods();
  }

  // ==================== Static Middleware Methods ====================

  /**
   * JSON request body parsing middleware.
   * @returns {Function} The middleware function.
   */
  static json() {
    return (req, res, next) => {
      try {
        // Check Content-Type
        const contentType = req.contentType();
        if (!contentType || !contentType.includes("application/json")) {
          return next();
        }

        const jsonData = req.json();
        if (typeof jsonData !== "object") {
          return next(
            new Error("JSON format error: Must be an object or array")
          );
        }

        // Set the parsed data to req.body
        req.body = jsonData;
        next();
      } catch (error) {
        next(new Error(`JSON parsing failed: ${error.message}`));
      }
    };
  }

  /**
   * URL-encoded data parsing middleware.
   * @returns {Function} The middleware function.
   */
  static urlencoded() {
    return (req, res, next) => {
      try {
        // Check Content-Type
        const contentType = req.contentType();
        if (
          !contentType ||
          !contentType.includes("application/x-www-form-urlencoded")
        ) {
          return next();
        }

        // Parse form data
        const formData = req.formData();

        // Set the parsed data to req.body
        req.body = formData;
        next();
      } catch (error) {
        next(new Error(`Form data parsing failed: ${error.message}`));
      }
    };
  }

  /**
   * Request logging middleware.
   * @param {Object} options - Logging configuration options.
   * @param {string} options.format - Log format ('combined', 'common', 'short', 'tiny').
   * @param {Function} options.skip - Function for condition to skip logging.
   * @returns {Function} The middleware function.
   */
  static logger(options = {}) {
    const { format = "combined", skip } = options;

    return (req, res, next) => {
      // If skip condition exists and is met, skip logging
      if (skip && skip(req, res)) {
        return next();
      }

      const startTime = Date.now();

      // Record request start time
      req.startTime = startTime;

      // Listen for response end event (simulation)
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
   * Registers middleware.
   * @param {...*} args - Path and middleware function(s).
   * @returns {SimpleExpress} Supports chaining.
   */
  use(...args) {
    const handler = args.pop();
    const [path = "*"] = args;

    if (handler.length === 4) {
      // Error handling middleware (4 arguments: err, req, res, next)
      this.#errorMiddlewares.push({ handler });
    } else {
      // Middleware (3 arguments: req, res, next)
      this.#middlewares.push({ path, handler });
    }
    return this;
  }

  /**
   * Initializes HTTP methods.
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
   * Registers a route.
   * @param {string} method - The HTTP method.
   * @param {string} path - The path.
   * @param {Function} handler - The handler function.
   * @returns {SimpleExpress} Supports chaining.
   * @private
   */
  #route(method, path, handler) {
    this.#routes.push({ method, path, handler });
    return this;
  }

  /**
   * Startup method - Public API entry point.
   * @returns {Promise<*>} The processing result.
   */
  async run() {
    return await this.#handleRequest(
      new Request(this.#originalReq),
      new Response(this.#originalRes)
    );
  }

  /**
   * Handles the request.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @param {Error} error - The error object.
   * @returns {Promise<*>} The processing result.
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
   * Executes middlewares.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @returns {Promise<void>}
   * @private
   */
  async #runMiddlewares(req, res) {
    await this.#createNext(this.#middlewares, req, res); // 1️⃣ First execute general middlewares
    await this.#createNext(this.#routes, req, res); // 2️⃣ Then execute route middlewares

    // 🚫 Fallback 404 handler: No matching route
    res.status(404).json({ error: "Not Found" });
  }

  /**
   * Error middleware handler.
   * @param {Error} error - The error object.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @returns {Promise<void>}
   * @private
   */
  async #errorMiddleware(error, req, res) {
    await this.#createNext(this.#errorMiddlewares, req, res, error);
    // 🚫 Fallback 500 handler: Server error
    res.status(500).json({ error: error.message });
  }

  /**
   * Creates the next function generator.
   * @param {Array} tasks - The task list.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @param {Error} error - The error object.
   * @returns {Promise<void>}
   * @private
   */
  async #createNext(tasks, req, res, error) {
    for (let i = 0, j = 0; i < tasks.length; j++) {
      if (j > i) throw new Error("Please use next to pass the next middleware");
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
            // Error middleware, continue passing the error
            error = inputError;
          } else {
            // Regular middleware, jump to error middleware
            throw inputError;
          }
        }

        // Keyword matched successfully, skip the next middleware
        if (input === "route" && method) i++, j++;
      };

      error
        ? await handler(error, req, res, next)
        : await handler(req, res, next);
    }
  }
}
