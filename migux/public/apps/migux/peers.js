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

export class PeersApp extends AppBase {
  constructor(state, options) {
    super(state, options);

    // app specifics
    this._tooltipElementsByParentId = {};

    const _changeTabBound = this._changeTab.bind(this);
    const selectedTabIndexObservable = asObservable(
      this.state.namespace("__app__").selected_tab_index,
    );
    selectedTabIndexObservable._addEventListenerSilent(
      "change",
      _changeTabBound,
    );
  }

  onDestroy() {
    this._options.beforeDestruction(this);
  }

  onInitialize() {
    this.summaryRequest();

    this.searchAcceptedQuery();
    this.searchRequestedQuery();

    this._options.afterInitialization(this);
  }

  /* app wide functions */

  changeTab(nextTabIndex) {
    const appState = this.state.namespace("__app__");
    const previousValue = appState.selected_tab_index();

    appState.selected_tab_index(nextTabIndex);

    this._changeTab({ detail: { value: nextTabIndex, previousValue } });
  }

  _changeTab(ev) {
    const { previousValue: currentTabIndex } = ev.detail;

    if (currentTabIndex === 2) {
      const newPeersNamespace = this.state.formState("peers_new");
      if (newPeersNamespace._is_editing()) {
        this.editPeerCancel();
      }
    }
  }

