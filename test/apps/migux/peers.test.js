import { JSDOM } from "jsdom";
import * as fsAsync from "fs/promises";
import * as path from "path";
import * as sinon from "sinon";

import {
  AssertionError,
  assertFalse,
  assertTrue,
  assertEqual,
} from "../../support/assertions.js";
import { browserHooksEach, grabBrowserGlobals } from "../../support/browser.js";

import { AppBase } from "../../../lib/app.js";
import { NO_VALUE } from "../../../lib/observable.js";
import { createNamespacedState as createState } from "../../../lib/state.js";

const SCRIPT_DIR = path.dirname(import.meta.url.replace("file://", ""));
const ROOT_DIR = path.join(SCRIPT_DIR, "../../..");

import { bootstrap, PeersApp } from "../../../migux/public/apps/migux/peers.js";

function loadTextualFixture(fixtureFilename) {
  const fixureFile = path.join(ROOT_DIR, "test", "fixtures", fixtureFilename);
  return fsAsync.readFile(fixureFile, "utf8");
}

const TEST_SEARCH_ACCEPTED_RESULT = await loadTextualFixture(
  "fragment_accepted.html",
);
const TEST_SEARCH_ACCEPTED_RESULT_TOTAL = 2;
const TEST_SEARCH_REQUESTED_RESULT = await loadTextualFixture(
  "fragment_requested.html",
);
const TEST_SEARCH_REQUESTED_RESULT_TOTAL = 3;

function makeFakeFetch({ body = null, contentType = "text/html" } = {}) {
  const res = {
    status: 200,
    headers: new Headers({
      "content-type": contentType,
    }),
    json() {
      throw new Error("UNSPECIFIED");
    },
    text() {
      throw new Error("UNSPECIFIED");
    },
    get ok() {
      return 200 <= res.status && res.status < 299;
    },
  };
  const stub = sinon.stub().named("fakeFetch").resolves(res);
  stub.getCallQueryArgs = (callIndex) => {
    const [url, fetchOptions] = stub.getCall(callIndex).args;
    if (fetchOptions.method !== "GET") {
      throw new AssertionError("query string unavilable for non-GET request");
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      if (e.message === "Invalid URL") {
        // assume we have only a path
        const prefixedUrl = `http://testhost${url}`;
        parsedUrl = new URL(prefixedUrl);
      } else {
        throw e;
      }
    }

    const queryArgs = {};
    for (const [k, v] of parsedUrl.searchParams.entries()) {
      queryArgs[k] = v;
    }
    return queryArgs;
  };
  stub.programResponse = ({ status = null, body = null }) => {
    if (status !== null) {
      res.status = status;
    }

    if (contentType === "application/json") {
      res.json = () => Promise.resolve(body);
    } else {
      if (body === null) throw new Error("fakeFetch: textual body is required");
      res.text = () => Promise.resolve(body);
    }
  };

  stub.programResponse({ body });

  return stub;
}

