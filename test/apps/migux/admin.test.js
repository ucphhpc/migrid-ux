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
import { bootstrap, AdminApp } from "../../../migux/public/apps/migux/admin.js";

const TEST_SEARCH_ACCOUNT_REQUESTS_RESULT = loadTextualFixture(
  "fragment_account_requests.html",
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

describe("apps/admin", function () {
  browserHooksEach(this);

  it("should allow being closed when there are no submissions", () => {
    const state = createState(AppBase.definition(AdminApp));

    assertFalse(state.namespace("__app__").disable_close());
  });

  describe("when listing account requests", () => {
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
      const state = createState(AppBase.definition(AdminApp));
      const instance = new AdminApp(state, { _fetch: fakeFetch });

      await instance.accountRequestsSearch();

      assertTrue(fakeFetch.calledOnce);
      const { queryParams } = fakeFetchParseRequestURL(fakeFetch.lastCall);
      assertEqual(queryParams.get("query"), "");
    });
  });

  describe("when bound", function () {
    let appHtml;

    before(async () => {
      const appFileHtml = await loadPublicFile("public/apps/migux/admin.html");
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
      rootEl.dataset.migapp = "admin";
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

    describe("server status tab", () => {
      it("should be initially active", () => {
        bootstrap(document.body);
        const serverStatusTabForm = document.querySelector(
          'form[name="server_status"]',
        );

        assertTrue(serverStatusTabForm.classList.contains("TabsPanel--active"));
      });

      describe("server logs", () => {
        it("should perform a search with specified number of lines", () => {
          const app = bootstrap(document.body);
          const makeFakeRes = async () => {
            return {
              ok: true,
              status: 200,
              text: async () => {
                return "";
              },
            };
          };
          const fakeFetch = sinon.stub().returns(makeFakeRes());
          app._fetch = fakeFetch;

          const serverLogsLastLinesInput = document.querySelector(
            'form[name="server_status"] input[name="server_logs_last_lines"]',
          );
          serverLogsLastLinesInput.value = "123";
          serverLogsLastLinesInput.dispatchEvent(
            new window.InputEvent("input", { bubbles: true }),
          );
          serverLogsLastLinesInput.dispatchEvent(
            new window.KeyboardEvent("keyup", { key: "Enter" }),
          );

          assertTrue(fakeFetch.calledOnce);
          const { parsedUrl, queryParams } = fakeFetchParseRequestURL(
            fakeFetch.lastCall,
          );
          assertEqual(parsedUrl.pathname, "/admin/server/logs");
          assertEqual(queryParams.get("last_lines"), "123");
        });
      });
    });

    describe("account requests tab", () => {
      it("should be initially inactive", () => {
        bootstrap(document.body);
        const accountRequestsTabForm = document.querySelector(
          'form[name="account_requests"]',
        );

        assertFalse(
          accountRequestsTabForm.classList.contains("TabsPanel--active"),
        );
      });
    });

    describe("site stats tab", () => {
      it("should be initially inactive", () => {
        bootstrap(document.body);
        const siteStatsTabForm = document.querySelector(
          'form[name="site_stats"]',
        );

        assertFalse(siteStatsTabForm.classList.contains("TabsPanel--active"));
      });
    });
  });
});
