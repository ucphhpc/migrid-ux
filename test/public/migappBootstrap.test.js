/* globals global */

import { assertEqual, assertNotEqual } from "../support/assertions.js";

function asFormData(obj) {
  const formData = new global.FormData();
  for (const [k, v] of Object.entries(obj)) {
    formData.set(k, v);
  }
  return formData;
}

describe("bootrapping code", () => {
  let buildMigUrl;
  let migResponse;
  let window;

  before(async () => {
    // allow the bootstrapping code to see a "window" object
    global.window = window = {};

    await import("../../migux/public/migappBootstrap.js");
    buildMigUrl = window.MiG.migBuildUrl;
    migResponse = window.MiG.migResponse;
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

  describe("response processing", () => {
    it("should throw on invalid response", async () => {
      const payload = {};
      const res = new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

      let expectedError = null;
      try {
        await migResponse(res);
      } catch (error) {
        expectedError = error;
      }
      assertNotEqual(expectedError, null);
      assertEqual(expectedError.message, "NOT_IMPLEMENTED");
    });

    it("should process a successful response", async () => {
      const payload = [
        {
          object_type: "objects",
          objects: {
            status: 200,
            error: null,
          },
        },
      ];
      const res = new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const migRes = await migResponse(res);

      const data = await migRes.json();
      assertEqual(data, {
        error: null,
      });
    });

    it("should process an error response with status (data)", async () => {
      const payload = [
        {
          object_type: "objects",
          objects: {
            status: 400,
            error: null,
            data: {
              specifics: "very specific info",
            },
          },
        },
      ];
      const res = new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

      let expectedError = null;
      try {
        await migResponse(res);
      } catch (error) {
        expectedError = error;
      }
      assertNotEqual(expectedError, null);

      assertEqual(expectedError.message, "HTTP 400 Error");
      assertEqual(expectedError.status, 400);
      assertEqual(expectedError.data, {
        specifics: "very specific info",
      });
    });

    it("should process an error response with status (error null)", async () => {
      const payload = [
        {
          object_type: "objects",
          objects: {
            status: 400,
            error: null,
          },
        },
      ];
      const res = new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

      let expectedError = null;
      try {
        await migResponse(res);
      } catch (error) {
        expectedError = error;
      }
      assertNotEqual(expectedError, null);

      assertEqual(expectedError.message, "HTTP 400 Error");
      assertEqual(expectedError.status, 400);
      assertEqual(expectedError.data, null);
    });

    it("should process an error response with status (error empty string)", async () => {
      const payload = [
        {
          object_type: "objects",
          objects: {
            status: 400,
            error: "",
          },
        },
      ];
      const res = new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

      let expectedError = null;
      try {
        await migResponse(res);
      } catch (error) {
        expectedError = error;
      }
      assertNotEqual(expectedError, null);

      assertEqual(expectedError.message, "");
      assertEqual(expectedError.status, 400);
      assertEqual(expectedError.data, null);
    });

    it("should process an error response with no status", async () => {
      const payload = [
        {
          object_type: "objects",
          objects: {
            error: "arbitrary error",
          },
        },
      ];
      const res = new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

      let expectedError = null;
      try {
        await migResponse(res);
      } catch (error) {
        expectedError = error;
      }
      assertNotEqual(expectedError, null);

      assertEqual(expectedError.message, "arbitrary error");
      assertEqual(expectedError.status, 422);
      assertEqual(expectedError.data, null);
    });
  });
});