describe("apps/peers", function () {
  browserHooksEach(this);

  it("should allow being closed when there are no submissions", () => {
    const state = createState(AppBase.definition(PeersApp));

    assertFalse(state.namespace("__app__").disable_close());
  });

  it("should disable the close button while forms are submitted", () => {
    const state = createState(AppBase.definition(PeersApp));

    const acceptedForm = state.formState("peers_accepted");
    acceptedForm.submitted(true);

    assertTrue(state.namespace("__app__").disable_close());
  });

  describe("when listing accepted peers", () => {
    it("should not issue a request for an empty search term", async () => {
      const makeFakeRes = () => {
        const res = {
          ok: true,
          status: 200,
          text() {
            return Promise.resolve(TEST_SEARCH_REQUESTED_RESULT);
          },
        };
        return Promise.resolve(res);
      };
      const fakeFetch = sinon.stub().returns(makeFakeRes());
      const state = createState(AppBase.definition(PeersApp));
      const instance = new PeersApp(state, { _fetch: fakeFetch });

      await instance.searchAcceptedQuery();

      assertTrue(fakeFetch.notCalled);
    });

    it("should issue the request", async () => {
      const fakeFetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });
      const state = createState(AppBase.definition(PeersApp));
      const namespace = state.formState("peers_accepted");
      const instance = new PeersApp(state, { _fetch: fakeFetch });
      // set a query
      namespace.query("my search query");

      await instance.searchAcceptedQuery();

      assertTrue(fakeFetch.calledOnce);

      const queryArgs = fakeFetch.getCallQueryArgs(0);
      assertEqual(queryArgs, {
        query: "my search query",
        fields: "full_name,email,organization,kind,label,expire",
      });

      const theCall = fakeFetch.getCall(0);
      assertEqual(theCall.args, [
        "/peers/accepted?query=my+search+query&fields=full_name%2Cemail%2Corganization%2Ckind%2Clabel%2Cexpire",
        { method: "GET" },
      ]);
    });

    it("should clear the results while searching", async () => {
      const makeFakeRes = () => {
        const res = {
          ok: true,
          status: 200,
          text() {
            return Promise.resolve(TEST_SEARCH_REQUESTED_RESULT);
          },
        };
        return Promise.resolve(res);
      };
      const fakeFetch = sinon.stub().returns(makeFakeRes());
      const state = createState(AppBase.definition(PeersApp));
      const namespace = state.formState("peers_accepted");
      const instance = new PeersApp(state, { _fetch: fakeFetch });
      // set a query
      namespace.query("my search query");

      const queryPromise = instance.searchAcceptedQuery();

      // assertions made _before_ waiting on the promise in order to catch
      // state changes made prior to the search query fetch call returning
      assertEqual(namespace.results(), "");
      assertEqual(namespace.results_placeholder(), "Searching...");

      await queryPromise;
    });

    it("should process a successful response", async () => {
      const fakeFetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });
      const state = createState(AppBase.definition(PeersApp));
      const namespace = state.formState("peers_accepted");
      const instance = new PeersApp(state, { _fetch: fakeFetch });
      // set a query
      namespace.query("my search query");

      await instance.searchAcceptedQuery();

      assertEqual(namespace.count(), 3);
    });

    it("should process a failed response", async () => {
      const makeFakeRes = () => {
        const res = {
          ok: true,
          status: 200,
          text() {
            return Promise.reject(new Error("ARRANGED"));
          },
        };
        return Promise.resolve(res);
      };
      const fakeFetch = sinon.stub().returns(makeFakeRes());
      const state = createState(AppBase.definition(PeersApp));
      const namespace = state.formState("peers_accepted");
      const instance = new PeersApp(state, { _fetch: fakeFetch });
      // set a query
      namespace.query("my search query");

      await instance.searchAcceptedQuery();

      assertEqual(namespace.results(), "");
      assertEqual(namespace.results_placeholder(), "ARRANGED");
    });
  });

  describe("when listing requested peers", () => {
    it("should issue the request", async () => {
      const fakeFetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });
      const state = createState(AppBase.definition(PeersApp));
      const namespace = state.formState("peers_requested");
      const instance = new PeersApp(state, { _fetch: fakeFetch });

      namespace.query("my search query");

      await instance.searchRequestedQuery();

      assertTrue(fakeFetch.calledOnce);

      const queryArgs = fakeFetch.getCallQueryArgs(0);
      assertEqual(queryArgs, {
        query: "my search query",
        fields: "full_name,email,organization,kind,expire",
      });

      const theCall = fakeFetch.getCall(0);
      assertEqual(theCall.args, [
        "/peers/requested?query=my+search+query&fields=full_name%2Cemail%2Corganization%2Ckind%2Cexpire",
        { method: "GET" },
      ]);
    });

    it("should issue the request and preserve the query", async () => {
      const fakeFetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });
      const state = createState(AppBase.definition(PeersApp));
      const namespace = state.formState("peers_requested");
      const instance = new PeersApp(state, { _fetch: fakeFetch });

      namespace.query("show me peers");

      await instance.searchRequestedQuery();

      // no longer searching
      assertEqual(namespace.results_placeholder(), "");
      // no failure occurred
      assertEqual(namespace._error_string(), "");
      // query is unchanged
      assertEqual(namespace.query(), "show me peers");
    });

    it("should issue the request and filter by expire", async () => {
      const fakeFetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });
      const state = createState(AppBase.definition(PeersApp));
      const namespace = state.formState("peers_requested");
      const instance = new PeersApp(state, { _fetch: fakeFetch });

      namespace.expire("2223-12-10");

      await instance.searchRequestedQuery();

      assertTrue(fakeFetch.calledOnce);

      const queryArgs = fakeFetch.getCallQueryArgs(0);
      assertEqual(queryArgs, {
        expire: "2223-12-10",
        fields: "full_name,email,organization,kind,expire",
      });

      const theCall = fakeFetch.getCall(0);
      assertEqual(theCall.args, [
        "/peers/requested?expire=2223-12-10&fields=full_name%2Cemail%2Corganization%2Ckind%2Cexpire",
        { method: "GET" },
      ]);
    });
  });

  describe("with existing accepted peers", () => {
    /** @type {import("../../migux/public/apps/peers.js").PeersApp} */
    let app;
    let fakeFetch;
    let acceptedPeersState;

    beforeEach(() => {
      fakeFetch = makeFakeFetch({
        body: {},
        contentType: "application/json",
      });
      const state = createState(AppBase.definition(PeersApp));
      app = new PeersApp(state, { _fetch: fakeFetch });
      acceptedPeersState = state.formState("peers_accepted");

      app.state.selected_tab_index(0);

      const acceptedPeersHtml = TEST_SEARCH_ACCEPTED_RESULT;
      acceptedPeersState = state.formState("peers_accepted");
      acceptedPeersState.query("*");
      acceptedPeersState.total(TEST_SEARCH_ACCEPTED_RESULT_TOTAL);
      app._peersListingUpdateResults(acceptedPeersState, acceptedPeersHtml, {
        _skipRebind: true,
      });
    });

    describe("when removing a peer", () => {
      beforeEach(() => {
        // select two peers
        acceptedPeersState.results_rows()[0].selected(true);
        acceptedPeersState.results_rows()[1].selected(true);

        sinon
          .stub(app, "request")
          .resolves({ json: () => Promise.resolve({}) });
      });

      it("should not change tabs", async () => {
        // precondition
        assertEqual(app.state.selected_tab_index(), 0);

        await app.searchAcceptedRemove(null, acceptedPeersState);

        assertEqual(app.state.selected_tab_index(), 0);
      });

      it("should reload the requested listing", async () => {
        const searchAcceptedQueryStub = sinon.stub(app, "searchAcceptedQuery");

        await app.searchAcceptedRemove(null, acceptedPeersState);

        assertTrue(searchAcceptedQueryStub.calledOnce);
      });

      it("should update the requested total", async () => {
        // precondition
        assertEqual(acceptedPeersState.total(), 2);

        await app.searchAcceptedRemove(null, acceptedPeersState);

        assertEqual(acceptedPeersState.total(), 0);
      });
    });
  });

  describe("with existing requested peers", () => {
    /** @type {import("../../migux/public/apps/peers.js").PeersApp} */
    let app;
    let fakeFetch;
    let requestedPeersState;

    beforeEach(() => {
      fakeFetch = makeFakeFetch({
        body: {},
        contentType: "application/json",
      });
      const state = createState(AppBase.definition(PeersApp));
      app = new PeersApp(state, { _fetch: fakeFetch });

      app.state.selected_tab_index(1);

      const requestedPeersHtml = TEST_SEARCH_REQUESTED_RESULT;
      requestedPeersState = state.formState("peers_requested");
      requestedPeersState.query("*");
      requestedPeersState.total(TEST_SEARCH_REQUESTED_RESULT_TOTAL);
      app._peersListingUpdateResults(requestedPeersState, requestedPeersHtml, {
        _skipRebind: true,
      });
    });

    it("should clear the listing on an empty search query", async () => {
      requestedPeersState.query("");

      await app.searchRequestedQuery();

      assertTrue(fakeFetch.notCalled);
      assertEqual(requestedPeersState.results_rows().length, 0);
      assertEqual(requestedPeersState.results_placeholder(), "No results.");
    });

    describe("when accepting a peer", () => {
      beforeEach(() => {
        // select two peers
        requestedPeersState.results_rows()[1].selected(true);
        requestedPeersState.results_rows()[2].selected(true);

        sinon
          .stub(app, "request")
          .resolves({ json: () => Promise.resolve({}) });
      });

      it("should change to the accepted tab", async () => {
        // precondition
        assertEqual(app.state.selected_tab_index(), 1);

        await app.searchRequestedAccept(null, requestedPeersState);

        assertEqual(app.state.selected_tab_index(), 0);
      });

      it("should reload the accepted listing", async () => {
        const searchAcceptedQueryStub = sinon.stub(app, "searchAcceptedQuery");
        const acceptedPeersState = app.state.formState("peers_accepted");
        acceptedPeersState.query("to be replaced");

        await app.searchRequestedAccept(null, requestedPeersState);

        assertTrue(searchAcceptedQueryStub.calledOnce);
        assertEqual(acceptedPeersState.query(), "*");
      });

      it("should reload the requested listing", async () => {
        const searchRequestedQueryStub = sinon.stub(
          app,
          "searchRequestedQuery",
        );
        requestedPeersState.query("not to be replaced");

        await app.searchRequestedAccept(null, requestedPeersState);

        assertTrue(searchRequestedQueryStub.calledOnce);
        assertEqual(requestedPeersState.query(), "not to be replaced");
      });

      it("should update the requested total", async () => {
        // precondition
        assertEqual(requestedPeersState.total(), 3);

        await app.searchRequestedAccept(null, requestedPeersState);

        assertEqual(requestedPeersState.total(), 1);
      });
    });

    describe("when removing a peer", () => {
      beforeEach(() => {
        // select two peers
        requestedPeersState.results_rows()[1].selected(true);
        requestedPeersState.results_rows()[2].selected(true);

        sinon
          .stub(app, "request")
          .resolves({ json: () => Promise.resolve({}) });
      });

      it("should not change tabs", async () => {
        // precondition
        assertEqual(app.state.selected_tab_index(), 1);

        await app.searchRequestedRemove(null, requestedPeersState);

        assertEqual(app.state.selected_tab_index(), 1);
      });

      it("should reload the requested listing", async () => {
        const searchRequestedQueryStub = sinon.stub(
          app,
          "searchRequestedQuery",
        );

        await app.searchRequestedRemove(null, requestedPeersState);

        assertTrue(searchRequestedQueryStub.calledOnce);
      });

      it("should update the requested total", async () => {
        // precondition
        assertEqual(requestedPeersState.total(), 3);

        await app.searchRequestedRemove(null, requestedPeersState);

        assertEqual(requestedPeersState.total(), 1);
      });
    });
  });

  describe("when creating a new peer", () => {
    const EXAMPLE_PEERS_FIELDS = {
      full_name: "foo",
      email: "foo@example.com",
      label: "some_peer_label",
      expire: "2003-02-01",
      organization: "KU",
      kind: "course",
      country: "DK",
      state: "NA",
    };

    /** @type {import("../../migux/public/apps/peers.js").PeersApp} */
    let app;
    let fakeFetch;
    let state;

    beforeEach(() => {
      fakeFetch = makeFakeFetch({
        body: {},
        contentType: "application/json",
      });
      state = createState(AppBase.definition(PeersApp));

      app = new PeersApp(state, { _fetch: fakeFetch });

      // set a requested peers search term
      state.formState("peers_requested").query("show_me_peers");
      // set new peer fields
      const newPeerNamespace = state.formState("peers_new");
      for (const [field, value] of Object.entries(EXAMPLE_PEERS_FIELDS)) {
        const observed = newPeerNamespace[field];
        observed(value);
      }
    });

    it("should display errors on create peer failure", async () => {
      fakeFetch.programResponse({
        status: 400,
        body: {
          data: {
            success_map: {
              0: false,
            },
            errors_map: {
              0: {
                label: "does not say foo",
              },
            },
          },
        },
      });

      const newPeerNamespace = state.formState("peers_new");

      await app.newPeerCreate(null, newPeerNamespace);

      // check fields are unchanged
      for (const [field, example_value] of Object.entries(
        EXAMPLE_PEERS_FIELDS,
      )) {
        const observed = newPeerNamespace[field];
        assertEqual(observed(), example_value);
      }

      // check field errors were processed
      assertEqual(newPeerNamespace._label_err(), "<p>does not say foo</p>");
      // check only returned errors were shown
      assertEqual(newPeerNamespace._email_err(), NO_VALUE);
    });

    it("should clear the form success", async () => {
      const newPeerNamespace = state.formState("peers_new");

      await app.newPeerCreate(null, newPeerNamespace);

      for (const field of Object.keys(EXAMPLE_PEERS_FIELDS)) {
        const observed = newPeerNamespace[field];
        assertEqual(observed(), "");
      }
    });

    it("should reload the requested peers on success", async () => {
      const newPeerNamespace = state.formState("peers_new");
      const searchRequestedQueryStub = sinon.stub(app, "searchRequestedQuery");

      await app.newPeerCreate(null, newPeerNamespace);

      assertTrue(searchRequestedQueryStub.calledOnce);
    });

    it("should change to the requested peers tab on success", async () => {
      const newPeerNamespace = state.formState("peers_new");

      await app.newPeerCreate(null, newPeerNamespace);

      const appState = state.namespace("__app__");
      assertEqual(appState.selected_tab_index(), 1);
    });
  });

  describe("when importing peers", () => {
    const EXAMPLE_IMPORT_FIELDS = {
      kind: "course",
      label: "some_peer_label",
      expire: "2003-02-01",
      csvtext: "lines of csv",
    };

    /** @type {import("../../migux/public/apps/peers.js").PeersApp} */
    let app;
    let fakeFetch;
    let state;
    let importPeersNamespace;

    beforeEach(() => {
      fakeFetch = makeFakeFetch({
        body: {},
        contentType: "application/json",
      });
      state = createState(AppBase.definition(PeersApp));

      app = new PeersApp(state, { _fetch: fakeFetch });
      importPeersNamespace = state.formState("peers_import");

      // set new peer fields
      for (const [field, value] of Object.entries(EXAMPLE_IMPORT_FIELDS)) {
        const observed = importPeersNamespace[field];
        observed(value);
      }
    });

    it("should display errors on create peer failure", async () => {
      fakeFetch.programResponse({
        status: 400,
        body: {
          data: {
            errors_map: {
              label: "does not say foo",
            },
          },
        },
      });

      await app.importAction(null, importPeersNamespace);

      // check fields are unchanged
      for (const [field, example_value] of Object.entries(
        EXAMPLE_IMPORT_FIELDS,
      )) {
        const observed = importPeersNamespace[field];
        assertEqual(observed(), example_value);
      }

      // check field errors were processed
      assertEqual(importPeersNamespace._label_err(), "<p>does not say foo</p>");
      // check only returned errors were shown
      assertEqual(importPeersNamespace._kind_err(), NO_VALUE);
    });

    it("should clear the form success", async () => {
      await app.importAction(null, importPeersNamespace);

      for (const field of Object.keys(EXAMPLE_IMPORT_FIELDS)) {
        const observed = importPeersNamespace[field];
        assertEqual(observed(), "");
      }
    });

    it("should change to the accepted peers tab on success", async () => {
      await app.importAction(null, importPeersNamespace);

      const appState = state.namespace("__app__");
      assertEqual(appState.selected_tab_index(), 0);
    });

    it("should reload the accepted peers on success", async () => {
      const searchAcceptedQueryStub = sinon.stub(app, "searchAcceptedQuery");

      await app.importAction(null, importPeersNamespace);

      assertTrue(searchAcceptedQueryStub.calledOnce);
    });
  });

  describe("when bound", function () {
    let appHtml;

    before(async () => {
      const jsdom = new JSDOM("<!DOCTYPE html><html></html>");
      const DOMParser = jsdom.window.DOMParser;
      const appFileHtml = await fsAsync.readFile(
        path.join(ROOT_DIR, "public/apps/migux/peers.html"),
        "utf8",
      );

      const dom = new DOMParser().parseFromString(appFileHtml, "text/html");
      const scriptEls = dom.querySelectorAll("script");
      for (const scriptEl of scriptEls) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
      appHtml = dom.body.innerHTML.trim();
    });

    let document;
    let window;

    browserHooksEach(this);

    beforeEach(() => {
      ({ window, document } = grabBrowserGlobals());
      const rootEl = document.body;
      rootEl.dataset.migrole = "app";
      rootEl.dataset.migapp = "peers";
      rootEl.innerHTML = appHtml;
    });

    function assertPlaceholderVisibility(visible) {
      const placeholderEl = document.querySelector(
        '[data-bind-observe="results_placeholder"]',
      );
      assertTrue(!!placeholderEl);
      return placeholderEl.style.display === (visible ? "" : "none");
    }

    function assertPlaceholderValue(value) {
      const placeholderEl = document.querySelector(
        '[data-bind-observe="results_placeholder"]',
      );
      assertTrue(!!placeholderEl);
      assertEqual(placeholderEl.innerHTML, value);
    }

    function unpackReturnedPromise(spy) {
      assertTrue(spy.isSinonProxy);
      assertTrue(spy.calledOnce);
      const returnedPromise = spy.returnValues[0];
      assertTrue(returnedPromise instanceof Promise);
      return returnedPromise;
    }

    it("should close itself on click of the x icon", () => {
      bootstrap(document.body);
      const closeIconEl = document.querySelector(".CloseButton");

      closeIconEl.dispatchEvent(new window.MouseEvent("click"));

      assertEqual(document.body.children.length, 0);
    });

    it("should close itself on click of the close button", () => {
      bootstrap(document.body);
      const modelFooterEl = document.querySelector("#peers-modal-footer");
      const closeButtonEl = modelFooterEl.querySelector(
        '[data-bind-disabled="disable_close"]',
      );

      closeButtonEl.dispatchEvent(new window.MouseEvent("click"));

      assertEqual(document.body.children.length, 0);
    });

    it("should change tab on a corresponding click", () => {
      bootstrap(document.body);
      const tabItemEls = document.querySelectorAll(".TabsItem");
      const secondTabPanelEl = document.querySelector(
        "form[name=peers_requested]",
      );

      tabItemEls[1].dispatchEvent(new window.MouseEvent("click"));

      assertTrue(secondTabPanelEl.classList.contains("TabsPanel--active"));
    });

    it("should show a placeholder with no search", () => {
      bootstrap(document);

      const tbodyEl = document.querySelector('[data-bind-observe="results"]');
      assertEqual(tbodyEl.children.length, 0);
      assertPlaceholderVisibility(true);
    });

    it("should toggle submitted when searching", async () => {
      const app = bootstrap(document);
      app._fetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });
      const searchAcceptedQuerySpy = sinon.spy(app, "searchAcceptedQuery");
      const searchAcceptedState = app.state.formState("peers_accepted");

      const searchEl = document.querySelector("#peers_search_accepted");
      searchEl.value = "foo";
      const inputEvent = new window.InputEvent("input");
      searchEl.dispatchEvent(inputEvent);
      //searchEl.value = "foo";
      const keyboardEvent = new window.KeyboardEvent("keyup", { key: "Enter" });
      searchEl.dispatchEvent(keyboardEvent);

      assertTrue(searchAcceptedState.submitted());

      await unpackReturnedPromise(searchAcceptedQuerySpy);

      assertFalse(searchAcceptedState.submitted());
    });

    it("should inform the user a search is in progress", async () => {
      const app = bootstrap(document);
      app._fetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });
      const searchAcceptedQuerySpy = sinon.spy(app, "searchAcceptedQuery");

      const searchEl = document.querySelector("#peers_search_accepted");
      searchEl.value = "foo";
      const inputEvent = new window.InputEvent("input");
      searchEl.dispatchEvent(inputEvent);
      //searchEl.value = "foo";
      const keyboardEvent = new window.KeyboardEvent("keyup", { key: "Enter" });
      searchEl.dispatchEvent(keyboardEvent);

      assertPlaceholderVisibility(true);
      assertPlaceholderValue("Searching...");

      await unpackReturnedPromise(searchAcceptedQuerySpy);
    });

    it("should display the results of a search", async () => {
      const app = bootstrap(document);
      app._fetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });
      const searchAcceptedQuerySpy = sinon.spy(app, "searchAcceptedQuery");

      const searchEl = document.querySelector("#peers_search_accepted");
      searchEl.value = "foo";
      const inputEvent = new window.InputEvent("input");
      searchEl.dispatchEvent(inputEvent);
      //searchEl.value = "foo";
      const keyboardEvent = new window.KeyboardEvent("keyup", { key: "Enter" });
      searchEl.dispatchEvent(keyboardEvent);

      await unpackReturnedPromise(searchAcceptedQuerySpy);

      const tbodyEl = document.querySelector('[data-bind-observe="results"]');
      assertTrue(tbodyEl.innerHTML.trimStart().startsWith("<tr>"));
      assertPlaceholderVisibility(false);
    });

    it("should display the placeholder when no search term is input", async () => {
      const app = bootstrap(document);
      app._fetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });

      const searchEl = document.querySelector("#peers_search_accepted");
      searchEl.value = "";
      const inputEvent = new window.InputEvent("input");
      searchEl.dispatchEvent(inputEvent);
      //searchEl.value = "foo";
      const keyboardEvent = new window.KeyboardEvent("keyup", { key: "Enter" });
      searchEl.dispatchEvent(keyboardEvent);

      assertFalse(app._fetch.called);
      assertPlaceholderVisibility(true);
    });

    it("should bind result rows to state", async () => {
      const app = bootstrap(document);
      app._fetch = makeFakeFetch({ body: TEST_SEARCH_REQUESTED_RESULT });
      const searchAcceptedQuerySpy = sinon.spy(app, "searchAcceptedQuery");

      const searchEl = document.querySelector("#peers_search_accepted");

      searchEl.value = "foo";
      const inputEvent = new window.InputEvent("input");
      searchEl.dispatchEvent(inputEvent);

      const keyboardEvent = new window.KeyboardEvent("keyup", { key: "Enter" });
      searchEl.dispatchEvent(keyboardEvent);

      await unpackReturnedPromise(searchAcceptedQuerySpy);

      const firstCheckboxEl = document.querySelectorAll(
        '[data-bind-checked="selected"]',
      )[0];

      const clickEvent = new window.InputEvent("click");
      firstCheckboxEl.dispatchEvent(clickEvent);

      assertEqual(firstCheckboxEl.value, "on");
    });

    it("should open the new peers form on 'New Peers' tab click", () => {
      bootstrap(document);

      const newPeersTab = document.querySelectorAll(".TabsItem")[2];
      newPeersTab.dispatchEvent(new window.MouseEvent("click"));

      const activeFormEl = document.querySelector('form[name="peers_new"]');
      activeFormEl.classList.contains("TabsPanel--active");
    });

    describe("with the accepted peers tab", () => {
      it("should open empty with placeholder text", async () => {
        const app = bootstrap(document);
        app._fetch = makeFakeFetch({
          body: [],
          contentType: "application/json",
        });
        app.state.selected_tab_index(0);

        const formEl = document.querySelector('form[name="peers_accepted"]');
        const placeholderEl = formEl.querySelector(
          'div[data-bind-observe="results_placeholder"]',
        );
        assertEqual(placeholderEl.innerHTML, "No results.");
      });

      describe("with peers displayed", () => {
        it("should open empty with placeholder text", async () => {
          const app = bootstrap(document);
          app._fetch = makeFakeFetch({
            body: [],
            contentType: "application/json",
          });
          app.state.selected_tab_index(0);
          const acceptedPeersState = app.state.formState("peers_accepted");
          app._peersListingUpdateResults(
            acceptedPeersState,
            TEST_SEARCH_ACCEPTED_RESULT,
          );
          const formEl = document.querySelector('form[name="peers_accepted"]');
          const selectAllEl = formEl.querySelector(
            'input[data-bind-checked="all"]',
          );

          selectAllEl.dispatchEvent(new window.MouseEvent("click"));

          // assert all rows are selected
          for (const entry of acceptedPeersState.results_rows()) {
            assertTrue(entry.selected());
          }
        });
      });
    });

    describe("with the requested peers tab", () => {
      it("should open empty with placeholder text", async () => {
        const app = bootstrap(document);
        app._fetch = makeFakeFetch({
          body: [],
          contentType: "application/json",
        });
        app.state.selected_tab_index(1);

        const formEl = document.querySelector('form[name="peers_requested"]');
        const placeholderEl = formEl.querySelector(
          'div[data-bind-observe="results_placeholder"]',
        );
        assertEqual(placeholderEl.innerHTML, "No results.");
      });

      it("should load requested peers", async () => {
        const app = bootstrap(document);
        app._fetch = makeFakeFetch({
          body: [],
          contentType: "application/json",
        });
        const searchRequestedQuerySpy = sinon.spy(app, "searchRequestedQuery");

        app.state.selected_tab_index(1);
        const formState = app.state.formState("peers_requested");
        formState.query("*");
        const formEl = document.querySelector("form.peers_requested");
        const labelEl = formEl.querySelector('[data-bind-observe="query"]');

        const keyboardEvent = new window.KeyboardEvent("keyup", {
          key: "Enter",
        });
        labelEl.dispatchEvent(keyboardEvent);

        await unpackReturnedPromise(searchRequestedQuerySpy);

        const theCall = searchRequestedQuerySpy.getCall(0);
        assertEqual(theCall.args[0], { value: "*" });
      });

      describe("with peers displayed", () => {
        it("should open empty with placeholder text", async () => {
          const app = bootstrap(document);
          app._fetch = makeFakeFetch({
            body: [],
            contentType: "application/json",
          });
          app.state.selected_tab_index(1);
          const requestedPeersState = app.state.formState("peers_requested");
          app._peersListingUpdateResults(
            requestedPeersState,
            TEST_SEARCH_REQUESTED_RESULT,
          );
          const formEl = document.querySelector('form[name="peers_requested"]');
          const selectAllEl = formEl.querySelector(
            'input[data-bind-checked="all"]',
          );

          selectAllEl.dispatchEvent(new window.MouseEvent("click"));

          // assert all rows are selected
          for (const entry of requestedPeersState.results_rows()) {
            assertTrue(entry.selected());
          }
        });
      });
    });

    describe("with the new peers tab", () => {
      it('should use the default option for "kind" on first open', () => {
        const app = bootstrap(document);

        const namespace = app.state.formState("peers_new");
        assertEqual(namespace.kind(), "course");
      });

      it('should send the form on "Create" button press', () => {
        const app = bootstrap(document);
        app._fetch = makeFakeFetch({
          body: [],
          contentType: "application/json",
        });
        const formEl = document.querySelector("form[name=peers_new]");
        const createButtonEl = formEl.querySelector("button.btn-primary");

        createButtonEl.dispatchEvent(new window.MouseEvent("click"));

        const firstCall = app._fetch.getCall(0);
        const firstCallOptions = firstCall.args[1];
        assertEqual(firstCallOptions, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: '{"full_name":"","email":"","label":"","expire":"","organization":"","kind":"course","country":"","state":"NA","invite_on_email":true}',
        });
      });
    });

    describe("with preexisting state", () => {
      it("should allow interaction after reloading a result", async () => {
        const rootEl = document.body;
        const app = bootstrap(rootEl, {
          _overrideDefaults: {
            __app__: {
              selected_tab_index: 1,
            },
            form__peers_requested: {
              query: "",
              results_placeholder: "",
              results_rows: [],
            },
          },
        });
        app._fetch = makeFakeFetch({
          body: TEST_SEARCH_REQUESTED_RESULT,
          contentType: "text/html",
        });
        const peersRequestedState = app.state.formState("peers_requested");
        const formEl = document.querySelector('form[name="peers_requested"]');
        const tableEl = formEl.querySelector('[data-bind-observe="results"]');

        // preconditions
        assertTrue(app._fetch.notCalled);
        assertTrue(formEl.classList.contains("TabsPanel--active"));
        assertEqual(tableEl.children.length, 0);

        // arrange
        peersRequestedState.query("some query");
        await app.searchRequestedQuery();
        assertEqual(tableEl.children.length, 3);

        // act
        const thirdCheckboxEl = tableEl.children[2].querySelector(
          'input[type="checkbox"]',
        );
        thirdCheckboxEl.dispatchEvent(new window.MouseEvent("click"));

        // assert
        assertTrue(
          peersRequestedState.results_rows()[2].selected(),
          "the result rows were not correctly bound",
        );
      });
    });
  });

  describe("url building", () => {
    it("should build a REST style url", () => {
      const { url, ...fetchOptions } = PeersApp.restUrl(
        "some.server",
        "/the/path",
        {
          query: {
            foo: 1,
            bar: [true, "blue"],
          },
        },
      );

      assertEqual(url, "some.server/the/path?foo=1&bar=true%2Cblue");
      assertEqual(fetchOptions, {
        method: "GET",
      });
    });

    it("should build a REST style url for JSON", () => {
      const { url, ...fetchOptions } = PeersApp.restUrl(
        "some.server",
        "/the/path",
        {
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          data: {
            foo: 1,
            bar: [true, "blue"],
          },
        },
      );

      assertEqual(url, "some.server/the/path");
      assertEqual(fetchOptions, {
        body: '{"foo":1,"bar":[true,"blue"]}',
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    });
  });
});
