/*
# --- BEGIN_HEADER ---
#
# peers.js - dual licensed source code file
# Copyright (C) 2025 - 2026  SCIENCE HPC Center at UCPH
#
# This file is part of MiGrid-UX.
#
# MiGrid-UX is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License version 2 (LICENSES/LICENSE.GPLv2 or
# https://opensource.org/license/gpl-2.0) or any later version
# at your option. The MiGrid-UX files may NOT be copied, modified, or
# distributed except according to those terms.
#
# --- END_HEADER ---
*/
import { AppBase, APP_COMPONENTS, APP_DEFINITION } from "../../lib/app.js";
import { Tabs } from "../../components/Tabs.js";
import {
  NO_VALUE,
  anyChangeValue,
  asObservable,
  computedValue,
  observedArray,
  observedHtml,
  observedValue,
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
    // Ensure that the default NO_VALUE toString entry is removed
    this.state.namespace("__app__")._active_tooltips({});
  }

  onDestroy() {
    this._options.beforeDestruction(this);
  }

  onInitialize() {
    this.summaryRequest();

    // default to search for everything
    this.searchAcceptedQuery({ defaultEmptyQuery: "*" });
    this.searchRequestedQuery({ defaultEmptyQuery: "*" });

    this._options.afterInitialization(this);
  }

  /* app wide functions */

  _disableToolTips() {
    // A label wrapper can cause double click that
    // triggers this too early.
    // https://stackoverflow.com/questions/19249209/why-does-a-label-inside-an-input-trigger-a-click-event

    // TODO, change to use direct events to disable activated
    // tooltips
    const appState = this.state.namespace("__app__");
    // Copy the current active _active_tooltips
    const currentActiveTooltips = Object.assign(
      Object.create(null),
      appState._active_tooltips(),
    );

    const newActiveTooltips = {};
    for (const [key, value] of Object.entries(currentActiveTooltips)) {
      const justActivated = value.just_activated;
      const active = value.active;

      // If just activated, set it to be disabled later so
      // the user is able to see it when it is activated the first time
      if (justActivated && active) {
        newActiveTooltips[key] = {
          just_activated: false,
          active: active,
        };
        continue;
      }

      // Get the formstate tooltip signal observed variable
      const formStatePath = key.split("__");
      const activeToolTipFormKey = formStatePath[1];
      const activeToolTipVariableName = formStatePath[2];

      // flip the identified activation variable (show/hide)
      const activeToolTipForm = this.state.formState(activeToolTipFormKey);
      activeToolTipForm[activeToolTipVariableName](false);

      newActiveTooltips[key] = {
        just_activated: false,
        active: false,
      };
    }
    appState._active_tooltips(newActiveTooltips);
  }

  showDialog() {
    const popupState = this.state.namespace("popup");
    popupState.visible(true);
  }

  hideDialog() {
    const popupState = this.state.namespace("popup");
    popupState.visible(false);
  }

  setPopupDialog(title, message, { primary_label = "Close" } = {}) {
    const popupState = this.state.namespace("popup");
    popupState.title(title);
    popupState.message(message);
    popupState.primary_label(primary_label);
  }

  disableToolTips() {
    // UI selection to disable tooltips
    this._disableToolTips();
  }

  changeTab(nextTabIndex) {
    const appState = this.state.namespace("__app__");
    const previousValue = appState.selected_tab_index();

    appState.selected_tab_index(nextTabIndex);

    this._changeTab({ detail: { value: nextTabIndex, previousValue } });
  }

  _changeTab(ev) {
    const { previousValue: currentTabIndex } = ev.detail;

    // Clear any error string on any of the form tabs the tab is changed
    const formNames = [
      "peers_accepted",
      "peers_requested",
      "peers_new",
      "peers_import",
    ];
    const leavingNamespace = this.state.formState(formNames[currentTabIndex]);
    if (leavingNamespace) {
      leavingNamespace._error_string("");
    }

    // When leaving the peers_new tab when in editing mode, it will be cleared
    // and the editing canceled
    if (currentTabIndex === 2) {
      const newPeersNamespace = this.state.formState("peers_new");
      if (newPeersNamespace._is_editing()) {
        this.editPeerCancel();
      }
    }
  }

  resetNamespace(namespace) {
    if (namespace === undefined) {
      throw new Error(
        "Can't reset the namespace when an undefined was recieved",
      );
    }

    this.state.resetNamespace(namespace);
  }

  clearFormErrorOnFieldChange(_, namespace, __, observed) {
    const fieldName = this.state.namespaceObservedToName(observed, namespace);
    // find the corresponding field error observable
    const errObserved = namespace[PeersApp._fieldNameToFieldError(fieldName)];
    // clear it
    errObserved("");
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
      namespace.results_placeholder("Found no Peer(s).");
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
          namespace.results_placeholder("Found no Peer(s).");
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
    // Do initial user friendly check if everything is present before
    // the backend does a comprehensive check
    const fieldNames = Object.keys(PeersApp.CONST_ACCEPTED_IMPORT_FIELDS);

    const payload = {};
    for (const fieldName of fieldNames) {
      const observed = namespace[fieldName];
      payload[fieldName] = observed();
    }

    // Optional fields includes label and kind,
    const optionalFields = ["label", "kind"];
    const absentRequiredFields = fieldNames.filter(
      (fieldName) => !payload[fieldName] && !optionalFields.includes(fieldName),
    );
    try {
      if (absentRequiredFields.length > 0) {
        const errorsMap = {};
        for (const fieldName of absentRequiredFields) {
          // special case for expire
          let errorMsg;
          if (fieldName == "expire") {
            errorMsg = `End Date is empty but is required to have content`;
          } else {
            errorMsg = `${fieldName} is empty but is required to have content`;
          }
          errorsMap[fieldName] = errorMsg;
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

      await this.searchAcceptedQuery({ defaultEmptyQuery: "*" });
      this.importClear();
      this.summaryRequest();
      this.changeTab(0);
    } catch (e) {
      const errorsMap = (e.data || {}).errors_map;

      if (errorsMap) {
        this._unpackAndApplyErrorsMap(errorsMap, fieldNames, namespace);
      }

      if (e.message !== undefined && e.message !== "") {
        namespace._error_string(e.message);
      } else {
        namespace._error_string("unknown error occured");
      }
    }
  }

  importClear() {
    const importNamespace = this.state.formState("peers_import");
    this.resetNamespace(importNamespace);
  }

  importReset() {
    // Clears the import form input values to their default and
    // removes any displayed errors
    this.importClear();
    // reset the form errors
    const importPeerNamespace = this.state.formState("peers_import");
    this._resetNamespaceFieldErrors(
      Object.keys(PeersApp.CONST_ACCEPTED_IMPORT_FIELDS),
      importPeerNamespace,
    );
    // clear the form values
    const importPeerForm = document.getElementById("peers_import_form");
    importPeerForm.reset();
  }

  static getRowsSelectedPeers(results_rows) {
    const selected = [];
    for (const entry of results_rows) {
      if (entry.selected()) {
        selected.push(entry.peer_dn());
      }
    }
    return selected;
  }

  /* search accepted functions */

  searchAcceptedQuery({ defaultEmptyQuery = "*" } = {}) {
    const namespace = this.state.formState("peers_accepted");
    // Empty query means that we will search for everything
    if (namespace.query() == "" && defaultEmptyQuery !== "") {
      namespace.query(defaultEmptyQuery);
    }
    const searchParams = {
      query: namespace.query(),
    };

    // TODO allow kind to be set as a filter
    for (const observableName of ["kind"]) {
      const observed = namespace[observableName];
      let value;
      if ((value = observed())) {
        searchParams[observableName] = value;
      }
    }

    return this.peersListingQuery("/peers/accepted", namespace, searchParams);
  }

  searchAcceptedSelectAll({ value: selectedValue }, namespace) {
    for (const item of namespace.results_rows()) {
      item.selected(selectedValue);
    }
  }

  searchAcceptedRemove(_, namespace) {
    const resultsRows = namespace.results_rows();
    const distinguished_names_for_removal =
      PeersApp.getRowsSelectedPeers(resultsRows);
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

        // Reduce the namespace total
        const currentTotal = namespace.total();
        namespace.total(currentTotal - distinguished_names_for_removal.length);

        // update the total and count values
        this.summaryRequest();
        await this.searchAcceptedQuery({ defaultEmptyQuery: "*" });
      })
      .catch((error) => {
        namespace._error_string(error.message);
      });
  }

  searchAcceptedSendInvitation(_, namespace) {
    const resultsRows = namespace.results_rows();
    const peer_dns_for_invitation = PeersApp.getRowsSelectedPeers(resultsRows);
    if (peer_dns_for_invitation.length === 0) {
      return;
    }

    const requestOptions = {
      method: "POST",
      data: { peers: peer_dns_for_invitation },
    };
    return this.request("/peers/send_invitation", requestOptions)
      .then(async (res) => {
        const result = await res.json();
        if (typeof result.error === "string" && result.error) {
          const error = new Error(result.error);
          error.status = 422;
          throw error;
        }
        const data = result.data || {};
        const peerInvitations = data["peer_invitations"] || {};

        // Create the popup message
        const popupMsgs = {
          success: [],
          failures: [],
        };
        for (const [peerDnInvitation, invited] of Object.entries(
          peerInvitations,
        )) {
          const unpackedPeer = this._unpackPeerDN(peerDnInvitation);
          const parsedPeer = {
            full_name: unpackedPeer.CN,
            email: unpackedPeer.emailAddress,
          };
          if (invited) {
            popupMsgs["success"].push(parsedPeer);
          } else {
            popupMsgs["failures"].push(parsedPeer);
          }
        }

        let popupMsg = "";
        if (popupMsgs["success"].length > 0) {
          popupMsg += "Succesfully invited the following peers: <br><br>";
          popupMsg += popupMsgs["success"]
            .map((p) => `${p.full_name} &lt;${p.email}&gt;`)
            .join("<br>");
        }
        if (popupMsgs["failures"].length > 0) {
          popupMsg += "<br><br> Failed to invited the following peers: <br>";
          popupMsg += popupMsgs["failures"]
            .map((p) => `${p.full_name} &lt;${p.email}&gt;`)
            .join("<br>");
        }
        // populate the popup with errors
        this.setPopupDialog("Inviation Results.", popupMsg);
        this.showDialog();
      })
      .catch((error) => {
        if (error.message !== undefined && error.message !== "") {
          namespace._error_string(error.message);
        } else {
          namespace._error_string(
            "an unknown error occurred while trying to send invitations",
          );
        }
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
    const resultsRows = namespace.results_rows();
    const distinguished_names_for_accept =
      PeersApp.getRowsSelectedPeers(resultsRows);
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

        // Ensure that the form state is also updated
        this.changeTab(0);

        // Reduce the namespace total
        const currentTotal = namespace.total();
        namespace.total(currentTotal - distinguished_names_for_accept.length);

        // ensure the newly added peer wll be loaded
        this.summaryRequest();
        // refresh the accepted peers listing
        await this.searchAcceptedQuery({ defaultEmptyQuery: "*" });
        // refresh the requested peers so the peer
        // being accepted will disappear if shown
        await this.searchRequestedQuery({ defaultEmptyQuery: "*" });
      })
      .catch((error) => {
        namespace._error_string(error.message);
      });
  }

  searchRequestedRemove(_, namespace) {
    const resultsRows = namespace.results_rows();
    const distinguished_names_for_removal =
      PeersApp.getRowsSelectedPeers(resultsRows);
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

        // Reduce the namespace total
        const currentTotal = namespace.total();
        namespace.total(currentTotal - distinguished_names_for_removal.length);

        // update total
        this.summaryRequest();
        await this.searchRequestedQuery({ defaultEmptyQuery: "*" });
      })
      .catch((error) => {
        namespace._error_string(error.message);
      });
  }

  searchRequestedQuery({ defaultEmptyQuery = "*" } = {}) {
    const namespace = this.state.formState("peers_requested");
    // Empty query means that we will search for everything
    if (namespace.query() == "" && defaultEmptyQuery !== "") {
      namespace.query(defaultEmptyQuery);
    }
    const searchParams = {
      query: namespace.query(),
    };

    return this.peersListingQuery("/peers/requested", namespace, searchParams);
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
      this.searchRequestedQuery({ defaultEmptyQuery: "*" });
    }
  }

  /* new peer functions */

  async newPeerCreate(ev, namespace) {
    const values = this.state.serializeNamespace(namespace);

    if (!values.state) {
      values.state = "NA";
    }

    // Do initial user friendly check if everything is present before
    // the backend does a comprehensive check
    const fieldNames = Object.keys(PeersApp.CONST_NEW_PEERS_FIELDS);

    const optionalFields = ["label", "kind", "state"];
    const absentRequiredFields = fieldNames.filter(
      (fieldName) => !values[fieldName] && !optionalFields.includes(fieldName),
    );

    try {
      if (absentRequiredFields.length > 0) {
        const errorsMap = { 0: {} };
        for (const fieldName of absentRequiredFields) {
          // special case for expire
          let errorMsg;
          if (fieldName == "expire") {
            errorMsg = `End Date is empty but is required to have content`;
          } else {
            errorMsg = `${fieldName} is empty but is required to have content`;
          }
          errorsMap["0"][fieldName] = errorMsg;
        }
        const error = new Error("The form has failed to validate.");
        error.data = { errors_map: errorsMap };
        throw error;
      }

      const requestOptions = {
        method: "POST",
        data: values,
      };
      await this.request("/peers/new", requestOptions, namespace);
      await this.searchAcceptedQuery({ defaultEmptyQuery: "*" });
      this.newPeerClear();
      // Update the requested peers tab count and total state
      // before switching to it.
      this.summaryRequest();
      this.changeTab(0);
    } catch (error) {
      const errorData = error.data || {};
      const errorsMap = errorData["errors_map"] || {};
      const payloadErrors = errorsMap["0"];

      if (payloadErrors && Object.keys(payloadErrors).length > 0) {
        this._unpackAndApplyErrorsMap(payloadErrors, fieldNames, namespace);
      }

      if (error.message !== undefined && error.message !== "") {
        namespace._error_string(error.message);
      }
    }
  }

  newPeerClear() {
    const newPeerNamespace = this.state.formState("peers_new");
    this.resetNamespace(newPeerNamespace);
  }

  newPeerCreateReset() {
    // Clears the new peers form input values to their default and
    // removes any displayed errors
    this.newPeerClear();
    // reset the form errors
    const newPeerNamespace = this.state.formState("peers_new");
    this._resetNamespaceFieldErrors(
      Object.keys(PeersApp.CONST_NEW_PEERS_FIELDS),
      newPeerNamespace,
    );
    // clear the form values
    const newPeerForm = document.getElementById("peers_new_form");
    newPeerForm.reset();
    // Switches back to the Accepted Peers Tab on cancel
    this.changeTab(0);
  }

  // edit peer functions

  editPeerOpen(_, entry) {
    const newPeerNamespace = this.state.formState("peers_new");
    const peer_dn = entry.peer_dn();

    return this.request("/peers/accepted/fetch", {
      method: "POST",
      data: {
        peer_dn,
      },
    })
      .then(async (res) => {
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
      })
      .catch((error) => {
        newPeerNamespace._error_string(error.message);
      });
  }

  editPeerCancel() {
    const newPeerNamespace = this.state.formState("peers_new");
    this.resetNamespace(newPeerNamespace);
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
      "/peers/accepted/update",
      {
        method: "POST",
        data: values,
      },
      newPeerNamespace,
    )
      .then(async () => {
        this.editPeerCancel();
        this.changeTab(0);
        await this.searchAcceptedQuery({ defaultEmptyQuery: "*" });
      })
      .catch((error) => {
        const errorData = error.data || {};
        const errorsMap = errorData["errors_map"] || {};
        const payloadErrors = errorsMap["0"];
        if (!payloadErrors || Object.keys(payloadErrors).length === 0) {
          return;
        }

        // The fieldNames to target with the error messages
        this._unpackAndApplyErrorsMap(
          payloadErrors,
          PeersApp.CONST_EDIT_PEER_FIELD_NAMES,
          newPeerNamespace,
        );

        if (error.message !== undefined && error.message !== "") {
          newPeerNamespace._error_string(error.message);
        }
      });
  }

  /* other */

  static _fieldNameToFieldError(fieldName) {
    return `_${fieldName}_err`;
  }

  _unpackPeerDN(peerDN) {
    let peer = Object.create({});
    const peerSplit = peerDN.split("/");
    for (const peerItem of peerSplit) {
      // Split the key=value item
      const peerKeyValue = peerItem.split("=");
      peer[peerKeyValue[0]] = peerKeyValue[1];
    }
    return peer;
  }

  _unpackAndApplyErrorsMap(errorsMap, fieldNames, namespace) {
    for (const fieldName of fieldNames) {
      const errValue = errorsMap[fieldName];
      if (!(typeof errValue === "string" && errValue)) continue;
      const errFieldName = PeersApp._fieldNameToFieldError(fieldName);
      const errObservable = namespace[errFieldName];
      errObservable(`<p>${errValue}</p>`);
    }
  }

  _resetNamespaceFieldErrors(fieldNames, namespace) {
    for (const fieldName of fieldNames) {
      const errFieldName = PeersApp._fieldNameToFieldError(fieldName);
      const errObservable = namespace[errFieldName];
      errObservable("");
    }
    namespace._error_string("");
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
      tooltipEl.className = "MiguxTooltip";
      tooltipEl.textContent = tooltipText;

      this._tooltipElementsByParentId[associatedElId] = tooltipEl;
      element.appendChild(tooltipEl);
    }
  }

  tooltipHide(_, namespace, inputEl) {
    if (inputEl === null) {
      return;
    }
    const elId = inputEl.id;

    const appState = this.state.namespace("__app__");
    const currentActiveTooltips = appState._active_tooltips();
    const newActiveTooltips = Object.assign(
      Object.create(null),
      currentActiveTooltips,
      { [elId]: { just_activated: false, active: false } },
    );
    appState._active_tooltips(newActiveTooltips);

    // Retrieve the bound tooltip state variable
    // that is bound to hide the tooltip
    const toolTipNamespaceKey = elId.split("__")[2];
    // disable the form tooltip
    namespace[toolTipNamespaceKey](false);
  }

  tooltipShow(_, namespace, inputEl) {
    // Is an element associated with tooltip
    if (inputEl === null) {
      return;
    }
    // Update the appwide active tooltips when
    // it can be associated with an inputEl id
    const elId = inputEl.id;
    const appState = this.state.namespace("__app__");
    // Update the existing _active_tooltips
    const newValue = Object.assign(
      Object.create(null),
      appState._active_tooltips(),
      { [elId]: { just_activated: true, active: true } },
    );
    appState._active_tooltips(newValue);

    // Retrieve the bound tooltip state variable
    // that is bound to hide the tooltip
    const toolTipNamespaceKey = elId.split("__")[2];
    // disable the form tooltip
    namespace[toolTipNamespaceKey](true);
  }

  tooltipHover(_, namespace, inputEle, sourceElementId) {
    // Used to extract the innerHTML content from the sourceElementId
    // and add it as a title to the inputEle
    if (inputEle.title !== undefined || inputEle.title === "") {
      const sourceContent = document.getElementById(sourceElementId).innerHTML;
      inputEle.title = sourceContent;
    }
  }

  /* common functions */

  static _makeErrorFieldDefinitionsForFields(fieldDefinitions) {
    const definition = {};
    for (const fieldName of Object.keys(fieldDefinitions)) {
      const fieldErrName = PeersApp._fieldNameToFieldError(fieldName);
      definition[fieldErrName] = NO_VALUE;
    }
    return definition;
  }
}

