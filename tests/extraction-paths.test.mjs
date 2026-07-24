import assert from "node:assert/strict";
import test from "node:test";
import {
  EXTRACTION_PATHS,
  getExtractionPath,
} from "../convex/extractionPaths.ts";

test("accepts every configured extraction path", () => {
  for (const path of EXTRACTION_PATHS) {
    assert.equal(getExtractionPath(path), path);
  }
});

test("rejects unknown extraction paths", () => {
  assert.throws(
    () => getExtractionPath("unknown"),
    /Invalid PDF_EXTRACTION_PATH/
  );
});
