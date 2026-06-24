import sinon from "sinon";

import {
  assertEqual,
  assertKeys,
  assertTrue,
  assertFalse,
  assertStringEqual,
} from "../support/assertions.js";
import { browserHooksEach, grabBrowserGlobals } from "../support/browser.js";

import { binder, _Binder } from "../../lib/binding.js";
import { createState, createNamespacedState } from "../../lib/state.js";
import {
  NO_VALUE,
  UNKNOWN_VALUE,
  observedValue,
  observedHtml as htmlValue,
  _observedValueFrom,
  _Observable,
} from "../../lib/observable.js";

function grabElementByTestId(fromElement, testId) {
  return fromElement.querySelector(`[data-testid=${testId}]`);
}

function visitationSpyToElementAndWhetherExcluded(visitationSpy) {
  const resultPairs = [];
  for (let i = 0; i < visitationSpy.callCount; i += 1) {
    const element = visitationSpy.args[i][0];
    const wasExcluded = visitationSpy.returnValues[i];
    resultPairs.push([element, wasExcluded]);
  }
  return resultPairs;
}

class CallMeMaybeApp {
  constructor(state) {
    this.state = state;
    this.args = [];
  }

  callMyMaybe(...args) {
    this.args.push(args);
  }

  callChecker() {
    const app = this;
    return {
      get calledOnce() {
        return app.args.length === 1;
      },
      get firstCall() {
        return app.args[0];
      },
    };
  }
}

