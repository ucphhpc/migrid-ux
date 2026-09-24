import * as path from "path";
import * as fsAsync from "fs/promises";

const SCRIPT_DIR = path.dirname(import.meta.url.replace("file://", ""));
const ROOT_DIR = path.join(SCRIPT_DIR, "../..");

export function loadTextualFixture(fixtureFilename) {
  const fixureFile = path.join(ROOT_DIR, "test", "fixtures", fixtureFilename);
  return fsAsync.readFile(fixureFile, "utf8");
}

export function loadPublicFile(filename) {
  return fsAsync.readFile(path.join(ROOT_DIR, filename), "utf8");
}
