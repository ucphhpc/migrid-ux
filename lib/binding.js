import {
  asObservable,
  isObservableUnset,
  isObservedHtml,
  NO_VALUE,
  UNKNOWN_VALUE,
} from "./observable.js";

const FORM_PREFIX = "form__";

const ATTR_ARRAY = "data-bind-array";
const ATTR_CHECKED = "data-bind-checked";
const ATTR_COMPONENT = "data-bind-component";
const ATTR_CSS = "data-bind-css";
const ATTR_DISABLED = "data-bind-disabled";
const ATTR_HIDE = "data-bind-hide";
const ATTR_OBSERVE = "data-bind-observe";
const ATTR_ONCHANGE = "data-bind-onchange";
const ATTR_ONCLICK = "data-bind-onclick";
const ATTR_ONENTER = "data-bind-onenter";
const ATTR_ONHIDE = "data-bind-onhide";
const ATTR_SHOW = "data-bind-show";

const BIND_ARRAY = "bindArray";
const BIND_ARRAY_EACH = "bindArrayEach";
const BIND_CHECKED = "bindChecked";
const BIND_COMPONENT = "bindComponent";
const BIND_COMPONENT_OBSERVE = "bindComponentObserve";
const BIND_CSS = "bindCss";
const BIND_CSS_WATCH = "bindCssWatch";
const BIND_DISABLED = "bindDisabled";
const BIND_HIDE = "bindHide";
const BIND_OBSERVE = "bindObserve";
const BIND_ONCHANGE = "bindOnchange";
const BIND_ONCLICK = "bindOnclick";
const BIND_ONCLICK_ARGUMENT = "bindOnclickArgument";
const BIND_ONENTER = "bindOnenter";
const BIND_ONHIDE = "bindOnhide";
const BIND_SHOW = "bindShow";
const _BIND_FORM = "bindForm";

function isObjectEmpty(obj) {
  return Object.keys(obj).length === 0;
}

class ExcludingElementsIterator {
  constructor(source, excludeWhen) {
    this.iterator = source[Symbol.iterator]();
    this.excludeWhen = excludeWhen;
    this.ended = false;
  }

  [Symbol.iterator]() {
    return this;
  }

  next() {
    let next = this.iterator.next();
    while (!next.done) {
      if (!this.excludeWhen(next.value)) return next;
      next = this.iterator.next();
    }
    return { done: true };
  }
}

class ElementFinder {
  constructor(rootElement) {
    this.rootElement = rootElement;
    this.exclude = new Set();
    this.force = new Set();
  }

  _ascendSubtreeAndCheck(element, elementCondition) {
    let currentElement = element;

    while (currentElement !== this.rootElement) {
      const condResult = elementCondition(currentElement);
      if (condResult === ElementFinder.EF_FORCE) {
        return false;
      } else if (condResult === ElementFinder.EF_FOUND) {
        return true;
      } else {
        // EF_CONTINUE
      }
      currentElement = currentElement.parentNode;
    }

    return false;
  }

  elementIsWithinExcludedSubtree(element) {
    return this._ascendSubtreeAndCheck(element, (el) => {
      if (this.isForcedSubtree(el)) return ElementFinder.EF_FORCE;
      if (this.exclude.has(el)) return ElementFinder.EF_FOUND;
      return ElementFinder.EF_CONTINUE;
    });
  }

  excludeSubtree(fromElement) {
    this.exclude.add(fromElement);
  }

  forceSubtree(fromElement) {
    this.force.add(fromElement);
  }

  unforceSubtree(fromElement) {
    this.force.delete(fromElement);
  }

  isForcedSubtree(element) {
    return this.force.has(element);
  }

  isExcludedSubtree(element) {
    return this.exclude.has(element);
  }

  querySelectorAllWithExclusions(fromElement, selector) {
    const elements = fromElement.querySelectorAll(selector);
    const excludeWhen = (el) => this.elementIsWithinExcludedSubtree(el);
    return new ExcludingElementsIterator(elements, excludeWhen);
  }
}

ElementFinder.EF_CONTINUE = Object.create(null);
ElementFinder.EF_FORCE = Object.create(null);
ElementFinder.EF_FOUND = Object.create(null);

