import { JSDOM } from "jsdom";

/**
 * Parse the given  HTML content into a DOM.
 * @param {String} html HTML content to parse.
 * @returns {HTMLElement}
 */
export async function parseHtmlFromString(html) {
  const jsdom = new JSDOM("<!DOCTYPE html><html></html>");
  const DOMParser = jsdom.window.DOMParser;
  const dom = new DOMParser().parseFromString(html, "text/html");
  return dom;
}
