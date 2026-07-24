import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV3 } from "ai/test";
import {
  EXTRACTION_PATHS,
  createExtractionRequest,
  generateFixtureData,
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

test("retries schema-invalid output once and preserves cumulative usage", async () => {
  const fixture = {
    manufacturer: "Test",
    name: "Fixture",
    shortName: "Fixture",
    fixtureType: "Other",
    dmxModes: [{
      name: "1 channel",
      channelCount: 1,
      channels: [{ channel: 1, gdtfAttribute: "Dimmer", prettyName: "Dim", defaultValue: 0 }],
    }],
    physical: {
      weight: "1 kg",
      width: "1 mm",
      height: "1 mm",
      depth: "1 mm",
      powerConsumption: "1 W",
    },
  };
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  };
  let attempt = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => ({
      content: [{ type: "text", text: attempt++ ? JSON.stringify(fixture) : "{}" }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }),
  });

  const result = await generateFixtureData({
    path: "claude-haiku-native",
    model,
    content: [{ type: "text", text: "extract" }],
  });

  assert.equal(result.retryCount, 1);
  assert.equal(result.fixtureData.name, "Fixture");
  assert.equal(result.totalTokens, 4);
  assert.equal(model.doGenerateCalls.length, 2);
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
