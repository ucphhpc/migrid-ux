import { deepStrictEqual as equal, ok } from "assert";
import * as sinon from "sinon";
import { assertTrue, assertFalse } from "../support/assertions.js";

import {
  NO_VALUE,
  asObservable,
  observedValue,
  computedValue,
  anyChangeValue,
} from "../../lib/observable.js";

const precondition = (bool) => ok(bool, "precondition");

describe("basic", () => {
  it("should throw unless the value is an observable", () => {
    let raised = null;
    try {
      asObservable(null);
    } catch (exception) {
      raised = { exception };
    }
    ok(raised);
    const theexception = raised.exception;
    equal(theexception.message, "observable: non-observable value `null`");
  });

  it("should store a known no value if no first value was given", () => {
    const observed = observedValue();
    const observable = asObservable(observed);
    equal(observable.value, undefined);
    equal(observable._value, NO_VALUE);
  });

  it("should store the first value when supplied", () => {
    const observed = observedValue(0);
    const observable = asObservable(observed);
    equal(observable.value, 0);
  });

  it("should emit an event when the value is changed", () => {
    const setValue = observedValue(0);
    const observable = asObservable(setValue);
    const onChangeStub = sinon.stub();

    observable.addEventListener("change", onChangeStub);
    onChangeStub.reset();
    precondition(onChangeStub.notCalled);

    setValue("foo");

    ok(onChangeStub.calledOnce);
  });

  it("should not emit an event when the value is unchanged", () => {
    const setValue = observedValue(0);
    const observable = asObservable(setValue);
    const onChangeStub = sinon.stub();

    observable.addEventListener("change", onChangeStub);
    onChangeStub.reset();
    precondition(onChangeStub.notCalled);

    setValue(0);

    ok(onChangeStub.notCalled);
  });

  it("should emit an event when a listener is attached", () => {
    const setValue = observedValue(0);
    const observable = asObservable(setValue);
    const onChangeStub = sinon.stub();

    observable.addEventListener("change", onChangeStub);

    ok(onChangeStub.calledOnce);
  });

  it("should allow a derived value", () => {
    const onChangeStub = sinon.stub();
    const observed = observedValue(0);
    const allObserved = [observed];
    const computed = computedValue(([value]) => {
      if (value === 0) {
        return "nothing";
      } else {
        return "something";
      }
    }, allObserved);
    const observable = asObservable(computed);

    observable.addEventListener("change", onChangeStub);

    const event = onChangeStub.getCall(0).args[0];
    equal(event.detail.value, "nothing");
  });

  it("should update a derived value on any change", () => {
    const onChangeStub = sinon.stub();
    const observed = observedValue(0);
    const allObserved = [observed];
    const computed = computedValue(([value]) => {
      if (value === 0) {
        return "nothing";
      } else {
        return "something";
      }
    }, allObserved);
    const observable = asObservable(computed);

    observable.addEventListener("change", onChangeStub);
    onChangeStub.reset();

    observed(1);

    const event = onChangeStub.getCall(0).args[0];
    equal(event.detail.value, "something");
  });

  it("should not emit events when a derived value is unchanged", () => {
    const onChangeStub = sinon.stub();
    const observed = observedValue(0);
    const allObserved = [observed];
    const computed = computedValue(([value]) => {
      if (value === 0) {
        return "nothing";
      } else {
        return "something";
      }
    }, allObserved);
    const observable = asObservable(computed);

    observable.addEventListener("change", onChangeStub);
    onChangeStub.reset();

    observed(1);
    onChangeStub.reset();

    observed(2);

    ok(onChangeStub.notCalled);
  });

  describe("with an anyChange value", () => {
    let watched1;
    let watched2;
    let observable;

    beforeEach(() => {
      watched1 = observedValue(false);
      watched2 = observedValue(false);
      observable = anyChangeValue([watched1, watched2]);
    });

    it("should change when a dependent value changes", () => {
      const onChangeStub = sinon.stub();
      asObservable(observable)._addEventListenerSilent("change", onChangeStub);
      assertFalse(onChangeStub.called);

      // now change one of the watched observables
      watched1(true);
      assertTrue(onChangeStub.calledOnce);
    });

    it("should change for every change to an observed value", () => {
      const onChangeStub = sinon.stub();
      asObservable(observable)._addEventListenerSilent("change", onChangeStub);

      // make two changes
      watched1(true);
      watched2(true);

      assertTrue(onChangeStub.calledTwice);
    });

    it("should not change with an unchanged observed value", () => {
      const onChangeStub = sinon.stub();
      asObservable(observable)._addEventListenerSilent("change", onChangeStub);

      // set the same value again
      watched1(false);

      assertFalse(onChangeStub.called);
    });
  });
});
