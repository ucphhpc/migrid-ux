((GLOBAL) => {
  /**
   * MiG specific url creation function.
   *
   * The primary responsibility of this functoi is to shape any requests issued
   * by the application such that they can operate against a MiG backend.
   */
  function migBuildUrl(baseOptions, reqPath, reqOptions) {
    if (!reqOptions) reqOptions = {};

    const pathParts = reqPath.split("/");
    if (pathParts[0] !== "") throw new Error("urlPath must be absolute");
    if (pathParts.length < 3) throw new Error("urlPath must lead with api");

    const apiName = pathParts.splice(1, 1)[0];

    let body;
    let endpoint;
    let headers;
    if (
      (reqOptions.method === "POST" && reqOptions.data !== undefined) ||
      (reqOptions.headers || {})["Content-Type"] === "application/json"
    ) {
      const hasPayload = reqOptions.method === "POST";

      endpoint = "/datainterface.py";
      headers = {
        "Content-Type": "application/json",
      };
      body = JSON.stringify({
        ...reqOptions.data,
        type: `${apiName}${pathParts.join("__")}`,
        operation: hasPayload ? "create" : "read",
      });
    } else {
      const migType = baseOptions.migType;
      if (!migType) throw new Error("urlOptions.migType missing");

      endpoint = "/tmplinterface.py";
      headers = undefined;
      const bodyObj = {
        ...reqOptions.query,
        type: `${baseOptions.migType}${pathParts.join("__")}`,
        operation: "read",
      };
      body = new FormData();
      for (const [k, v] of Object.entries(bodyObj)) {
        body.set(k, v);
      }
    }

    return {
      url: `${baseOptions.apiUrl || ""}${endpoint}`,
      method: "POST",
      headers,
      body,
    };
  }

  /**
   * MiG specific response processing function - given a response, handle the
   * wrapping done by the MiG backend and hand back a response to the caller
   * that looks much closer to standard JSON endpoint.
   *
   * This function is intended to be passed as `processResponse` within the
   * urlOptions when bootstrapping an applicatin running against a MiG backend.
   */
  async function migResponse(res) {
    if (res.headers.get("content-type") !== "application/json") {
      return res;
    }

    const json = await res.json();

    let found = null;
    if (Array.isArray(json)) {
      for (const entry of json) {
        if (entry.object_type === "objects") {
          found = entry;
          break;
        }
      }
    }
    if (found === null) {
      throw Error("NOT_IMPLEMENTED");
    }

    const result = found.objects;
    const migRes = new Response("", { status: result.status });

    const hasDataKey = Object.prototype.hasOwnProperty.call(result, "data");
    const hasErrorString = typeof result.error === "string";
    if (!migRes.ok) {
      // common error path: specific status was set
      const migStatus = migRes.status;
      const error = new Error(
        hasErrorString ? result.error : `HTTP ${migRes.status} Error`,
      );
      error.status = migStatus;
      error.data = hasDataKey ? result.data : null;
      throw error;
    } else if (hasErrorString && result.error) {
      // uncommon error path: attempt to interpret any returned error text
      const error = new Error(result.error);
      error.status = 422;
      error.data = hasDataKey ? result.data : null;
      throw error;
    } else {
      const resultWithoutStatus = result;
      delete resultWithoutStatus.status;
      migRes.json = () => {
        return Promise.resolve(resultWithoutStatus);
      };
    }
    return migRes;
  }

  const _TAG_BODY_OPEN_START = "<body";
  const _TAG_BODY_CLOSE = "</body>";
  const _TAG_MIGAPPSCRPT_START = "<script>";

  /**
   * Dynamically load the HTML markup of an example application.
   *
   * @param {string} appname The relative name of the app to load.
   * @returns {HTMLElement}
   */
  async function loadAppMarkup(appname, baseUrl) {
    const res = await fetch(`${baseUrl}/apps/${appname}.html`);
    const text = await res.text();
    let templateHtml;

    let startIndex = text.indexOf(_TAG_BODY_OPEN_START);
    if (startIndex > -1) {
      startIndex = text.indexOf(">", startIndex) + 1;
      const endIndex = text.indexOf(_TAG_BODY_CLOSE);

      const maybeEndIndexWithScript = text.lastIndexOf(
        _TAG_MIGAPPSCRPT_START,
        endIndex,
      );
      if (maybeEndIndexWithScript > -1) {
        templateHtml = text.slice(startIndex, maybeEndIndexWithScript);
      } else {
        templateHtml = text.slice(startIndex, endIndex);
      }

      templateHtml = templateHtml.trim();
    } else {
      throw new Error("failure loading markup");
    }

    console.log(`loaded markup: ${appname}`);

    return templateHtml;
  }

  /**
   * Dynamically load the script file of an example application.
   *
   * @param {string} appname The relative name of the app to load.
   * @returns {() => None}
   */
  function loadAppScript(appname, baseUrl) {
    return import(`${baseUrl}/apps/${appname}.js`).then((module) => {
      console.log(`loaded script: ${appname}`);

      return module;
    });
  }

  /**
   * Dynamically load the styles for an application.
   *
   * @param {string} appname The relative name of the app to load.
   * @returns {() => None}
   */
  function loadAppStyles(appname, baseUrl) {
    loadStylesheet(`${baseUrl}/build/main.css`);
    loadStylesheet(`${baseUrl}/apps/${appname}.css`);

    console.log(`loaded stylesheet: ${appname}`);
  }

  function loadStylesheet(stylesheetUrl) {
    const styleEl = document.createElement("LINK");
    styleEl.rel = "stylesheet";
    styleEl.href = stylesheetUrl;
    document.head.appendChild(styleEl);
  }

  /**
   *
   * @param {string} appname The relative name of the app to load.
   * @param {HTMLElement} rootEl The root element into which to inject markup.
   * @returns {None}
   */
  function performAppLoad(appname, rootEl, appOptions) {
    const urlOptions = appOptions.urlOptions || {};
    const baseUrl = urlOptions.baseUrl;
    const miguxAppname = `migux/${appname}`;

    return Promise.all([
      loadAppMarkup(miguxAppname, baseUrl),
      loadAppScript(miguxAppname, baseUrl),
      loadAppStyles(miguxAppname, baseUrl),
    ])
      .then(([htmlString, module]) => {
        const { App } = module;

        rootEl.dataset.migrole = "app";
        rootEl.className = App.name;
        rootEl.innerHTML = htmlString;

        const instance = module.bootstrap(rootEl, appOptions);
        const appRecord = window.MiG.applications[appname] || {};
        window.MiG.applications[appname] = appRecord;
        appRecord.instance = instance;
      })
      .catch((error) => {
        console.error(error);
      });
  }

  GLOBAL.MiG = GLOBAL.MiG || {};
  GLOBAL.MiG.applications = GLOBAL.MiG.applications || {};
  GLOBAL.MiG.loadAppMarkup = loadAppMarkup;
  GLOBAL.MiG.loadAppScript = loadAppScript;
  GLOBAL.MiG.loadAppStyles = loadAppStyles;
  GLOBAL.MiG.migBuildUrl = migBuildUrl;
  GLOBAL.MiG.migResponse = migResponse;

  const MIG_URL_OPTIONS_PARTIAL = {
    apiUrl: "/cgi-bin",
    baseUrl: "/assets/migux",
    buildUrl: migBuildUrl,
    migType: null,
    processResponse: migResponse,
  };

  /**
   *
   * @param {string} appname The relative name of the app to load.
   * @returns {None}
   */
  function migappBootstrap(appname, parentNode) {
    parentNode = parentNode || document.body;

    const rootEl = document.createElement("DIV");

    const firstChild = parentNode.children[0];
    if (firstChild) {
      parentNode.insertBefore(rootEl, firstChild);
    } else {
      parentNode.appendChild(rootEl);
    }

    const urlOptions = Object.assign({}, MIG_URL_OPTIONS_PARTIAL);
    urlOptions.migType = `migux_apps_${appname}`;
    return performAppLoad(appname, rootEl, { urlOptions });
  }

  GLOBAL.migappBootstrap = migappBootstrap;
})(typeof window !== "undefined" ? window : {});
