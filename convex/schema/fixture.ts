import { z } from "zod";

export const channelFunctionSchema = z.object({
  name: z.string(),
  dmxFrom: z.number(),
  dmxTo: z.number(),
  attribute: z.optional(z.string()),
  physicalFrom: z.optional(z.number()),
  physicalTo: z.optional(z.number()),
});

export const dmxChannelSchema = z.object({
  channel: z.number(),
  gdtfAttribute: z.string(),
  prettyName: z.string(),
  defaultValue: z.number(),
  functions: z.optional(z.array(channelFunctionSchema)),
});

export const subFixtureChannelSchema = z.object({
  gdtfAttribute: z.string(),
  prettyName: z.string(),
  defaultValue: z.number(),
  functions: z.optional(z.array(channelFunctionSchema)),
});

export const subFixtureLayoutSchema = z.object({
  name: z.string(),
  count: z.number(),
  channels: z.array(subFixtureChannelSchema),
  firstChannel: z.number(),
});

export const dmxModeSchema = z.object({
  name: z.string(),
  channelCount: z.number(),
  channels: z.array(dmxChannelSchema),
  subFixtures: z.optional(subFixtureLayoutSchema),
});

export const wheelSlotSchema = z.object({
  name: z.string(),
  color: z.optional(z.string()),
});

export const wheelSchema = z.object({
  name: z.string(),
  type: z.enum(["Color", "Gobo"]),
  slots: z.array(wheelSlotSchema),
});

export const beamPropertiesSchema = z.object({
  lampType: z.optional(z.string()),
  beamAngle: z.optional(z.number()),
  fieldAngle: z.optional(z.number()),
  colorTemperature: z.optional(z.number()),
  cri: z.optional(z.number()),
  luminousFlux: z.optional(z.number()),
  beamType: z.optional(z.string()),
});

export const physicalPropertiesSchema = z.object({
  weight: z.string(),
  width: z.string(),
  height: z.string(),
  depth: z.string(),
  powerConsumption: z.string(),
  panRange: z.optional(z.number()),
  tiltRange: z.optional(z.number()),
});

export const fixtureDataSchema = z.object({
  manufacturer: z.string(),
  name: z.string(),
  shortName: z.string(),
  fixtureType: z.string(),
  dmxModes: z.array(dmxModeSchema),
  physical: physicalPropertiesSchema,
  wheels: z.optional(z.array(wheelSchema)),
  beam: z.optional(beamPropertiesSchema),
});

export type ChannelFunction = z.infer<typeof channelFunctionSchema>;
export type DmxChannel = z.infer<typeof dmxChannelSchema>;
export type SubFixtureChannel = z.infer<typeof subFixtureChannelSchema>;
export type SubFixtureLayout = z.infer<typeof subFixtureLayoutSchema>;
export type DmxMode = z.infer<typeof dmxModeSchema>;
export type WheelSlot = z.infer<typeof wheelSlotSchema>;
export type Wheel = z.infer<typeof wheelSchema>;
export type BeamProperties = z.infer<typeof beamPropertiesSchema>;
export type PhysicalProperties = z.infer<typeof physicalPropertiesSchema>;
export type FixtureData = z.infer<typeof fixtureDataSchema>;
