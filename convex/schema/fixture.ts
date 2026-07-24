import { z } from "zod";

const requiredString = z.string().trim().min(1);
const positiveInt = z.number().int().positive();
const nonNegativeNumber = z.number().nonnegative();
const dmxValue = z.number().int().min(0).max(255);

export const channelFunctionSchema = z
  .object({
    name: requiredString,
    dmxFrom: dmxValue,
    dmxTo: dmxValue,
    attribute: z.optional(requiredString),
    physicalFrom: z.optional(z.number()),
    physicalTo: z.optional(z.number()),
  })
  .refine(({ dmxFrom, dmxTo }) => dmxFrom <= dmxTo, {
    message: "dmxFrom must be less than or equal to dmxTo",
    path: ["dmxTo"],
  });

const channelFunctionsSchema = z
  .array(channelFunctionSchema)
  .min(1)
  .superRefine((functions, ctx) => {
    if (functions[0].dmxFrom !== 0) {
      ctx.addIssue({
        code: "custom",
        message: "Channel functions must start at DMX value 0",
        path: [0, "dmxFrom"],
      });
    }
    if (functions.at(-1)?.dmxTo !== 255) {
      ctx.addIssue({
        code: "custom",
        message: "Channel functions must end at DMX value 255",
        path: [functions.length - 1, "dmxTo"],
      });
    }
    for (let i = 1; i < functions.length; i++) {
      if (functions[i].dmxFrom !== functions[i - 1].dmxTo + 1) {
        ctx.addIssue({
          code: "custom",
          message: "Channel function ranges must be ordered and contiguous",
          path: [i, "dmxFrom"],
        });
      }
    }
  });

export const dmxChannelSchema = z.object({
  channel: positiveInt,
  gdtfAttribute: requiredString,
  prettyName: requiredString,
  defaultValue: dmxValue,
  fineOf: z.optional(positiveInt),
  functions: z.optional(channelFunctionsSchema),
});

export const subFixtureChannelSchema = z.object({
  gdtfAttribute: requiredString,
  prettyName: requiredString,
  defaultValue: dmxValue,
  functions: z.optional(channelFunctionsSchema),
});

export const subFixtureLayoutSchema = z.object({
  name: requiredString,
  count: positiveInt,
  channels: z.array(subFixtureChannelSchema).min(1),
  firstChannel: positiveInt,
});

export const dmxModeSchema = z
  .object({
    name: requiredString,
    channelCount: positiveInt,
    channels: z.array(dmxChannelSchema),
    subFixtures: z.optional(subFixtureLayoutSchema),
  })
  .superRefine((mode, ctx) => {
    const occupied = new Set<number>();
    const channelsByNumber = new Map(
      mode.channels.map((channel) => [channel.channel, channel])
    );
    const fineTargets = new Set<number>();
    for (let i = 0; i < mode.channels.length; i++) {
      const current = mode.channels[i];
      const channel = current.channel;
      if (channel > mode.channelCount) {
        ctx.addIssue({
          code: "custom",
          message: "Channel exceeds mode channel count",
          path: ["channels", i, "channel"],
        });
      }
      if (occupied.has(channel)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate channel number",
          path: ["channels", i, "channel"],
        });
      }
      occupied.add(channel);

      if (current.fineOf !== undefined) {
        const coarse = channelsByNumber.get(current.fineOf);
        if (
          !coarse ||
          coarse.fineOf !== undefined ||
          coarse.channel >= current.channel ||
          coarse.gdtfAttribute !== current.gdtfAttribute
        ) {
          ctx.addIssue({
            code: "custom",
            message: "fineOf must reference an earlier coarse channel with the same attribute",
            path: ["channels", i, "fineOf"],
          });
        } else if (fineTargets.has(current.fineOf)) {
          ctx.addIssue({
            code: "custom",
            message: "A coarse channel can only have one fine channel",
            path: ["channels", i, "fineOf"],
          });
        }
        fineTargets.add(current.fineOf);
      }
    }

    let highestChannel = Math.max(0, ...occupied);
    if (mode.subFixtures) {
      const { firstChannel, count, channels } = mode.subFixtures;
      const lastChannel = firstChannel + count * channels.length - 1;
      highestChannel = Math.max(highestChannel, lastChannel);
      for (let channel = firstChannel; channel <= lastChannel; channel++) {
        if (occupied.has(channel)) {
          ctx.addIssue({
            code: "custom",
            message: "Sub-fixture channels overlap global channels",
            path: ["subFixtures", "firstChannel"],
          });
          break;
        }
      }
    }

    if (highestChannel !== mode.channelCount) {
      ctx.addIssue({
        code: "custom",
        message: "Declared channel count does not match channel layout",
        path: ["channelCount"],
      });
    }
  });

export const wheelSlotSchema = z.object({
  name: requiredString,
  color: z.optional(z.string().regex(/^#[0-9a-f]{6}$/i)),
});

export const wheelSchema = z.object({
  name: requiredString,
  type: z.enum(["Color", "Gobo"]),
  slots: z.array(wheelSlotSchema).min(1),
});

export const beamPropertiesSchema = z.object({
  lampType: z.optional(requiredString),
  beamAngle: z.optional(nonNegativeNumber),
  fieldAngle: z.optional(nonNegativeNumber),
  colorTemperature: z.optional(nonNegativeNumber),
  cri: z.optional(z.number().min(0).max(100)),
  luminousFlux: z.optional(nonNegativeNumber),
  beamType: z.optional(z.enum(["Wash", "Spot", "None"])),
});

export const physicalPropertiesSchema = z.object({
  weight: requiredString,
  width: requiredString,
  height: requiredString,
  depth: requiredString,
  powerConsumption: requiredString,
  panRange: z.optional(nonNegativeNumber),
  tiltRange: z.optional(nonNegativeNumber),
});

export const fixtureDataSchema = z.object({
  manufacturer: requiredString,
  name: requiredString,
  shortName: requiredString,
  fixtureType: z.enum([
    "MovingHead",
    "Spot",
    "Wash",
    "Beam",
    "Profile",
    "Blinder",
    "Strobe",
    "Laser",
    "Dimmer",
    "Effect",
    "LED",
    "Other",
  ]),
  dmxModes: z.array(dmxModeSchema).min(1),
  physical: physicalPropertiesSchema,
  wheels: z.optional(z.array(wheelSchema).min(1)),
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