  summaryRequest() {
    const acceptedState = this.state.formState("peers_accepted");
    const requestedState = this.state.formState("peers_requested");

    this.request("/peers/summary", {
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (res) => {
        const result = await res.json();
        if (typeof result.error === "string" && result.error) {
          const error = new Error(result.error);
          error.status = 422;
          throw error;
        }

        acceptedState.total(result.data.accepted_count);
        requestedState.total(result.data.requested_count);
      })
      .catch(() => {
        // ignore
      });
  }

  _peersListingUpdateResults(namespace, html, { _skipRebind = false } = {}) {
    const { rowCount, resultRows } = namespace.results(html);

    namespace.count(rowCount);
    if (rowCount === 0) {
      namespace.results_rows([]);
      namespace.results_placeholder("No results.");
    } else {
      namespace.results_rows(resultRows);
      namespace.results_placeholder("");
    }

    if (rowCount === 0 || _skipRebind) return;

    this.rebind(namespace, "array", "results_rows");
  }

  peersListing(endpoint, { includeColumns, ...otherParams }, namespace) {
    const queryIsEmpty = !Object.keys(otherParams).some(
      (param) => !!otherParams[param],
    );
    if (queryIsEmpty) {
      this._peersListingUpdateResults(namespace, "");
      return;
    }

    namespace.results("");
    namespace.results_placeholder("Searching...");

    const requestOptions = {
      query: {
        ...otherParams,
        fields: includeColumns,
      },
    };
    return this.request(endpoint, requestOptions, namespace)
      .then(async (res) => {
        const html = await res.text();
        this._peersListingUpdateResults(namespace, html);
      })
      .catch((error) => {
        if (error.status === 404) {
          namespace.results_placeholder("No results.");
        } else {
          namespace.results_placeholder(error.message);
        }
      });
  }

  peersListingColumnChange(_, namespace) {
    namespace.results("");
  }

  peersListingQuery(endpoint, namespace, additionalParams) {
    const includeColumns = ["full_name", "email"];

    for (const colName of PeersApp.CONST_PEERS_LISTING_COLNAMES) {
      const columnIsShown = namespace[`col_${colName}`];
      if (columnIsShown()) {
        includeColumns.push(colName);
      }
    }

    return this.peersListing(
      endpoint,
      { ...additionalParams, includeColumns },
      namespace,
    );
  }

  peersListingSettingsToggle(_, namespace) {
    namespace.show_toggles(!namespace.show_toggles());
  }

  /* accepted import functions */

  async importAction(_, namespace) {
    const fieldNames = Object.keys(PeersApp.CONST_ACCEPTED_IMPORT_FIELDS);

    const payload = {};
    for (const fieldName of fieldNames) {
      const observed = namespace[fieldName];
      payload[fieldName] = observed();
    }

    const absentFields = fieldNames.filter((fieldName) => !payload[fieldName]);

    try {
      if (absentFields.length > 0) {
        const errorsMap = {};
        for (const fieldName of absentFields) {
          errorsMap[fieldName] = `${fieldName} value is required`;
        }
        const error = new Error("The form has failed to validate.");
        error.data = { errors_map: errorsMap };
        throw error;
      }

      const requestOptions = {
        method: "POST",
        data: payload,
      };
      await this.request("/peers/accepted/import", requestOptions, namespace);

      await this.searchAcceptedQuery();
      this.importClear();
      this.changeTab(0);
    } catch (e) {
      const errorsMap = (e.data || {}).errors_map;
      if (errorsMap) {
        this._unpackAndApplyErrorsMap(errorsMap, fieldNames, namespace);
      } else {
        namespace._error_string("unknown error");
      }
    }
  }

  importClear() {
    const importNamespace = this.state.formState("peers_import");
    this.state.resetNamespace(importNamespace);
  }

  /* search accepted functions */

  searchAcceptedQuery() {
    const namespace = this.state.formState("peers_accepted");
    return this.peersListingQuery("/peers/accepted", namespace, {
      query: namespace.query(),
    });
  }

  searchAcceptedSelectAll({ value: selectedValue }, namespace) {
    for (const item of namespace.results_rows()) {
      item.selected(selectedValue);
    }
  }

  searchAcceptedRemove(_, namespace) {
    const resultsRows = namespace.results_rows();

    const distinguished_names_for_removal = [];

    for (const entry of resultsRows) {
      if (entry.selected()) {
        distinguished_names_for_removal.push(entry.peer_dn());
      }
    }

    if (distinguished_names_for_removal.length === 0) {
      // no peers were selected - nothing to do
      return;
    }

    const requestOptions = {
      method: "POST",
      data: { peers: distinguished_names_for_removal },
    };
    return this.request("/peers/accepted/delete", requestOptions)
      .then(async (res) => {
        const result = await res.json();
        if (typeof result.error === "string" && result.error) {
          const error = new Error(result.error);
          error.status = 422;
          throw error;
        }

        // update total
        const currentTotal = namespace.total();
        namespace.total(currentTotal - distinguished_names_for_removal.length);

        this.searchAcceptedQuery();
      })
      .catch((error) => {
        namespace._error_string(error.message);
      });
  }

  searchAcceptedSettingsHide(_, namespace) {
    const wereResultsCleared = namespace.results() === "";
    if (wereResultsCleared) {
      // results are cleared when the column seleciton changes, so we infer
      // infer such a change occurred and thus must be refresh the results
      this.searchAcceptedQuery();
    }
  }

  /* search requested functions */

  searchRequestedAccept(_, namespace) {
    const acceptedNamespace = this.state.formState("peers_accepted");

    const resultsRows = namespace.results_rows();

    const distinguished_names_for_accept = [];

    for (const entry of resultsRows) {
      if (entry.selected()) {
        distinguished_names_for_accept.push(entry.peer_dn());
      }
    }

    if (distinguished_names_for_accept.length === 0) {
      // no peers were selected - nothing to do
      return;
    }

    const requestOptions = {
      method: "POST",
      data: { peers: distinguished_names_for_accept },
    };
    return this.request("/peers/requested/accept", requestOptions)
      .then(async (res) => {
        const result = await res.json();
        if (typeof result.error === "string" && result.error) {
          const error = new Error(result.error);
          error.status = 422;
          throw error;
        }

        // update requsted total
        const requestedCount =
          namespace.total() - distinguished_names_for_accept.length;
        namespace.total(requestedCount);

        const acceptedCount =
          acceptedNamespace.total() + distinguished_names_for_accept.length;
        acceptedNamespace.total(acceptedCount);

        this.changeTab(0);

        // ensure the newly added peer wll be loaded
        acceptedNamespace.query("*");
        // refresh the accepted peers listing
        this.searchAcceptedQuery();
        // refresh the requested peers so the peer
        // being accepted will disappear if shown
        this.searchRequestedQuery();
      })
      .catch((error) => {
        namespace._error_string(error.message);
      });
  }

  searchRequestedRemove(_, namespace) {
    const resultsRows = namespace.results_rows();

    const distinguished_names_for_removal = [];

    for (const entry of resultsRows) {
      if (entry.selected()) {
        distinguished_names_for_removal.push(entry.peer_dn());
      }
    }

    if (distinguished_names_for_removal.length === 0) {
      // no peers were selected - nothing to do
      return;
    }

    const requestOptions = {
      method: "POST",
      data: { peers: distinguished_names_for_removal },
    };
    return this.request("/peers/requested/delete", requestOptions)
      .then(async (res) => {
        const result = await res.json();
        if (typeof result.error === "string" && result.error) {
          const error = new Error(result.error);
          error.status = 422;
          throw error;
        }

        // update total
        const currentTotal = namespace.total();
        namespace.total(currentTotal - distinguished_names_for_removal.length);

        this.searchRequestedQuery();
      })
      .catch((error) => {
        namespace._error_string(error.message);
      });
  }

  searchRequestedQuery() {
    const namespace = this.state.formState("peers_requested");

    const additionalParams = {};
    for (const observableName of ["query", "kind", "expire"]) {
      const observed = namespace[observableName];
      let value;
      if ((value = observed())) {
        additionalParams[observableName] = value;
      }
    }

    return this.peersListingQuery(
      "/peers/requested",
      namespace,
      additionalParams,
    );
  }

  searchRequestedSelectAll({ value: selectedValue }, namespace) {
    for (const item of namespace.results_rows()) {
      item.selected(selectedValue);
    }
  }

  searchRequestedSettingsHide(_, namespace) {
    const wereResultsCleared = namespace.results() === "";
    if (wereResultsCleared) {
      // results are cleared when the column seleciton changes, so we infer
      // infer such a change occurred and thus must be refresh the results
      this.searchRequestedQuery();
    }
  }

  /* new peer functions */

  newPeerCreate(ev, namespace) {
    const values = this.state.serializeNamespace(namespace);

    if (!values.state) {
      values.state = "NA";
    }

    const requestOptions = {
      method: "POST",
      data: values,
    };
    return this.request("/peers/new", requestOptions, namespace)
      .then(async () => {
        await this.searchRequestedQuery();
        this.newPeerClear();
        this.changeTab(1);
      })
      .catch((error) => {
        namespace._error_string(error.message);

        const errorData = error.data || {};
        const errorsMap = errorData["errors_map"] || {};
        const payloadErrors = errorsMap["0"];
        if (!payloadErrors || Object.keys(payloadErrors).length === 0) {
          return;
        }

        this._unpackAndApplyErrorsMap(
          payloadErrors,
          Object.keys(PeersApp.CONST_NEW_PEERS_FIELDS),
          namespace,
        );
      });
  }

  newPeerClear() {
    const newPeerNamespace = this.state.formState("peers_new");
    this.state.resetNamespace(newPeerNamespace);
  }

  newPeerFieldChange(_, namespace, __, observed) {
    const fieldName = this.state.namespaceObservedToName(observed, namespace);
    // find the corresponding field error observable
    const errObserved = namespace[this._fieldNameToFieldError(fieldName)];
    // clear it
    errObserved("");
  }

  // edit peer functions

  editPeerOpen(_, entry) {
    const newPeerNamespace = this.state.formState("peers_new");
    const peer_dn = entry.peer_dn();

    return this.request("/accepted/fetch", {
      method: "POST",
      data: {
        peer_dn,
      },
    }).then(async (res) => {
      const result = await res.json();
      const peer = result.data;

      // Set edit mode (i.e. disable any fields we do not allow editing)
      newPeerNamespace._is_editing(true);
      newPeerNamespace._editing_dn(peer_dn);

      // Atempt to fill in the peers fields
      for (const fieldName of Object.keys(PeersApp.CONST_NEW_PEERS_FIELDS)) {
        if (Object.prototype.hasOwnProperty.call(peer, fieldName)) {
          const observed = newPeerNamespace[fieldName];
          observed(peer[fieldName]);
        }
      }

      // Switch to the peer fields tab
      this.changeTab(2);
    });
  }

  editPeerCancel() {
    const newPeerNamespace = this.state.formState("peers_new");
    this.newPeerClear();
    newPeerNamespace._is_editing(false);
    newPeerNamespace._editing_dn(NO_VALUE);
  }

  editPeerSave() {
    const newPeerNamespace = this.state.formState("peers_new");
    const peerDnBeingEdited = newPeerNamespace._editing_dn();

    if (peerDnBeingEdited === NO_VALUE) {
      return;
    }

    const values = {};
    for (const fieldName of PeersApp.CONST_EDIT_PEER_FIELD_NAMES) {
      values[fieldName] = newPeerNamespace[fieldName]();
    }
    values["peer_dn"] = peerDnBeingEdited;

    return this.request(
      "/accepted/update",
      {
        method: "POST",
        data: values,
      },
      newPeerNamespace,
    ).then(async () => {
      this.editPeerCancel();
      this.changeTab(0);
      await this.searchAcceptedQuery();
    });
  }

  /* other */

  _fieldNameToFieldError(fieldName) {
    return `_${fieldName}_err`;
  }

  _unpackAndApplyErrorsMap(errorsMap, fieldNames, namespace) {
    for (const fieldName of fieldNames) {
      const errValue = errorsMap[fieldName];
      if (!(typeof errValue === "string" && errValue)) continue;
      const errFieldName = this._fieldNameToFieldError(fieldName);
      const errObservable = namespace[errFieldName];
      errObservable(`<p>${errValue}</p>`);
    }
  }

  /**
   *
   * @param {*} _
   * @param {*} __
   * @param {HTMLElement} element
   * @returns
   */
  show_info_modal(_, __, element, tooltipText) {
    const associatedElId = element.id;

    if (!tooltipText) {
      return;
    }

    let tooltipEl = this._tooltipElementsByParentId[associatedElId];
    if (tooltipEl) {
      // tooltip is visible, destroy it
      element.removeChild(tooltipEl);
      this._tooltipElementsByParentId[associatedElId] = null;
    } else {
      const tooltipEl = document.createElement("SPAN");
      tooltipEl.className = "tooltip";
      tooltipEl.textContent = tooltipText;

      this._tooltipElementsByParentId[associatedElId] = tooltipEl;

      element.appendChild(tooltipEl);
    }
  }

  /* common functions */

  static _makeErrorFieldDefinitionsForFields(fieldDefinitions) {
    const definition = {};
    for (const fieldName of Object.keys(fieldDefinitions)) {
      definition[`_${fieldName}_err`] = NO_VALUE;
    }
    return definition;
  }
}

PeersApp.CONST_ACCEPTED_IMPORT_FIELDS = {
  csvtext: "",
  expire: "",
  kind: "",
  label: "",
};

PeersApp.CONST_EDIT_PEER_FIELD_NAMES = ["expire"];

PeersApp.CONST_NEW_PEERS_FIELDS = {
  full_name: "",
  email: "",
  label: "",
  expire: "",
  organization: "",
  kind: NO_VALUE,
  country: NO_VALUE,
  state: NO_VALUE,
};

PeersApp.CONST_PEERS_LISTING_COLNAMES = [
  "organization",
  "country",
  "state",
  "kind",
  "label",
  "expire",
];

export const App = PeersApp;

(function () {
  function makePeersListingState({ showColLabel = true } = {}) {
    return {
      query: "",
      // column chooser
      show_toggles: false,
      // columns to show
      col_organization: true,
      col_country: false,
      col_state: false,
      col_kind: true,
      col_label: showColLabel,
      col_expire: true,
      changed_column: (state, namespace) => {
        return anyChangeValue([
          namespace.col_organization,
          namespace.col_country,
          namespace.col_state,
          namespace.col_kind,
          namespace.col_label,
          namespace.col_expire,
        ]);
      },
      // results handling
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
    };
  }

  PeersApp[APP_COMPONENTS] = [Tabs];

  PeersApp[APP_DEFINITION] = {
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
      peers_accepted: {
        ...makePeersListingState(),
        all: false,
        count: 0,
        total: 0,
        _error_string: "",
      },
      peers_requested: {
        ...makePeersListingState({ showColLabel: false }),
        all: false,
        count: 0,
        total: 0,
        _error_string: "",
        // additional filter criteria
        kind: "",
        expire: "",
      },
      peers_new: {
        ...PeersApp.CONST_NEW_PEERS_FIELDS,
        ...PeersApp._makeErrorFieldDefinitionsForFields(
          PeersApp.CONST_NEW_PEERS_FIELDS,
        ),
        invite_on_email: true,
        _is_editing: false,
        _editing_dn: NO_VALUE,
        _error_string: "",
      },
      peers_import: {
        ...PeersApp.CONST_ACCEPTED_IMPORT_FIELDS,
        ...PeersApp._makeErrorFieldDefinitionsForFields(
          PeersApp.CONST_ACCEPTED_IMPORT_FIELDS,
        ),
        csvtext: "",
        expire: "",
        kind: "",
        label: "",
        _error_string: "",
      },
    },
  };
})();

const MIGAPP_NAME = "peers";

export function bootstrap(root, options = {}) {
  let beforeunloadListener = null;

  return AppBase.bootstrap(PeersApp, root, {
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
