import {
  observedValue,
  hookedValue,
  asObservable,
  cloneObserved,
  isObserved,
  isObservedArray,
  isObservedHtml,
  NO_VALUE,
} from "../lib/observable.js";

const _EMPTY_SET = new Set();

const _NAMESPACE_NAME = Symbol("state::namespaceName");

const _FORM_NAMESPACE_PREFIX = "form__";
/**
 * standard observed values to be included in the state backing a form
 */
const _STANDARD_FORM_OBSERVABLES = {
  submitted: false,
};
const _STANDARD_FORM_OBSERVABLES_KEYS = new Set(
  Object.keys(_STANDARD_FORM_OBSERVABLES),
);

function excludingItems(arr, itemsSet) {
  if (arr.length === 0) return arr;
  return arr.filter((item) => !itemsSet.has(item));
}

function hasProperty(obj, property) {
  return Object.prototype.hasOwnProperty.call(obj, property);
}

function isObject(obj) {
  return typeof obj === "object" && obj !== null;
}

function setAddAll(set, items) {
  for (const item of items) {
    set.add(item);
  }
}

function setAddAllIf(set, items, ifFn) {
  for (const item of items) {
    if (ifFn(item)) set.add(item);
  }
}

function withoutKey(obj, key) {
  const clone = Object.assign({}, obj);
  delete clone[key];
  return clone;
}

function _ensureDefaultOptions(options) {
  options = options || {};
  return {
    namespaceOptions: options.namespaceOptions || Object.create(null),
  };
}

function _ensureNamespaceOptions(namespaceOptions, { isForm = false } = {}) {
  const serializeExclude = new Set(namespaceOptions.serializeExclude || []);

  setAddAll(serializeExclude, ["namespace"]);

  if (isForm) {
    setAddAll(serializeExclude, Object.keys(_STANDARD_FORM_OBSERVABLES));
  }

  return {
    serialization: {
      exclude: serializeExclude,
    },
  };
}

function _keysIfPresent(obj) {
  if (!obj) return [];
  return Object.keys(obj);
}

/**
 *
 * @param {*} obj
 * @param {State} state
 * @returns {State}
 */
function _wrapObservableValues(obj, defaults, state) {
  const computeds = new Set();

  const definitionKeys = new Set(_keysIfPresent(obj));
  const defaultsKeys = new Set(_keysIfPresent(defaults));

  for (const key of definitionKeys) {
    let reapplyDefault = false;

    let value = obj[key];
    if (value !== undefined) {
      reapplyDefault = defaultsKeys.has(key);
    } else if (defaultsKeys.has(key)) {
      value = defaults[key];
    }

    if (isObserved(value)) {
      state[key] = value._noClone ? value : cloneObserved(value);
    } else if (typeof value === "function") {
      const computedName = key;
      const computedMaker = value;
      computeds.add([computedName, computedMaker]);
      continue;
    } else {
      state[key] = observedValue(value);
    }

    if (reapplyDefault) {
      state[key](defaults[key]);
    }
  }
  return { state, computeds, valueNamesSet: definitionKeys };
}

function _makeProcessArrayEntry(itemDefinition) {
  return (arrayEntry) => {
    const entryValues = Object.assign({}, itemDefinition, arrayEntry);
    const { state } = _wrapObservableValues(entryValues, null, {});
    return state;
  };
}

function _wrapObservableArrayItemsIfPresent(
  arrayValues,
  namespace,
  namespaceDefaults,
) {
  if (!arrayValues) return;

  for (const [arrayName, arrayDefinition] of Object.entries(arrayValues)) {
    let existingArrayObservable;
    let itemDefinition;

    if (isObservedArray(arrayDefinition)) {
      // the array observable was already cloned by _wrapObservableValues
      // snd attached ot the namespace so use it
      existingArrayObservable = asObservable(namespace[arrayName]);
      itemDefinition = existingArrayObservable.getOption("definition");
    } else {
      existingArrayObservable = null;
      itemDefinition = arrayDefinition;
    }
    const processArrayEntry = _makeProcessArrayEntry(itemDefinition);
    const arrayEntries = namespaceDefaults[arrayName] || [];

    if (existingArrayObservable !== null) {
      existingArrayObservable._options.processValue = (value) => ({
        value: value.map(processArrayEntry),
      });
      namespace[arrayName](arrayEntries);
      continue;
    }

    namespace[arrayName] = hookedValue(arrayEntries, {
      processValue: (value) => ({
        value: value.map(processArrayEntry),
      }),
    });
  }
}

