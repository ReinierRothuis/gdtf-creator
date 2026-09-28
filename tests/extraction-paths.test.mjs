import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV3 } from "ai/test";
import {
  EXTRACTION_PATHS,
  createExtractionRequest,
  generateFixtureData,
  getExtractionPath,
  normalizeGeminiMode,
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
      openai: {
        store: false,
        strictJsonSchema: false,
        reasoningEffort: "medium",
        textVerbosity: "low",
      },
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

test("normalizes Gemini function attributes without collapsing shutter states", () => {
  const mode = normalizeGeminiMode({
    name: "Test",
    channelCount: 3,
    channels: [
      {
        channel: 1,
        gdtfAttribute: "ColorEffects1",
        prettyName: "Macro",
        defaultValue: 0,
        functions: [{ name: "Macro 1", dmxFrom: 0, dmxTo: 255 }],
      },
      {
        channel: 2,
        gdtfAttribute: "Shutter1",
        prettyName: "Strobe",
        defaultValue: 0,
        functions: [
          { name: "Closed", dmxFrom: 0, dmxTo: 7 },
          { name: "Open", dmxFrom: 8, dmxTo: 15 },
          { name: "Random strobe", dmxFrom: 16, dmxTo: 255 },
        ],
      },
      {
        channel: 3,
        gdtfAttribute: "Function",
        prettyName: "Control",
        defaultValue: 0,
        functions: [
          { name: "Null", dmxFrom: 0, dmxTo: 29 },
          { name: "Dimmer curve linear", dmxFrom: 30, dmxTo: 39 },
          { name: "Dimmer curve square", dmxFrom: 40, dmxTo: 69 },
          { name: "900Hz", dmxFrom: 70, dmxTo: 255 },
        ],
      },
    ],
  });

  assert.equal(mode.channels[0].functions, undefined);
  assert.deepEqual(mode.channels[1].functions.map((fn) => fn.attribute), [
    "Shutter1",
    "Shutter1",
    "Shutter1StrobeRandom",
  ]);
  assert.deepEqual(mode.channels[2].functions.map((fn) => [fn.dmxFrom, fn.dmxTo, fn.attribute]), [
    [0, 29, "Dummy"],
    [30, 69, "DimmerCurve"],
    [70, 255, "Refresh Rate"],
  ]);
});

test("merges focused extraction passes", async () => {
  const makeFixture = (name, channelCount) => ({
    manufacturer: "Test",
    name: "Fixture",
    shortName: "Fixture",
    fixtureType: "Other",
    dmxModes: [{
      name,
      channelCount,
      channels: Array.from({ length: channelCount }, (_, index) => ({
        channel: index + 1,
        gdtfAttribute: "Dimmer",
        prettyName: "Dim",
        defaultValue: 0,
      })),
    }],
    physical: {
      weight: "1 kg",
      width: "1 mm",
      height: "1 mm",
      depth: "1 mm",
      powerConsumption: "1 W",
    },
  });
  let pass = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => ({
      content: [{ type: "text", text: JSON.stringify(makeFixture(`Mode ${pass + 1}`, ++pass)) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    }),
  });

  const result = await generateFixtureData({
    path: "claude-haiku-native",
    model,
    content: [{ type: "text", text: "first" }],
    additionalContents: [[{ type: "text", text: "second" }]],
  });

  assert.deepEqual(result.fixtureData.dmxModes.map(({ channelCount }) => channelCount), [1, 2]);
  assert.equal(result.totalTokens, 4);
  assert.equal(result.retryCount, 0);
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
