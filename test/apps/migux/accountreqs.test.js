import * as sinon from "sinon";

import {
  assertTrue,
  assertFalse,
  assertEqual,
  assertNotEqual,
} from "../../support/assertions.js";
import { browserHooksEach, grabBrowserGlobals } from "../../support/browser.js";
import { parseHtmlFromString } from "../../support/dom.js";
import { loadTextualFixture, loadPublicFile } from "../../support/files.js";
import { AppBase } from "../../../lib/app.js";
import { createNamespacedState as createState } from "../../../lib/state.js";
import { bootstrap, AccountRequestsApp } from "../../../public/apps/migux/accountreqs.js";
import { makeFakeFetch, fakeResponse } from "./fakefetch.js";

const TEST_SEARCH_ACCOUNT_REQUESTS_RESULT = loadTextualFixture(
  "accountreqs/fragment_requested.html",
);


function arrangeAppInstance() {
  const fakeFetch = makeFakeFetch({body: TEST_SEARCH_ACCOUNT_REQUESTS_RESULT})
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

      await instance.searchRequest();

      assertTrue(fakeFetch.calledOnce);
      const queryParams = fakeFetch.getCallQueryArgs(0);
      assertEqual(queryParams.query, "");
    });

    describe("and search state is empty", () => {
      it("should issue a request with empty state", async () => {
        const { instance, fakeFetch, accountRequestsNamespace: namespace } = arrangeAppInstance()
        namespace.search_state("")

        await instance.searchRequest();

        assertTrue(fakeFetch.calledOnce);
        const queryParams = fakeFetch.getCallQueryArgs(0);
        assertEqual(queryParams.state, "");
      })
    })

    describe("and search state is requested", () => {
      it("should issue a request with requested state", async () => {
        const { instance, fakeFetch, accountRequestsNamespace: namespace } = arrangeAppInstance()
        namespace.search_state("requested")

        await instance.searchRequest();

        assertTrue(fakeFetch.calledOnce);
        const queryParams = fakeFetch.getCallQueryArgs(0);
        assertEqual(queryParams.state, "requested");
      })
    })

    describe("and search state is pending", () => {
      it("should issue a request with pending state", async () => {
        const { instance, fakeFetch, accountRequestsNamespace: namespace } = arrangeAppInstance()
        namespace.search_state("pending")

        await instance.searchRequest();

        assertTrue(fakeFetch.calledOnce);
        const queryParams = fakeFetch.getCallQueryArgs(0);
        assertEqual(queryParams.state, "pending");
      })
    })

    describe("and search state is accepted", () => {
      it("should issue a request with accepted state", async () => {
        const { instance, fakeFetch, accountRequestsNamespace: namespace } = arrangeAppInstance()
        namespace.search_state("accepted")

        await instance.searchRequest();

        assertTrue(fakeFetch.calledOnce);
        const queryParams = fakeFetch.getCallQueryArgs(0);
        assertEqual(queryParams.state, "accepted");
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

    it("should show a placeholder with no search", () => {
      bootstrap(document);

      const tbodyEl = document.querySelector('[data-bind-observe="results"]');
      assertEqual(tbodyEl.children.length, 0);
      const placeholderEl = document.querySelector('[data-bind-observe="results_placeholder"]');
      assertNotEqual(placeholderEl, null)
      assertEqual(placeholderEl.style.display, "")
    });

    it("should toggle submitted when searching", async () => {
      const app = bootstrap(document);
      app._fetch = makeFakeFetch({ body: TEST_SEARCH_ACCOUNT_REQUESTS_RESULT });
      const searchRequestSpy = sinon.spy(app, "searchRequest");
      const namespace = app.state.formState("account_requests");

      const queryEl = document.querySelector("#account_requests_query");
      queryEl.value = "foo";
      queryEl.dispatchEvent(new window.InputEvent("input"));
      queryEl.dispatchEvent(new window.KeyboardEvent("keyup", { key: "Enter" }));

      assertTrue(namespace.submitted());

      await searchRequestSpy.returnValues[0]

      assertFalse(namespace.submitted());
    });
  });
});
