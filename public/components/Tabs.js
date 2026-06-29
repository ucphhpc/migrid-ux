import { asObservable } from "../lib/observable.js";

const TABS_ITEM = "TabsItem";

class Tabs {
  constructor(observable, observableName, tabElements) {
    this.observable = observable;
    this.observableName = observableName;
    this.tabElements = tabElements;
  }

  bind() {
    for (const [index, el] of this.tabElements.entries()) {
      el.dataset["bindOnclick"] = "updateSelectedIndex";
      el.dataset["bindCss"] = `{ TabsItem--active: $() == ${index} }`;
      el.dataset["bindCssWatch"] = this.observableName;
    }

    return this;
  }

  destroy() {}

  updateSelectedIndex(_, __, tabElement) {
    const selectedIndex = this.tabElements.indexOf(tabElement);
    this.observable.setValue(selectedIndex);
  }

  static fromElement(element, namespace) {
    const observableName = element.dataset["bindComponentObserve"];
    const observable = asObservable(namespace[observableName]);
    const tabElements = Array.from(element.querySelectorAll(`.${TABS_ITEM}`));
    return new Tabs(observable, observableName, tabElements).bind();
  }
}

export { Tabs };
