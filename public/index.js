async function loadAppMarkup(appname, baseUrl) {
  const res = await fetch(`${baseUrl}/apps/${appname}.html`);
  const text = await res.text();

  const bodyIndex = text.indexOf("<body");
  let appHtml = text.slice(
    text.indexOf(">", bodyIndex) + 1,
    text.indexOf("</body>"),
  );

  // remove trailing script
  const scriptIndex = appHtml.indexOf("<script>");
  if (scriptIndex > 1) {
    appHtml = appHtml.slice(0, scriptIndex);
  }

  appHtml = appHtml.trim();

  console.log(`loaded markup: ${appname}`);

  return appHtml;
}

async function loadAppScript(appname, baseUrl) {
  const module = await import(`${baseUrl}/apps/${appname}.js`);

  console.log(`loaded script: ${appname}`);

  return module;
}

function loadAppStyles(appname, baseUrl) {
  loadStylesheet(`${baseUrl}/apps/${appname}.css`);

  console.log(`loaded styles: ${appname}`);
}

function loadStylesheet(stylesheetUrl) {
  const styleEl = document.createElement("LINK");
  styleEl.rel = "stylesheet";
  styleEl.href = stylesheetUrl;
  document.head.appendChild(styleEl);
}

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

  function performAppLoad(appname, rootEl, appOptions) {
    const urlOptions = appOptions.urlOptions || {};
    const baseUrl = urlOptions.baseUrl;

    return Promise.all([
      loadAppMarkup(appname, baseUrl),
      loadAppScript(appname, baseUrl),
      loadAppStyles(appname, baseUrl),
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