class State {
  constructor(options = null, definition = null) {
    Object.defineProperty(this, "options", {
      value: _ensureDefaultOptions(options),
    });
    Object.defineProperty(this, "definition", {
      value: definition,
    });
    Object.defineProperty(this, "namespaces", {
      value: Object.create(null),
    });
    Object.defineProperty(this, "namespacesOptions", {
      value: Object.create(null),
    });
  }

  get state() {
    return this;
  }

  get forms() {
    const forms = Object.create(null);
    for (const namespaceName of Object.keys(this.namespaces)) {
      if (namespaceName.startsWith("form__")) {
        forms[namespaceName] = this.namespace(namespaceName);
      }
    }
    return forms;
  }

  defaultState(namespace) {
    let namespaceName;
    if (this.isNamespace(namespace)) {
      namespaceName = namespace[_NAMESPACE_NAME];
    } else if (typeof namespace === "string") {
      namespaceName = namespace;
    } else {
      return null;
    }
    return this.definition[namespaceName] || null;
  }

  formState(formName) {
    return this.namespace(`form__${formName}`);
  }

  isFormState(namespace) {
    return new Set(Object.values(this.forms)).has(namespace);
  }

  isNamespace(namespace) {
    return isObject(namespace) && hasProperty(namespace, _NAMESPACE_NAME);
  }

  namespaceObservedToName(observable, namespace) {
    for (const [observableName, currentObservable] of Object.entries(
      namespace,
    )) {
      if (currentObservable === observable) {
        return observableName;
      }
    }
    return null;
  }

  namespaceOrCreate(named) {
    if (!(named in this.namespaces)) {
      const parent = this;

      const namespace = Object.create(null);

      Object.defineProperty(namespace, _NAMESPACE_NAME, { value: named });

      namespace.namespace = (...args) => parent.namespace(...args);

      this.namespaces[named] = namespace;
      if (!this.options.namespaceOptions[named]) {
        this.options.namespaceOptions[named] = Object.create(null);
      }
      this.namespacesOptions[named] = _ensureNamespaceOptions(
        this.options.namespaceOptions[named],
        { isForm: named.startsWith(_FORM_NAMESPACE_PREFIX) },
      );
    }
    return this.namespaces[named];
  }

  namespace(named) {
    if (!(named in this.namespaces)) {
      throw new Error("NONONO");
    }
    return this.namespaces[named];
  }

  serialize() {
    const serialized = Object.create(null);
    for (const namespace of Object.keys(this.namespaces)) {
      serialized[namespace] = this.serializeNamespace(namespace);
    }
    return serialized;
  }

  serializeNamespace(namedOrNamespace) {
    let named;
    let namespace;
    if (typeof namedOrNamespace === "string") {
      named = namedOrNamespace;
      namespace = this.namespaces[named];
    } else if (hasProperty(namedOrNamespace, _NAMESPACE_NAME)) {
      namespace = namedOrNamespace;
      named = namespace[_NAMESPACE_NAME];
    } else {
      throw new Error("NONONO");
    }

    const namespaceOptions = this.namespacesOptions[named];

    const allKeys = Object.keys(namespace);
    const keysToSerialize = excludingItems(
      allKeys,
      namespaceOptions.serialization.exclude,
    );

    const payload = Object.create(null);
    for (const key of keysToSerialize) {
      const observable = namespace[key];
      payload[key] = asObservable(observable).value;
    }
    return payload;
  }

  resetNamespace(namespace) {
    const namespaceDefaults = this.defaultState(namespace);
    const skipKeys = this.isFormState(namespace)
      ? _STANDARD_FORM_OBSERVABLES_KEYS
      : _EMPTY_SET;

    for (const [stateKey, defaultValue] of Object.entries(namespaceDefaults)) {
      if (skipKeys.has(stateKey)) continue;
      if (stateKey.startsWith("_")) continue;
      const valueToSet = defaultValue !== NO_VALUE ? defaultValue : "";
      namespace[stateKey](valueToSet);
    }
  }

