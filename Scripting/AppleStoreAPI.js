// Module Import Utility Class
class $ {
  static async imports(...input) {
    return await Promise.all(input.map((i) => this.import(...i)));
  }

  static async import(...args) {
    const url = this.#cdn(args.pop());
    const rule = args[0];

    try {
      const module = await import(url);
      const exp = "default" in module ? module.default : module;
      const expName = typeof exp.name === "string" ? exp.name : "default";
      this.#mountFunction(rule, exp, expName);
      console.log(`${url} Load successful`);
    } catch (error) {
      console.log(`Module loading failed: ${url}`, error);
      throw error;
    }
  }
  static #cdn(path) {
    const { host } = new URL(path);
    if (!host.includes("github")) return path;
    return path
      .replace(host, `fastly.jsdelivr.net/gh`)
      .replace(/refs.+(?=main)/, "")
      .replace(/\/blob\//, "@")
      .replace(/\/main/, "@main")
      .replace(/\/master/, "@master");
  }
  static #mountFunction(rule, exp, expName, depth = 0) {
    if (typeof exp === "object" && depth === 0) {
      if (typeof rule === "string" && rule.includes("* as"))
        return (this[rule.split(" ").at(-1)] = exp);

      Object.entries(exp).forEach(([k, v]) => {
        this.#mountFunction(rule, v, k, depth + 1);
      });
    } else if (!rule) {
      this[expName] = exp;
    } else if (typeof rule === "string") {
      this[rule.split(" ").at(-1)] = exp;
    } else if (typeof rule === "function") {
      const result = rule({ name: expName, fn: exp });
      result.stop || (this[result.name ?? expName] = result.fn ?? exp);
    } else if (Array.isArray(rule)) {
      rule.forEach((n) => {
        if (n.includes(expName)) this[n.split(" ").at(-1)] = exp;
      });
    }
  }
}
// LRU Cache Class
class LRUCache {
  #cache;
  constructor(capacity, cache) {
    this.capacity = capacity;
    this.#cache = new Map(cache || []);
  }

  has(key) {
    return this.#cache.has(key);
  }

