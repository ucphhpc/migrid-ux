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

export class AccountRequestsApp extends AppBase {
  constructor(state, options) {
    super(state, options);
    const namespace = this.state.formState("account_requests");
  }

  tableSettingsToggle(_, namespace) {
    namespace.show_toggles(!namespace.show_toggles());
  }

  summaryRequest() {
    const namespace = this.state.formState("account_requests");
    const requestOptions = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    this.request("/accountreqs/summary", requestOptions, namespace)
      .then(async (resp) => {
        const result = await resp.json();
        if (typeof result.error === "string" && result.error) {
          throw new Error(result.error);
        }

        namespace.summary_total(result.data.total);
        namespace.summary_requested(result.data.requested);
        namespace.summary_pending(result.data.pending);
        namespace.summary_accepted(result.data.accepted);
        namespace.summary_invalid_peer_contact(result.data.invalid_peer_contact);
      })
      .catch(() => {
        // ignore
      });
  }

  searchRequest() {
    const namespace = this.state.formState("account_requests");
    const includeColumns = ["full_name", "email"];

    for (const colName of AccountRequestsApp.CONST_ACCOUNT_REQUESTS_LISTING_COLNAMES) {
      const columnIsShown = namespace[`col_${colName}`];
      if (columnIsShown()) {
        includeColumns.push(colName);
      }
    }

    const requestOptions = {
      query: {
        query: namespace.search_query(),
        state: namespace.search_state(),
        fields: includeColumns,
      },
    };

    namespace.results("");
    namespace.results_placeholder("Fetching account requests...");

    this.request("/accountreqs/", requestOptions, namespace)
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

  getSelectedAccountRequestIDs(namespace) {
    const resultsRows = namespace.results_rows();
    const selected = [];
    for (const entry of resultsRows) {
      if (entry.selected()) {
        selected.push(entry.account_request_id());
      }
    }
    return selected;
  }

  async refreshCsrfTokens({
    requests = AccountRequestsApp.CONST_STATE_CHANGE_REQUESTS,
  } = {}) {
    const namespace = this.state.namespace("__app__");

    const requestOptions = {
      query: {
        requests: requests,
      },
    };

    return this.request("/accountreqs/csrf_tokens", requestOptions, namespace)
      .then(async (res) => {
        const html = await res.text();
        this._csrfTokenUpdateElements(namespace, html);
      })
      .catch((err) => {
        console.error(err);
      });
  }

  _csrfTokenUpdateElements(namespace, html) {
    const elements = namespace.csrf_tokens(html);
    if (elements.length === 0) {
      namespace.csrf_tokens_entries([]);
    } else {
      namespace.csrf_tokens_entries(elements);
    }
  }

  getCsrfToken(method, operation) {
    const namespace = this.state.namespace("__app__");
    const tokens = namespace.csrf_tokens_entries();
    const token = tokens.find(
      (token) => token.method() === method && token.operation() === operation,
    );
    return token;
  }

  forwardRequest() {
    const namespace = this.state.formState("account_requests");
    const account_request_ids_to_forward =
      this.getSelectedAccountRequestIDs(namespace);
    if (account_request_ids_to_forward.length === 0) {
      // no account requests were selected - nothing to do
      return;
    }

    let requestOptions = {
      method: "POST",
      data: { account_request_ids: account_request_ids_to_forward },
    };
    const csrfToken = this.getCsrfToken("POST", "/accountreqs/forward");
    if (csrfToken) {
      requestOptions.data.csrf_token = csrfToken.csrf_token();
    }
    return this.request("/accountreqs/forward", requestOptions)
      .then(async (res) => {
        const result = await res.json();
        if (typeof result.error === "string" && result.error) {
          const error = new Error(result.error);
          error.status = 422;
          throw error;
        }

        // update total
        this.summaryRequest();
        await this.searchRequest();
      })
      .catch((error) => {
        console.error(error)
      });
  }

  createRequest() {

  }

  rejectRequest() {
    const namespace = this.state.formState("account_requests");
    const account_request_ids_to_remove = this.getSelectedAccountRequestIDs(namespace)
    if (account_request_ids_to_remove.length === 0) {
      return;
    }

    let requestOptions = {
      method: "POST",
      data: { account_request_ids: account_request_ids_to_remove },
    };

    const csrfToken = this.getCsrfToken("POST", "/accountreqs/reject");
    if (csrfToken) {
      requestOptions.data.csrf_token = csrfToken.csrf_token();
    }

    return this.request("/accountreqs/reject", requestOptions)
      .then(async (res) => {
        const result = await res.json();
        if (typeof result.error === "string" && result.error) {
          throw new Error(result.error);;
        }

        // update total
        this.summaryRequest();
        await this.searchRequest();
      })
      .catch((error) => {
      });
  }

  onInitialize() {
    this.summaryRequest();
    this.searchRequest("");
    this._initializeAccountRequestsTable();
    this._initializeSearchStateHandling();
    this._initializeSummaryLabels();

    // Get the initial csrf tokens for the available operations
    this.refreshCsrfTokens();
  }

  _initializeSummaryLabel(stateEntry, labelEntry, label) {
    asObservable(stateEntry).addEventListener("change", () => {
      labelEntry(`${label} (${stateEntry()})`)
    })
  }

  _initializeSummaryLabels() {
    const namespace = this.state.formState("account_requests");
    this._initializeSummaryLabel(namespace.summary_total, namespace.summary_all_label, "All")
    this._initializeSummaryLabel(namespace.summary_requested, namespace.summary_requested_label, "Requested")
    this._initializeSummaryLabel(namespace.summary_pending, namespace.summary_pending_label, "Peer Pending")
    this._initializeSummaryLabel(namespace.summary_accepted, namespace.summary_accepted_label, "Peer Accepted")
    this._initializeSummaryLabel(namespace.summary_invalid_peer_contact, namespace.summary_invalid_peer_contact_label, "Invalid Peer Contact")
  }

  _initializeSearchStateHandling() {
    const namespace = this.state.formState("account_requests");
    asObservable(namespace.search_state).addEventListener("change", () => {
      const state = namespace.search_state()
      namespace.account_request_state_selected_any(state == "")
      namespace.account_request_state_selected_requested(state == "requested")
      namespace.account_request_state_selected_pending(state == "pending")
      namespace.account_request_state_selected_accepted(state == "accepted")
    });
  }

  _initializeAccountRequestsTable() {
    const namespace = this.state.formState("account_requests");
    // update table when column selection is changed
    asObservable(namespace.changed_column).addEventListener("change", () => {
      namespace.results("");
      this.searchRequest();
    });
  }
}

AccountRequestsApp.CONST_ACCOUNT_REQUESTS_LISTING_COLNAMES = [
  "organization",
  "country",
  "state",
  "peers_full_name",
  "peers_email",
  "comment",
  "created",
];

AccountRequestsApp.CONST_STATE_CHANGE_REQUESTS = [
  "method=POST&operation=/accountreqs/forward",
  "method=POST&operation=/accountreqs/reject",
];

export const App = AccountRequestsApp;

(function () {
  function makeCsrfTokenState() {
    return {
      csrf_tokens: observedHtml(NO_VALUE, {
        select: "div",
        // This is called when the csrf_tokens is changed
        decodeHtml: (subtreeEl) => {
          const tokenEls = Array.from(
            subtreeEl.querySelectorAll('div[class="csrf-token"]'),
          );

          const csrfElements = tokenEls.map((tokenEl) => {
            return {
              method: tokenEl.querySelector("div[class=csrf-token-method]")
                .textContent,
              operation: tokenEl.querySelector(
                "div[class=csrf-token-operation]",
              ).textContent,
              csrf_token: tokenEl.querySelector("div[class=csrf-token-token]")
                .textContent,
            };
          });
          return csrfElements;
        },
      }),
      csrf_tokens_entries: observedArray(NO_VALUE, {
        definition: {
          method: NO_VALUE,
          operation: NO_VALUE,
          csrf_token: NO_VALUE,
        },
      }),
    };
  }

  AccountRequestsApp[APP_COMPONENTS] = [Tabs];
  AccountRequestsApp[APP_DEFINITION] = {
    __app__: {
      ...makeCsrfTokenState(),
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
      account_requests: {
        all: false,
        // column chooser
        show_toggles: false,
        // columns to show
        col_organization: true,
        col_country: false,
        col_state: false,
        col_peers_full_name: true,
        col_peers_email: true,
        col_comment: false,
        col_auth_access: false,
        col_created: true,
        changed_column: (state, namespace) => {
          return anyChangeValue([
            namespace.col_organization,
            namespace.col_country,
            namespace.col_state,
            namespace.col_peers_full_name,
            namespace.col_peers_email,
            namespace.col_comment,
            namespace.col_auth_access,
            namespace.col_created,
          ]);
        },
        // search
        search_query: "",
        search_state: "requested",
        // current state filtering
        account_request_state_selected_any: false,
        account_request_state_selected_requested: true,
        account_request_state_selected_pending: false,
        account_request_state_selected_accepted: false,
        // results handling
        count: 0,
        summary_total: 0,
        summary_requested: 0,
        summary_pending: 0,
        summary_accepted: 0,
        summary_invalid_peer_contact: 0,
        summary_all_label: "All (?)",
        summary_requested_label: "Requested (?)",
        summary_pending_label: "Pending (?)",
        summary_accepted_label: "Accepted (?)",
        summary_invalid_peer_contact_label: "Invalid Peer Contact (?)",
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
            account_request_id: NO_VALUE,
            selected: false,
          },
        }),
        results_placeholder: observedHtml(NO_VALUE),
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

  return AppBase.bootstrap(AccountRequestsApp, root, {
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
