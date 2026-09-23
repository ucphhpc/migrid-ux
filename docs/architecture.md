# Architecture

This repository contains a small browser runtime, a series of small web
applications built on top of it, and a fake development backend. An
application is HTML markup bound to an observable-based state (in the spirit
of Knockout https://knockoutjs.com), with dynamic content delivered as server-rendered HTML fragments. See the [developer guide](developer.md)
for environment setup, the Make targets, and the CI overview.

## Layout

The architecture is defined by a set of browser runtime components that can be used to build dynamic web applications.
These components include the javascript files contained in the `lib` directory.
Namely:

- `app.js` — the general `AppBase` class and request handling
- `binding.js` — the DOM binding
- `observable.js` — the observable value primitives
- `state.js` — the state construction

Most users will only need to interact with the `state.js` and `observable.js` files. The reason being that these files contains helper functions to manage the current state of an application, such as `resetNamespace` to reset a namespace or `formState` to retrieve a particular form from a namespace. The `observable.js` on the other hand contains various `Observable` classes that can be usedful when defining which state attributes in your app definition should be observed and thereby dynamically handled.

The `app.js` is mostly useful for the initial application state definition, where often the application class is extended by the common AppBase. In addition it defines a set of common contants such as `APP_COMPONENTS` and `APP_DEFINITION` that are used to define the application components and the application definition itself.

Examples for this can be seen in the `public/apps/migux/peers.js` file, where the `PeersApp` class is defined as an extension of the `AppBase` class.

Finally, the `binding.js` file is used to define functions that help establishing the bind between the application state and the DOM. These functions will typically not be used directly when defining an application, but are rather utilized by the `AppBase` class and the general `bootstrap` function in `app.js` to establish this link during the initialisation.


## How an application is introduced

### Defining the application

Any additional introduced application is expected to create its resource files in the `public/apps/migux` directory.

#### Javascript foundation

When establishing a new application, the first thing to do is to define the application class and the application definition. This is done by creating a new javascript file in the `public/apps/migux` directory. This filename must match the expected application name as it is used to be loaded by the general `loadAppScript` function in `public/migappBootstrap.js` at runtime.

To establish the application class and definition a set of expected structures must be created. For instance if you want to introduce a Profile app, a first thing to do is to create the `public/apps/migux/profile.js` file and add the following code to it:

```js
import { AppBase, APP_DEFINITION } from "../../lib/app.js";
import { observedValue } from "../../lib/observable.js";

export class ProfileApp extends AppBase {
  constructor(state, options) {
    super(state, options);
  }

  onDestroy() {
    // Any cleanup that should be done when the app is destroyed
  }

  onInitialize() {
    // Any state that should be initialized when the app is loaded
  }
}

// Required by performAppLoad to identify the application class
export const App = ProfileApp;

(function () {
  ProfileApp[APP_DEFINITION] = {
    __app__: {
      // The ProfileApp global namespace
    }
    // Any additional custom namespaces
    // will be added here
  };
})();
```

This puts in the required foundational ProfileApp class, the export, and the definition. You should note that every application class is expected to a general default/global namespace called `__app__` as part of their definition.

After this, the general bootstrap function for initialize the application should be defined in the same file following the above block.

```js
export function bootstrap(root, options = {}) {
  return AppBase.bootstrap(ProfileApp, root, options);
}
```
If you want to add any serialization for data persitency, see the `public/apps/migux/peers.js` file for an example.

Any new application must define and export the `bootstrap` function in their Javascript source file. The reason for this is that this function is used by the `migappBootstrap` function to load the application via the `performAppLoad` call when a user selects to launch the application in their browser. The application instance returned from this is then stored in the general `window.MiG.applications` object.

After the basic Javascript infrastructure is implemented, the next step is to define the application's HTML and CSS.


#### Defining the application's HTML and CSS

As with the Javascript foundation, the application's HTML and CSS should be defined in the `public/apps/migux` directory that matches the application name. Following the profile example this would mean the creation of the `profile.html` and `profile.css` files.

In terms of structure, the `migrid-ux` architecture expects that the HTML file defines a regular `body` that defines the `data-migrole="app"` and `data-migapp="profile"` attributes. After this is achived, the internal `body` structure can be defined as required by the application itself, with the ability to use the `data-bind-*` attributes to bind the application's state to the HTML elements and their events.

```html
<!doctype html>
<html>
    <head>
        <title>apps/profile</title>
    </head>

    <body data-migrole="app" data-migapp="profile">
        <h1>Profile</h1>
        <p>This is the profile page</p>
    </body>
</html>
```

For CSS, we use the SCSS preprocessor to define the application's styles. The CSS file should be defined in the `src/apps` directory and should be named after the application name. For the profile example, this would mean the creation of the `profile.scss` file in the `src/apps` directory. After

After the appropriate styles are defined in the mentioned SCSS file, the file should be added as an entry to the `Makefile` `build-css` target.

```Makefile
.PHONY: build-css
build-css: ./envhelp/local.depends
	@$(NPM_BIN) exec -- sass --quiet \
		./src/apps/profile.scss:./public/apps/migux/profile.css
```

This will ensure that the CSS file is built and placed in the expected `public/apps/migux` directory where it is required to be present when `mig-ux` tries to load the associated stylesheets via the `loadAppStyles` call in the `performAppLoad` function.


#### Putting it all together

After having completed the above steps in creating the 3 required files and generating the associated CSS, the application should be ready to be used for local development and iteration. The application can then be launched by executing the `make local` target, which will start the `migrid-ux` development server at `http://localhost:8080` and include the profile application in the default menu.
