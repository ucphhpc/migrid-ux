import * as sinon from "sinon";
import { AssertionError } from "../../support/assertions.js";

export function makeFakeFetch({ body = null, contentType = "text/html" } = {}) {
  const res = {
    status: 200,
    headers: new Headers({
      "content-type": contentType,
    }),
    json() {
      throw new Error("UNSPECIFIED");
    },
    text() {
      throw new Error("UNSPECIFIED");
    },
    get ok() {
      return 200 <= res.status && res.status < 299;
    },
  };

  const stub = sinon.stub().named("fakeFetch").resolves(res);

  stub.getCallQueryArgs = (callIndex) => {
    const [url, fetchOptions] = stub.getCall(callIndex).args;
    if (fetchOptions.method !== "GET") {
      throw new AssertionError("query string unavilable for non-GET request");
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      if (e.message === "Invalid URL") {
        // assume we have only a path
        const prefixedUrl = `http://testhost${url}`;
        parsedUrl = new URL(prefixedUrl);
      } else {
        throw e;
      }
    }

    const queryArgs = {};
    for (const [k, v] of parsedUrl.searchParams.entries()) {
      queryArgs[k] = v;
    }
    return queryArgs;
  };

  stub.programResponse = ({ status = null, body = null }) => {
    if (status !== null) {
      res.status = status;
    }

    if (contentType === "application/json") {
      res.json = () => Promise.resolve(body);
    } else {
      if (body === null) throw new Error("fakeFetch: textual body is required");
      res.text = () => Promise.resolve(body);
    }
  };

  stub.programResponse({ body });

  return stub;
}

/**
 * Create a fake response to be returned by a fake/stub fetch.
 * @param {string} text The resolved text response.
 * @returns A promise of a response.
 */
export function fakeResponse(text) {
  const res = {
    ok: true,
    status: 200,
    text() {
      return Promise.resolve(text);
    },
  };
  return Promise.resolve(res);
}
