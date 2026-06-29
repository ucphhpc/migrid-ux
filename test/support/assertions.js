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
