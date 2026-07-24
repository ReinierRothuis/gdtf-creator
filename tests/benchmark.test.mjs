import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateDescriptionXml } from "../convex/gdtf.ts";
import {
  repairFixtureData,
  repairFixtureDataWithReport,
} from "../convex/schema/fixture.ts";
import { parseReferenceXml, reportHtml, scoreFixture } from "../scripts/benchmark.ts";

const fixture = {
  manufacturer: "Benchmark Co",
  name: "Reference One",
  shortName: "Ref1",
  fixtureType: "Spot",
  dmxModes: [{
    name: "2 channel",
    channelCount: 2,
    channels: [
      { channel: 1, gdtfAttribute: "Dimmer", prettyName: "Dim", defaultValue: 0 },
      {
        channel: 2,
        gdtfAttribute: "Shutter1",
        prettyName: "Shutter",
        defaultValue: 0,
        functions: [
          { name: "Open", dmxFrom: 0, dmxTo: 127 },
          { name: "Strobe", dmxFrom: 128, dmxTo: 255, attribute: "Shutter1Strobe" },
        ],
      },
    ],
  }],
  physical: {
    weight: "8 kg",
    width: "200 mm",
    height: "300 mm",
    depth: "200 mm",
    powerConsumption: "400 W",
  },
  wheels: [{
    name: "Color Wheel 1",
    type: "Color",
    slots: [
      { name: "Open", color: "#ffffff" },
      { name: "Red", color: "#ff0000" },
    ],
  }],
  beam: {
    lampType: "LED",
    beamAngle: 25,
    fieldAngle: 25,
    colorTemperature: 6000,
    cri: 100,
    luminousFlux: 10000,
    beamType: "Spot",
  },
};

test("parses real-world geometry-reference channels without double-offsetting", () => {
  const reference = parseReferenceXml(
    readFileSync(new URL("./fixtures/tornado-geometry-reference.xml", import.meta.url), "utf8"),
  );

  assert.equal(reference.modes[0].channelCount, 170);
  assert.equal(reference.modes[0].channels.filter((channel) => channel.offset === 169).length, 1);
  assert.ok(reference.modes[0].channels.some((channel) => channel.offset === 40));
});

test("scores matching extracted data against generated GDTF", () => {
  const reference = parseReferenceXml(generateDescriptionXml(fixture));
  const scores = scoreFixture(fixture, reference);

  assert.equal(scores.total, 100);
  assert.deepEqual(
    [scores.identity, scores.modes, scores.channels, scores.functions, scores.wheels, scores.physical],
    [100, 100, 100, 100, 100, 100],
  );

  const html = reportHtml([{
    key: "test",
    fixture: fixture.name,
    path: "claude-haiku-native",
    status: "ok",
    modelId: "test-model",
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    preprocessingMs: 10,
    generationMs: 20,
    durationMs: 30,
    scores,
    output: fixture,
  }], 1);
  assert.match(html, /Truth\s*<br>vs Tokens/);
  assert.match(html, /id="scatter"/);
  assert.match(html, /test-model/);
  assert.doesNotThrow(() => new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]));
});

test("scorer reacts predictably to controlled perturbations", () => {
  const reference = parseReferenceXml(generateDescriptionXml(fixture));
  const score = (change) => scoreFixture(change(structuredClone(fixture)), reference);

  const missingChannel = score((value) => {
    value.dmxModes[0].channels.pop();
    return value;
  });
  assert.ok(missingChannel.channels < 100, "missing channel lowers channel score");

  const wrongAttribute = score((value) => {
    value.dmxModes[0].channels[0].gdtfAttribute = "Zoom";
    return value;
  });
  assert.ok(wrongAttribute.channels < missingChannel.channels, "wrong attribute lowers channel score");

  const shiftedBoundary = score((value) => {
    value.dmxModes[0].channels[1].functions[0].dmxTo = 129;
    value.dmxModes[0].channels[1].functions[1].dmxFrom = 130;
    return value;
  });
  assert.ok(
    shiftedBoundary.functions > 95 && shiftedBoundary.functions < 100,
    "small boundary shift receives a small IoU penalty",
  );

  const missingMode = score((value) => {
    value.dmxModes = [];
    return value;
  });
  assert.equal(missingMode.modes, 0, "missing mode lowers mode score");
  assert.equal(missingMode.channels, 0, "missing mode lowers channel score");

  const extraWheelSlot = score((value) => {
    value.wheels[0].slots.push({ name: "Blue", color: "#0000ff" });
    return value;
  });
  assert.ok(extraWheelSlot.wheels < 100, "hallucinated wheel slot lowers wheel precision");

  const wrongWheelColor = score((value) => {
    value.wheels[0].slots[1].color = "#0000ff";
    return value;
  });
  assert.ok(wrongWheelColor.wheels < 100, "wrong wheel color lowers wheel score");

  const wrongDefault = score((value) => {
    value.dmxModes[0].channels[0].defaultValue = 255;
    return value;
  });
  assert.ok(wrongDefault.channels < 100, "wrong default lowers channel score");

  const wrongWeight = score((value) => {
    value.physical.weight = "16 kg";
    return value;
  });
  assert.ok(wrongWeight.physical < 100, "wrong physical value lowers physical score");

  const equivalentWeightUnit = score((value) => {
    value.physical.weight = "17.63698 lb";
    return value;
  });
  assert.ok(equivalentWeightUnit.physical > 99.99, "equivalent weight units compare equally");

  const wrongBeamType = score((value) => {
    value.beam.beamType = "Wash";
    return value;
  });
  assert.ok(wrongBeamType.physical < 100, "wrong beam type lowers physical score");

  const punctuationOnly = score((value) => {
    value.manufacturer = "BENCHMARK---CO";
    value.name = "REFERENCE...ONE";
    return value;
  });
  assert.equal(punctuationOnly.identity, 100, "case and punctuation do not alter identity score");

  const reordered = score((value) => {
    value.dmxModes[0].channels.reverse();
    return value;
  });
  assert.equal(reordered.total, 100, "channel order does not alter score when offsets match");

  const normalized = scoreFixture(fixture, reference, 3);
  assert.equal(normalized.normalizationPenalty, 6, "each deterministic repair costs two points");
  assert.equal(normalized.total, 94, "normalization penalty reduces total score");

});

