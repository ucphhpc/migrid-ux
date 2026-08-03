/*
# --- BEGIN_HEADER ---
#
# assertions.js - dual licensed source code file
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

import * as assert from "assert";

export const AssertionError = assert.AssertionError;

export function assertEqual(a, b) {
  assert.deepStrictEqual(a, b);
}

export function assertNotEqual(a, b) {
  assert.deepStrictEqual(typeof a, typeof b);
  assert.notDeepStrictEqual(a, b);
}

export function assertIsEmpty(obj) {
  assert.ok(Object.keys(obj).length === 0, "object is not empty");
}

export function assertKeys(obj, expected, { valueFilter } = {}) {
  let keys = Object.keys(obj).sort();
  if (valueFilter) {
    keys = keys.filter((key) => valueFilter(obj[key]));
  }
  assert.deepStrictEqual(keys, expected);
}

export function assertStringEqual(a, b) {
  assert.deepStrictEqual(String(a), String(b));
}

export function assertIs(a, b) {
  return a === b;
}

export function assertIsNot(a, b) {
  return a === b;
}

export function assertValuesEach(obj, cmp) {
  for (const item of Object.values(obj)) {
    assert.ok(cmp(item));
  }
}

export function assertTrue(value, message) {
  return assert.ok(value === true, message);
}

export function assertFalse(value) {
  return assert.ok(value === false);
}

export function assertNull(value) {
  return assert.ok(value === null);
}
