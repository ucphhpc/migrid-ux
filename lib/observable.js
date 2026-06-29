const _OBSERVABLE = Symbol("OBSERVABLE");
const _NONE = Object.assign(Object.create(null), {
  toString() {
    return "";
  },
});
const _UNKNOWN = Object.assign(Object.create(null), {
  toString() {
    return "";
  },
});

class _Detail {
  constructor(observable, previousValue) {
    this[_OBSERVABLE] = observable;
    this.previousValue = previousValue;
  }

  get observable() {
    return this[_OBSERVABLE];
  }

  get value() {
    return this[_OBSERVABLE]._value;
  }
}

class Observable extends EventTarget {
  constructor(firstValue = _NONE, options = null) {
    super();
    this._value = firstValue;
    this._options = options;
  }

  get value() {
    if (this._value === _NONE) {
      return undefined;
    } else {
      return this._value;
    }
  }

  _addEventListenerSilent(event, listener) {
    super.addEventListener(event, listener);
  }

  addEventListener(event, listener) {
    super.addEventListener(event, listener);
    const detail = new _Detail(this, this._value);
    listener(new CustomEvent("change", { detail }));
  }

  clone() {
    const Observable = this.constructor;
    //Object.defineProperty(options, _CLONE, { value: _CLONE });
    return new Observable(this._value, { ...this._options });
  }

  getOption(optionName) {
    if (!this._options) return undefined;
    return this._options[optionName];
  }

  setValue(newValue) {
    if (this._value === newValue) return;
    const previousValue = this._value;
    this._value = newValue;
    const detail = new _Detail(this, previousValue);
    this.dispatchEvent(new CustomEvent("change", { detail }));
  }

  static _toRawValue(observable) {
    return observable._value;
  }
}

export const _Observable = Observable;

class ComputedObservable extends Observable {
  constructor(compute, allObserved) {
    super();

    this._compute = compute;
    this._watchedObservables = allObserved.map(asObservable);

    this._value = this._recomputeOnly();

    for (const observable of this._watchedObservables) {
      observable._addEventListenerSilent("change", () => this._recompute());
    }
  }

  _recompute() {
    const newValue = this._recomputeOnly();
    if (this._value !== newValue) {
      this.setValue(newValue);
    }
  }

  _recomputeOnly() {
    return this._compute(this._watchedObservables.map(Observable._toRawValue));
  }
}

class HookedObservable extends Observable {
  constructor(firstValue, options) {
    super(firstValue, options);

    if (!Object.prototype.hasOwnProperty.call(this._options, "processValue")) {
      this._options.processValue = HookedObservable.noopProcessValue;
    }
  }

  setValue(value) {
    const { processValue } = this._options;
    const { value: valueToSet, result } = processValue(value);
    super.setValue(valueToSet !== undefined ? valueToSet : value);
    return result;
  }

  static noopProcessValue(value) {
    return value;
  }
}

class HtmlObservable extends HookedObservable {
  constructor(firstValue, options) {
    super(firstValue, {
      ...options,
      processValue: (...args) => ({
        value: args[0],
        result: this.processHtml(...args),
      }),
    });

    if (!Object.prototype.hasOwnProperty.call(this._options, "decodeHtml")) {
      this._options.decodeHtml = HtmlObservable.noopDecodeHtml;
    }

    this.fallbackValue = firstValue;
  }

  processHtml(value, ...rest) {
    let parsedHtml;
    if (typeof value === "string") {
      parsedHtml = HtmlObservable.parseHtml(value);
    } else {
      parsedHtml = value;
    }
    // XXX: ???
    return this._options.decodeHtml(parsedHtml, ...rest);
  }

  static parseHtml(htmlString) {
    const fragment = new DOMParser().parseFromString(htmlString, "text/html");
    //fragment.innerHTML = htmlString;
    return fragment.body;
  }

  static noopDecodeHtml(parsedHtml) {
    return parsedHtml;
  }
}

export const NO_VALUE = _NONE;
export const UNKNOWN_VALUE = _UNKNOWN;

/**
 *
 * @param {any} value
 * @returns {Observable}
 */
export function asObservable(value) {
  if (value instanceof Observable) {
    return value;
  } else if (!(value && _OBSERVABLE in value)) {
    throw Error(`observable: non-observable value \`${String(value)}\``);
  }
  /**
   * @type {Observable}
   */
  const observable = value[_OBSERVABLE];
  return observable;
}

export function _valueOfObserved(observed) {
  return asObservable(observed).value;
}

export function cloneObserved(observed) {
  const observable = asObservable(observed);
  return _observedValueFrom(observable.clone());
}

export function isObserved(obj) {
  return typeof obj === "function" && _OBSERVABLE in obj;
}

export function isObservedArray(observed) {
  return (
    isObserved(observed) && asObservable(observed) instanceof ArrayObservable
  );
}

export function isObservedHtml(obj) {
  return isObserved(obj) && asObservable(obj) instanceof HtmlObservable;
}

export function isObservableUnset(observed) {
  const observable = asObservable(observed);
  return observable._value === _NONE;
}

export function obtainElementFromHtmlString(value, selector = null) {
  let fragmentEl;

  if (value === NO_VALUE) {
    return NO_VALUE;
  } else if (typeof value === "string") {
    fragmentEl = HtmlObservable.parseHtml(value);
  } else {
    fragmentEl = value;
  }

  if (selector === null) {
    return fragmentEl;
  }

  const selectedEls = fragmentEl.querySelectorAll(selector);

  // there must be one single selected element in the HTML
  if (selectedEls.length === 0) {
    throw new Error("new innerHTML does not contain selector");
  } else if (selectedEls.length > 1) {
    throw new Error("new innerHTML has duplicates for selector");
  }

  const selectedEl = selectedEls[0];
  return selectedEl;
}

export function _observedValueFrom(observable) {
  const observableExternal = (newValue = _NONE) => {
    if (newValue !== _NONE) {
      return observable.setValue(newValue);
    } else {
      return observable._value;
    }
  };
  observableExternal[_OBSERVABLE] = observable;
  return observableExternal;
}

export function observedValue(firstValue = NO_VALUE, observableOptions = null) {
  const observable = new Observable(firstValue, observableOptions);
  return _observedValueFrom(observable);
}

class ArrayObservable extends HookedObservable {}

export function observedArray(firstValue, observableOptions) {
  const arrayObservable = new ArrayObservable(firstValue, observableOptions);
  return _observedValueFrom(arrayObservable);
}

export function observedHtml(firstValue, observableOptions) {
  const htmlObservable = new HtmlObservable(firstValue, observableOptions);
  return _observedValueFrom(htmlObservable);
}

export function computedValue(compute, allObserved) {
  const computed = new ComputedObservable(compute, Array.from(allObserved));
  const computedExternal = () => {
    return computed.value;
  };
  computedExternal[_OBSERVABLE] = computed;
  return computedExternal;
}

function anyChangeCompute() {
  const toString = () => "";
  return { toString };
}

export function anyChangeValue(allObserved) {
  return computedValue(anyChangeCompute, allObserved);
}

export function hookedValue(firstValue, observableOptions) {
  const hookedObservable = new HookedObservable(firstValue, observableOptions);
  // process the initial value
  if (firstValue !== NO_VALUE) {
    const { processValue } = hookedObservable._options;
    hookedObservable._value = processValue(firstValue).value;
  }
  // wrap it for return
  return _observedValueFrom(hookedObservable);
}

/**
 * @typedef {ReturnType<observedValue>} Observed
 * @typedef {ReturnType<asObservable>} Observable
 */
