/* globals global */

import { assertEqual } from "../support/assertions.js";

function asFormData(obj) {
  const formData = new global.FormData();
  for (const [k, v] of Object.entries(obj)) {
    formData.set(k, v);
  }
  return formData;
}

describe("bootrapping code", () => {
  let buildMigUrl;
  let window;

  before(async () => {
    // allow the bootstrapping code to see a "window" object
    global.window = window = {};

    await import("../../migux/public/migappBootstrap.js");
    buildMigUrl = window.MiG.migBuildUrl;
  });

  after(() => {
    // we must clean up after ourselves wrt the global namespace
    delete global.window;
  });

  describe("url building", () => {
    it("should take the apiUrl into account", () => {
      const baseOptions = {
        apiUrl: "some.server/path/to",
        migType: "pkg_to_import",
      };
      const { url } = buildMigUrl(baseOptions, "/someapi/endpoint");

      assertEqual(url, "some.server/path/to/tmplinterface.py");
    });

    it("should build a MiG style url for tmpl GET", () => {
      const baseOptions = {
        apiUrl: "some.server",
        migType: "pkg_to_import",
      };
      const { url, ...fetchOptions } = buildMigUrl(
        baseOptions,
        "/someapi/endpoint",
        {
          query: {
            foo: 1,
            bar: [true, "blue"],
          },
        },
      );

      assertEqual(url, "some.server/tmplinterface.py");
      assertEqual(fetchOptions, {
        method: "POST",
        headers: undefined,
        body: asFormData({
          foo: 1,
          bar: [true, "blue"],
          type: "pkg_to_import__someapi__endpoint",
          operation: "read",
        }),
      });
    });

    it("should build a MiG style url for data GET", () => {
      const baseOptions = {};
      const { url, ...fetchOptions } = buildMigUrl(
        baseOptions,
        "/someapi/endpoint",
        {
          headers: {
            "Content-Type": "application/json",
          },
          data: {
            foo: 1,
            bar: [true, "blue"],
          },
        },
      );

      assertEqual(url, "/datainterface.py");
      assertEqual(fetchOptions, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          foo: 1,
          bar: [true, "blue"],
          type: "someapi__endpoint",
          operation: "read",
        }),
      });
    });

    it("should build a MiG style url for data POST", () => {
      const baseOptions = {
        apiUrl: "some.server",
      };
      const { url, ...fetchOptions } = buildMigUrl(
        baseOptions,
        "/someapi/endpoint",
        {
          method: "POST",
          data: {
            foo: 1,
            bar: [true, "blue"],
          },
        },
      );

      assertEqual(url, "some.server/datainterface.py");
      assertEqual(fetchOptions, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          foo: 1,
          bar: [true, "blue"],
          type: "someapi__endpoint",
          operation: "create",
        }),
      });
    });
  });
});