function parseBinding(s) {
  if (typeof s !== "string") return null;
  if (s[0] !== "{" || s[s.length - 1] !== "}") return null;
  const maybeClauses = s.slice(1, -1);
  const clauses = [];
  try {
    for (const maybeClause of maybeClauses.split(",")) {
      let lhs, rhs, remains;
      [lhs, rhs, ...remains] = maybeClause.split(":");
      if (lhs === undefined || rhs === undefined) return null;
      if (remains.length !== 0) return null;
      lhs = lhs.trim();
      rhs = rhs.trim();

      clauses.push([lhs, rhs]);
    }
    return clauses;
  } catch {
    return null;
  }
}

function prepareAndEvaluateWhenExpression(whenExpression, whenObserved) {
  const fnBody = `const $ = this; return ${whenExpression}`;
  try {
    return Function(fnBody).apply(whenObserved);
  } catch {
    return false;
  }
}

class Binder {
  constructor(context, rootElement, binderOptions) {
    this.components = Object.create(null);
    this.context = context;
    this.rootElement = rootElement;
    this.elementFinder = new ElementFinder(this.rootElement);
    this.listenerAttachments = [];
    this.elementByNamespace = new Map();
    this.componentByElement = new Map();

    binderOptions = binderOptions || {};

    if (Array.isArray(binderOptions.components)) {
      for (const Component of binderOptions.components) {
        this.components[Component.name] = Component;
      }
    }
  }

  get state() {
    return this.context.state;
  }

  _addObservableListerner(observable, event, listener) {
    observable.addEventListener(event, listener);
    this.listenerAttachments.push([observable, event, listener]);
  }

  _addObservableListernerSilent(observable, event, listener) {
    observable._addEventListenerSilent(event, listener);
    this.listenerAttachments.push([observable, event, listener]);
  }

  boundElementsWithinNamespace(namespace, attrName, observableName) {
    const element = this.elementByNamespace.get(namespace);
    return element.querySelector(`[${attrName}="${observableName}"]`);
  }

  destroy() {
    for (const [observable, event, listener] of this.listenerAttachments) {
      observable.removeEventListener(event, listener);
    }
    this.rootElement = null;
  }

  rebind(namespace, binding, observableName) {
    let attrName;
    switch (binding) {
      case "array":
        attrName = ATTR_ARRAY;
        break;
      default:
        throw new Error("UNSUPPORTED");
    }
    const fromElement = this.boundElementsWithinNamespace(
      namespace,
      attrName,
      observableName,
    );

    this.elementFinder.forceSubtree(fromElement);

    switch (attrName) {
      case ATTR_ARRAY:
        this.bindArray([fromElement], namespace);
        break;
    }

    this.elementFinder.unforceSubtree(fromElement);
  }

  recordNamespaceElement(element, namespace) {
    this.elementByNamespace.set(namespace, element);
  }

  queryAttributesAll(fromElement, attrName) {
    return this.elementFinder.querySelectorAllWithExclusions(
      fromElement,
      `[${attrName}]`,
    );
  }

  processElement(fromElement, namespace, context) {
    for (const attrName of [
      ATTR_COMPONENT,
      ATTR_OBSERVE,
      ATTR_ARRAY,
      ATTR_CHECKED,
      ATTR_DISABLED,
      ATTR_ONCHANGE,
      ATTR_ONCLICK,
      ATTR_ONENTER,
      ATTR_ONHIDE,
      ATTR_CSS,
      ATTR_SHOW,
      ATTR_HIDE,
    ]) {
      switch (attrName) {
        case ATTR_OBSERVE:
          this.bindObserve(fromElement, namespace);
          break;
        case ATTR_ARRAY: {
          const elements = fromElement.querySelectorAll(`[${ATTR_ARRAY}]`);
          this.bindArray(elements, namespace);
          break;
        }
        case ATTR_CHECKED:
          this.bindChecked(fromElement, namespace);
          break;
        case ATTR_COMPONENT:
          this.bindComponent(fromElement, namespace);
          break;
        case ATTR_CSS:
          this.bindCss(fromElement, namespace);
          break;
        case ATTR_DISABLED:
          this.bindDisabled(fromElement, namespace);
          break;
        case ATTR_ONCHANGE:
          this.bindOnchange(fromElement, namespace, context);
          break;
        case ATTR_ONCLICK:
          this.bindOnclick(fromElement, namespace, context);
          break;
        case ATTR_ONENTER:
          this.bindOnenter(fromElement, namespace, context);
          break;
        case ATTR_ONHIDE:
          this.bindOnhide(fromElement, namespace, context);
          break;
        case ATTR_SHOW:
          this.bindShow(fromElement, namespace, context);
          break;
        case ATTR_HIDE:
          this.bindHide(fromElement, namespace, context);
          break;
      }
    }
  }