  static compatExpose(state) {
    for (const namespace of [state.namespaces.__app__]) {
      for (const namespaceItem of Object.keys(namespace)) {
        if (!isObserved(namespace[namespaceItem])) continue;
        Object.defineProperty(state, namespaceItem, {
          get: () => namespace[namespaceItem],
          enumerable: true,
        });
      }
    }
  }

  static specificDefinitionFromNamespaceDefinition(
    definitionName,
    namespaceSpec,
  ) {
    const arraySpecs = namespaceSpec.__array__ || Object.create(null);
    if (definitionName in arraySpecs) {
      return arraySpecs[definitionName];
    }
    const nonArraySpecs = withoutKey(arraySpecs, "__array__");
    return nonArraySpecs[definitionName];
  }
}

function _createState(definition, defaults, options) {
  defaults = defaults === null ? {} : defaults;
  definition = definition === null ? {} : Object.assign({}, definition);

  //const appDefaults = isNamespaced ? defaults.__app__ : defaults;

  const namespaced = {
    __app__: Object.assign({}, definition.__app__),
    ...withoutKey(definition, "__app__"),
  };

  const computedsByNamespace = new Map();

  const state = new State(options, definition);
  for (const [named, allNamespaceItems] of Object.entries(namespaced)) {
    const namespace = state.namespaceOrCreate(named);
    const namespaceDefaults = defaults[named] || {};

    const namespaceItems = Object.assign({}, allNamespaceItems);

    const arrayValues = {};
    for (const [k, v] of Object.entries(namespaceItems)) {
      if (k === "__array__") {
        Object.assign(arrayValues, v);
      } else if (isObservedArray(v)) {
        arrayValues[k] = v;
      } else {
        continue;
      }
    }

    const { computeds, valueNamesSet } = _wrapObservableValues(
      namespaceItems,
      defaults[named],
      namespace,
    );

    _wrapObservableArrayItemsIfPresent(
      arrayValues,
      namespace,
      namespaceDefaults,
    );

    if (computeds.size > 0) {
      computedsByNamespace.set(namespace, computeds);
    }

    setAddAllIf(
      state.namespacesOptions[named].serialization.exclude,
      valueNamesSet,
      (item) => item.startsWith("_") || isObservedHtml(namespace[item]),
    );
  }

  if (computedsByNamespace.size > 0) {
    for (const [namespace, computeds] of computedsByNamespace) {
      for (const [computedName, computedMaker] of computeds) {
        const computed = computedMaker(state, namespace);
        namespace[computedName] = computed;
      }
    }
  }

  State.compatExpose(state);

  return state;
}

export function createState(appstate, appdefaults = null, appoptions = null) {
  const definition = { __app__: appstate };
  const defaults = { __app__: appdefaults };
  appoptions = appoptions || {};
  const options = {
    namespaceOptions: {
      __app__: {
        serializeExclude: appoptions.serializeExclude || [],
      },
    },
  };
  return _createState(definition, defaults, options);
}

export function createNamespacedState(
  definition,
  defaults = null,
  options = null,
) {
  const prepared = {};

  let formDefinitions = null;

  for (const [k, v] of Object.entries(definition)) {
    if (k === "forms") {
      formDefinitions = v;
      continue;
    }

    if (isObserved(v)) {
      throw new Error(`incorrectly nested state for key: ${k}`);
    }

    prepared[k] = v;
  }

  for (const [k, v] of Object.entries(formDefinitions || {})) {
    const stateKey = `${_FORM_NAMESPACE_PREFIX}${k}`;
    const state = Object.assign({}, v);

    for (const key of Object.keys(_STANDARD_FORM_OBSERVABLES)) {
      state[key] = observedValue(v[key] || _STANDARD_FORM_OBSERVABLES[key]);
    }

    prepared[stateKey] = state;
  }

  return _createState(prepared, defaults, options);
}
