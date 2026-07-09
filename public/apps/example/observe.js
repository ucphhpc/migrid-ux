// --- BEGIN_HEADER ---
//
// observe.js - dual licensed source code file
// Copyright (C) 2025 - 2026  SCIENCE HPC Center at UCPH
//
// This file is part of MiGrid-UX.
//
// MiGrid-UX is free software: you can redistribute it and/or modify it under
// the terms of either
// the MIT License (LICENSES/LICENSE.MIT or https://opensource.org/licenses/MIT)
// OR
// the GNU General Public License version 2 (LICENSES/LICENSE.GPLv2 or
// https://opensource.org/license/gpl-2.0) or any later version
// at your option. The MiGrid-UX files may NOT be copied, modified, or
// distributed except according to those terms.
//
// --- END_HEADER ---

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