  processForm(formEl, namespace) {
    const bindType = formEl.dataset[_BIND_FORM];
    if (bindType !== "DEFINED") {
      // do not visit the form or any of its childern again
      this.elementFinder.excludeSubtree(formEl);
      return;
    }

    const observableNames = new Set(Object.keys(namespace));
    for (const inputEl of formEl.querySelectorAll(`input[name]`)) {
      const inputName = inputEl.name;
      if (isObjectEmpty(inputEl.dataset) && observableNames.has(inputName)) {
        inputEl.dataset[BIND_OBSERVE] = inputName;
      }
    }

    this.processElement(formEl, namespace, this.context);
    // kludge to allow bindings on form elements themselves
    this.bindCssElement(formEl, namespace);
    this.recordNamespaceElement(formEl, namespace);
    this.elementFinder.excludeSubtree(formEl);
  }

  bindObserve(fromElement, namespace) {
    const attrElements = this.queryAttributesAll(fromElement, ATTR_OBSERVE);

    const elementsArray = Array.from(attrElements);

    for (const attrElement of elementsArray) {
      const observableName = attrElement.dataset[BIND_OBSERVE];
      const observed = namespace[observableName];
      const observable = asObservable(observed);

      if (
        attrElement.tagName === "INPUT" ||
        attrElement.tagName === "TEXTAREA"
      ) {
        if (isObservableUnset(observable)) {
          // copy the value from the HTML into the observable
          observable.setValue(attrElement.value);
        }

        this._addObservableListerner(observable, "change", (ev) => {
          const { value } = ev.detail;
          if (value === NO_VALUE) return;
          if (
            attrElement.type === "radio" &&
            attrElement.value !== ev.detail.value
          ) {
            return;
          }
          attrElement.value = ev.detail.value;
        });

        attrElement.addEventListener("input", (ev) => {
          observed(ev.target.value);
        });
      } else if (attrElement.tagName === "SELECT") {
        if (isObservableUnset(observable)) {
          observed(attrElement.value);
        }

        this._addObservableListerner(observable, "change", (ev) => {
          const { value } = ev.detail;
          if (value === NO_VALUE) return;
          attrElement.value = ev.detail.value;
        });

        attrElement.addEventListener("input", (ev) => {
          observed(ev.target.value);
        });
      } else if (isObservedHtml(observed)) {
        this._addObservableListerner(observable, "change", (ev) => {
          attrElement.innerHTML = ev.detail.value;
        });
      } else {
        this._addObservableListerner(observable, "change", (ev) => {
          attrElement.innerHTML = ev.detail.value;
        });
      }
    }
  }

  bindOnclick(fromElement, namespace, context) {
    const inputElements = this.queryAttributesAll(fromElement, ATTR_ONCLICK);

    for (const inputEl of inputElements) {
      const method = context[inputEl.dataset[BIND_ONCLICK]];
      const arg = inputEl.dataset[BIND_ONCLICK_ARGUMENT];

      if (typeof method !== "function") {
        console.warn("cannot bind onclick: method target missing");
      }

      inputEl.addEventListener("click", () => {
        const detail = { value: UNKNOWN_VALUE };
        const invokeArgs = [detail, namespace, inputEl];
        if (arg !== undefined) invokeArgs.push(arg);
        method.apply(context, invokeArgs);
      });
    }
  }

