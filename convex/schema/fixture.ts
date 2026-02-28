import { z } from "zod";

export const dmxChannelSchema = z.object({
  channel: z.number(),
  gdtfAttribute: z.string(),
  prettyName: z.string(),
  defaultValue: z.number(),
});

export const dmxModeSchema = z.object({
  name: z.string(),
  channelCount: z.number(),
  channels: z.array(dmxChannelSchema),
});

export const physicalPropertiesSchema = z.object({
  weight: z.string(),
  width: z.string(),
  height: z.string(),
  depth: z.string(),
  powerConsumption: z.string(),
});

export const fixtureDataSchema = z.object({
  manufacturer: z.string(),
  name: z.string(),
  shortName: z.string(),
  fixtureType: z.string(),
  dmxModes: z.array(dmxModeSchema),
  physical: physicalPropertiesSchema,
});

export type DmxChannel = z.infer<typeof dmxChannelSchema>;
export type DmxMode = z.infer<typeof dmxModeSchema>;
export type PhysicalProperties = z.infer<typeof physicalPropertiesSchema>;
export type FixtureData = z.infer<typeof fixtureDataSchema>;