  get(key) {
    if (!this.#cache.has(key)) return;
    const value = this.#cache.get(key);
    this.#cache.delete(key);
    this.#cache.set(key, value);
    return value;
  }

  put(key, value) {
    if (this.#cache.has(key)) {
      this.#cache.delete(key);
    } else if (this.#cache.size >= this.capacity) {
      this.#cache.delete(this.#cache.keys().next().value);
    }

    this.#cache.set(key, value);
  }

  toArray() {
    return this.#cache.entries().toArray();
  }
}
// Custom error class
class CustomError extends Error {
  constructor(...args) {
    super(args.pop());
    if (args[0]) this.name = args[0] + "Error";
  }
}
// Generate virtual GUID | Cache MAC address
const getMAc = (key) => {
  const generateHexPair = () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");

  let uniqueId = $.cache.get(key);

  if (!uniqueId) {
    uniqueId = Array.from({ length: 6 }, generateHexPair)
      .join("")
      .toUpperCase();

    $.cache.set(key, uniqueId);
  }

  return uniqueId;
};
// Calculate capacity
const formatSize = (size, unit = "B") => {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const currentIndex = Math.max(0, units.indexOf(unit.toUpperCase()));
  let bytes = size * 1024 ** currentIndex;
  let unitIndex = 0;
  while (bytes >= 1024 && unitIndex < units.length - 1) {
    bytes /= 1024;
    unitIndex++;
  }
  const formattedSize =
    bytes < 10
      ? bytes.toFixed(2)
      : bytes < 100
      ? bytes.toFixed(1)
      : Math.round(bytes).toString();
  return `${formattedSize} ${units[unitIndex]}`;
};
// Shared State | Global Configuration
const sharedState = {
  GUID: "AppleMac",
  LOGIN_KEY: "AppleLogin",
  VERSION_KEY: "AppVersions",
  MAX_APP_CACHE: 50,
  CONCURRENCY_CONFIG: {
    concurrencyLimit: 5,
    maxRetry: 2,
    waitTime: 0.5,
  },
};

/**
 * Abstract Base Class for Third-Party Services
 * Provides common interface discovery and data retrieval capabilities.
 * @description Provides unified foundational functionality for all third-party services.
 */
const ThirdPartyService = class {
  /**
   * Abstract property: The type identifier that must be implemented by the subclass.
   * @returns {string} The service type identifier.
   */
  static get type() {
    throw new Error(
      `The abstract property type defining the interface type must be implemented in the subclass ${this.name}`
    );
  }

  /**
   * Gets a list of all available third-party interfaces.
   * Interface naming convention: _get + InterfacesName + type
   * @description Returns the identifiers for all currently supported third-party interfaces.
   * @param {number} [limit=Number.MAX_SAFE_INTEGER] - Limits the number of interfaces to return; defaults to returning all interfaces.
   * @returns {Array<string>} - An array of available third-party interface identifiers.
   */
  static getAvailableInterfaces(limit = Number.MAX_SAFE_INTEGER) {
    const methods = Object.getOwnPropertyNames(this);
    const excludeMethod = `_getApp${this.type}List`;
    const regex = new RegExp(`^_get(.+)${this.type}$`);

    // Filter private method names that match the pattern and extract the interface name
    return methods
      .flatMap((method) => {
        if (
          method.startsWith("_get") &&
          method.endsWith(this.type) &&
          method !== excludeMethod
        ) {
          return method.replace(regex, "$1");
        }
        return [];
      })
      .slice(0, limit);
  }

  /**
   * Dynamically searches for and calls a third-party interface.
   * @description Dynamically calls the corresponding private method based on the interface name.
   * @param {string} selset - The interface name (e.g., "Timbrd", "Bilin").
   * @param {...any} args - Arguments passed to the specific method.
   * @returns {Promise<any>} - The result of the interface call.
   */
  static async searchInterface(selset, ...args) {
    const methodName = `_get${
      selset.charAt(0).toUpperCase() + selset.slice(1)
    }${this.type}`;

    if (this[methodName]) {
      return await this[methodName](...args);
    } else {
      throw new Error(`第三方接口 ${selset} 暂未实现`);
    }
  }

  /**
   * Generic third-party data retrieval method.
   * @param {string|Object} req - Request URL | Request object.
   * @param {string} id - The application ID or query parameter.
   * @param {Function} dataExtractor - The data extraction function.
   * @returns {Promise<Object>} - The formatted data information.
   */
  static async _fetchThirdPartyData(req, id, dataExtractor) {
    try {
      const { body } = await $.http(req, 8);
      const data = dataExtractor(body);

      return {
        appId: id,
        data,
        total: data.length,
      };
    } catch (error) {
      throw new Error(`${req?.url ?? req} 接口请求失败: ${error.message}`);
    }
  }
};

/**
 * Version Query Service
 * Specifically handles application version-related queries.
 * Overrides the base class abstract property 'type', returns "Versions".
 * Interface naming convention: _get + InterfacesName + type
 * @description Inherits from ThirdPartyService, providing application version query functionality.
 */
const VersionService = class extends ThirdPartyService {
  static type = "Versions";

  /**
   * Gets the application version list.
   * @description Retrieves the application version list based on the application ID and the selected third-party interface.
   * @param {string} id - The application ID.
   * @param {string} selset - The identifier for the selected third-party interface.
   * @returns {Promise<[number, number][]>>} - The application version list information, where each element is [version ID, version number].
   */
  static async getAppVersionList(id, selset) {
    return await this.searchInterface(selset, id);
  }

  /**
   * Concurrently fetches the application version list.
   * @description Concurrently calls all available version interfaces and returns the first successful result.
   * @param {string} id - The application ID.
   * @param {number} [num=Number.MAX_SAFE_INTEGER] - Limits the number of interfaces to return; defaults to returning all interfaces.
   * @returns {Promise<Object>} - The result of the first successful version interface call.
   * @throws {Error} - Throws an error when all interfaces fail.
   */
  static async concurrentGetVersionList(id, num = Number.MAX_SAFE_INTEGER) {
    const availableInterfaces = this.getAvailableInterfaces(num);

    if (availableInterfaces.length === 0) {
      throw new Error(`No available version interface`);
    }

    return Promise.any(
      availableInterfaces.map((interfaceName) =>
        this.getAppVersionList(id, interfaceName)
      )
    );
  }

  /**
   * Gets the application version list via the timbrd interface (Private Method).
   * @param {string} id - The application ID.
   * @returns {Promise<Object>} - The application version list.
   */
  static async _getTimbrdVersions(id) {
    const url = `https://api.timbrd.com/apple/app-version/index.php?id=${id}`;
    return this._fetchThirdPartyData(url, id, (body) =>
      JSON.parse(body)
        .reverse()
        .map(({ external_identifier, bundle_version }) => [
          external_identifier,
          bundle_version,
        ])
    );
  }

  /**
   * Gets the application version list via the bilin interface (Private Method).
   * @param {string} id - The application ID.
   * @returns {Promise<Object>} - The application version list.
   */
  static async _getBilinVersions(id) {
    const url = `https://apis.bilin.eu.org/history/${id}`;
    return this._fetchThirdPartyData(url, id, (body) =>
      body.data.map(({ external_identifier, bundle_version }) => [
        external_identifier,
        bundle_version,
      ])
    );
  }
};

// Authentication Service | Log in to Apple Account
const AuthService = class {
  /**
   * Logs into the Apple account.
   * Caches the login response.
   * @description Logs into the Apple account to retrieve the login response data.
   * @param {Object} op - Login parameters.
   * @param {string} op.appleId - The Apple account (Apple ID).
   * @param {string} op.password - The password for the Apple account.
   * @param {string} [op.code] - The verification code, required during login.
   * @returns {Promise<Object>} - The response data after a successful login.
   */
  static async #login({ appleId, password, code }) {
    const dataJson = {
      attempt: code ? 2 : 4,
      createSession: "true",
      guid: getMAc(sharedState.GUID),
      rmp: 0,
      why: "signIn",
      appleId,
      password: `${password}${code ?? ""}`,
    };
    const body = $.plist.build(dataJson);
    const url = `https://auth.itunes.apple.com/auth/v1/native/fast?guid=${dataJson.guid}`;
    const resp = await $.http.post({ url, body, timeout: 6 });
    const parsedResp = $.plist.parse(resp.body);

    this.validate(parsedResp);
    $.log("Login successful", parsedResp?.accountInfo);
    const cacheLoginResp = JSON.parse(
      $.cache.get(sharedState.LOGIN_KEY) || "{}"
    );

    const { "set-cookie": Cookie } = resp.headers;
    const storeFront = resp.headers["x-set-apple-store-front"]?.split("-")?.[0];
    Object.assign(cacheLoginResp, parsedResp, { password, Cookie, storeFront });
    $.cache.setJson(sharedState.LOGIN_KEY, cacheLoginResp);
    return { ...parsedResp, storeFront };
  }

