import { binder } from "../../lib/binding.js";
import { observedValue } from "../../lib/observable.js";
import { createState } from "../../lib/state.js";

class ExampleObserveApp {}

export const App = ExampleObserveApp;

export function bootstrap(root) {
  const definition = {
    who: observedValue("someone"),
  };
  const state = createState(definition);

  binder(root, state);
}
