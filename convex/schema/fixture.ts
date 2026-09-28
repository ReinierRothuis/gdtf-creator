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
    attribute: z.optional(requiredString).describe(
      "GDTF attribute active in this range. Always set this for every function when a channel has multiple ranges; do not rely on the channel default."
    ),
    physicalFrom: z.optional(z.number()),
    physicalTo: z.optional(z.number()),
  })
  .refine(({ dmxFrom, dmxTo }) => dmxFrom <= dmxTo, {
    message: "dmxFrom must be less than or equal to dmxTo",
    path: ["dmxTo"],
  });

const channelFunctionsSchema = z
  .array(channelFunctionSchema)
  .superRefine((functions, ctx) => {
    if (!functions.length) return;
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
  gdtfAttribute: requiredString.describe(
    "Exact standard GDTF attribute, not the manual label (for example Lime is ColorAdd_GY)."
  ),
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
  count: positiveInt.describe("Number of identical contiguous repeated blocks."),
  channels: z.array(subFixtureChannelSchema).min(1).describe(
    "Complete ordered channel template for one repeated block; blocks may be heads or sections, not only pixels."
  ),
  firstChannel: positiveInt.describe("Actual DMX channel where the first repeated block starts."),
});

export const dmxModeSchema = z
  .object({
    name: requiredString,
    channelCount: positiveInt,
    channels: z.array(dmxChannelSchema).describe(
      "Direct/global channels only. If exact blocks repeat, put their full template in subFixtures instead of expanding them here."
    ),
    subFixtures: z.optional(subFixtureLayoutSchema).describe(
      "Compact exact repeated head/cell/pixel blocks. Exclude these expanded channels from channels."
    ),
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
    const occupiedCount = occupied.size + (mode.subFixtures
      ? mode.subFixtures.count * mode.subFixtures.channels.length
      : 0);
    if (occupiedCount !== mode.channelCount) {
      ctx.addIssue({
        code: "custom",
        message: "Channel layout must account for every channel in the mode",
        path: ["channels"],
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

/** Repair common structured-output serialization/layout mistakes before strict validation. */
export function repairFixtureDataWithReport(value: unknown): {
  fixtureData: FixtureData;
  repairs: string[];
} {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const fixture = structuredClone(parsed) as Record<string, any>;
  const repairs: string[] = [];

  for (const key of ["dmxModes", "physical", "wheels", "beam"]) {
    if (typeof fixture[key] === "string") {
      fixture[key] = JSON.parse(fixture[key]);
      repairs.push(`parsed stringified ${key}`);
    }
  }
  if (Array.isArray(fixture.wheels) && fixture.wheels.length === 0) {
    delete fixture.wheels;
    repairs.push("removed empty wheels");
  }
  let removedInvalidWheelColors = false;
  for (const wheel of Array.isArray(fixture.wheels) ? fixture.wheels : []) {
    for (const slot of Array.isArray(wheel.slots) ? wheel.slots : []) {
      if (slot.color !== undefined && !/^#[0-9a-f]{6}$/i.test(slot.color)) {
        delete slot.color;
        removedInvalidWheelColors = true;
      }
    }
  }
  if (removedInvalidWheelColors) repairs.push("removed invalid wheel colors");
  if (fixture.physical && typeof fixture.physical === "object") {
    for (const key of ["panRange", "tiltRange"]) {
      if (fixture[key] !== undefined && fixture.physical[key] === undefined) {
        fixture.physical[key] = fixture[key];
        delete fixture[key];
        repairs.push(`moved ${key} into physical`);
      }
    }
  }

  if (Array.isArray(fixture.dmxModes)) {
    fixture.dmxModes = fixture.dmxModes.filter((mode: Record<string, any>) => {
      const valid = Number.isInteger(mode.channelCount) && mode.channelCount > 0 &&
        Array.isArray(mode.channels) && mode.channels.length > 0;
      if (!valid) repairs.push(`removed invalid mode ${mode.name ?? "unnamed"}`);
      return valid;
    });
  }

  for (const mode of Array.isArray(fixture.dmxModes) ? fixture.dmxModes : []) {
    const originalCount = mode.channels.length;
    mode.channels = mode.channels.filter(
      (channel: Record<string, unknown>) =>
        Number.isInteger(channel.channel) && Number(channel.channel) > 0 && Number(channel.channel) <= mode.channelCount
    );
    for (let index = mode.channels.length; index < originalCount; index++) {
      repairs.push(`removed out-of-range channel from ${mode.name}`);
    }

    if (mode.subFixtures === null) {
      delete mode.subFixtures;
      repairs.push(`removed null sub-fixture layout from ${mode.name}`);
    }
    if (mode.subFixtures && (
      !Number.isInteger(mode.subFixtures.count) || mode.subFixtures.count < 1 ||
      !Number.isInteger(mode.subFixtures.firstChannel) || mode.subFixtures.firstChannel < 1 ||
      !Array.isArray(mode.subFixtures.channels) || mode.subFixtures.channels.length < 1
    )) {
      delete mode.subFixtures;
      repairs.push(`removed invalid sub-fixture layout from ${mode.name}`);
    }

    let removedEmptyFunctions = false;
    const allChannels = [
      ...mode.channels,
      ...(Array.isArray(mode.subFixtures?.channels) ? mode.subFixtures.channels : []),
    ];
    for (const channel of allChannels) {
      if (Array.isArray(channel.functions) && channel.functions.length === 0) {
        delete channel.functions;
        removedEmptyFunctions = true;
      }
    }
    if (removedEmptyFunctions) repairs.push(`removed empty functions from ${mode.name}`);

    const channelsByNumber = new Map<number, Record<string, any>>(
      mode.channels.map((channel: Record<string, any>) => [channel.channel, channel])
    );
    const fineTargets = new Set<number>();
    let removedFineLinks = false;
    let normalizedFunctions = false;
    for (const channel of allChannels) {
      if (channel.fineOf !== undefined) {
        const coarse = channelsByNumber.get(channel.fineOf);
        if (
          !Number.isInteger(channel.fineOf) || channel.fineOf < 1 || !coarse ||
          coarse.fineOf !== undefined || coarse.channel >= channel.channel ||
          coarse.gdtfAttribute !== channel.gdtfAttribute || fineTargets.has(channel.fineOf)
        ) {
          delete channel.fineOf;
          removedFineLinks = true;
        } else {
          fineTargets.add(channel.fineOf);
        }
      }

      if (Array.isArray(channel.functions) && channel.functions.length) {
        const functions = channel.functions
          .filter((fn: Record<string, unknown>) => Number.isFinite(fn.dmxFrom) && Number.isFinite(fn.dmxTo))
          .sort((left: Record<string, number>, right: Record<string, number>) => left.dmxFrom - right.dmxFrom)
          .filter((fn: Record<string, number>, index: number, all: Array<Record<string, number>>) =>
            index === 0 || fn.dmxFrom !== all[index - 1].dmxFrom
          );
        if (functions.length) {
          for (let index = 0; index < functions.length; index++) {
            const from = index === 0 ? 0 : Math.max(0, Math.min(255, Math.round(functions[index].dmxFrom)));
            const to = index === functions.length - 1
              ? 255
              : Math.max(from, Math.min(255, Math.round(functions[index + 1].dmxFrom) - 1));
            if (functions[index].dmxFrom !== from || functions[index].dmxTo !== to) normalizedFunctions = true;
            functions[index].dmxFrom = from;
            functions[index].dmxTo = to;
          }
          channel.functions = functions;
        } else {
          delete channel.functions;
          normalizedFunctions = true;
        }
      }
    }
    if (removedFineLinks) repairs.push(`removed invalid fine links from ${mode.name}`);
    if (normalizedFunctions) repairs.push(`normalized function ranges in ${mode.name}`);

    const highestGlobal = Math.max(0, ...mode.channels.map((channel: Record<string, number>) => channel.channel));
    if (mode.subFixtures) {
      const first = mode.subFixtures.firstChannel;
      const last = first + mode.subFixtures.count * mode.subFixtures.channels.length - 1;
      if (mode.channels.some((channel: Record<string, number>) =>
        channel.channel >= first && channel.channel <= last)) {
        delete mode.subFixtures;
        repairs.push(`removed overlapping sub-fixture layout from ${mode.name}`);
      }
    }
    const highestChannel = mode.subFixtures
      ? Math.max(highestGlobal, mode.subFixtures.firstChannel + mode.subFixtures.count * mode.subFixtures.channels.length - 1)
      : highestGlobal;
    if (highestChannel > 0 && highestChannel !== mode.channelCount) {
      repairs.push(`changed channel count from ${mode.channelCount} to ${highestChannel} in ${mode.name}`);
      mode.channelCount = highestChannel;
    }
  }

  return { fixtureData: fixtureDataSchema.parse(fixture), repairs };
}

export function repairFixtureData(value: unknown): FixtureData {
  return repairFixtureDataWithReport(value).fixtureData;
}
