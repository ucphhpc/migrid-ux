import { binder } from "../../lib/binding.js";
import { NO_VALUE, observedArray } from "../../lib/observable.js";
import { createNamespacedState as createState } from "../../lib/state.js";

const _DEFINITION = Symbol("DEFINITION");

export class ExampleArraysApp {
  constructor(state) {
    this.state = state;
  }

  static definition() {
    return this[_DEFINITION];
  }
}

export const App = ExampleArraysApp;

(function () {
  ExampleArraysApp[_DEFINITION] = {
    __app__: {
      example_items: observedArray(NO_VALUE, {
        definition: {
          present: false,
        },
        decodeHtml: (arrayItemEls) => {
          const trEls = Array.from(arrayItemEls);
          const arrayItems = trEls.map((trEl) => {
            const checkboxEl = trEl.querySelector('input[type="checkbox"]');
            return { present: checkboxEl.checked };
          });
          return { arrayItems };
        },
        updateState: (decodeResult, state) => {
          state.example_items(decodeResult.example_items);
        },
      }),
    },
    /*
    forms: {
      search_accepted: {
        count: -1,
        query: "",
        results: observedHtml("", {
          select: "tbody",
          decodeHtml: (subtreeEl) => {
            const rowCount = subtreeEl.querySelectorAll("tr").length;
            return { rowCount };
          },
        }),
      },
      peers_requested: {
        peers_request_label: "",
      },
      peers_add: {
        peers_add_label: "",
      },
      peers_import: {},
    },
    */
  };
})();

export function bootstrap(root) {
  const definition = ExampleArraysApp.definition();
  const state = createState(definition);
  const app = new ExampleArraysApp(state);

  state.example_items([
    {
      present: true,
    },
    {
      present: false,
    },
  ]);

  binder(root, app);

  return app;
}
