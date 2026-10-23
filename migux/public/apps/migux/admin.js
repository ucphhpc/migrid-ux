import { AppBase, APP_COMPONENTS, APP_DEFINITION } from "../../lib/app.js";
import { Tabs } from "../../components/Tabs.js";
import {
  NO_VALUE,
  computedValue,
  observedHtml,
} from "../../lib/observable.js";

function _someTruthyValue(arrayOfValues) {
  return arrayOfValues.some((value) => !!value);
}

export class AdminApp extends AppBase {
  constructor(state, options) {
    super(state, options);
  }

  serverDaemonsRequest() {
    const namespace = this.state.formState("server_status");
    const requestOptions = { query: {} };

    namespace.server_daemons("");
    namespace.server_daemons_placeholder("Fetching server daemon status");

    this.request("/admin/daemons", requestOptions, namespace)
      .then(async (resp) => {
        const html = await resp.text();
        const { daemonCount } = namespace.server_daemons(html);
        namespace.server_daemons_placeholder(
          daemonCount === 0 ? "Found no Server Daemons." : "",
        );
        namespace.server_daemons_last_updated(new Date().toLocaleTimeString());
      })
      .catch((error) => {
        namespace.server_daemons_placeholder(error.message);
      });
  }

  serverLogsRequest() {
    const namespace = this.state.formState("server_status");
    const requestOptions = {
      query: {
        last_lines: namespace.server_logs_last_lines(),
      },
    };

    namespace.server_logs("");
    namespace.server_logs_placeholder("Fetching server logs...");

    this.request("/admin/logs", requestOptions, namespace)
      .then(async (resp) => {
        const html = await resp.text();
        const { entryCount } = namespace.server_logs(html);
        namespace.server_logs_placeholder(
          entryCount === 0 ? "Found no Server Logs." : "",
        );
      })
      .catch((error) => {
        namespace.server_logs_placeholder(error.message);
      });
  }

  siteStatsRequest() {
    const namespace = this.state.formState("site_stats");
    const requestOptions = { query: {} };

    namespace.stats("");
    namespace.stats_placeholder("Fetching site statistics...");

    this.request("/admin/stats", requestOptions, namespace)
      .then(async (resp) => {
        const html = await resp.text();
        const { statCount } = namespace.stats(html);
        namespace.stats_placeholder(
          statCount === 0 ? "Found no Site Stats." : "",
        );
      })
      .catch((error) => {
        namespace.stats_placeholder(error.message);
      });
  }

  onInitialize() {
    this.serverDaemonsRequest();
    this.serverLogsRequest();
    this.siteStatsRequest();
  }
}

AdminApp.CONST_ACCOUNT_REQUESTS_LISTING_COLNAMES = [
  "organization",
  "country",
  "state",
  "peers_full_name",
  "peers_email",
  "comment",
  "created",
];

export const App = AdminApp;

(function () {
  AdminApp[APP_COMPONENTS] = [Tabs];
  AdminApp[APP_DEFINITION] = {
    __app__: {
      disable_close: (state) => {
        const observing = new Set();
        for (const [, formNamespace] of Object.entries(state.forms)) {
          observing.add(formNamespace.submitted);
        }
        return computedValue(_someTruthyValue, observing);
      },
      selected_tab_index: 0,
    },
    forms: {
      server_status: {
        // server logs requests
        server_logs_last_lines: 20,
        // server logs results handling
        server_logs: observedHtml(NO_VALUE, {
          select: "tbody",
          decodeHtml: (subtreeEl) => {
            const entryEls = Array.from(subtreeEl.querySelectorAll("tr"));
            return { entryCount: entryEls.length };
          },
        }),
        server_logs_placeholder: observedHtml(NO_VALUE),

        // server daemons results handling
        server_daemons: observedHtml(NO_VALUE, {
          select: "tbody",
          decodeHtml: (subtreeEl) => {
            const daemonEls = Array.from(subtreeEl.querySelectorAll("tr"));
            return { daemonCount: daemonEls.length };
          },
        }),
        server_daemons_last_updated: "never",
        server_daemons_placeholder: observedHtml(NO_VALUE),
      },
      site_stats: {
        stats: observedHtml(NO_VALUE, {
          select: "tbody",
          decodeHtml: (subtreeEl) => {
            const statEls = Array.from(
              subtreeEl.querySelectorAll("details.site-stat"),
            );
            const statCount = statEls.length;
            return { statCount };
          },
        }),
        stats_placeholder: observedHtml(NO_VALUE),
      },
    },
  };
})();

const MIGAPP_NAME = "admin";

function _decodeStorage(namespace) {
  try {
    let defaults = JSON.parse(localStorage.getItem(namespace));
    if (defaults["__app__"] === undefined) {
      defaults = { __app__: defaults };
    }
    return defaults;
  } catch {
    return null;
  }
}

export function bootstrap(root, options = {}) {
  let beforeunloadListener = null;

  return AppBase.bootstrap(AdminApp, root, {
    ...options,
    defaultState:
      options._overrideDefaults || _decodeStorage(`migapp-${MIGAPP_NAME}`),
    afterInitialization: (app) => {
      beforeunloadListener = () => app.onDestroy();
      window.addEventListener("beforeunload", beforeunloadListener);
    },
    beforeDestruction: (app) => {
      window.removeEventListener("beforeunload", beforeunloadListener);

      const item = JSON.stringify(app.state.serialize());
      try {
        localStorage.setItem(`migapp-${MIGAPP_NAME}`, item);
      } catch {
        // localStorage is not available
      }
    },
  });
}