  /**
   * Loads the cached login response.
   * @description Loads the login response from the cache; if it does not exist, it performs a login and caches the result.
   * @param {Object} op - Login parameters.
   * @param {string} op.appleId - The Apple ID. When the login account does not match the cached account, it will switch accounts and log in again.
   * @returns {Promise<Object>} - The response data after a successful login.
   */
  static async login(op) {
    const loginResp = JSON.parse($.cache.get(sharedState.LOGIN_KEY) || null);

    if (op && !loginResp) return await this.#login(op);

    if (op && op.appleId !== loginResp.accountInfo?.appleId) {
      $.log(
        "The login account does not match the cached account. Switching accounts to log in"
      );
      $.cache.remove(sharedState.LOGIN_KEY);
      return await this.#login(op);
    }

    if (op && op.password !== loginResp.password) {
      $.log("Password changed! Attempting to log in again.");
      return await this.#login(op);
    }

    this.validate(loginResp);
    op && $.log("Logged in", loginResp.accountInfo);
    return loginResp;
  }

  /**
   * Refreshes the login Cookie.
   * @description Refreshes the Cookie for the current login, extending the login validity period.
   * @returns {Promise<Object>} - The response data after a successful refresh.
   */
  static async refreshCookie() {
    const { accountInfo = {}, password } = JSON.parse(
      $.cache.get(sharedState.LOGIN_KEY) || "{}"
    );
    const { appleId } = accountInfo;
    if (!appleId || !password) {
      throw new CustomError(
        "Login",
        "Not logged in. Failed to refresh Cookie, please log in again"
      );
    }
    return await this.#login({ appleId, password });
  }
  /**
   * Resets the login status and cached data.
   * @description Clears login-related cached data and GUID cache.
   * @returns {Object} - The reset result information.
   */
  static reset() {
    try {
      // Clear login cache
      $.cache.remove(sharedState.LOGIN_KEY);
      // Clear GUID cache (MAC address)
      $.cache.remove(sharedState.GUID);

      $.log("Reset successful! Login cache and GUID cache have been cleared");

      return {
        success: true,
        message:
          "Reset successful! Login information and GUID cache have been cleared",
        clearedKeys: [sharedState.LOGIN_KEY, sharedState.GUID],
      };
    } catch (error) {
      throw new CustomError("Reset", `Reset failed: ${error.message}`);
    }
  }

