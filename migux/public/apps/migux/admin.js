import { AppBase, APP_COMPONENTS, APP_DEFINITION } from "../../lib/app.js";
import { Tabs } from "../../components/Tabs.js";
import {
  NO_VALUE,
  anyChangeValue,
  asObservable,
  computedValue,
  observedArray,
  observedHtml,
} from "../../lib/observable.js";

function _someTruthyValue(arrayOfValues) {
  return arrayOfValues.some((value) => !!value);
}

export class AdminApp extends AppBase {
  constructor(state, options) {
    super(state, options);
  }

  tableSettingsToggle(_, namespace) {
    namespace.show_toggles(!namespace.show_toggles());
  }

  accountRequestsSummary() {
    const namespace = this.state.formState("account_requests");
    const requestOptions = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    this.request("/admin/account_requests/summary", requestOptions, namespace)
      .then(async (resp) => {
        const result = await resp.json();
        if (typeof result.error === "string" && result.error) {
          const error = new Error(result.error);
          error.status = 422;
          throw error;
        }

        namespace.total(result.data.account_requests_count);
      })
      .catch((error) => {
        namespace.results_placeholder(error.message);
      });
  }

  accountRequestsSearch() {
    const namespace = this.state.formState("account_requests");

    const includeColumns = ["full_name", "email"];

    for (const colName of AdminApp.CONST_ACCOUNT_REQUESTS_LISTING_COLNAMES) {
      const columnIsShown = namespace[`col_${colName}`];
      if (columnIsShown()) {
        includeColumns.push(colName);
      }
    }

    const requestOptions = {
      query: {
        query: namespace.query(),
        fields: includeColumns,
      },
    };

    this.request("/admin/account_requests", requestOptions, namespace)
      .then(async (resp) => {
        const html = await resp.text();
        const { rowCount, resultRows } = namespace.results(html);
        namespace.count(rowCount);
        if (rowCount === 0) {
          namespace.results_rows([]);
          namespace.results_placeholder("Found no Account Requests.");
        } else {
          namespace.results_rows(resultRows);
          namespace.results_placeholder("");
        }

        if (rowCount !== 0) {
          this.rebind(namespace, "array", "results_rows");
        }
      })
      .catch((error) => {
        namespace.results_placeholder(error.message);
      });
  }

  accountRequestsSelectAll({ value: selectedValue }, namespace) {
    for (const item of namespace.results_rows()) {
      item.selected(selectedValue);
    }
  }

  serverDaemonsRequest() {
    const namespace = this.state.formState("server_status");
    const requestOptions = { query: {} };
    this.request("/admin/server/daemons", requestOptions, namespace)
      .then(async (resp) => {
        const html = await resp.text();
        const { daemonCount } = namespace.server_daemons(html);
        namespace.server_daemons_placeholder(
          daemonCount === 0 ? "Found no Server Logs." : "",
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
        count: namespace.server_logs_request_count(),
      },
    };
    this.request("/admin/server/logs", requestOptions, namespace)
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
    this.request("/admin/site/stats", requestOptions, namespace)
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
    this.accountRequestsSummary();
    this.accountRequestsSearch("");
    this.siteStatsRequest();
    this._initializeAccountRequestsTable();
  }

  _initializeAccountRequestsTable() {
    const namespace = this.state.formState("account_requests");
    // update table when column selection is changed
    asObservable(namespace.changed_column).addEventListener("change", () => {
      namespace.results("");
      this.accountRequestsSearch();
    });
  }
}

AdminApp.CONST_ACCOUNT_REQUESTS_LISTING_COLNAMES = [
  "organization",
  "country",
  "state",
  "peer_contact_full_name",
  "peer_contact_email",
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
        server_logs_request_count: 20,
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
      account_requests: {
        all: false,
        // column chooser
        show_toggles: false,
        // columns to show
        col_organization: true,
        col_country: false,
        col_state: false,
        col_peer_contact_full_name: true,
        col_peer_contact_email: true,
        col_comment: false,
        col_auth_access: false,
        col_created: true,
        changed_column: (state, namespace) => {
          return anyChangeValue([
            namespace.col_organization,
            namespace.col_country,
            namespace.col_state,
            namespace.col_peer_contact_full_name,
            namespace.col_peer_contact_email,
            namespace.col_comment,
            namespace.col_auth_access,
            namespace.col_created,
          ]);
        },
        // search
        query: "",
        // results handling
        count: 0,
        total: 0,
        results: observedHtml(NO_VALUE, {
          select: "tbody",
          decodeHtml: (subtreeEl) => {
            const rowEls = Array.from(subtreeEl.querySelectorAll("tr"));

            const rowCount = rowEls.length;
            const resultRows = rowEls.map((rowEl) => {
              return {
                peer_dn: rowEl.querySelector('input[type="hidden"]').value,
                selected: rowEl.querySelector('input[type="checkbox"]').checked,
              };
            });
            return { rowCount, resultRows };
          },
        }),
        results_rows: observedArray(NO_VALUE, {
          definition: {
            peer_dn: NO_VALUE,
            selected: false,
          },
        }),
        results_placeholder: observedHtml(NO_VALUE),
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
