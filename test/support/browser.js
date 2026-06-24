/* globals global */

import { JSDOM } from "jsdom";

function defineBrowserGlobals() {
  const jsdom = new JSDOM("<!DOCTYPE html><html></html>");

  global.window = jsdom.window;
  global.document = global.window.document;
  global.Document = JSDOM;
  global.DOMParser = global.window.DOMParser;
}

function undefineBrowserGlobals() {
  delete global.window;
  delete global.document;
  delete global.Document;
  delete global.DOMParser;
}

export function browserHooksEach(suite) {
  if (global.window !== undefined) {
    throw new Error("browser globals nesting is disallowed");
  }

  suite.beforeEach(defineBrowserGlobals);
  suite.afterEach(undefineBrowserGlobals);
}

export function grabBrowserGlobals() {
  if (global.window === undefined) {
    throw new Error("browser globals have not been defined");
  }

  return {
    window: global.window,
    document: global.document,
  };
}
