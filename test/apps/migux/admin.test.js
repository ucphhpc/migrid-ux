import { assertFalse } from "../../support/assertions.js";
import { browserHooksEach } from "../../support/browser.js";
import { AdminApp } from "../../../migux/public/apps/migux/admin.js";

import { AppBase } from "../../../lib/app.js";
import { createNamespacedState as createState } from "../../../lib/state.js";

describe("apps/peers", function () {
  browserHooksEach(this);

  it("should allow being closed when there are no submissions", () => {
    const state = createState(AppBase.definition(AdminApp));

    assertFalse(state.namespace("__app__").disable_close());
  });
});
