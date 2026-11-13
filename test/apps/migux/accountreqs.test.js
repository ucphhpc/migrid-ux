import * as sinon from "sinon";

import {
  assertTrue,
  assertFalse,
  assertEqual,
} from "../../support/assertions.js";
import { browserHooksEach, grabBrowserGlobals } from "../../support/browser.js";
import { parseHtmlFromString } from "../../support/dom.js";
import { loadTextualFixture, loadPublicFile } from "../../support/files.js";
import { AppBase } from "../../../lib/app.js";
import { createNamespacedState as createState } from "../../../lib/state.js";
import { bootstrap, AccountRequestsApp } from "../../../public/apps/migux/accountreqs.js";

const TEST_SEARCH_ACCOUNT_REQUESTS_RESULT = loadTextualFixture(
  "accountreqs/fragment_requested.html",
);

function fakeResponse(text) {
  const res = {
    ok: true,
    status: 200,
    text() {
      return Promise.resolve(text);
    },
  };
  return Promise.resolve(res);
};

function fakeFetchParseRequestURL(call) {
  const url = call.args[0];
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    if (e.message !== "Invalid URL") {
      throw e;
    }

    // assume we have only a path
    const prefixedUrl = `http://testhost${url}`;
    parsedUrl = new URL(prefixedUrl);
  }

  const queryParams = new URLSearchParams(parsedUrl.search);

  return { parsedUrl, queryParams };
}

function arrangeAppInstance() {
  const fakeFetch = sinon.stub();
  const state = createState(AppBase.definition(AccountRequestsApp));
  const accountRequestsNamespace = state.formState("account_requests")
  const instance = new AccountRequestsApp(state, { _fetch: fakeFetch });
  return { instance, state, accountRequestsNamespace, fakeFetch }
}