test("uses globally optimal mode pairing", () => {
  const candidate = {
    ...fixture,
    dmxModes: [
      { name: "A", channelCount: 10, channels: [] },
      { name: "A", channelCount: 30, channels: [] },
    ],
  };
  const reference = {
    manufacturer: fixture.manufacturer,
    name: fixture.name,
    modes: [
      { name: "A", channelCount: 21, channels: [], functions: [] },
      { name: "B", channelCount: 30, channels: [], functions: [] },
    ],
    wheelSlots: [],
    physical: {},
  };

  assert.ok(Math.abs(scoreFixture(candidate, reference).modes - 67.8571428571) < 1e-9);
});

test("scores explicit fine-channel linkage", () => {
  const fineFixture = {
    ...fixture,
    wheels: undefined,
    dmxModes: [{
      name: "Pan 16-bit",
      channelCount: 2,
      channels: [
        { channel: 1, gdtfAttribute: "Pan", prettyName: "Pan", defaultValue: 128 },
        { channel: 2, gdtfAttribute: "Pan", prettyName: "Pan fine", defaultValue: 0, fineOf: 1 },
      ],
    }],
  };
  const reference = parseReferenceXml(generateDescriptionXml(fineFixture));
  const exact = scoreFixture(fineFixture, reference);
  const unlinked = structuredClone(fineFixture);
  delete unlinked.dmxModes[0].channels[1].fineOf;

  assert.equal(exact.channels, 100);
  assert.ok(scoreFixture(unlinked, reference).channels < 100);
});

test("repairs redundant channels and sub-fixture layouts", () => {
  const repaired = repairFixtureData({
    ...fixture,
    dmxModes: [{
      ...fixture.dmxModes[0],
      channels: [
        ...fixture.dmxModes[0].channels,
        { channel: 3, gdtfAttribute: "Function", prettyName: "Extra", defaultValue: 0 },
      ],
      subFixtures: {
        name: "Pixel",
        count: 1,
        firstChannel: 1,
        channels: [{ gdtfAttribute: "Dimmer", prettyName: "Dim", defaultValue: 0 }],
      },
    }],
  });

  assert.equal(repaired.dmxModes[0].channels.length, 2);
  assert.equal(repaired.dmxModes[0].subFixtures, undefined);
});

test("repairs provider placeholders and incomplete layouts", () => {
  const malformed = structuredClone(fixture);
  malformed.wheels = [];
  malformed.dmxModes[0].channelCount = 5;
  malformed.dmxModes[0].channels[0].fineOf = 0;
  malformed.dmxModes[0].channels[1].functions.at(-1).dmxTo = 254;
  malformed.dmxModes[0].subFixtures = { name: "", count: 0, channels: [], firstChannel: 0 };
  malformed.dmxModes.push({ name: "Settings", channelCount: 0, channels: [] });

  const { fixtureData: repaired, repairs } = repairFixtureDataWithReport(malformed);

  assert.equal(repaired.wheels, undefined);
  assert.equal(repaired.dmxModes.length, 1);
  assert.equal(repaired.dmxModes[0].channelCount, 2);
  assert.equal(repaired.dmxModes[0].channels[0].fineOf, undefined);
  assert.equal(repaired.dmxModes[0].channels[1].functions.at(-1).dmxTo, 255);
  assert.ok(repairs.length > 0);
});

test("expands sub-fixture geometry references for channel scoring", () => {
  const pixelFixture = {
    ...fixture,
    wheels: undefined,
    dmxModes: [{
      name: "Pixels",
      channelCount: 7,
      channels: [
        { channel: 1, gdtfAttribute: "Dimmer", prettyName: "Dim", defaultValue: 0 },
      ],
      subFixtures: {
        name: "Pixel",
        count: 2,
        firstChannel: 2,
        channels: [
          { gdtfAttribute: "ColorAdd_R", prettyName: "R", defaultValue: 0 },
          { gdtfAttribute: "ColorAdd_G", prettyName: "G", defaultValue: 0 },
          { gdtfAttribute: "ColorAdd_B", prettyName: "B", defaultValue: 0 },
        ],
      },
    }],
  };
  const scores = scoreFixture(pixelFixture, parseReferenceXml(generateDescriptionXml(pixelFixture)));

  assert.equal(scores.modes, 100);
  assert.equal(scores.channels, 100);
  assert.equal(scores.wheels, null, "absent GDTF wheels are excluded from scoring");
});