  _determineDataObservableForElement(element) {
    for (const bindName of Binder.ALL_BIND_DATA_ATTRS) {
      let propertyValue;
      if ((propertyValue = element.dataset[bindName]) !== undefined) {
        return propertyValue;
      }
    }
  }

  bindOnchange(fromElement, namespace, context) {
    const inputElements = this.queryAttributesAll(fromElement, ATTR_ONCHANGE);

    for (const inputEl of inputElements) {
      const observableName = this._determineDataObservableForElement(inputEl);
      const observed = namespace[observableName];
      const observable = asObservable(observed);
      const method = context[inputEl.dataset[BIND_ONCHANGE]];

      this._addObservableListernerSilent(observable, "change", () => {
        const detail = { value: observable._value };
        method.call(context, detail, namespace, inputEl, observed);
      });
    }
  }

  bindOnenter(fromElement, namespace, context) {
    const inputElements = this.queryAttributesAll(fromElement, ATTR_ONENTER);

    for (const inputEl of inputElements) {
      const observableName = inputEl.dataset[BIND_OBSERVE];
      const observable = asObservable(namespace[observableName]);

      inputEl.addEventListener("keyup", (ev) => {
        if (ev.key !== "Enter") return;
        const method = context[inputEl.dataset[BIND_ONENTER]];
        if (typeof method !== "function") return;
        const detail = { value: observable.value };
        method.call(context, detail, namespace, inputEl);
      });
    }
  }

  bindOnhide(fromElement, namespace, context) {
    const inputElements = this.queryAttributesAll(fromElement, ATTR_ONHIDE);

    for (const inputEl of inputElements) {
      const observableName = inputEl.dataset[BIND_SHOW];
      const observable = asObservable(namespace[observableName]);

      this._addObservableListernerSilent(observable, "change", (...args) => {
        const value = args[0].detail.value;
        if (value) return; // do nothing unless hiding
        const method = context[inputEl.dataset[BIND_ONHIDE]];
        if (typeof method !== "function") return;
        const detail = { value: observable.value };
        method.call(context, detail, namespace, inputEl);
      });
    }
  }

  bindShow(fromElement, namespace) {
    const inputElements = this.queryAttributesAll(fromElement, ATTR_SHOW);

    for (const inputEl of inputElements) {
      let observableName = inputEl.dataset[BIND_SHOW];
      const observable = asObservable(namespace[observableName]);

      this._addObservableListerner(observable, "change", (ev) => {
        const show = ev.detail.value;
        inputEl.style.display = show ? "" : "none";
      });
    }
  }

  bindHide(fromElement, namespace) {
    const inputElements = this.queryAttributesAll(fromElement, ATTR_HIDE);

    for (const inputEl of inputElements) {
      let observableName = inputEl.dataset[BIND_HIDE];
      const observable = asObservable(namespace[observableName]);

      this._addObservableListerner(observable, "change", (ev) => {
        const show = ev.detail.value;
        inputEl.style.display = show ? "none" : "";
      });
    }
  }

  bindArray(elements, namespace) {
    for (const arrayEl of elements) {
      const observableName = arrayEl.dataset[BIND_ARRAY];
      const eachSelector = arrayEl.dataset[BIND_ARRAY_EACH];

      const arrayObservable = namespace[observableName];
      if (!arrayObservable) {
        // TODO:
        continue;
      }

      const arrayItemEls = arrayEl.querySelectorAll(eachSelector);
      if (arrayItemEls.length === 0) {
        return;
      }

      this.bindArrayItems(observableName, arrayItemEls, namespace);

      this.elementFinder.excludeSubtree(arrayEl);
    }
  }

  bindArrayItems(observableName, arrayItemEls, namespace) {
    const arrayObserved = namespace[observableName];
    const arrayItems = arrayObserved();

    for (const [itemIdx, itemObj] of arrayItems.entries()) {
      const itemEl = arrayItemEls[itemIdx];
      this.processElement(itemEl, itemObj, this.context);
    }
  }

  bindChecked(fromElement, namespace) {
    const attrElements = this.queryAttributesAll(fromElement, ATTR_CHECKED);

    for (const attrElement of attrElements) {
      const observableName = attrElement.dataset[BIND_CHECKED];
      this._attachChecked(attrElement, namespace[observableName]);
    }
  }