describe("apps/accountreqs", function () {
  before(async () => {
    // Disable the refreshCsrfTokens that is for instance used during initialization
    // We are not testing the csrf token functionality here.
    sinon.stub(AccountRequestsApp.prototype, "refreshCsrfTokens");
  });

  browserHooksEach(this);

  it("should allow being closed when there are no submissions", () => {
    const state = createState(AppBase.definition(AccountRequestsApp));

    assertFalse(state.namespace("__app__").disable_close());
  });

  describe("when searching account requests", () => {
    it("should issue a request for an empty search term", async () => {
      const { instance, fakeFetch } = arrangeAppInstance()
      fakeFetch.returns(fakeResponse(TEST_SEARCH_ACCOUNT_REQUESTS_RESULT));

      await instance.searchRequest();

      assertTrue(fakeFetch.calledOnce);
      const { queryParams } = fakeFetchParseRequestURL(fakeFetch.lastCall);
      assertEqual(queryParams.get("query"), "");
    });

    describe("and search state is empty", () => {
      it("should issue a request with empty state", async () => {
        const { instance, fakeFetch, accountRequestsNamespace: namespace } = arrangeAppInstance()
        namespace.search_state("")
        fakeFetch.returns(fakeResponse(TEST_SEARCH_ACCOUNT_REQUESTS_RESULT));

        await instance.searchRequest();

        assertTrue(fakeFetch.calledOnce);
        const { queryParams } = fakeFetchParseRequestURL(fakeFetch.lastCall);
        assertEqual(queryParams.get("state"), "");
      })
    })

    describe("and search state is requested", () => {
      it("should issue a request with requested state", async () => {
        const { instance, fakeFetch, accountRequestsNamespace: namespace } = arrangeAppInstance()
        namespace.search_state("requested")
        fakeFetch.returns(fakeResponse(TEST_SEARCH_ACCOUNT_REQUESTS_RESULT));

        await instance.searchRequest();

        assertTrue(fakeFetch.calledOnce);
        const { queryParams } = fakeFetchParseRequestURL(fakeFetch.lastCall);
        assertEqual(queryParams.get("state"), "requested");
      })
    })

    describe("and search state is pending", () => {
      it("should issue a request with pending state", async () => {
        const { instance, fakeFetch, accountRequestsNamespace: namespace } = arrangeAppInstance()
        namespace.search_state("pending")
        fakeFetch.returns(fakeResponse(TEST_SEARCH_ACCOUNT_REQUESTS_RESULT));

        await instance.searchRequest();

        assertTrue(fakeFetch.calledOnce);
        const { queryParams } = fakeFetchParseRequestURL(fakeFetch.lastCall);
        assertEqual(queryParams.get("state"), "pending");
      })
    })

    describe("and search state is accepted", () => {
      it("should issue a request with accepted state", async () => {
        const { instance, fakeFetch, accountRequestsNamespace: namespace } = arrangeAppInstance()
        namespace.search_state("accepted")
        fakeFetch.returns(fakeResponse(TEST_SEARCH_ACCOUNT_REQUESTS_RESULT));

        await instance.searchRequest();

        assertTrue(fakeFetch.calledOnce);
        const { queryParams } = fakeFetchParseRequestURL(fakeFetch.lastCall);
        assertEqual(queryParams.get("state"), "accepted");
      })
    })
  })

  describe("when changing search state", () => {
    let namespace;

    beforeEach(() => {
      const { instance, accountRequestsNamespace } = arrangeAppInstance()
      instance._initializeSearchStateHandling()
      namespace = accountRequestsNamespace
    })

    describe("to any", () => {
      it("it updates expected indicators", () => {
        namespace.search_state("")
        assertTrue(namespace.account_request_state_selected_any())
        assertFalse(namespace.account_request_state_selected_requested())
        assertFalse(namespace.account_request_state_selected_pending())
        assertFalse(namespace.account_request_state_selected_accepted())
      })
    })

    describe("to requested", () => {
      it("it updates expected indicators", () => {
        namespace.search_state("requested")
        assertFalse(namespace.account_request_state_selected_any())
        assertTrue(namespace.account_request_state_selected_requested())
        assertFalse(namespace.account_request_state_selected_pending())
        assertFalse(namespace.account_request_state_selected_accepted())
      })
    })

    describe("to pending", () => {
      it("it updates expected indicators", () => {
        namespace.search_state("pending")
        assertFalse(namespace.account_request_state_selected_any())
        assertFalse(namespace.account_request_state_selected_requested())
        assertTrue(namespace.account_request_state_selected_pending())
        assertFalse(namespace.account_request_state_selected_accepted())
      })
    })

    describe("to accepted", () => {
      it("it updates expected indicators", () => {
        namespace.search_state("accepted")
        assertFalse(namespace.account_request_state_selected_any())
        assertFalse(namespace.account_request_state_selected_requested())
        assertFalse(namespace.account_request_state_selected_pending())
        assertTrue(namespace.account_request_state_selected_accepted())
      })
    })
  })

  describe("when bound", function () {
    let appHtml;

    before(async () => {
      const appFileHtml = await loadPublicFile("public/apps/migux/accountreqs.html");
      const dom = await parseHtmlFromString(appFileHtml);
      const scriptEls = dom.querySelectorAll("script");
      for (const scriptEl of scriptEls) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
      appHtml = dom.body.innerHTML.trim();
    });

    /** @type {Document} */
    let document;
    let window;

    browserHooksEach(this);

    beforeEach(() => {
      ({ window, document } = grabBrowserGlobals());
      const rootEl = document.body;
      rootEl.dataset.migrole = "app";
      rootEl.dataset.migapp = "accountreqs";
      rootEl.innerHTML = appHtml;
    });

    it("should close itself on click of the x icon", () => {
      bootstrap(document.body);
      const closeIconEl = document.querySelector(".modal-close");

      closeIconEl.dispatchEvent(new window.MouseEvent("click"));

      assertEqual(document.body.children.length, 0);
    });

    it("should close itself on click of the close button", () => {
      bootstrap(document.body);
      const closeIconEl = document.querySelector(".modal-footer .btn");

      closeIconEl.dispatchEvent(new window.MouseEvent("click"));

      assertEqual(document.body.children.length, 0);
    });
  });
});
