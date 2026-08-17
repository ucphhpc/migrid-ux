/*
# --- BEGIN_HEADER ---
#
# state.test.js - dual licensed source code file
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
  observedArray,
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
    // The definition also sets the initial value if no matching
    // defaults are given
    assertTrue(state.foo());
    assertEqual(state.bar(), 1);
    assertEqual(state.baz(), "foobar");
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
    it("basic observable state change", () => {
      const definition = {
        custom: observedValue(false),
      };
      const state = createState(definition);
      assertFalse(state.custom());
      state.custom(true);
      assertTrue(state.custom());
    });

    it("should preserve the configured observable on state creation", () => {
      const definition = {
        custom: observedValue(undefined, { foo: true }),
      };
      const state = createState(definition);
      const customObservable = asObservable(state.custom);

      assertEqual(customObservable._options, { foo: true });
      assertIsNot(customObservable, definition.custom);
      assertTrue(customObservable.getOption("foo"));
    });

    it("should do correct state change with default values", () => {
      const definition = {
        custom: observedValue(undefined, { active: false, disabled: true }),
      };
      const defaults = {
        custom: { active: true, disabled: false },
      };
      const state = createState(definition, defaults);
      const customObservable = asObservable(state.custom);

      assertTrue(customObservable.value.active);
      assertFalse(customObservable.value.disabled);
    });
  });

  describe("using arrays", () => {
    it("should define specified fields and apply initial values", () => {
      const definition = {
        __array__: {
          things: {
            checked: true,
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
      // __array__ is a special keyword identifier when creating
      // a state to assign its contained key/values during constructor
      const definition = {
        __array__: {
          things: {},
        },
      };

      const state = createState(definition);
      const appNamespace = state.namespace("__app__");
      // validate that we start with no array items
      // since the definition only sets the provided keys
      if (appNamespace.things().length !== 0) throw new Error("PRECONDITION");

      appNamespace.things([{ checked: false }, { checked: true }]);

      const arrayValue = appNamespace.things();
      assertTrue(Array.isArray(arrayValue));
      assertEqual(arrayValue.length, 2);
      assertFalse(arrayValue[0].checked());
      assertTrue(arrayValue[1].checked());
    });

    it("using ArrayObservable to create the state array items with defaults", () => {
      const definition = {
        things: observedArray(NO_VALUE, {}),
      };

      const defaults = {
        things: [{ checked: true }, { checked: false }],
      };
      const state = createState(definition, defaults);
      const appNamespace = state.namespace("__app__");
      // validate that the ArrayObservable is created as expected
      const arrayValue = appNamespace.things();
      assertTrue(Array.isArray(arrayValue));
      assertEqual(arrayValue.length, 2);
      assertTrue(arrayValue[0].checked());
      assertFalse(arrayValue[1].checked());
    });

    it("using ArrayObservable to create the state array items without defaults", () => {
      const definition = {
        things: observedArray(NO_VALUE, {}),
      };

      const state = createState(definition);
      const appNamespace = state.namespace("__app__");
      // Since we only pass a definition, no array values are populated
      if (appNamespace.things().length !== 0) throw new Error("PRECONDITION");

      // Populate the defined array observable
      appNamespace.things([{ checked: true }, { checked: false }]);

      const arrayValue = appNamespace.things();
      assertTrue(Array.isArray(arrayValue));
      assertEqual(arrayValue.length, 2);
      assertTrue(arrayValue[0].checked());
      assertFalse(arrayValue[1].checked());
    });
  });
});