  bindDisabled(fromElement, namespace) {
    const elements = this.queryAttributesAll(fromElement, ATTR_DISABLED);

    for (const inputEl of elements) {
      const observableName = inputEl.dataset[BIND_DISABLED];
      const observable = asObservable(namespace[observableName]);

      if (isObservableUnset(observable)) {
        // copy the value from the HTML into the observable
        observable.setValue(inputEl.disabled);
      } else {
        inputEl.disabled = Boolean(observable.value);
      }

      this._addObservableListerner(observable, "change", (ev) => {
        const newValue = Boolean(ev.detail.value);
        if (newValue === inputEl.disabled) return;
        inputEl.disabled = newValue;
      });
    }
  }

  _attachChecked(inputEl, observed) {
    const observable = asObservable(observed);

    if (isObservableUnset(observable)) {
      // copy the value from the HTML into the observable
      observable.setValue(inputEl.checked);
    } else {
      inputEl.checked = Boolean(observable.value);
    }

    this._addObservableListerner(observable, "change", (ev) => {
      inputEl.checked = ev.detail.value;
    });

    inputEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      observable.setValue(!observable.value);
    });
  }

  bindComponent(fromElement, namespace) {
    const elements = this.queryAttributesAll(fromElement, ATTR_COMPONENT);
    for (const componentEl of elements) {
      const componentName = componentEl.dataset[BIND_COMPONENT];
      const Component = this.components[componentName];
      if (!Component || typeof Component.fromElement !== "function") continue;
      const observableName = componentEl.dataset[BIND_COMPONENT_OBSERVE];
      if (!(observableName in namespace)) continue;
      const component = Component.fromElement(componentEl, namespace);
      this.processElement(componentEl, namespace, component);
      this.elementFinder.excludeSubtree(componentEl);
    }
  }

  bindCss(fromElement, namespace) {
    const elements = this.queryAttributesAll(fromElement, ATTR_CSS);
    for (const element of elements) {
      this.bindCssElement(element, namespace);
    }
  }

  bindCssElement(element) {
    // TODO: checks ought to operate against the current namespace
    const appNamespace = this.state.namespace("__app__");

    const cssBindingObserved = appNamespace[element.dataset[BIND_CSS_WATCH]];
    if (cssBindingObserved === undefined) return;
    const cssBindingExpression = element.dataset[BIND_CSS];
    if (cssBindingExpression == undefined) return;
    const parsedPairs = parseBinding(cssBindingExpression);
    if (parsedPairs === null) return;

    const onChange = () => {
      for (const [className, whenExpression] of parsedPairs) {
        const sholdApplyCssClass = prepareAndEvaluateWhenExpression(
          whenExpression,
          cssBindingObserved,
        );
        if (sholdApplyCssClass) {
          element.classList.add(className);
        } else {
          element.classList.remove(className);
        }
      }
    };

    asObservable(cssBindingObserved).addEventListener("change", onChange);
  }
}

Binder.ALL_BIND_DATA_ATTRS = [
  BIND_OBSERVE,
  BIND_CHECKED,
  BIND_DISABLED,
  BIND_ONCLICK,
];

export function binder(root, app, binderOptions = null) {
  const binder = new Binder(app, root, binderOptions);
  const state = app.state;

  let appNamespace = null;

  for (const [namespaceName, namespace] of Object.entries(state.namespaces)) {
    if (namespaceName === "__app__") {
      appNamespace = namespace;
      continue;
    }

    if (namespaceName.startsWith(FORM_PREFIX)) {
      const formName = namespaceName.substring(FORM_PREFIX.length);

      const formEl = root.querySelector(`form[name="${formName}"]`);
      if (!formEl) {
        // named form was not found in the DOM
        continue;
      }

      binder.processForm(formEl, namespace);

      // make sure the form behaves "async" by default
      formEl.addEventListener("submit", (ev) => ev.preventDefault());
    }
  }

  if (appNamespace) {
    // now bind anythng that remains to the global namespace
    binder.processElement(binder.rootElement, appNamespace, binder.context);
  }

  return binder;
}

export const _Binder = Binder;