  /**
   * Validates the login response.
   * @param {Object} loginResp - The login response data.
   * @throws {Error} - Throws an error if the login response is invalid.
   */
  static validate(loginResp) {
    if (!loginResp)
      throw new CustomError("Login", "Not logged in, please log in first.");

    if (!loginResp.accountInfo && !loginResp.customerMessage) {
      throw new CustomError(
        "Login",
        "Cache data is invalid, please log in again."
      );
    }

    if (Object.hasOwn(loginResp, "failureType")) {
      const { failureType, customerMessage } = loginResp;
      throw new CustomError("Login", [
        "Login failed",
        failureType,
        customerMessage,
      ]);
    }

    return true;
  }
};

// Store Services | Download | Purchase
const StoreService = class {
  /**
   * Search apps
   * @param {string} term - Search keyword
   * @param {number} [limit=10] - Limit on the number of results returned, default is 10
   * @param {string} [country='CN'] - Country/region to search, default is China
   * @returns {Promise<Array>} - Array of search results
   */
  static async searchApps({
    term,
    limit = 10,
    country = "CN",
    entity = "software",
  }) {
    // Construct search URL
    const searchUrl = new URL("https://itunes.apple.com/search");
    searchUrl.searchParams.set("term", term.trim());
    searchUrl.searchParams.set("country", country.toLowerCase());
    searchUrl.searchParams.set("entity", entity);
    searchUrl.searchParams.set("explicit", "yes");
    searchUrl.searchParams.set("limit", limit.toString());

    // Send request
    const { body } = await $.http(searchUrl.toString(), 8);
    return body;
  }

  /**
   * Get app information
   * If the app has not been purchased, it will attempt to purchase it; throws an error if the purchase fails
   * @param {number} salableAdamId - The app's Adam ID
   * @param {number} [externalVersionId] - The app's external version ID, optional; if not provided, returns the latest version
   * @returns {Promise<Object>} - App information
   */
  static async getAppInfo(salableAdamId, externalVersionId) {
    const { dsPersonId, Cookie } = await this.getValidatedAuth();

    const dataJson = {
      creditDisplay: "",
      guid: getMAc(sharedState.GUID),
      salableAdamId,
      externalVersionId,
    };
    const resp = await $.http.post({
      url: `https://p25-buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${dataJson.guid}`,
      body: $.plist.build(dataJson),
      timeout: 6,
      headers: {
        Cookie,
        "X-Dsid": dsPersonId,
        "iCloud-DSID": dsPersonId,
      },
    });

    const appInfo = $.plist.parse(resp.body);
    try {
      this.validateAppInfo(appInfo);
      return await this.formatAppInfo(appInfo);
    } catch (error) {
      if (
        error.name === "AppInfoError" &&
        error.message.includes("2042") &&
        error.message.includes("2034")
      ) {
        await AuthService.refreshCookie();
        return await this.getAppInfo(salableAdamId, externalVersionId);
      }

      if (error.name === "AppInfoError" && error.message.includes("9610")) {
        await this.purchaseApp(salableAdamId);
        return await this.getAppInfo(salableAdamId, externalVersionId);
      }

      throw error;
    }
  }

  /**
   * Get the validated login response
   * @description Retrieve the login response from the cache and validate its validity
   * @throws {Error} - Throws an error if the login response is invalid
   * @returns {Object} - Response data after successful login
   */
  static async getValidatedAuth() {
    return await AuthService.login();
  }

  /**
   * Validate app information
   * @param {Object} appInfo - App information
   * @throws {Error} - Throws an error if the app information is invalid
   */
  static validateAppInfo(appInfo) {
    if (!appInfo) throw new CustomError("AppInfo", "App information is empty");
    if (Object.hasOwn(appInfo, "failureType")) {
      const { failureType, customerMessage } = appInfo;
      throw new CustomError("AppInfo", [
        "Failed to retrieve app information",
        failureType,
        customerMessage,
      ]);
    }
    if (!appInfo?.songList?.length) {
      throw new CustomError(
        "AppInfo",
        "The app information for this version ID is empty"
      );
    }

    return true;
  }

  /**
   * Batch query app versions
   * @param {string} direction - Query direction; 'next' means query older versions, 'prev' means query newer versions
   * @param {number} salableAdamId - The app ID to query
   * @param {number} startVersionId - Starting version ID for the query, default is the latest version
   * @param {number} count - Number of versions to query; default -1 returns all
   * @returns {Promise<Array<Object>>} - List of version information
   */
  static async getVersions({
    direction,
    count = -1,
    salableAdamId,
    startVersionId,
  }) {
    // Initialize by retrieving the app version list from the cache; if not present, fetch it from the API
    const { cachedVersionsAll, versionList } = await this.getAppVersionCache(
      salableAdamId,
      startVersionId
    );

    // No pagination
    if (count === -1)
      return {
        data: versionList.entries().toArray(),
        total: versionList.size,
      };

    // Pagination
    let index = versionList.keys().toArray().indexOf(startVersionId);
    if (index === -1) index = 0;
    if (direction === "prev") index -= count;
    if (index < 0) index = 0;

    $.http.useReq((req) => Object.assign(req, { timeout: 11 }));
    const page = versionList.entries().drop(index).take(count).toArray();

    const tasks = page.map(([extVersionId, cachebuildVersion]) => async () => {
      try {
        if (versionList.get(extVersionId))
          return [extVersionId, cachebuildVersion];
        const { buildVersion } = await StoreService.getAppInfo(
          salableAdamId,
          extVersionId
        );
        versionList.set(extVersionId, buildVersion);
        return [extVersionId, buildVersion];
      } catch ({ message }) {
        throw [extVersionId, message];
      }
    });

    const { fulfilled, rejected } = await $.taskProcessor.runTasks({
      tasks,
      ...sharedState.CONCURRENCY_CONFIG,
    });
    cachedVersionsAll.put(salableAdamId, versionList.entries().toArray());
    $.cache.set(
      sharedState.VERSION_KEY,
      JSON.stringify(cachedVersionsAll.toArray())
    );

    return {
      data: [...fulfilled, ...rejected],
      total: versionList.size,
    };
  }

  /**
   * Get app version cache
   * Merge third-party API data
   * @description Retrieve the app version list from the cache; if it does not exist, fetch it from the APIs
   * @param {number} salableAdamId - The app's Adam ID
   * @param {number} startVersionId - The app's external version ID, optional; if not provided, returns the latest version
   * @returns {cachedVersionsAll} - All app versions; returns an empty array if not in cache
   * @returns {versionList} - Current app version list (Map type, key: external version ID, value: null or version identifier); if not in cache, fetches and returns the version list
   */
  static async getAppVersionCache(salableAdamId, startVersionId) {
    const cachedVersionsAll = new LRUCache(
      sharedState.MAX_APP_CACHE,
      JSON.parse($.cache.get(sharedState.VERSION_KEY) ?? "[]")
    );

    // If the version list of the app does not exist in the cache, fetch data from the official and third-party APIs
    if (!cachedVersionsAll.has(salableAdamId)) {
      const [processedVersions, legacyVersions] = await Promise.all([
        this.#processVersionIdList(salableAdamId, startVersionId),
        VersionService.concurrentGetVersionList(salableAdamId).catch(
          ({ errors = [], error }) => {
            $.log(...errors, error);
            return { total: 0, data: [] };
          }
        ),
      ]);

      if (processedVersions.length >= legacyVersions.total) {
        // Merge data sources
        processedVersions.forEach((p) => {
          const legacy = legacyVersions.data.find((i) => i[0] === p[0]);
          if (legacy && p[1] === "????") p[1] = legacy[1];
        });
        cachedVersionsAll.put(salableAdamId, processedVersions);
      } else {
        cachedVersionsAll.put(salableAdamId, legacyVersions.data);
      }
    }

    $.cache.set(
      sharedState.VERSION_KEY,
      JSON.stringify(cachedVersionsAll.toArray())
    );

    return {
      cachedVersionsAll,
      versionList: new Map(cachedVersionsAll.get(salableAdamId)),
    };
  }

  /**
   * Initialize the version ID list, ensuring it contains at least one version ID
   * @param {number} salableAdamId - The app's Adam ID
   * @param {string} startVersionId - The app's external version ID, optional; if not provided, returns the latest version
   * @returns {Array} - Formatted array of version IDs, each element in the format [id, null]
   */
  static async #processVersionIdList(salableAdamId, startVersionId) {
    const { externalVersionIdList, externalVersionId, displayVersion } =
      await this.getAppInfo(salableAdamId, startVersionId);

    if (!externalVersionIdList.length) {
      return [[externalVersionId, displayVersion]];
    }

    return externalVersionIdList.reverse().map((id) => [id, "????"]);
  }

  /**
   * Purchase an app
   * @param {number} salableAdamId - The app's Adam ID
   * @returns {Promise<string>} - The software ID of the successfully purchased app
   * @throws {CustomError} - Throws an error if the purchase fails
   */
  static async purchaseApp(salableAdamId) {
    const { dsPersonId, passwordToken, storeFront, Cookie } =
      await AuthService.refreshCookie();

    const dataJson = {
      appExtVrsId: "0",
      buyWithoutAuthorization: "true",
      guid: getMAc(sharedState.GUID),
      hasAskedToFulfillPreorder: "true",
      hasDoneAgeCheck: "true",
      price: "0",
      pricingParameters: "STDQ",
      productType: "C",
      salableAdamId,
    };
    const body = $.plist.build(dataJson);
    const url =
      "https://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/buyProduct";
    const headers = {
      Cookie,
      "X-Token": passwordToken,
      "X-Dsid": dsPersonId,
      "iCloud-DSID": dsPersonId,
      "X-Apple-Store-Front": storeFront,
    };
    const resp = await $.http.post({ url, body, headers }, 6);
    const { failureType, customerMessage, jingleDocType } = $.plist.parse(
      resp.body
    );

    switch (failureType) {
      case "5002":
        throw new CustomError("buy", "[Unknown error] Already purchased");
      case "2040":
        throw new CustomError(
          "buy",
          "[Purchase failed] Already purchased, removed from store"
        );
      case "2059":
        throw new CustomError(
          "buy",
          "[Purchase failed] Not purchased, removed from store, not available in region"
        );
      case "1010":
        throw new CustomError(
          "buy",
          "[Invalid Store] Not available in this region"
        );
      case "2034":
        throw new CustomError(
          "buy",
          "[Not logged in to iTunes Store] CK expired"
        );
      case "2042":
        throw new CustomError(
          "buy",
          "[Not logged in to iTunes Store] CK empty or expired"
        );
      case "2019":
        throw new CustomError(
          "buy",
          "[Purchase failed] Cannot directly purchase paid app"
        );
      case "9610":
        throw new CustomError(
          "buy",
          "[License not found] Not purchased or invalid app ID"
        );
      default:
        if (failureType || failureType === "")
          throw new CustomError("buy", `[Purchase failed] ${customerMessage}`);
    }

    if (jingleDocType) {
      $.log("Purchase successful", "Software ID:", salableAdamId);
      return salableAdamId;
    }
  }

  /**
   * Format app information
   * @param {Object} appInfo - App information object
   * @property {string} name - App name
   * @property {string} appId - Unique app identifier
   * @property {string} url - App download URL
   * @property {string} sinf - App license information
   * @property {string} bundleId - App bundle identifier
   * @property {string} displayVersion - User-visible version number
   * @property {string} buildVersion - Internal build version number
   * @property {number} externalVersionId - External version identifier
   * @property {Array<number>} externalVersionIdList - List of external version identifiers
   * @property {number} fileSize - File size
   * @property {Object} metadata - iTunesMetadata.plist file content
   * @property {string} currency - Currency unit
   */
  static async formatAppInfo(appInfo) {
    const {
      metrics: { currency },
    } = appInfo;

    const {
      songId: appId,
      URL: url,
      "artwork-urls": {
        default: { url: icon },
      },
      sinfs: [{ sinf }],
      "asset-info": { "file-size": fileSize },
      metadata,
    } = appInfo.songList[0];

    const {
      bundleDisplayName: name,
      softwareVersionBundleId: bundleId,
      bundleShortVersionString: displayVersion,
      bundleVersion: buildVersion,
      softwareVersionExternalIdentifier: externalVersionId,
      softwareVersionExternalIdentifiers: externalVersionIdList,
      rating: { label: minimumOsVersion },
    } = metadata;

    const {
      accountInfo: { appleId },
    } = await this.getValidatedAuth();

    Object.assign(appInfo, { appleId });

    // Debug information output
    // $.log("App name:", name);
    // $.log("App download URL:", url);
    // $.log("App icon:", icon);
    // $.log("App ID:", appId);
    // $.log("Software license info:", sinf);
    // $.log("App bundle identifier:", bundleId);
    // $.log("User version number:", displayVersion);
    // $.log("Internal build number:", buildVersion);
    // $.log("Version identifier:", externalVersionId);
    // $.log("List of version identifiers:", externalVersionIdList);
    // $.log("File size:", fileSize);
    // $.log("iTunesMetadata.plist file:", metadata);
    // $.log("Currency:", currency);
    // $.log("Minimum supported OS version:", minimumOsVersion);
    return {
      name,
      appId,
      url,
      icon,
      sinf,
      bundleId,
      displayVersion,
      buildVersion,
      externalVersionId,
      externalVersionIdList,
      fileSize,
      metadata: $.plist.build(metadata),
      minimumOsVersion: minimumOsVersion.replace("+", ""),
      currency,
    };
  }
};

