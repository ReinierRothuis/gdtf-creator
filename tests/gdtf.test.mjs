import assert from "node:assert/strict";
import test from "node:test";
import { generateDescriptionXml } from "../convex/gdtf.ts";
import { fixtureDataSchema } from "../convex/schema/fixture.ts";

const fixture = {
  manufacturer: "Test",
  name: "Test Fixture",
  shortName: "Test",
  fixtureType: "Spot",
  dmxModes: [
    {
      name: "2ch",
      channelCount: 2,
      channels: [
        {
          channel: 1,
          gdtfAttribute: "Color1",
          prettyName: "Color",
          defaultValue: 0,
          functions: [
            { name: "Open", dmxFrom: 0, dmxTo: 9 },
            { name: "Red", dmxFrom: 10, dmxTo: 255 },
          ],
        },
        {
          channel: 2,
          gdtfAttribute: "Shutter1",
          prettyName: "Shutter",
          defaultValue: 0,
          functions: [
            {
              name: "Shutter open",
              dmxFrom: 0,
              dmxTo: 19,
              attribute: "Shutter1",
            },
            {
              name: "Shutter open",
              dmxFrom: 20,
              dmxTo: 255,
              attribute: "Shutter1Strobe",
            },
          ],
        },
      ],
    },
  ],
  physical: {
    weight: "1 kg",
    width: "100 mm",
    height: "100 mm",
    depth: "100 mm",
    powerConsumption: "100 W",
  },
  wheels: [
    {
      name: "Color Wheel 1",
      type: "Color",
      slots: [
        { name: "Open", color: "#ffffff" },
        { name: "Red", color: "#ff0000" },
      ],
    },
  ],
};

test("validates fixture semantics and wheel colors", () => {
  assert.equal(fixtureDataSchema.safeParse(fixture).success, true);
  assert.equal(
    fixtureDataSchema.safeParse({
      ...fixture,
      dmxModes: [
        {
          ...fixture.dmxModes[0],
          channels: [
            { ...fixture.dmxModes[0].channels[0], defaultValue: 256 },
          ],
        },
      ],
    }).success,
    false,
  );
});

test("emits declared attributes, unique functions, and linked CIE wheel slots", () => {
  const xml = generateDescriptionXml(fixtureDataSchema.parse(fixture));
  assert.match(xml, /<Attribute Name="Shutter1Strobe"/);
  assert.match(xml, /Name="Shutter_open_1"/);
  assert.match(xml, /Name="Shutter_open_2"/);
  assert.match(xml, /Wheel="Color Wheel 1"/);
  assert.match(xml, /WheelSlotIndex="2"/);
  assert.match(xml, /Color="0\.640000,0\.330000,21\.267290"/);
});

test("only merges explicitly linked fine channels", () => {
  const parsed = fixtureDataSchema.parse({
    ...fixture,
    wheels: undefined,
    dmxModes: [
      {
        name: "4ch",
        channelCount: 4,
        channels: [
          { channel: 1, gdtfAttribute: "Dimmer", prettyName: "Dim 1", defaultValue: 0 },
          { channel: 2, gdtfAttribute: "Dimmer", prettyName: "Dim 2", defaultValue: 0 },
          {
            channel: 3,
            gdtfAttribute: "Pan",
            prettyName: "Pan",
            defaultValue: 255,
            functions: [
              { name: "Low", dmxFrom: 0, dmxTo: 24 },
              { name: "High", dmxFrom: 25, dmxTo: 255 },
            ],
          },
          { channel: 4, gdtfAttribute: "Pan", prettyName: "Pan fine", defaultValue: 0, fineOf: 3 },
        ],
      },
    ],
  });
  const xml = generateDescriptionXml(parsed);
  assert.match(xml, /Offset="1"[^>]*>[\s\S]*?<LogicalChannel Attribute="Dimmer"/);
  assert.match(xml, /Offset="2"[^>]*>[\s\S]*?<LogicalChannel Attribute="Dimmer2"/);
  assert.match(xml, /Offset="3,4"[^>]*>[\s\S]*?<LogicalChannel Attribute="Pan"/);
  assert.match(xml, /Highlight="None"[^>]*InitialFunction="Base_Pan\.Pan\.High_2"/);
  assert.match(xml, /Name="High_2" Default="255\/1" DMXFrom="25\/1s"/);
  assert.doesNotMatch(xml, /(?:25|255)\/2/);
  assert.doesNotMatch(xml, /Offset="1,2"/);
});

test("builds geometry references from each mode's sub-fixture layout", () => {
  const parsed = fixtureDataSchema.parse({
    ...fixture,
    wheels: undefined,
    dmxModes: [
      {
        name: "Cells",
        channelCount: 7,
        channels: [
          { channel: 1, gdtfAttribute: "Dimmer", prettyName: "Dim", defaultValue: 0 },
        ],
        subFixtures: {
          name: "Cell",
          count: 2,
          firstChannel: 2,
          channels: [
            { gdtfAttribute: "ColorAdd_R", prettyName: "R", defaultValue: 0 },
            { gdtfAttribute: "ColorAdd_G", prettyName: "G", defaultValue: 0 },
            { gdtfAttribute: "ColorAdd_B", prettyName: "B", defaultValue: 0 },
          ],
        },
      },
      {
        name: "Pixels",
        channelCount: 3,
        channels: [],
        subFixtures: {
          name: "Pixel",
          count: 3,
          firstChannel: 1,
          channels: [
            { gdtfAttribute: "ColorAdd_R", prettyName: "R", defaultValue: 0 },
          ],
        },
      },
    ],
  });
  const xml = generateDescriptionXml(parsed);
  const base1 = xml.match(/<Geometry Name="Base_1"[^>]*>([\s\S]*?)<\/Geometry>/)?.[1];
  const base2 = xml.match(/<Geometry Name="Base_2"[^>]*>([\s\S]*?)<\/Geometry>/)?.[1];
  assert.ok(base1);
  assert.ok(base2);
  assert.equal(base1.match(/<GeometryReference/g)?.length, 2);
  assert.match(base1, /DMXOffset="2"/);
  assert.match(base1, /DMXOffset="5"/);
  assert.equal(base2.match(/<GeometryReference/g)?.length, 3);
  assert.match(xml, /<DMXMode Name="Cells"[^>]*Geometry="Base_1"/);
  assert.match(xml, /<DMXMode Name="Pixels"[^>]*Geometry="Base_2"/);
});
