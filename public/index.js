/*
# --- BEGIN_HEADER ---
#
# index.js - dual licensed source code file
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

async function populateAppList(appSelectEl, baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/apps`);
    const appsFragment = await res.text();

    appSelectEl.innerHTML = appsFragment;
  } catch (error) {
    console.error(`An error occurred loading the apps list: ${String(error)}`);
  }
}

(async function (GLOBAL) {
  GLOBAL.APPLICATIONS = GLOBAL.APPLICATIONS || {};

  const apiUrl = "http://localhost:8881";
  const formEl = document.querySelector("form");
  const formSelectEl = formEl.querySelector("select");
  let rootEl = null;

  await import("./migappBootstrap.js");

  function performAppLoad(appname, rootEl, appOptions) {
    const urlOptions = appOptions.urlOptions || {};
    const baseUrl = urlOptions.baseUrl;

    return Promise.all([
      GLOBAL.MiG.loadAppMarkup(appname, baseUrl),
      GLOBAL.MiG.loadAppScript(appname, baseUrl),
      GLOBAL.MiG.loadAppStyles(appname, baseUrl),
    ])
      .then(([htmlString, module]) => {
        const { App } = module;

        rootEl.dataset.migrole = "app";
        rootEl.className = App.name;
        rootEl.innerHTML = htmlString;

        const instance = module.bootstrap(rootEl, appOptions);
        const appRecord = GLOBAL.APPLICATIONS[appname] || {};
        GLOBAL.APPLICATIONS[appname] = appRecord;
        appRecord.instance = instance;
      })
      .catch((error) => {
        console.error(error);
      });
  }

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);

    const appname = data.get("app");
    if (appname === "" || appname === "index") {
      return;
    }

    if (!rootEl) {
      rootEl = document.createElement("div");
      document.body.appendChild(rootEl);
    }

    const urlOptions = {
      apiUrl: `${apiUrl}/api`,
      baseUrl: "",
    };
    performAppLoad(appname, rootEl, { urlOptions });
  });

  populateAppList(formSelectEl, apiUrl);
})(typeof window !== "undefined" ? window : {});
