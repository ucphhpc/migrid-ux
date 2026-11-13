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
      const makeFakeRes = () => {
        const res = {
          ok: true,
          status: 200,
          text() {
            return Promise.resolve(TEST_SEARCH_ACCOUNT_REQUESTS_RESULT);
          },
        };
        return Promise.resolve(res);
      };
      const fakeFetch = sinon.stub().returns(makeFakeRes());
      const state = createState(AppBase.definition(AccountRequestsApp));
      const instance = new AccountRequestsApp(state, { _fetch: fakeFetch });

      await instance.searchRequest();

      assertTrue(fakeFetch.calledOnce);
      const { queryParams } = fakeFetchParseRequestURL(fakeFetch.lastCall);
      assertEqual(queryParams.get("query"), "");
    });
  });

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
