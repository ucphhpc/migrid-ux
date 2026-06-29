import {
  assertEqual,
  assertIsNot,
  assertKeys,
  assertFalse,
  assertTrue,
  assertValuesEach,
} from "../support/assertions.js";

import {
  asObservable,
  isObserved,
  hookedValue,
  observedHtml,
  observedValue,
  NO_VALUE,
  _valueOfObserved,
} from "../../lib/observable.js";
import { createState, createNamespacedState } from "../../lib/state.js";

function asNullPrototype(obj) {
  return Object.assign(Object.create(null), obj);
}

function namespaceToPlain(namespace) {
  const obj = {};
  for (const [k, v] of Object.entries(namespace)) {
    if (k === "namespace") continue;
    obj[k] = _valueOfObserved(v);
  }
  return obj;
}

describe("state", () => {
  it("should define specified fields", () => {
    const state = createState({
      foo: true,
      bar: 1,
      baz: "foobar",
    });

    assertKeys(state, ["bar", "baz", "foo"]);
    assertValuesEach(state, (value) => isObserved(value));
  });

  it("should define specified fields and apply initial values", () => {
    const definition = {
      foo: "",
      bar: "",
      baz: "",
    };

    const state = createState(definition, {
      foo: "maybe",
      bar: "yes",
      baz: "no",
      noo: "exclude_me",
    });

    assertEqual(namespaceToPlain(state.namespace("__app__")), {
      bar: "yes",
      baz: "no",
      foo: "maybe",
    });
  });

  it("should define namespaced fields", () => {
    const state = createNamespacedState({
      testspace: {
        foo: "maybe",
        bar: "yes",
        baz: "no",
      },
    });

    assertEqual(namespaceToPlain(state.namespace("testspace")), {
      bar: "yes",
      baz: "no",
      foo: "maybe",
    });
  });

  it("should define namespaced fields and apply initial values", () => {
    const state = createNamespacedState(
      {
        testspace: {
          foo: "",
          bar: "",
          baz: "",
        },
      },
      {
        testspace: {
          foo: "maybe",
          bar: "yes",
          baz: "no",
        },
      },
    );

    assertEqual(namespaceToPlain(state.namespace("testspace")), {
      bar: "yes",
      baz: "no",
      foo: "maybe",
    });
  });

  it("should define form namespaces including any default fields", () => {
    const state = createNamespacedState({
      forms: {
        testform: {
          foo: "maybe",
          bar: "yes",
          baz: "no",
        },
      },
    });

    assertEqual(namespaceToPlain(state.formState("testform")), {
      bar: "yes",
      baz: "no",
      foo: "maybe",
      submitted: false,
    });
  });

  it("should define form namespaces preserving the value of any default fields", () => {
    const state = createNamespacedState({
      forms: {
        already_submitted: {
          submitted: true,
        },
      },
    });

    assertEqual(namespaceToPlain(state.formState("already_submitted")), {
      submitted: true,
    });
  });

  describe("when serializing", () => {
    it("should serialize to a plain object with null prototype", () => {
      const state = createState({});

      const seralized = state.serializeNamespace("__app__");

      assertEqual(seralized, asNullPrototype({}));
    });

    it("should serialize given a namespace reference", () => {
      const state = createState({});
      const namespace = state.namespace("__app__");

      const seralized = state.serializeNamespace(namespace);

      assertEqual(seralized, asNullPrototype({}));
    });

    it("should serialize the unpacked values", () => {
      const state = createState({
        foo: true,
        bar: 1,
        baz: "foobar",
      });

      const seralized = state.serializeNamespace("__app__");

      assertEqual(
        seralized,
        asNullPrototype({
          foo: true,
          bar: 1,
          baz: "foobar",
        }),
      );
    });

    it("should serialize a form excluding the standard properties", () => {
      const state = createNamespacedState({
        forms: {
          testform: {
            foo: "maybe",
            bar: "yes",
            baz: "no",
          },
        },
      });
      const namespaceKeys = Object.keys(state.namespace("form__testform"));
      assertTrue(namespaceKeys.includes("submitted"));

      const serialized = state.serializeNamespace("form__testform");

      const serializedKeys = Object.keys(serialized);
      assertFalse(serializedKeys.includes("submitted"));
    });

    it("should allow serializing across all namespaces", () => {
      const state = createNamespacedState({
        __app__: {
          foo: true,
          bar: 1,
          baz: "foobar",
        },
        testspace: {
          foo: "maybe",
          bar: "yes",
          baz: "no",
        },
      });

      const seralized = state.serialize();

      assertEqual(
        seralized,
        asNullPrototype({
          __app__: asNullPrototype({
            foo: true,
            bar: 1,
            baz: "foobar",
          }),
          testspace: asNullPrototype({
            bar: "yes",
            baz: "no",
            foo: "maybe",
          }),
        }),
      );
    });

    describe("with keys excluded", () => {
      it("should allow exclusions at the app level", () => {
        const definition = {
          foo: "maybe",
          bar: "yes",
          baz: "no",
        };
        const state = createState(definition, null, {
          serializeExclude: ["foo"],
        });

        assertEqual(
          state.serialize(),
          asNullPrototype({
            __app__: asNullPrototype({
              bar: "yes",
              baz: "no",
            }),
          }),
        );
      });

      it("should allow exclusions at the namespace level", () => {
        const definition = {
          a_namespace: {
            foo: "maybe",
            bar: "yes",
            baz: "no",
          },
        };
        const state = createNamespacedState(definition, null, {
          namespaceOptions: {
            a_namespace: {
              serializeExclude: ["foo"],
            },
          },
        });

        assertEqual(
          state.serialize(),
          asNullPrototype({
            __app__: asNullPrototype({}),
            a_namespace: asNullPrototype({
              bar: "yes",
              baz: "no",
            }),
          }),
        );
      });
    });

    it("should exclude underscored observables", () => {
      const definition = {
        __app__: {
          foo: "yep",
          _skipme: "hopefully",
        },
      };
      const state = createNamespacedState(definition, null, {});

      assertEqual(
        state.serializeNamespace("__app__"),
        asNullPrototype({
          foo: "yep",
        }),
      );
    });

    it("should exclude html observables", () => {
      const definition = {
        __app__: {
          foo: "yep",
          foohtml: observedHtml(NO_VALUE),
        },
      };
      const state = createNamespacedState(definition, null, {});

      assertEqual(
        state.serializeNamespace("__app__"),
        asNullPrototype({
          foo: "yep",
        }),
      );
    });
  });

  describe("with hooked values", () => {
    function reverseString(str) {
      return [...String(str)].reverse().join("");
    }

    it("should apply the hook to an initial value", () => {
      const definition = {
        always_backwards: hookedValue("spots", {
          processValue: (value) => ({
            value: reverseString(value),
          }),
        }),
      };
      const state = createState(definition);
      const appNamespace = state.namespace("__app__");

      assertEqual(appNamespace.always_backwards(), "stops");
    });

    it("should apply the hook when a value is set", () => {
      const definition = {
        always_backwards: hookedValue(NO_VALUE, {
          processValue: (value) => ({
            value: reverseString(value),
          }),
        }),
      };
      const state = createState(definition);
      const appNamespace = state.namespace("__app__");

      appNamespace.always_backwards("lever");

      assertEqual(appNamespace.always_backwards(), "revel");
    });
  });

  describe("with custom observables", () => {
    it("should preserve the configured observable on state creation", () => {
      const definition = {
        custom: observedValue(undefined, { foo: true }),
      };
      const state = createState(definition);

      const customObservable = asObservable(state.custom);

      assertEqual(customObservable._options, { foo: true });
      assertIsNot(customObservable, definition.custom);
    });
  });

  describe("using arrays", () => {
    it("should define specified fields and apply initial values", () => {
      const definition = {
        __array__: {
          things: {
            checked: false,
          },
        },
      };
      const defaults = {
        things: [{ checked: false }, { checked: true }],
      };

      const state = createState(definition, defaults);

      const appNamespace = state.namespace("__app__");
      const arrayValue = appNamespace.things();
      assertTrue(Array.isArray(arrayValue));
      assertEqual(arrayValue.length, 2);
      assertFalse(arrayValue[0].checked());
      assertTrue(arrayValue[1].checked());
    });

    it("should wrap the items of an array on assignment", () => {
      const definition = {
        __array__: {
          things: {
            checked: false,
          },
        },
      };
      const state = createState(definition);
      const appNamespace = state.namespace("__app__");
      // validate that we start with no array items
      if (appNamespace.things().length !== 0) throw new Error("PRECONDITION");

      appNamespace.things([{ checked: false }, { checked: true }]);

      const arrayValue = appNamespace.things();
      assertTrue(Array.isArray(arrayValue));
      assertEqual(arrayValue.length, 2);
      assertFalse(arrayValue[0].checked());
      assertTrue(arrayValue[1].checked());
    });
  });
});
