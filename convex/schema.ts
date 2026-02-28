import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const channelFunction = v.object({
  name: v.string(),
  dmxFrom: v.number(),
  dmxTo: v.number(),
  attribute: v.optional(v.string()),
  physicalFrom: v.optional(v.number()),
  physicalTo: v.optional(v.number()),
});

const dmxChannel = v.object({
  channel: v.number(),
  gdtfAttribute: v.string(),
  prettyName: v.string(),
  defaultValue: v.number(),
  functions: v.optional(v.array(channelFunction)),
});

const subFixtureChannel = v.object({
  gdtfAttribute: v.string(),
  prettyName: v.string(),
  defaultValue: v.number(),
  functions: v.optional(v.array(channelFunction)),
});

const subFixtureLayout = v.object({
  name: v.string(),
  count: v.number(),
  channels: v.array(subFixtureChannel),
  firstChannel: v.number(),
});

const dmxMode = v.object({
  name: v.string(),
  channelCount: v.number(),
  channels: v.array(dmxChannel),
  subFixtures: v.optional(subFixtureLayout),
});

const wheelSlot = v.object({
  name: v.string(),
  color: v.optional(v.string()),
});

const wheel = v.object({
  name: v.string(),
  type: v.union(v.literal("Color"), v.literal("Gobo")),
  slots: v.array(wheelSlot),
});

const beamProperties = v.object({
  lampType: v.optional(v.string()),
  beamAngle: v.optional(v.number()),
  fieldAngle: v.optional(v.number()),
  colorTemperature: v.optional(v.number()),
  cri: v.optional(v.number()),
  luminousFlux: v.optional(v.number()),
  beamType: v.optional(v.string()),
});

const physicalProperties = v.object({
  weight: v.string(),
  width: v.string(),
  height: v.string(),
  depth: v.string(),
  powerConsumption: v.string(),
  panRange: v.optional(v.number()),
  tiltRange: v.optional(v.number()),
});

const fixtureData = v.object({
  manufacturer: v.string(),
  name: v.string(),
  shortName: v.string(),
  fixtureType: v.string(),
  dmxModes: v.array(dmxMode),
  physical: physicalProperties,
  wheels: v.optional(v.array(wheel)),
  beam: v.optional(beamProperties),
});

export default defineSchema({
  sessions: defineTable({
    status: v.union(
      v.literal("uploading"),
      v.literal("extracting"),
      v.literal("complete"),
      v.literal("error")
    ),
    pdfStorageId: v.optional(v.id("_storage")),
    fixtureData: v.optional(fixtureData),
    gdtfStorageId: v.optional(v.id("_storage")),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  }),
});