PeersApp.CONST_ACCEPTED_IMPORT_FIELDS = {
  label: "",
  kind: "",
  expire: "",
  csvtext: "",
};

PeersApp.CONST_EDIT_PEER_FIELD_NAMES = ["expire", "kind", "label"];

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
  function makePeersListingState({
    showColLabel = true,
    showColKind = true,
  } = {}) {
    return {
      query: "",
      // column chooser
      show_toggles: false,
      // columns to show
      col_organization: true,
      col_country: false,
      col_state: false,
      col_kind: showColKind,
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
      // Ensure that the initial value is not shared across
      // instances
      _active_tooltips: observedValue(NO_VALUE),
    },
    // An appwide popup dialog to display
    // messages and receive user confirmation.
    // Disabled and empty at construction
    popup: {
      visible: false,
      title: "",
      message: "",
      primary_label: "",
      secondary_label: "",
    },
    // keyword defined in createNamespacedState
    forms: {
      peers_accepted: {
        ...makePeersListingState(),
        all: false,
        kind: "",
        count: 0,
        total: 0,
        _error_string: "",
        tooltip: false,
        _label_or_email_tooltip: false,
        _invitation_tooltip: false,
      },
      peers_requested: {
        ...makePeersListingState({ showColLabel: false, showColKind: false }),
        all: false,
        count: 0,
        total: 0,
        _error_string: "",
        // additional filter criteria
        kind: "",
        expire: "",
        info_tooltip: false,
        _fullname_or_email_tooltip: false,
        _expire_tooltip: false,
      },
      peers_new: {
        ...PeersApp.CONST_NEW_PEERS_FIELDS,
        ...PeersApp._makeErrorFieldDefinitionsForFields(
          PeersApp.CONST_NEW_PEERS_FIELDS,
        ),
        invite_on_email: true,
        // Only show the State field in the form if
        // the user selects one of the following countries
        _show_state_field: (state) => {
          const observing = new Set();
          observing.add(state.forms.form__peers_new.country);
          return computedValue((values) => {
            return ["US", "CA", "AU"].includes(values[0]);
          }, observing);
        },
        _is_editing: false,
        _editing_dn: NO_VALUE,
        _error_string: "",
        _label_tooltip: false,
        _expire_tooltip: false,
        _kind_tooltip: false,
        _organization_tooltip: false,
        _country_tooltip: false,
        _email_tooltip: false,
        _state_tooltip: false,
        _invite_email_tooltip: false,
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
        info_tooltip: false,
        _error_string: "",
        _label_tooltip: false,
        _kind_tooltip: false,
        _expire_tooltip: false,
        _invite_email_tooltip: false,
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