/**
 * Unified response format handler
 * @param {boolean} success - Whether successful
 * @param {any} data - Response data
 * @param {string} error - Error message
 * @returns {Object} Uniformly formatted response object
 */
const createResponse = (success, data = null, error = null) => ({
  success,
  data,
  error,
  timestamp: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
});

/**
 * 参数验证工具函数
 * @param {boolean} condition - Validation condition
 * @param {string} message - Error information
 * @throws {Error} Throw an error when the condition is not met
 */
const validate = (condition, message) => {
  if (!condition) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
};

// Main function
const main = async () => {
  try {
    //Preload TaskProcessor
    const isTaskProcessor = $.import(
      ({ fn: TaskProcessor }) => ({
        name: "taskProcessor",
        fn: new TaskProcessor(),
      }),
      "https://raw.githubusercontent.com/longthinh/Public/refs/heads/main/Scripting/TaskProcessor.js"
    );

    await $.imports(
      ["* as plist", "https://esm.sh/plist"],
      [
        "express",
        "https://raw.githubusercontent.com/longthinh/Public/refs/heads/main/Scripting/SimpleExpressBeta.js",
      ],
      [
        ({ name, fn }) => ({ name: name.slice(1), fn }),
        "https://raw.githubusercontent.com/longthinh/Public/refs/heads/main/Scripting/utils.js",
      ]
    );

    $.http.useReq((req) => {
      Object.assign(req.headers, {
        "User-Agent":
          "Configurator/2.15 (Macintosh; OS X 11.0.0; 16G29) AppleWebKit/2603.3.8",
        "Content-Type": "application/x-www-form-urlencoded",
      });
      return req;
    });

    $.http.useRes((res) => {
      res.headers = Object.fromEntries(
        Object.entries(res.headers).map(([k, v]) => [k.toLowerCase(), v])
      );
      return res;
    });

    const app = new $.express($request);

    // Add middleware
    app.use($.express.json());
    app.use($.express.logger());

    // Root path - API information
    app.get("/", (req, res, next) => {
      const data = {
        name: "Apple Store API",
        version: "1.0.0",
        description: "Apple App Store app information and purchase API",
        endpoints: {
          "POST /auth/login": {
            description: "User login",
            body: {
              appleId: "Apple account (required)",
              password: "Apple account password (required)",
              code: "Verification code (optional, required for two-factor authentication)",
            },
          },
          "POST /auth/refresh": {
            description: "Refresh token",
            body: "No parameters",
          },
          "POST /auth/reset": {
            description: "Reset login state and GUID cache",
            body: "No parameters",
          },
          "GET /apps/:id": {
            description: "Get app information (including download URL)",
            params: {
              id: "appId (required)",
            },
            query: {
              appVerId:
                "App versionId (optional, if not provided, returns the latest version)",
            },
          },
          "GET /apps/:id/versions": {
            description:
              "Officially retrieve app version history, with third-party data merged",
            params: {
              id: "appId (required)",
            },
            query: {
              direction:
                "Query direction (optional, default: 'next', options: 'next' | 'prev')",
              count:
                "Number of results to return (optional, default: -1 for all results, page range: 1-20)",
              appVerId:
                "Starting versionId (optional, if not provided, starts from the latest version)",
            },
          },
          "GET /apps/:id/versions/legacy": {
            description: "Third-party app version history",
            params: {
              id: "appId (required)",
            },
            query: {
              selset:
                "Third-party API name (optional, default: the fastest concurrent response, options: 'Timbrd' | 'Bilin')",
            },
          },
          "POST /apps/:id/purchase": {
            description: "Purchase app",
            params: {
              id: "appId (required)",
            },
            body: "No parameters",
          },
          "GET /apps/search/:term": {
            description: "Search app(s)",
            params: {
              term: "Search keyword (required)",
            },
            query: {
              limit:
                "Number of results to return (optional, default: 10, range 1-20)",
              country: "Country/region to search (optional, default: 'CN')",
            },
          },
        },
        responseFormat: {
          success: {
            success: true,
            data: "Response data",
            message: "Success message (optional)",
          },
          error: {
            success: false,
            data: null,
            message: "Error message",
          },
        },
      };
      res.json(createResponse(true, data));
    });

    // Login API
    app.post("/auth/login", async (req, res, next) => {
      const { appleId, password, code } = req.body;
      validate(
        appleId && password,
        "Missing required parameters: Apple ID or Password"
      );

      const result = await AuthService.login({ appleId, password, code });
      const data = {
        message: "Login successful",
        loginData: result,
      };
      res.json(createResponse(true, data));
    });

    // Refresh Cookie API
    app.post("/auth/refresh", async (req, res, next) => {
      await AuthService.refreshCookie();
      const data = {
        message: "Cookie refreshed successfully",
      };
      res.json(createResponse(true, data));
    });

    // API to reset login state and cache
    app.post("/auth/reset", async (req, res, next) => {
      const result = AuthService.reset();
      res.json(createResponse(true, result));
    });

    // App information retrieval API - can be used to download the app
    app.get("/apps/:id", async (req, res, next) => {
      const { id } = req.params;
      const { appVerId } = req.query;

      validate(!isNaN(id), "Invalid appId");

      const appInfo = await StoreService.getAppInfo(parseInt(id), appVerId);
      const data = {
        appId: id,
        appInfo: appInfo,
      };
      res.json(createResponse(true, data));
    });

    // Official API to retrieve app version history
    app.get("/apps/:id/versions", async (req, res, next) => {
      const { id } = req.params;
      const { direction = "next", count = -1, appVerId } = req.query;

      validate(!isNaN(id), "Invalid appId");
      validate(
        !isNaN(count) && count >= -1 && count <= 20,
        "The page size must be between 1-20"
      );

      await isTaskProcessor;
      const versions = await StoreService.getVersions({
        direction,
        count: parseInt(count),
        salableAdamId: parseInt(id),
        startVersionId: appVerId ? parseInt(appVerId) : undefined,
      });

      const data = {
        appId: id,
        ...versions,
        direction,
        count: parseInt(count),
        appVerId,
      };
      res.json(createResponse(true, data));
    });

    // Third-party API to retrieve app version history
    app.get("/apps/:id/versions/legacy", async (req, res, next) => {
      const { id } = req.params;
      const { selset } = req.query;

      validate(!isNaN(id), "Invalid appId");

      const data = selset
        ? await VersionService.getAppVersionList(id, selset)
        : await VersionService.concurrentGetVersionList(id).catch(
            ({ errors = [], error }) => {
              throw errors.length ? errors.map((e) => e.message) : error;
            }
          );

      res.json(createResponse(true, data));
    });

    // Purchase app API
    app.post("/apps/:id/purchase", async (req, res, next) => {
      const { id } = req.params;

      validate(!isNaN(id), "Invalid appId");

      const result = await StoreService.purchaseApp(id);
      const data = {
        appId: id,
        message: "Purchase request has been submitted",
        purchaseResult: result,
      };
      res.json(createResponse(true, data));
    });

    // Search app API
    app.get("/apps/search/:term", async (req, res, next) => {
      const { term } = req.params;
      const { limit = 10, country } = req.query;

      validate(term, "Missing required parameter: term");
      validate(
        limit > 0 && limit <= 20,
        "The result count limit must be between 1-20"
      );

      const searchResult = await StoreService.searchApps({
        term,
        country,
        limit: parseInt(limit),
      });

      const data = {
        searchTerm: term,
        explicit: true,
        ...searchResult,
      };
      res.json(createResponse(true, data));
    });

    // Add error-handling middleware
    app.use((err, req, res, next) => {
      $.log("API Error:", err);

      res
        .status(err.status || 500)
        .json(createResponse(false, null, err.message || "Unknown error"));
    });

    const response = await app.run();
    $done({ response });
  } catch (error) {
    console.log(error.toString());
    console.log(error.stack);
    $done();
  }
};

main();
