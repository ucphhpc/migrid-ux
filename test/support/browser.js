/*
# --- BEGIN_HEADER ---
#
# browser.js - dual licensed source code file
# Copyright (C) 2025 - 2026  SCIENCE HPC Center at UCPH
#
# This file is part of MiGrid-UX.
#
# MiGrid-UX is free software: you can redistribute it and/or modify it under
# the terms of either
# the MIT License (LICENSES/LICENSE.MIT or https://opensource.org/licenses/MIT)
# OR
# the GNU General Public License version 2 (LICENSES/LICENSE.GPLv2 or
# https://opensource.org/license/gpl-2.0) or any later version
# at your option. The MiGrid-UX files may NOT be copied, modified, or
# distributed except according to those terms.
#
# --- END_HEADER ---
*/

/* globals global */

import { JSDOM } from "jsdom";
import { setMaxListeners } from "node:events";

function defineBrowserGlobals() {
  const jsdom = new JSDOM("<!DOCTYPE html><html></html>");

  global.window = jsdom.window;
  global.document = global.window.document;
  global.Document = JSDOM;
  global.DOMParser = global.window.DOMParser;

  // do not limit listener when running browser code
  setMaxListeners(Infinity);
}

function undefineBrowserGlobals() {
  // reset the listener limit to the node default
  setMaxListeners(10);

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
