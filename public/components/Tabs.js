/*
# --- BEGIN_HEADER ---
#
# Tabs.js - dual licensed source code file
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