describe("binding", function () {
  let window;
  let document;

  function setInputText(inputEl, text) {
    inputEl.value = text;

    inputEl.dispatchEvent(
      new window.Event("input", { bubbles: true, cancelable: true }),
    );
  }

  browserHooksEach(this);

  beforeEach(() => {
    ({ window, document } = grabBrowserGlobals());
  });

  it("should ignore unknown fields", () => {
    document.body.innerHTML = `
<form>
  <input name="some_field" />
  <input name="other_field" />
</form>`;

    const state = createNamespacedState({});

    binder(document.body, state);

    assertKeys(state.namespaces, ["__app__"]);
  });

  it("should bind known fields", () => {
    document.body.innerHTML = `
    <form name="a_form" data-bind-form="DEFINED">
      <input name="some_field" data-bind-observe="some_field" />
      <input name="other_field" data-bind-observe="other_field" />
    </form>`;
    const someFieldEl = document.querySelector('input[name="some_field"]');
    const otherFieldEl = document.querySelector('input[name="other_field"]');
    const state = createNamespacedState({
      forms: {
        a_form: {
          some_field: observedValue("abcd"),
          other_field: observedValue("efgh"),
        },
      },
    });

    binder(document.body, state);

    assertEqual(someFieldEl.value, "abcd");
    assertEqual(otherFieldEl.value, "efgh");
  });

  it("should update fields when observable changes", () => {
    document.body.innerHTML = `
    <form name="testform" data-bind-form="DEFINED">
      <input name="some_field" data-bind-observe="some_field" />
      <input name="other_field" data-bind-observe="other_field" />
    </form>`;
    const someFieldEl = document.querySelector('input[name="some_field"]');
    const appState = createNamespacedState({
      forms: {
        testform: {
          some_field: observedValue(),
          other_field: observedValue(),
        },
      },
    });
    binder(document.body, appState);

    // update state of relevant text input
    appState.formState("testform").some_field("hello user");

    assertEqual(someFieldEl.value, "hello user");
  });

  it("should update observables when fields change", () => {
    document.body.innerHTML = `
    <form name="testform" data-bind-form="DEFINED">
      <input name="some_field" data-bind-observe="some_field" />
      <input name="other_field" data-bind-observe="other_field" />
    </form>`;
    const someFieldEl = document.querySelector('input[name="some_field"]');
    const appState = createNamespacedState({
      forms: {
        testform: {
          some_field: observedValue(),
          other_field: observedValue(),
        },
      },
    });
    binder(document.body, appState);

    // input some text
    setInputText(someFieldEl, "hello user");

    const state = appState.formState("testform");
    assertEqual(state.some_field(), "hello user");
    assertStringEqual(state.other_field(), "");
  });

  it("should support binding to any object having a state property", () => {
    document.body.innerHTML = `
    <form name="testform" data-bind-form="DEFINED">
      <input name="some_field" />
      <input name="other_field" />
    </form>`;
    const someFieldEl = document.querySelector('input[name="some_field"]');
    const appState = createNamespacedState({
      forms: {
        testform: {
          some_field: observedValue(),
          other_field: observedValue(),
        },
      },
    });
    const objectWithStateProperty = {
      state: appState,
      namespace(...args) {
        return appState.namespace(...args);
      },
    };
    binder(document.body, objectWithStateProperty);

    // input some text
    setInputText(someFieldEl, "hello user");

    const state = appState.formState("testform");
    assertEqual(state.some_field(), "hello user");
    assertStringEqual(state.other_field(), "");
  });

  it("should support binding a group of radio buttons", () => {
    document.body.innerHTML = `
    <form name="testform" data-bind-form="DEFINED">
      <input type="radio" name="a_radio" value="foo" />
      <input type="radio" name="a_radio" value="bar" />
      <input type="radio" name="a_radio" value="baz" />
    </form>`;
    const appState = createNamespacedState({
      forms: {
        testform: {
          a_radio: observedValue(),
        },
      },
    });
    const radioEls = document.querySelectorAll('input[name="a_radio"]');
    binder(document.body, appState);

    const radioElValues = Array.from(radioEls).map((el) => el.value);

    assertEqual(radioElValues, ["foo", "bar", "baz"]);
  });

  describe("when explicitly observing", () => {
    it("should support a value <span>", () => {
      document.body.innerHTML = `
    <span data-bind-observe="a_field">`;
      const spanEl = document.querySelectorAll("span")[0];
      const state = createState({
        a_field: "",
      });

      binder(document.body, { state });

      // input some text
      state.a_field("here be a value");

      assertEqual(
        spanEl.outerHTML,
        '<span data-bind-observe="a_field">here be a value</span>',
      );
    });

    it("should support a value <tbody>", () => {
      document.body.innerHTML = `
    <table>
      <tbody data-bind-observe="a_field"></tbody>
    </table>`;
      const tbody = document.querySelectorAll("tbody")[0];
      const state = createState({
        a_field: "",
      });

      binder(document.body, { state });

      // input some text
      state.a_field("here be a value");

      assertEqual(
        tbody.outerHTML,
        '<tbody data-bind-observe="a_field">here be a value</tbody>',
      );
    });
  });

  describe("when binding forms", () => {
    it("should support explicit checked bind", () => {
      document.body.innerHTML = `
    <form name="a_form" data-bind-form="DEFINED">
      <input name="a_field" data-bind-checked="some_field" checked />
    </form>`;
      const state = createNamespacedState({
        forms: {
          a_form: {
            some_field: observedValue(),
          },
        },
      });

      binder(document.body, state);

      const namspace = state.namespace("form__a_form");
      assertEqual(namspace.some_field(), true);
    });

    it("should support explicit disabled bind", () => {
      document.body.innerHTML = `
    <form name="a_form" data-bind-form="DEFINED">
      <input name="a_field" data-bind-disabled="some_field" disabled />
    </form>`;
      const state = createNamespacedState({
        forms: {
          a_form: {
            some_field: observedValue(),
          },
        },
      });

      binder(document.body, state);

      const namspace = state.namespace("form__a_form");
      assertEqual(namspace.some_field(), true);
    });

    it("should not break binding a field inside a form not bound but in state", () => {
      document.body.innerHTML = `
      <form name="a_form">
        <span data-bind-observe="no_such_field"></span>
      </form>`;
      const state = createNamespacedState({
        forms: {
          a_form: {},
        },
      });

      try {
        binder(document.body, state);
      } catch {
        assertFalse(true, "should not be reached");
      }
    });

    it("should ignore forms entirely if no corresponding element is found", () => {
      document.body.innerHTML = `
      <span>no form to be found 'ere</span>`;
      const state = createNamespacedState({
        forms: {
          a_form: {},
        },
      });

      try {
        binder(document.body, state);
      } catch {
        assertFalse(true, "should not be reached");
      }
    });
  });

  describe("when binding html", () => {
    it("should set the element inner html based on the observable", () => {
      document.body.innerHTML = `
<table data-test-id="some-example-table" data-bind-observe="htmldata">
</table>`;
      const state = createState({
        htmldata: htmlValue(NO_VALUE, {
          select: "tbody",
        }),
      });
      const tableEl = document.body.querySelectorAll(
        '[data-test-id="some-example-table"]',
      )[0];

      binder(document.body, { state });

      state.htmldata("<table><tr><td>NEW ROW</td></tr></table>");

      assertEqual(
        tableEl.outerHTML,
        '<table data-test-id="some-example-table" data-bind-observe="htmldata"><tbody><tr><td>NEW ROW</td></tr></tbody></table>',
      );
    });

    it("should return a result of decoding the markup on html value change", () => {
      document.body.innerHTML = `
<table data-test-id="some-example-table" data-bind-observe="htmldata">
</table>`;
      const state = createState({
        htmldata: htmlValue(NO_VALUE, {
          select: "tbody",
          decodeHtml: (subtreeEl) => {
            const rowCount = subtreeEl.querySelectorAll("tr").length;
            return { rowCount };
          },
        }),
      });

      binder(document.body, { state });

      const result = state.htmldata("<table><tr><td>NEW ROW</td></tr></table>");

      assertEqual(result.rowCount, 1);
    });
  });

  describe("when binding arrays", () => {
    it("should support binding an element that already contains children", () => {
      document.body.innerHTML = `
<table data-bind-array="example_items" data-bind-array-each="tr">
  <tr>
    <td>
      <input type="checkbox" data-bind-checked="present" checked>
    </td>
  </tr>
  <tr>
    <td>
      <input type="checkbox" data-bind-checked="present">
    </td>
  </tr>
</table>
      `;
      const state = createState({
        __array__: {
          example_items: {
            present: false,
          },
        },
      });
      // ensure there are state rows
      state.example_items([{ present: NO_VALUE }, { present: NO_VALUE }]);

      binder(document.body, { state });

      // state was populated with values from the HTML
      const items = state.example_items();
      assertTrue(items[0].present());
      assertFalse(items[1].present());
    });

    it("should process bindings declared for each array item only once", () => {
      document.body.innerHTML = `
<table data-bind-array="example_items" data-bind-array-each="tr">
  <tr>
    <td>
      <input data-testid="checkbox1" type="checkbox" checked="checked" data-bind-checked="present">
    </td>
  </tr>
  <tr>
    <td>
      <input data-testid="checkbox2" type="checkbox" data-bind-checked="present">
    </td>
  </tr>
</table>
      `;
      const state = createState({
        __array__: {
          example_items: {
            present: false,
          },
        },
      });
      const checkbox1El = grabElementByTestId(document.body, "checkbox1");
      const checkbox2El = grabElementByTestId(document.body, "checkbox2");

      // ensure there are state rows
      state.example_items([{ present: NO_VALUE }, { present: NO_VALUE }]);
      const binder = new _Binder({ state }, document.body);

      // The two <input> elements that must be bound to items within the array
      // will be visited, each, twice - once when the array is visited and its
      // "each" rows are iterated, while the second time will be when when the
      // binder attempts to iterate over any explicit individual bindings.
      //
      // The intent of the logic is that the second pass does no rebinding
      // and instead simply ignores them by virtue of that subtree having been
      // previously visited. Since everything is gated on chking whether the
      // element is excluded, we can can verify correct behaviour by checking

      // . Since this is
      // gated by recording elements as having been visited, we check that the first
      // two visitations returned processing was neeed while the second do not.
      const visitationSpy = sinon.spy(
        binder.elementFinder,
        "elementIsWithinExcludedSubtree",
      );

      // now bind the elements (here triggered by hand)
      binder.processElement(binder.rootElement, state.namespace("__app__"));

      // - an attempt to reprocess the table itself is tried given it is maked
      //   by data-bind-observe but it is ignored given it was processed by the
      //   logic for handling elements marked data-bind-array
      const elementIdentityAndExclusionPairs =
        visitationSpyToElementAndWhetherExcluded(visitationSpy);

      assertEqual(elementIdentityAndExclusionPairs, [
        [checkbox1El, false],
        [checkbox2El, false],
        [checkbox1El, true],
        [checkbox2El, true],
      ]);
    });
  });

  describe("when binding css", () => {
    it("should not set a class if the expression evaluates false", () => {
      document.body.innerHTML = `
<span
  data-testid="span-to-verify"
  data-bind-css="MagicZeroCssClass: $() === 0"
  data-bind-css-watch="magic_number"
  ></span>`.trimStart();
      const state = createNamespacedState({
        __app__: {
          magic_number: 1,
        },
      });

      binder(document.body, state);

      const spanEl = grabElementByTestId(document.body, "span-to-verify");
      assertEqual(spanEl.className, "");
    });

    it("should set a class if the expression evaluates true", () => {
      document.body.innerHTML = `
<span
  data-testid="span-to-verify"
  data-bind-css="{ MagicZeroCssClass: $() === 0 }"
  data-bind-css-watch="magic_number"
  ></span>`.trimStart();
      const state = createNamespacedState({
        __app__: {
          magic_number: 0,
        },
      });

      binder(document.body, state);

      const spanEl = grabElementByTestId(document.body, "span-to-verify");
      assertEqual(spanEl.className, "MagicZeroCssClass");
    });

    it("should set a class for each expression that evaluates true", () => {
      document.body.innerHTML = `
<span
  data-testid="span-to-verify"
  data-bind-css="{ MagicZeroCssClass--soclose: $() === 1, MagicZeroCssClass--gettingthere: $() <= 2 }"
  data-bind-css-watch="magic_number"
  ></span>`.trimStart();
      const state = createNamespacedState({
        __app__: {
          magic_number: 1,
        },
      });

      binder(document.body, state);

      const spanEl = grabElementByTestId(document.body, "span-to-verify");
      assertEqual(
        spanEl.className,
        "MagicZeroCssClass--soclose MagicZeroCssClass--gettingthere",
      );
    });

    it("should update classes when the observable is changed", () => {
      document.body.innerHTML = `
<span
  data-testid="span-to-verify"
  data-bind-css="{ MagicZeroCssClass--soclose: $() === 1, MagicZeroCssClass--gettingthere: $() <= 2 }"
  data-bind-css-watch="magic_number"
  ></span>`.trimStart();
      const state = createNamespacedState({
        __app__: {
          magic_number: 2,
        },
      });

      binder(document.body, state);

      const appNamespace = state.namespace("__app__");
      appNamespace.magic_number(2);

      const spanEl = grabElementByTestId(document.body, "span-to-verify");
      assertEqual(spanEl.className, "MagicZeroCssClass--gettingthere");
    });

    it("should not set a class if the expression is invalid", () => {
      document.body.innerHTML = `
<span
  data-testid="span-to-verify"
  data-bind-css="{ MagicZeroCssClass: $() <> 1 }"
  data-bind-css-watch="magic_number"
  ></span>`.trimStart();
      const state = createNamespacedState({
        __app__: {
          magic_number: 0,
        },
      });

      binder(document.body, state);

      const appNamespace = state.namespace("__app__");
      appNamespace.magic_number(2);

      const spanEl = grabElementByTestId(document.body, "span-to-verify");
      assertEqual(spanEl.className, "");
    });
  });

  describe("with checkbox elements", () => {
    it("should support explicitly binding checked", () => {
      document.body.innerHTML = `
<input type="checkbox" data-bind-checked="checkme" />`;
      const state = createState({
        checkme: true,
      });
      const inputEl = document.body.querySelectorAll("input")[0];

      binder(document.body, { state });

      assertTrue(inputEl.checked);
    });

    it("should update the observable when the element is checked", () => {
      document.body.innerHTML = `
<input type="checkbox" data-bind-checked="test_checkbox_checked" />`;
      const state = createState({
        test_checkbox_checked: true,
      });
      const inputEl = document.body.querySelectorAll("input")[0];
      binder(document.body, { state });
      assertTrue(inputEl.checked);

      // act: click the checkbox
      const clickEvent = new window.MouseEvent("click");
      inputEl.dispatchEvent(clickEvent);

      assertFalse(state.test_checkbox_checked());
    });
  });

  describe("with disabled elements", () => {
    it("should support explicitly binding disabled", () => {
      document.body.innerHTML = `
<input data-bind-disabled="disableme" />`;
      const state = createState({
        disableme: true,
      });
      const inputEl = document.body.querySelectorAll("input")[0];

      binder(document.body, { state });

      assertTrue(inputEl.disabled);
    });

    it("should assign the disabled state to an unset observable", () => {
      document.body.innerHTML = `
<input disabled data-bind-checked="checkme" />`;
      const state = createState({
        checkme: false,
      });
      const inputEl = document.body.querySelectorAll("input")[0];

      binder(document.body, { state });

      assertTrue(inputEl.disabled);
    });
  });

  describe("with change events", () => {
    it("should allow specifying handler to be called", () => {
      document.body.innerHTML = `
<form name="testform" data-bind-form="DEFINED">
  <input data-testid="checkbox-input" data-bind-checked="checkme" data-bind-onchange="callMyMaybe" />
</form>
`;
      const state = createNamespacedState({
        forms: {
          testform: {
            checkme: "someone",
          },
        },
      });
      const app = new CallMeMaybeApp(state);
      const checkmeObserved = app.state.formState("testform").checkme;

      binder(document.body, app);

      // click the checkbox
      const inputEl = grabElementByTestId(document.body, "checkbox-input");
      inputEl.dispatchEvent(new window.MouseEvent("click"));

      const handler = app.callChecker();
      assertTrue(handler.calledOnce);
      assertEqual(handler.firstCall, [
        { value: false },
        state.formState("testform"),
        inputEl,
        checkmeObserved,
      ]);
    });
  });

  describe("with click events", () => {
    it("should allow specifying the handler to be called", () => {
      document.body.innerHTML = `
      <form name="testform" data-bind-form="DEFINED">
        <input data-testid="onclick-input" data-bind-onclick="callMyMaybe" />
      </form>
      `;
      const inputEl = document.querySelectorAll("input")[0];
      const state = createNamespacedState({
        forms: {
          testform: {
            whatever: "someone",
          },
        },
      });
      const app = new CallMeMaybeApp(state);

      binder(document.body, app);

      // input some text
      const clickEvent = new window.MouseEvent("click");
      inputEl.dispatchEvent(clickEvent);

      const handler = app.callChecker();
      assertTrue(handler.calledOnce);
      assertEqual(handler.firstCall, [
        { value: UNKNOWN_VALUE },
        state.formState("testform"),
        grabElementByTestId(document.body, "onclick-input"),
      ]);
    });

    it("should allow calling the handler with an additional argument", () => {
      document.body.innerHTML = `
      <form name="testform" data-bind-form="DEFINED">
        <input data-testid="onclick-input" data-bind-onclick="callMyMaybe" data-bind-onclick-argument="perhaps" />
      </form>
      `;
      const inputEl = document.querySelectorAll("input")[0];
      const state = createNamespacedState({
        forms: {
          testform: {
            whatever: "someone",
          },
        },
      });
      const app = new CallMeMaybeApp(state);

      binder(document.body, app);

      // input some text
      const clickEvent = new window.MouseEvent("click");
      inputEl.dispatchEvent(clickEvent);

      const handler = app.callChecker();
      assertTrue(handler.calledOnce);
      assertEqual(handler.firstCall, [
        { value: UNKNOWN_VALUE },
        state.formState("testform"),
        grabElementByTestId(document.body, "onclick-input"),
        "perhaps",
      ]);
    });
  });

  describe("with keyboard events", () => {
    it("should allow specifying handler to be called", () => {
      document.body.innerHTML = `
<form name="testform" data-bind-form="DEFINED">
  <input data-testid="onenter-input" data-bind-observe="whatever" data-bind-onenter="callMyMaybe" />
</form>
`;
      const inputEl = document.querySelectorAll("input")[0];
      const state = createNamespacedState({
        forms: {
          testform: {
            whatever: "someone",
          },
        },
      });
      const app = new CallMeMaybeApp(state);

      binder(document.body, app);

      // input some text
      const keyboardEvent = new window.KeyboardEvent("keyup", { key: "Enter" });
      inputEl.dispatchEvent(keyboardEvent);

      const handler = app.callChecker();
      assertTrue(handler.calledOnce);
      assertEqual(handler.firstCall, [
        { value: "someone" },
        state.formState("testform"),
        grabElementByTestId(document.body, "onenter-input"),
      ]);
    });
  });

  describe("when being destroyed", () => {
    class InstrumentedObservable extends _Observable {
      constructor(...args) {
        super(...args);
        this.listernerCount = 0;
      }

      addEventListener(...args) {
        super.addEventListener(...args);
        this.listernerCount += 1;
      }

      removeEventListener(...args) {
        super.removeEventListener(...args);
        this.listernerCount -= 1;
      }
    }

    function makeInstrumentedObserved() {
      const observable = new InstrumentedObservable(NO_VALUE, null);
      const observed = _observedValueFrom(observable);
      observed._noClone = true;
      observed._observable = observable;
      return observed;
    }

    /**
     * @type {_Binder}
     */
    let b;
    let someFieldObserved;
    let otherFieldObserved;

    beforeEach(() => {
      document.body.innerHTML = `
      <form name="a_form" data-bind-form="DEFINED">
        <input name="some_field" data-bind-observe="some_field" />
        <input name="other_field" data-bind-observe="other_field" />
      </form>`;
      someFieldObserved = makeInstrumentedObserved();
      otherFieldObserved = makeInstrumentedObserved();
      const state = createNamespacedState({
        forms: {
          a_form: {
            some_field: someFieldObserved,
            other_field: otherFieldObserved,
          },
        },
      });

      b = binder(document.body, { state });
    });

    it("should remove listeners attached to observables", () => {
      assertEqual(someFieldObserved._observable.listernerCount, 1);
      assertEqual(someFieldObserved._observable.listernerCount, 1);

      b.destroy();

      assertEqual(someFieldObserved._observable.listernerCount, 0);
      assertEqual(someFieldObserved._observable.listernerCount, 0);
    });
  });
});
