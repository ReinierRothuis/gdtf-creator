import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const dmxChannel = v.object({
  channel: v.number(),
  gdtfAttribute: v.string(),
  prettyName: v.string(),
  defaultValue: v.number(),
});

const dmxMode = v.object({
  name: v.string(),
  channelCount: v.number(),
  channels: v.array(dmxChannel),
});

const physicalProperties = v.object({
  weight: v.string(),
  width: v.string(),
  height: v.string(),
  depth: v.string(),
  powerConsumption: v.string(),
});

const fixtureData = v.object({
  manufacturer: v.string(),
  name: v.string(),
  shortName: v.string(),
  fixtureType: v.string(),
  dmxModes: v.array(dmxMode),
  physical: physicalProperties,
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
