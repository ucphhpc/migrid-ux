import { binder } from "./binding.js";
import { createNamespacedState } from "./state.js";

export const APP_COMPONENTS = Symbol("AppBase::COMPONENTS");

export const APP_DEFINITION = Symbol("AppBase::DEFINITION");

function _removeAllChildren(fromElement) {
  for (const element of fromElement.children) {
    fromElement.removeChild(element);
  }
}

async function _resOkOrThrow(res, deferError = false) {
  let error;

  const responseIsJson =
    res.headers && res.headers.get("content-type") === "application/json";

  if (responseIsJson) {
    if (deferError) return res;

    const result = await res.json();

    const hasDataKey = Object.prototype.hasOwnProperty.call(result, "data");
    const hasErrorString = typeof result.error === "string";

    if (res.ok) {
      const jsonResult = hasDataKey ? result : { data: result };
      res.json = () => {
        return Promise.resolve(jsonResult);
      };
      return res;
    } else if (hasErrorString && result.error) {
      error = new Error(result.error);
    } else {
      error = new Error(`HTTP ${res.status} Error`);
    }
    error.status = res.status;
    error.data = hasDataKey ? result.data : result;
  } else if (res.ok) {
    return res;
  } else {
    error = new Error(`HTTP ${res.status} Error`);
    error.status = res.status;
    error.data = null;
  }

  throw error;
}

function _resOkOrThrowDeferError(res) {
  return _resOkOrThrow(res, true);
}

export class AppBase {
  constructor(state, { urlOptions, _fetch = fetch, ...options } = {}) {
    this.state = state;
    this._baseUrl = null;
    this._buildUrl = null;
    this._binder = null;
    this._fetch = null;
    this._options = options;
    this._urlOptions = null;

    if (!urlOptions) {
      urlOptions = {
        apiUrl: null,
        baseUrl: null,
        buildUrl: null,
      };
    } else {
      urlOptions = Object.assign({}, urlOptions);
    }

    if (!urlOptions.apiUrl) {
      urlOptions.apiUrl = "";
    } else if (urlOptions.apiUrl.endsWith("/")) {
      urlOptions.apiUrl = urlOptions.apiUrl.slice(0, -1);
    }

    if (!urlOptions.baseUrl) {
      urlOptions.baseUrl = "";
    } else if (urlOptions.baseUrl.endsWith("/")) {
      urlOptions.baseUrl = urlOptions.baseUrl.slice(0, -1);
    }

    if (!urlOptions.buildUrl) {
      urlOptions.buildUrl = AppBase.restUrl;
    }

    const { buildUrl, _urlOptions } = urlOptions;
    this._urlOptions = _urlOptions;
    this._buildUrl = (...args) => buildUrl(urlOptions, ...args);

    const processResponse = urlOptions.processResponse;
    const hasProcessResponse = typeof processResponse === "function";

    // now add a bound fetch for use by the application
    if (hasProcessResponse) {
      this._fetch = (...args) =>
        _fetch(...args)
          .then(_resOkOrThrowDeferError)
          .then(processResponse);
    } else {
      this._fetch = (...args) => _fetch(...args).then(_resOkOrThrow);
    }
  }

  get rootElement() {
    if (!this._binder) {
      throw new Error("application not bound - root element unavailable");
    } else {
      return this._binder.rootElement;
    }
  }

  bind(root) {
    this._binder = binder(root, this, {
      components: AppBase.components(this.constructor),
    });
    this.onInitialize();
  }

  rebind(namespace, binding, observableName) {
    if (this._binder === null) return;
    this._binder.rebind(namespace, binding, observableName);
  }

  onClose() {
    _removeAllChildren(this.rootElement);
    this._binder.destroy();
    this._binder = null;
    this.onDestroy();
  }

  onDestroy() {}

  onInitialize() {}

  request(requestPath, requestOptions, namespace) {
    const { url, ...fetchOptions } = this._buildUrl(
      requestPath,
      requestOptions,
    );

    if (this.state.isFormState(namespace)) {
      return this._fetchAndUpdateFormState(url, fetchOptions, namespace);
    } else {
      return this._fetch(url, fetchOptions);
    }
  }

  _fetchAndUpdateFormState(url, fetchOptions, formState) {
    formState.submitted(true);

    return this._fetch(url, fetchOptions)
      .then((result) => {
        formState.submitted(false);
        return result;
      })
      .catch((error) => {
        formState.submitted(false);
        throw error;
      });
  }

  /* common functions */

  static bootstrap(App, root, options) {
    options = options || {};
    const definition = AppBase.definition(App);
    const state = createNamespacedState(definition, options.defaultState);

    const app = new App(state, options);

    app.bind(root);

    return app;
  }

  static components(App) {
    if (!(Object.getPrototypeOf(App) === AppBase)) {
      throw new Error("BaseApp: not an app");
    }
    return Array.isArray(App[APP_COMPONENTS]) ? App[APP_COMPONENTS] : [];
  }

  static definition(App) {
    if (!(Object.getPrototypeOf(App) === AppBase)) {
      throw new Error("BaseApp: not an app");
    }
    if (!App[APP_DEFINITION]) {
      throw new Error("BaseApp: no definition");
    }
    return App[APP_DEFINITION];
  }

  static restUrl(baseOptions, reqPath, reqOptions) {
    if (typeof baseOptions === "string") {
      baseOptions = {
        apiUrl: baseOptions,
        baseUrl: baseOptions,
      };
    }
    if (!reqOptions) reqOptions = {};
    if (!reqOptions.method) reqOptions.method = "GET";

    let extraOptions;
    if (
      (reqOptions.method === "POST" && reqOptions.data !== undefined) ||
      (reqOptions.headers || {})["Content-Type"] === "application/json"
    ) {
      extraOptions = {
        headers: {
          "Content-Type": "application/json",
        },
        body: reqOptions.data ? JSON.stringify(reqOptions.data) : undefined,
      };
    } else {
      extraOptions = undefined;
    }

    const apiUrl = baseOptions.apiUrl;
    const queryString = new URLSearchParams(reqOptions.query || {}).toString();
    const url = `${apiUrl}${reqPath}${queryString ? "?" : ""}${queryString}`;

    return { url, method: reqOptions.method, ...extraOptions };
  }
}
