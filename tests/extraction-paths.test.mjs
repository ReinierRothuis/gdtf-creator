import assert from "node:assert/strict";
import test from "node:test";
import {
  EXTRACTION_PATHS,
  createExtractionRequest,
  getExtractionPath,
  sanitizeAnthropicSchema,
} from "../convex/extractionPaths.ts";
import {
  extractionPromptAddenda,
  getExtractionPrompt,
} from "../convex/extractionPrompt.ts";

test("accepts every configured extraction path", () => {
  for (const path of EXTRACTION_PATHS) {
    assert.equal(getExtractionPath(path), path);
  }
});

test("builds an independently configurable prompt for every path", () => {
  for (const path of EXTRACTION_PATHS) {
    assert.match(getExtractionPrompt(path), /# Model-specific instructions/);
    assert.ok(getExtractionPrompt(path).endsWith(extractionPromptAddenda[path]));
  }
});

test("rejects unknown extraction paths", () => {
  assert.throws(
    () => getExtractionPath("unknown"),
    /Invalid PDF_EXTRACTION_PATH/
  );
});

test("disables OpenAI strict schemas for optional extraction fields", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test";
  try {
    const request = await createExtractionRequest(new ArrayBuffer(1), "extract", "openai-gpt-nano-native");
    assert.deepEqual(request.providerOptions, {
      openai: { store: false, strictJsonSchema: false },
    });
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("removes numeric constraints unsupported by Anthropic output schemas", () => {
  const schema = {
    type: "object",
    properties: {
      channel: { type: "integer", exclusiveMinimum: 0, maximum: 255 },
      name: { type: "string", minLength: 1 },
    },
  };

  sanitizeAnthropicSchema(schema);

  assert.deepEqual(schema.properties.channel, { type: "integer" });
  assert.deepEqual(schema.properties.name, { type: "string", minLength: 1 });
});
