import { createHash } from "node:crypto";
import { readdir, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import {
  fixtureDataSchema,
  repairFixtureDataWithReport,
  type FixtureData,
} from "../convex/schema/fixture.ts";
import {
  createExtractionRequest,
  EXTRACTION_PATHS,
  type ExtractionPath,
} from "../convex/extractionPaths.ts";
import { getExtractionPrompt } from "../convex/extractionPrompt.ts";

const BENCHMARK_VERSION = 3;
const PATH_COLORS: Record<ExtractionPath, string> = {
  "claude-haiku-native": "#d9ff43",
  "gemini-flash-lite-native": "#37d8ff",
  "openai-gpt-nano-native": "#ff6b35",
  "openrouter-unpdf-qwen": "#f44ec8",
  "cloudflare-markdown-qwen": "#a68cff",
};

// USD per 1M tokens, checked 2026-07-24 against provider pricing pages.
// Cloudflare toMarkdown is free for most PDFs; image-processing overages are not measurable here.
const PRICES: Record<ExtractionPath, Price> = {
  "claude-haiku-native": { inputPerMillion: 1, outputPerMillion: 5 },
  "gemini-flash-lite-native": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  "openai-gpt-nano-native": { inputPerMillion: 0.2, outputPerMillion: 1.25 },
  "openrouter-unpdf-qwen": {
    inputPerMillion: 0.26,
    outputPerMillion: 0.78,
    highContext: { minInputTokens: 256_000, inputPerMillion: 0.78, outputPerMillion: 2.34 },
  },
  "cloudflare-markdown-qwen": {
    inputPerMillion: 0.26,
    outputPerMillion: 0.78,
    highContext: { minInputTokens: 256_000, inputPerMillion: 0.78, outputPerMillion: 2.34 },
  },
};

type XmlNode = Record<string, any>;
type MetricScores = {
  total: number;
  identity: number;
  modes: number;
  channels: number;
  functions: number;
  wheels: number | null;
  physical: number | null;
  normalizationPenalty: number;
};
type ObservedFunction = {
  offset: number;
  channelAttribute: string;
  start: number;
  end: number;
  attribute: string;
};
type ObservedChannel = {
  offset: number;
  attribute: string;
  defaultValue?: number;
  fineOf?: number;
};
type ObservedMode = {
  name: string;
  channelCount: number;
  channels: ObservedChannel[];
  functions: ObservedFunction[];
};
type ObservedWheelSlot = { wheel: number; name: string; color?: [number, number, number] };
type Observation = {
  manufacturer: string;
  name: string;
  modes: ObservedMode[];
  wheelSlots: ObservedWheelSlot[];
  physical: Record<string, number>;
  beamType?: string;
};
type Pair = {
  name: string;
  pdfPath: string;
  gdtfPath: string;
  pdf: Buffer;
  reference: Observation;
  fingerprint: string;
};
type Price = {
  inputPerMillion: number;
  outputPerMillion: number;
  fixedPerDocument?: number;
  highContext?: { minInputTokens: number; inputPerMillion: number; outputPerMillion: number };
};
type BenchmarkResult = {
  key: string;
  fixture: string;
  path: ExtractionPath;
  status: "ok" | "error";
  modelId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  preprocessingMs: number;
  generationMs: number;
  durationMs: number;
  estimatedCost?: number;
  scores?: MetricScores;
  output?: FixtureData;
  rawOutput?: string;
  repaired?: boolean;
  repairs?: string[];
  error?: string;
};

type Options = {
  directory: string;
  output: string;
  cache: string;
  paths: ExtractionPath[];
  concurrency?: number;
  resume: boolean;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  processEntities: false,
});

function array<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function normalized(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return row[b.length];
}

function stringScore(a: string, b: string): number {
  const left = normalized(a);
  const right = normalized(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  return 1 - levenshtein(left, right) / Math.max(left.length, right.length);
}

function setF1(predicted: Iterable<string>, expected: Iterable<string>): number {
  const p = new Set(predicted);
  const e = new Set(expected);
  if (!p.size && !e.size) return 1;
  let matches = 0;
  for (const item of p) if (e.has(item)) matches++;
  return (2 * matches) / (p.size + e.size);
}

function hexToCie(hex: string): [number, number, number] | undefined {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const linearize = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const r = linearize(parseInt(hex.slice(1, 3), 16) / 255);
  const g = linearize(parseInt(hex.slice(3, 5), 16) / 255);
  const b = linearize(parseInt(hex.slice(5, 7), 16) / 255);
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const sum = X + Y + Z;
  return sum === 0 ? [0.3127, 0.329, 0] : [X / sum, Y / sum, Y * 100];
}

function physicalNumber(value: string | number | undefined, kind?: string): number | undefined {
  const match = String(value ?? "").toLowerCase().match(/-?[\d.]+/);
  if (!match) return undefined;
  let number = Number(match[0]);
  if (kind === "weight") {
    if (/\b(?:lb|lbs|pound)/.test(String(value).toLowerCase())) number *= 0.45359237;
    else if (/\bg\b/.test(String(value).toLowerCase()) && !/\bkg\b/.test(String(value).toLowerCase())) number /= 1000;
  }
  return number;
}

function dmxValue(value: unknown): number {
  const match = String(value ?? "0").match(/^(\d+)(?:\/(\d+))?/);
  if (!match) return 0;
  const raw = Number(match[1]);
  const bytes = Number(match[2] ?? 1);
  return bytes > 1 && raw > 255 ? Math.round((raw / (256 ** bytes - 1)) * 255) : raw;
}

function collectNamed(root: unknown, key: string, found: XmlNode[] = []): XmlNode[] {
  if (!root || typeof root !== "object") return found;
  for (const [name, value] of Object.entries(root as XmlNode)) {
    if (name === key) found.push(...array(value as XmlNode | XmlNode[]));
    for (const child of array(value as XmlNode | XmlNode[])) collectNamed(child, key, found);
  }
  return found;
}

function geometryReferences(fixture: XmlNode, modeGeometry: string): Map<string, number[]> {
  const map = new Map<string, number[]>();
  const roots = collectNamed(fixture.Geometries, "Geometry").filter((node) => node.Name === modeGeometry);
  for (const ref of roots.flatMap((root) => collectNamed(root, "GeometryReference"))) {
    for (const item of array(ref.Break)) {
      const offset = Number(item.DMXOffset ?? 1);
      if (Number.isFinite(offset)) map.set(ref.Geometry, [...(map.get(ref.Geometry) ?? []), offset]);
    }
  }
  for (const [geometry, offsets] of map) map.set(geometry, [...new Set(offsets)].sort((a, b) => a - b));
  return map;
}

function templateOffsets(relativeOffsets: number[], references?: number[]): number[] {
  if (!references?.length) return relativeOffsets;
  const differences = references.slice(1)
    .map((offset, index) => offset - references[index])
    .filter((difference) => difference > 0);
  const width = differences.length
    ? Math.min(...differences)
    : references[0] > 1 ? references[0] - 1 : Math.max(...relativeOffsets);
  return Math.max(...relativeOffsets) <= width
    ? references.flatMap((base) => relativeOffsets.map((offset) => base + offset - 1))
    : relativeOffsets;
}

function referenceMode(fixture: XmlNode, mode: XmlNode): ObservedMode {
  const refs = geometryReferences(fixture, mode.Geometry);
  const channels: ObservedMode["channels"] = [];
  const functions: ObservedFunction[] = [];
  for (const channel of array(mode.DMXChannels?.DMXChannel)) {
    const relativeOffsets = String(channel.Offset ?? "")
      .split(",")
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!relativeOffsets.length) continue;
    const references = refs.get(channel.Geometry);
    const expandedOffsets = templateOffsets(relativeOffsets, references);
    const isTemplate = expandedOffsets.length !== relativeOffsets.length ||
      expandedOffsets.some((offset, index) => offset !== relativeOffsets[index]);
    const groups = isTemplate && references
      ? references.map((base) => relativeOffsets.map((offset) => base + offset - 1))
      : [relativeOffsets];
    for (const logical of array(channel.LogicalChannel)) {
      const channelAttribute = String(logical.Attribute ?? "");
      if (!channelAttribute) continue;
      const channelFunctions = array(logical.ChannelFunction);
      const initialFunction = channelFunctions.find((fn) =>
        String(channel.InitialFunction ?? "").endsWith(`.${fn.Name}`)
      ) ?? channelFunctions[0];
      const defaultValue = dmxValue(initialFunction?.Default ?? 0);
      for (const group of groups) {
        group.forEach((offset, index) => channels.push({
          offset,
          attribute: channelAttribute,
          ...(index === 0 ? { defaultValue } : { fineOf: group[0] }),
        }));
      }
      const ranges = channelFunctions
        .map((fn) => ({ start: dmxValue(fn.DMXFrom), attribute: String(fn.Attribute ?? channelAttribute) }))
        .sort((a, b) => a.start - b.start)
        .map((fn, index, all) => ({ ...fn, end: (all[index + 1]?.start ?? 256) - 1 }));
      if (ranges.length === 1 && ranges[0].start === 0 && normalized(ranges[0].attribute) === normalized(channelAttribute)) continue;
      for (const group of groups) {
        for (const range of ranges) {
          functions.push({ offset: group[0], channelAttribute, ...range });
        }
      }
    }
  }
  return {
    name: String(mode.Name ?? ""),
    channelCount: Math.max(0, ...channels.map((channel) => channel.offset)),
    channels,
    functions,
  };
}

export function parseReferenceXml(xml: string): Observation {
  const document = parser.parse(xml);
  const fixture = document.GDTF?.FixtureType;
  if (!fixture) throw new Error("description.xml has no GDTF/FixtureType");
  const wheelSlots = array(fixture.Wheels?.Wheel).flatMap((wheel, wheelIndex) =>
    array(wheel.Slot).map((slot): ObservedWheelSlot => ({
      wheel: wheelIndex,
      name: String(slot.Name ?? ""),
      ...(typeof slot.Color === "string" && slot.Color.split(",").length === 3
        ? { color: slot.Color.split(",").map(Number) as [number, number, number] }
        : {}),
    }))
  );
  const beam = collectNamed(fixture.Geometries, "Beam")[0] ?? {};
  const weight = Number(fixture.PhysicalDescriptions?.Properties?.Weight?.Value);
  const physical: Record<string, number> = {};
  for (const [key, value] of Object.entries({
    weight,
    beamAngle: Number(beam.BeamAngle),
    fieldAngle: Number(beam.FieldAngle),
    colorTemperature: Number(beam.ColorTemperature),
    cri: Number(beam.ColorRenderingIndex),
    luminousFlux: Number(beam.LuminousFlux),
  })) {
    if (Number.isFinite(value)) physical[key] = value;
  }
  return {
    manufacturer: String(fixture.Manufacturer ?? ""),
    name: String(fixture.LongName ?? fixture.Name ?? ""),
    modes: array(fixture.DMXModes?.DMXMode).map((mode) => referenceMode(fixture, mode)),
    wheelSlots,
    physical,
    beamType: beam.BeamType === undefined ? undefined : String(beam.BeamType),
  };
}

function predictedObservation(fixture: FixtureData): Observation {
  const modes = fixture.dmxModes.map((mode): ObservedMode => {
    const channels = mode.channels.map((channel) => ({
      offset: channel.channel,
      attribute: channel.gdtfAttribute,
      defaultValue: channel.defaultValue,
      ...(channel.fineOf === undefined ? {} : { fineOf: channel.fineOf }),
    }));
    const functions: ObservedFunction[] = [];
    for (const channel of mode.channels) {
      const ranges = channel.functions ?? [];
      const meaningful = ranges.length > 1 || ranges.some((fn) =>
        normalized(fn.attribute ?? channel.gdtfAttribute) !== normalized(channel.gdtfAttribute)
      );
      if (meaningful) {
        for (const fn of ranges) {
          functions.push({
            offset: channel.channel,
            channelAttribute: channel.gdtfAttribute,
            start: fn.dmxFrom,
            end: fn.dmxTo,
            attribute: fn.attribute ?? channel.gdtfAttribute,
          });
        }
      }
    }
    if (mode.subFixtures) {
      const sub = mode.subFixtures;
      for (let index = 0; index < sub.count; index++) {
        for (let channelIndex = 0; channelIndex < sub.channels.length; channelIndex++) {
          const item = sub.channels[channelIndex];
          const offset = sub.firstChannel + index * sub.channels.length + channelIndex;
          channels.push({ offset, attribute: item.gdtfAttribute, defaultValue: item.defaultValue });
          const ranges = item.functions ?? [];
          const meaningful = ranges.length > 1 || ranges.some((fn) =>
            normalized(fn.attribute ?? item.gdtfAttribute) !== normalized(item.gdtfAttribute)
          );
          if (meaningful) {
            for (const fn of ranges) {
              functions.push({
                offset,
                channelAttribute: item.gdtfAttribute,
                start: fn.dmxFrom,
                end: fn.dmxTo,
                attribute: fn.attribute ?? item.gdtfAttribute,
              });
            }
          }
        }
      }
    }
    return { name: mode.name, channelCount: mode.channelCount, channels, functions };
  });
  return {
    manufacturer: fixture.manufacturer,
    name: fixture.name,
    modes,
    wheelSlots: (fixture.wheels ?? []).flatMap((wheel, wheelIndex) =>
      wheel.slots.map((slot): ObservedWheelSlot => ({
        wheel: wheelIndex,
        name: slot.name,
        ...(slot.color && hexToCie(slot.color) ? { color: hexToCie(slot.color)! } : {}),
      }))
    ),
    physical: Object.fromEntries(
      Object.entries({
        weight: physicalNumber(fixture.physical.weight, "weight"),
        beamAngle: fixture.beam?.beamAngle,
        fieldAngle: fixture.beam?.fieldAngle,
        colorTemperature: fixture.beam?.colorTemperature,
        cri: fixture.beam?.cri,
        luminousFlux: fixture.beam?.luminousFlux,
      }).filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
    ),
    beamType: fixture.beam?.beamType,
  };
}

function pairModes(predicted: ObservedMode[], expected: ObservedMode[]) {
  const similarity = (p: ObservedMode, e: ObservedMode) => {
    const count = 1 - Math.min(1, Math.abs(p.channelCount - e.channelCount) / Math.max(1, p.channelCount, e.channelCount));
    return count * 0.75 + stringScore(p.name, e.name) * 0.25;
  };
  const flipped = expected.length > predicted.length;
  const rows = flipped ? expected : predicted;
  const columns = flipped ? predicted : expected;
  if (columns.length > 15) {
    const candidates = predicted.flatMap((p, pi) => expected.map((e, ei) => ({ pi, ei, similarity: similarity(p, e) })))
      .sort((a, b) => b.similarity - a.similarity);
    const usedP = new Set<number>();
    const usedE = new Set<number>();
    return candidates.filter(({ pi, ei }) => {
      if (usedP.has(pi) || usedE.has(ei)) return false;
      usedP.add(pi);
      usedE.add(ei);
      return true;
    });
  }

  type Assignment = { score: number; pairs: Array<{ pi: number; ei: number; similarity: number }> };
  const memo = new Map<string, Assignment>();
  const solve = (row: number, mask: number): Assignment => {
    if (row === rows.length) return { score: 0, pairs: [] };
    const key = `${row}:${mask}`;
    const cached = memo.get(key);
    if (cached) return cached;
    let best = solve(row + 1, mask);
    for (let column = 0; column < columns.length; column++) {
      if (mask & (1 << column)) continue;
      const value = flipped
        ? similarity(columns[column], rows[row])
        : similarity(rows[row], columns[column]);
      const rest = solve(row + 1, mask | (1 << column));
      if (value + rest.score > best.score) {
        const pair = flipped
          ? { pi: column, ei: row, similarity: value }
          : { pi: row, ei: column, similarity: value };
        best = { score: value + rest.score, pairs: [pair, ...rest.pairs] };
      }
    }
    memo.set(key, best);
    return best;
  };
  return solve(0, 0).pairs;
}

function softFunctionF1(
  predicted: ObservedMode[],
  expected: ObservedMode[],
  predictedIds: Map<number, string>,
  expectedIds: Map<number, string>
): number {
  const keyed = (modes: ObservedMode[], ids: Map<number, string>, side: string) => modes.flatMap((mode, index) =>
    mode.functions.map((fn) => ({
      ...fn,
      key: `${ids.get(index) ?? `${side}${index}`}:${fn.offset}:${normalized(fn.channelAttribute)}:${normalized(fn.attribute)}`,
    }))
  );
  const p = keyed(predicted, predictedIds, "p");
  const e = keyed(expected, expectedIds, "e");
  if (!p.length && !e.length) return 1;
  const candidates = p.flatMap((left, pi) => e.flatMap((right, ei) => {
    if (left.key !== right.key) return [];
    const overlap = Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start) + 1);
    const union = Math.max(left.end, right.end) - Math.min(left.start, right.start) + 1;
    return [{ pi, ei, score: overlap / union }];
  })).sort((a, b) => b.score - a.score);
  const usedP = new Set<number>();
  const usedE = new Set<number>();
  let similarity = 0;
  for (const candidate of candidates) {
    if (usedP.has(candidate.pi) || usedE.has(candidate.ei)) continue;
    usedP.add(candidate.pi);
    usedE.add(candidate.ei);
    similarity += candidate.score;
  }
  return 2 * similarity / (p.length + e.length);
}

export function scoreFixture(
  fixture: FixtureData,
  reference: Observation,
  repairCount = 0
): MetricScores {
  const predicted = predictedObservation(fixture);
  const pairs = pairModes(predicted.modes, reference.modes);
  const pairIdsP = new Map(pairs.map((pair, index) => [pair.pi, `m${index}`]));
  const pairIdsE = new Map(pairs.map((pair, index) => [pair.ei, `m${index}`]));
  const modeId = (ids: Map<number, string>, side: string, index: number) => ids.get(index) ?? `${side}${index}`;
  const channelKey = (id: string, channel: ObservedChannel) => `${id}:${channel.offset}:${normalized(channel.attribute)}`;
  const channelKeys = (modes: ObservedMode[], ids: Map<number, string>, side: string) => modes.flatMap((mode, index) =>
    mode.channels.map((channel) => channelKey(modeId(ids, side, index), channel))
  );
  const channelF1 = setF1(
    channelKeys(predicted.modes, pairIdsP, "p"),
    channelKeys(reference.modes, pairIdsE, "e")
  );

  const predictedChannels = new Map(predicted.modes.flatMap((mode, index) =>
    mode.channels.map((channel) => [channelKey(modeId(pairIdsP, "p", index), channel), channel] as const)
  ));
  const expectedChannels = new Map(reference.modes.flatMap((mode, index) =>
    mode.channels.map((channel) => [channelKey(modeId(pairIdsE, "e", index), channel), channel] as const)
  ));
  const defaultChannels = [...expectedChannels].filter(([, channel]) => channel.defaultValue !== undefined);
  const defaults = defaultChannels.length
    ? defaultChannels.reduce((sum, [key, expected]) => {
        const actual = predictedChannels.get(key)?.defaultValue;
        return sum + (actual === undefined ? 0 : 1 - Math.abs(actual - expected.defaultValue!) / 255);
      }, 0) / defaultChannels.length
    : 1;
  const fineKeys = (modes: ObservedMode[], ids: Map<number, string>, side: string) => modes.flatMap((mode, index) =>
    mode.channels.flatMap((channel) => channel.fineOf === undefined ? [] : [
      `${modeId(ids, side, index)}:${channel.fineOf}:${channel.offset}:${normalized(channel.attribute)}`,
    ])
  );
  const predictedFineKeys = fineKeys(predicted.modes, pairIdsP, "p");
  const expectedFineKeys = fineKeys(reference.modes, pairIdsE, "e");
  const fineLinks = setF1(predictedFineKeys, expectedFineKeys);
  const channelParts = [
    { score: channelF1, weight: 0.8 },
    ...(defaultChannels.length ? [{ score: defaults, weight: 0.1 }] : []),
    ...(expectedFineKeys.length ? [{ score: fineLinks, weight: 0.1 }] : []),
  ];
  const channels = channelParts.reduce((sum, part) => sum + part.score * part.weight, 0) /
    channelParts.reduce((sum, part) => sum + part.weight, 0);

  const wheelKey = (slot: ObservedWheelSlot) => `${slot.wheel}:${normalized(slot.name)}`;
  const wheelNames = setF1(predicted.wheelSlots.map(wheelKey), reference.wheelSlots.map(wheelKey));
  const predictedWheels = new Map(predicted.wheelSlots.map((slot) => [wheelKey(slot), slot]));
  const coloredSlots = reference.wheelSlots.filter((slot) => slot.color);
  const wheelColors = coloredSlots.length
    ? coloredSlots.reduce((sum, expected) => {
        const actual = predictedWheels.get(wheelKey(expected))?.color;
        if (!actual) return sum;
        const distance = Math.hypot(actual[0] - expected.color![0], actual[1] - expected.color![1]);
        return sum + (distance < 1e-5 ? 1 : Math.max(0, 1 - distance / 0.5));
      }, 0) / coloredSlots.length
    : null;
  const wheels = wheelColors === null ? wheelNames : wheelNames * 0.8 + wheelColors * 0.2;

  const physicalParts = Object.entries(reference.physical).map(([key, expected]) => {
    const actual = predicted.physical[key];
    return actual === undefined ? 0 : Math.max(0, 1 - Math.abs(actual - expected) / Math.max(1, Math.abs(expected)));
  });
  if (reference.beamType) {
    physicalParts.push(normalized(predicted.beamType) === normalized(reference.beamType) ? 1 : 0);
  }
  const physical = physicalParts.length ? average(physicalParts) : null;
  const scores = {
    identity: (stringScore(predicted.manufacturer, reference.manufacturer) + stringScore(predicted.name, reference.name)) / 2,
    modes: pairs.reduce((sum, pair) => sum + pair.similarity, 0) / Math.max(1, predicted.modes.length, reference.modes.length),
    channels,
    functions: softFunctionF1(predicted.modes, reference.modes, pairIdsP, pairIdsE),
    wheels: reference.wheelSlots.length === 0 ? null : wheels,
    physical,
  };
  const weights = { identity: 0.1, modes: 0.2, channels: 0.35, functions: 0.2, wheels: 0.1, physical: 0.05 };
  const available = Object.entries(weights).filter(([key]) => scores[key as keyof typeof scores] !== null);
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  const weightedTotal = available.reduce(
    (sum, [key, weight]) => sum + Number(scores[key as keyof typeof scores]) * weight,
    0
  ) / totalWeight * 100;
  const normalizationPenalty = Math.min(20, repairCount * 2);
  return {
    total: Math.max(0, weightedTotal - normalizationPenalty),
    identity: scores.identity * 100,
    modes: scores.modes * 100,
    channels: scores.channels * 100,
    functions: scores.functions * 100,
    wheels: scores.wheels === null ? null : scores.wheels * 100,
    physical: scores.physical === null ? null : scores.physical * 100,
    normalizationPenalty,
  };
}

async function descriptionXml(path: string): Promise<string> {
  const zip = await JSZip.loadAsync(await readFile(path));
  const entry = Object.values(zip.files).find((file) => file.name.toLowerCase().endsWith("description.xml"));
  if (!entry) throw new Error(`${path}: missing description.xml`);
  return entry.async("text");
}

async function walk(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
}

async function findPairs(directory: string): Promise<Pair[]> {
  const manifestPath = join(directory, "benchmark-manifest.json");
  let definitions: Array<{ name?: string; pdf: string; gdtf: string }>;
  try {
    definitions = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const files = await walk(directory);
    const byDirectory = new Map<string, string[]>();
    for (const file of files) byDirectory.set(dirname(file), [...(byDirectory.get(dirname(file)) ?? []), file]);
    definitions = [];
    for (const [folder, folderFiles] of byDirectory) {
      const pdfs = folderFiles.filter((file) => extname(file).toLowerCase() === ".pdf");
      const gdtfs = folderFiles.filter((file) => extname(file).toLowerCase() === ".gdtf");
      const used = new Set<string>();
      for (const pdf of pdfs) {
        const stem = normalized(basename(pdf, extname(pdf)));
        const exact = gdtfs.find((gdtf) => !used.has(gdtf) && normalized(basename(gdtf, extname(gdtf))) === stem);
        if (exact) {
          definitions.push({ name: basename(pdf, extname(pdf)), pdf, gdtf: exact });
          used.add(exact);
        }
      }
      const remainingPdfs = pdfs.filter((pdf) => !definitions.some((item) => item.pdf === pdf));
      const remainingGdtfs = gdtfs.filter((gdtf) => !used.has(gdtf));
      if (remainingPdfs.length === 1 && remainingGdtfs.length === 1) {
        definitions.push({ name: basename(folder), pdf: remainingPdfs[0], gdtf: remainingGdtfs[0] });
      } else if (remainingPdfs.length || remainingGdtfs.length) {
        throw new Error(`Ambiguous files in ${relative(directory, folder) || "."}; use benchmark-manifest.json`);
      }
    }
  }
  if (!Array.isArray(definitions) || !definitions.length) throw new Error("No PDF/GDTF pairs found");
  return Promise.all(definitions.map(async (item) => {
    const pdfPath = resolve(directory, item.pdf);
    const gdtfPath = resolve(directory, item.gdtf);
    const [pdf, xml] = await Promise.all([readFile(pdfPath), descriptionXml(gdtfPath)]);
    return {
      name: item.name ?? basename(pdfPath, extname(pdfPath)),
      pdfPath,
      gdtfPath,
      pdf,
      reference: parseReferenceXml(xml),
      fingerprint: createHash("sha256").update(pdf).update(xml).digest("hex").slice(0, 16),
    };
  }));
}

function parseArgs(argv: string[]): Options {
  if (!argv.length || argv.includes("--help")) {
    console.log(`Usage: pnpm benchmark -- <directory> [options]\n\nOptions:\n  --paths <comma-list>  Extraction paths (default: all)\n  --concurrency <n>     Concurrent manuals per path (default: all manuals)\n  --output <file>       HTML report (default: benchmark-output/report.html)\n  --no-resume           Ignore successful cached results`);
    process.exit(argv.includes("--help") ? 0 : 1);
  }
  const directory = resolve(argv[0]);
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const selected = (value("--paths")?.split(",").map((path) => path.trim()) ?? EXTRACTION_PATHS) as ExtractionPath[];
  for (const path of selected) if (!EXTRACTION_PATHS.includes(path)) throw new Error(`Invalid path: ${path}`);
  const positiveInt = (flag: string, fallback: number) => {
    const parsed = Number(value(flag) ?? fallback);
    if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
    return parsed;
  };
  const output = resolve(value("--output") ?? "benchmark-output/report.html");
  return {
    directory,
    output,
    cache: /\.html?$/i.test(output) ? output.replace(/\.html?$/i, ".json") : `${output}.json`,
    paths: selected,
    concurrency: value("--concurrency") === undefined ? undefined : positiveInt("--concurrency", 1),
    resume: !argv.includes("--no-resume"),
  };
}

function extractionPromptHash(path: ExtractionPath): string {
  return createHash("sha256").update(getExtractionPrompt(path)).digest("hex").slice(0, 8);
}

async function runOne(pair: Pair, path: ExtractionPath): Promise<BenchmarkResult> {
  const prompt = getExtractionPrompt(path);
  const key = `${BENCHMARK_VERSION}:${extractionPromptHash(path)}:${pair.fingerprint}:${path}`;
  const started = performance.now();
  let cleanup: (() => Promise<void>) | undefined;
  try {
    const preprocessingStarted = performance.now();
    const request = await createExtractionRequest(
      pair.pdf.buffer.slice(pair.pdf.byteOffset, pair.pdf.byteOffset + pair.pdf.byteLength) as ArrayBuffer,
      prompt,
      path
    );
    cleanup = request.cleanup;
    const preprocessingMs = performance.now() - preprocessingStarted;
    const generationStarted = performance.now();
    const result = await generateText({
      model: request.model,
      output: Output.object({ schema: fixtureDataSchema }),
      messages: [{ role: "user", content: request.content }],
      providerOptions: request.providerOptions,
      temperature: path === "openai-gpt-nano-native" ? undefined : 0,
      maxOutputTokens: 65536,
    });
    const output = result.output;
    if (!output) throw new Error("No structured output returned");
    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;
    return {
      key,
      fixture: pair.name,
      path,
      status: "ok",
      modelId: result.response.modelId,
      inputTokens,
      outputTokens,
      totalTokens: result.usage.totalTokens ?? inputTokens + outputTokens,
      preprocessingMs,
      generationMs: performance.now() - generationStarted,
      durationMs: performance.now() - started,
      estimatedCost: estimateCost(path, inputTokens, outputTokens),
      scores: scoreFixture(output, pair.reference),
      output,
    };
  } catch (error) {
    const failed = NoObjectGeneratedError.isInstance(error) ? error : undefined;
    const inputTokens = failed?.usage?.inputTokens ?? 0;
    const outputTokens = failed?.usage?.outputTokens ?? 0;
    if (failed?.text) {
      try {
        const { fixtureData: output, repairs } = repairFixtureDataWithReport(failed.text);
        return {
          key,
          fixture: pair.name,
          path,
          status: "ok",
          modelId: failed.response?.modelId,
          inputTokens,
          outputTokens,
          totalTokens: failed.usage?.totalTokens ?? inputTokens + outputTokens,
          preprocessingMs: 0,
          generationMs: 0,
          durationMs: performance.now() - started,
          estimatedCost: estimateCost(path, inputTokens, outputTokens),
          scores: scoreFixture(output, pair.reference, repairs.length),
          output,
          rawOutput: failed.text,
          repaired: true,
          repairs,
        };
      } catch {}
    }
    return {
      key,
      fixture: pair.name,
      path,
      status: "error",
      modelId: failed?.response?.modelId,
      inputTokens,
      outputTokens,
      totalTokens: failed?.usage?.totalTokens ?? inputTokens + outputTokens,
      preprocessingMs: 0,
      generationMs: 0,
      durationMs: performance.now() - started,
      ...(failed ? { estimatedCost: estimateCost(path, inputTokens, outputTokens), rawOutput: failed.text } : {}),
      error: describeError(error),
    };
  } finally {
    await cleanup?.().catch((error) =>
      console.warn("Anthropic file cleanup failed", error)
    );
  }
}

function describeError(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error && current.message) messages.push(current.message);
    const issues = (current as { issues?: Array<{ path?: PropertyKey[]; message?: string }> }).issues;
    if (issues) {
      messages.push(...issues.map((issue) => `${issue.path?.join(".") || "output"}: ${issue.message ?? "invalid"}`));
    }
    current = (current as { cause?: unknown }).cause;
  }
  return [...new Set(messages)].join(" → ").slice(0, 2000) || String(error);
}

function estimateCost(path: ExtractionPath, inputTokens: number, outputTokens: number): number {
  const configured = PRICES[path];
  const price = configured.highContext && inputTokens >= configured.highContext.minInputTokens
    ? configured.highContext
    : configured;
  return inputTokens * price.inputPerMillion / 1e6 + outputTokens * price.outputPerMillion / 1e6 + (configured.fixedPerDocument ?? 0);
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function deviation(values: number[]): number {
  const mean = average(values);
  return values.length ? Math.sqrt(average(values.map((value) => (value - mean) ** 2))) : 0;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function reportHtml(results: BenchmarkResult[], fixtureCount: number): string {
  const aggregates = EXTRACTION_PATHS.filter((path) => results.some((result) => result.path === path)).map((path) => {
    const rows = results.filter((result) => result.path === path);
    const ok = rows.filter((result) => result.status === "ok");
    return {
      path,
      color: PATH_COLORS[path],
      score: average(ok.map((row) => row.scores!.total)),
      deviation: deviation(ok.map((row) => row.scores!.total)),
      tokens: average(ok.map((row) => row.totalTokens)),
      inputTokens: average(ok.map((row) => row.inputTokens)),
      outputTokens: average(ok.map((row) => row.outputTokens)),
      duration: average(ok.map((row) => row.durationMs)),
      cost: ok.some((row) => row.estimatedCost !== undefined) ? ok.reduce((sum, row) => sum + (row.estimatedCost ?? 0), 0) : null,
      success: rows.length ? ok.length / rows.length * 100 : 0,
    };
  }).sort((a, b) => b.score - a.score);
  const winner = aggregates[0];
  const successful = results.filter((result) => result.status === "ok");
  const repaired = successful.filter((result) => result.repaired).length;
  const generatedAt = new Date().toISOString();
  const data = JSON.stringify({ aggregates, results: results.map(({ output, ...result }) => result) }).replace(/</g, "\\u003c");
  const metric = (value: number, suffix = "") => `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GDTF Extraction Benchmark</title>
<style>
:root{--ink:#11130f;--paper:#f0eddf;--grid:#cbc7b8;--acid:#d9ff43;--orange:#ff6b35;--blue:#37d8ff;--muted:#6e7068}*{box-sizing:border-box}body{margin:0;color:var(--ink);background-color:var(--paper);background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:32px 32px;font-family:"Courier New",monospace}.shell{max-width:1500px;margin:auto;background:var(--paper);border-inline:2px solid var(--ink);min-height:100vh}header{position:relative;padding:42px 44px 34px;border-bottom:4px solid var(--ink);overflow:hidden}header:after{content:"BENCH / 01";position:absolute;right:-22px;top:22px;padding:8px 38px;background:var(--ink);color:var(--acid);transform:rotate(8deg);font-weight:900}h1{font-family:Impact,"Arial Narrow",sans-serif;font-size:clamp(3.5rem,9vw,9rem);font-weight:900;line-height:.78;letter-spacing:-.035em;text-transform:uppercase;margin:0;max-width:1100px}.kicker{font-weight:900;letter-spacing:.16em;margin-bottom:24px}.meta{display:flex;gap:22px;flex-wrap:wrap;margin-top:28px;font-size:.78rem;text-transform:uppercase}.meta span{border-left:8px solid var(--orange);padding-left:10px}.summary{display:grid;grid-template-columns:2fr repeat(3,1fr);border-bottom:2px solid var(--ink)}.card{min-height:172px;padding:24px;border-right:2px solid var(--ink)}.card:last-child{border:0}.card.winner{background:var(--acid)}.label{text-transform:uppercase;font-weight:900;font-size:.72rem;letter-spacing:.12em}.big{font-family:Impact,"Arial Narrow",sans-serif;font-size:4rem;line-height:1;margin:14px 0 4px}.winner .big{font-size:2rem;overflow-wrap:anywhere}.section{padding:34px 44px;border-bottom:2px solid var(--ink)}h2{font-family:Impact,"Arial Narrow",sans-serif;font-size:2.7rem;letter-spacing:.02em;text-transform:uppercase;margin:0 0 22px}.charts{display:grid;grid-template-columns:1fr 1fr;gap:28px}.chart{border:2px solid var(--ink);background:#f7f4e8;padding:18px}.chart h3{margin:0 0 12px;text-transform:uppercase;font-size:.8rem}.chart svg{width:100%;height:300px;display:block}.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:.7rem;margin-top:10px}.dot{display:inline-block;width:10px;height:10px;margin-right:6px;border:1px solid var(--ink)}table{width:100%;border-collapse:collapse;background:#f7f4e8;font-size:.76rem}th,td{padding:12px 10px;border:1px solid var(--ink);text-align:right}th{background:var(--ink);color:var(--paper);text-transform:uppercase;letter-spacing:.06em;position:sticky;top:0}td:first-child,td:nth-child(2),th:first-child,th:nth-child(2){text-align:left}.rank{font-family:Impact,"Arial Narrow",sans-serif;font-size:1.4rem}.scorebar{display:flex;align-items:center;gap:8px}.scorebar i{display:block;height:9px;background:var(--acid);border:1px solid var(--ink)}.matrix{display:grid;grid-template-columns:minmax(150px,1fr) repeat(${Math.max(1, aggregates.length)},minmax(120px,1fr));border-top:2px solid var(--ink);border-left:2px solid var(--ink)}.matrix>*{padding:11px;border-right:2px solid var(--ink);border-bottom:2px solid var(--ink);font-size:.72rem}.matrix .head{background:var(--ink);color:var(--paper);font-weight:900;overflow-wrap:anywhere}.matrix .cell{font-family:Impact,"Arial Narrow",sans-serif;font-size:1.4rem;text-align:center}.method{columns:2;column-gap:40px;line-height:1.65;font-size:.78rem}.method p{margin-top:0}.error{color:#ad2400;max-width:320px;white-space:normal;text-align:left}footer{padding:20px 44px;background:var(--ink);color:var(--paper);font-size:.7rem;display:flex;justify-content:space-between}@media(max-width:850px){.summary,.charts{grid-template-columns:1fr}.card{border-right:0;border-bottom:2px solid var(--ink)}.section,header{padding-inline:20px}.matrix{overflow:auto;display:block}.method{columns:1}.charts{gap:14px}}
</style></head><body><main class="shell"><header><div class="kicker">GDTF CREATOR // MODEL EXTRACTION LAB</div><h1>Truth<br>vs Tokens</h1><div class="meta"><span>${fixtureCount} reference fixtures</span><span>${results.length} evaluations</span><span>${escapeHtml(generatedAt)}</span></div></header>
<section class="summary"><div class="card winner"><div class="label">Best correctness</div><div class="big">${escapeHtml(winner?.path ?? "NO RESULT")}</div><div>${winner ? metric(winner.score, "%") : "—"} weighted score</div></div><div class="card"><div class="label">Successful evaluations</div><div class="big">${successful.length}/${results.length}</div><div>schema-valid · ${repaired} normalized</div></div><div class="card"><div class="label">Winner tokens</div><div class="big">${winner ? metric(winner.tokens) : "—"}</div><div>mean in + out</div></div><div class="card"><div class="label">Winner latency</div><div class="big">${winner ? metric(winner.duration / 1000, "s") : "—"}</div><div>end-to-end mean</div></div></section>
<section class="section"><h2>Performance field</h2><div class="charts"><div class="chart"><h3>Correctness by extraction path</h3><svg id="bars" role="img" aria-label="Mean correctness scores"></svg></div><div class="chart"><h3>Token efficiency — upper/left wins</h3><svg id="scatter" role="img" aria-label="Tokens versus correctness"></svg></div></div><div class="legend">${aggregates.map((item) => `<span><i class="dot" style="background:${item.color}"></i>${escapeHtml(item.path)}</span>`).join("")}</div></section>
<section class="section"><h2>Leaderboard</h2><table><thead><tr><th># / path</th><th>model</th><th>score</th><th>σ score</th><th>success</th><th>input tok</th><th>output tok</th><th>total tok</th><th>latency</th><th>est. total cost</th></tr></thead><tbody>${aggregates.map((item, index) => `<tr><td><span class="rank">${String(index + 1).padStart(2, "0")}</span> ${escapeHtml(item.path)}</td><td>${escapeHtml(results.find((row) => row.path === item.path && row.modelId)?.modelId ?? "—")}</td><td><div class="scorebar"><i style="width:${item.score}px"></i>${metric(item.score, "%")}</div></td><td>${metric(item.deviation, "pp")}</td><td>${metric(item.success, "%")}</td><td>${metric(item.inputTokens)}</td><td>${metric(item.outputTokens)}</td><td>${metric(item.tokens)}</td><td>${metric(item.duration / 1000, "s")}</td><td>${item.cost === null ? "—" : `$${item.cost.toFixed(4)}`}</td></tr>`).join("")}</tbody></table></section>
<section class="section"><h2>Fixture matrix</h2><div class="matrix"><div class="head">Fixture</div>${aggregates.map((item) => `<div class="head">${escapeHtml(item.path)}</div>`).join("")}${[...new Set(results.map((result) => result.fixture))].flatMap((fixture) => [`<div><strong>${escapeHtml(fixture)}</strong></div>`, ...aggregates.map((item) => { const rows = results.filter((row) => row.fixture === fixture && row.path === item.path && row.status === "ok"); const score = average(rows.map((row) => row.scores!.total)); return `<div class="cell" style="background:${rows.length ? `color-mix(in srgb, ${item.color} ${Math.round(score)}%, #f7f4e8)` : "#ffb4a2"}">${rows.length ? metric(score, "%") : "ERR"}</div>`; })]).join("")}</div></section>
<section class="section"><h2>Fixture detail</h2><table><thead><tr><th>fixture</th><th>path</th><th>total</th><th>repair penalty</th><th>modes</th><th>channels</th><th>functions</th><th>wheels</th><th>physical</th><th>tokens</th><th>time</th></tr></thead><tbody>${results.map((row) => `<tr><td>${escapeHtml(row.fixture)}</td><td>${escapeHtml(row.path)}</td>${row.status === "ok" ? `<td>${metric(row.scores!.total, "%")}</td><td>${metric(row.scores!.normalizationPenalty, "pp")}</td><td>${metric(row.scores!.modes, "%")}</td><td>${metric(row.scores!.channels, "%")}</td><td>${metric(row.scores!.functions, "%")}</td><td>${row.scores!.wheels === null ? "—" : metric(row.scores!.wheels, "%")}</td><td>${row.scores!.physical === null ? "—" : metric(row.scores!.physical, "%")}</td><td>${row.totalTokens.toLocaleString()}</td><td>${metric(row.durationMs / 1000, "s")}</td>` : `<td class="error" colspan="9">${escapeHtml(row.error)}</td>`}</tr>`).join("")}</tbody></table></section>
<section class="section method"><h2>Scoring protocol</h2><p><strong>Total score:</strong> identity 10%, DMX modes 20%, channels/defaults/fine links 35%, function range overlap 20%, wheel slots/colors 10%, physical/beam data 5%. Missing optional reference data is removed and weights are normalized. Deterministic repairs subtract 2 points each, capped at 20.</p><p><strong>Matching:</strong> modes pair by channel footprint and name similarity. Channels and function boundaries use set F1, penalizing omissions and hallucinations equally. Trivial single 0–255 functions are excluded. Physical values use relative numeric closeness. “Normalized” outputs had deterministic serialization/layout repairs before strict validation.</p><p><strong>Costs:</strong> leaderboard totals successful evaluations using hardcoded standard rates checked 2026-07-24. Cloudflare Markdown conversion is treated as free; potential image-processing overages are excluded. Token counts come from provider usage. Treat scores as regression signals; inspect source GDTFs where modeling conventions differ.</p></section>
<footer><span>GDTF CREATOR / BENCHMARK v${BENCHMARK_VERSION}</span><span>RAW RESULTS: COMPANION JSON</span></footer></main>
<script>const DATA=${data};const NS="http://www.w3.org/2000/svg";function el(n,a={}){const x=document.createElementNS(NS,n);for(const[k,v]of Object.entries(a))x.setAttribute(k,v);return x}function text(svg,x,y,value,anchor="start"){const t=el("text",{x,y,"text-anchor":anchor,fill:"#11130f","font-size":"11","font-family":"Courier New"});t.textContent=value;svg.append(t)}const A=DATA.aggregates;{const s=document.querySelector("#bars"),w=600,h=300;s.setAttribute("viewBox","0 0 "+w+" "+h);A.forEach((d,i)=>{const y=18+i*(250/Math.max(1,A.length)),bh=30;const b=el("rect",{x:180,y,width:Math.max(1,d.score*3.7),height:bh,fill:d.color,stroke:"#11130f","stroke-width":2});b.append(el("title"));b.firstChild.textContent=d.path+": "+d.score.toFixed(1)+"%";s.append(b);text(s,170,y+20,d.path,"end");text(s,190+d.score*3.7,y+20,d.score.toFixed(1)+"%");});} {const s=document.querySelector("#scatter"),w=600,h=300,p=42;s.setAttribute("viewBox","0 0 "+w+" "+h);const max=Math.max(1,...A.map(d=>d.tokens))*1.1;s.append(el("line",{x1:p,y1:h-p,x2:w-p,y2:h-p,stroke:"#11130f","stroke-width":2}),el("line",{x1:p,y1:p,x2:p,y2:h-p,stroke:"#11130f","stroke-width":2}));text(s,w/2,h-8,"MEAN TOTAL TOKENS","middle");const ylabel=text.bind(null,s,12,20);ylabel("SCORE ↑");A.forEach(d=>{const x=p+d.tokens/max*(w-2*p),y=h-p-d.score/100*(h-2*p);const c=el("circle",{cx:x,cy:y,r:10,fill:d.color,stroke:"#11130f","stroke-width":3});const title=el("title");title.textContent=d.path+"\\n"+d.score.toFixed(1)+"% / "+Math.round(d.tokens)+" tokens";c.append(title);s.append(c);text(s,x,y-15,d.path.split("-")[0],"middle")});text(s,p,h-p+18,"0","middle");text(s,w-p,h-p+18,Math.round(max).toLocaleString(),"middle");}</script></body></html>`;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--") argv.shift();
  const options = parseArgs(argv);
  await stat(options.directory);
  const pairs = await findPairs(options.directory);
  await mkdir(dirname(options.output), { recursive: true });
  let cached: BenchmarkResult[] = [];
  if (options.resume) {
    try { cached = JSON.parse(await readFile(options.cache, "utf8")).results ?? []; } catch {}
  }
  const tasks = pairs.flatMap((pair) => options.paths.map((path) => ({
    pair,
    path,
    key: `${BENCHMARK_VERSION}:${extractionPromptHash(path)}:${pair.fingerprint}:${path}`,
  })));
  const cachedByKey = new Map(cached.map((item) => [item.key, item]));
  const byKey = new Map<string, BenchmarkResult>();
  for (const task of tasks) {
    const item = cachedByKey.get(task.key);
    if (!item) continue;
    const { estimatedCost: _oldCost, error: _oldError, ...base } = item;
    const estimatedCost = estimateCost(item.path, item.inputTokens, item.outputTokens);
    if (item.rawOutput) {
      try {
        const { fixtureData: output, repairs } = repairFixtureDataWithReport(item.rawOutput);
        byKey.set(item.key, {
          ...base,
          key: task.key,
          fixture: task.pair.name,
          path: task.path,
          status: "ok",
          estimatedCost,
          output,
          repaired: true,
          repairs,
          scores: scoreFixture(output, task.pair.reference, repairs.length),
        } as BenchmarkResult);
      } catch {}
    } else if (item.status === "ok" && item.output) {
      byKey.set(item.key, {
        ...base,
        key: task.key,
        fixture: task.pair.name,
        path: task.path,
        status: "ok",
        estimatedCost,
        scores: scoreFixture(item.output, task.pair.reference, item.repairs?.length ?? 0),
      } as BenchmarkResult);
    }
  }
  const pending = tasks.filter((task) => !byKey.has(task.key));
  const concurrency = options.concurrency ?? pairs.length;
  console.log(`${pairs.length} fixtures × ${options.paths.length} paths = ${tasks.length}; ${pending.length} pending; up to ${concurrency} concurrent per path`);
  let completed = tasks.length - pending.length;
  let save = Promise.resolve();
  const checkpoint = () => {
    const current = tasks.map((task) => byKey.get(task.key)).filter(Boolean) as BenchmarkResult[];
    save = save.then(() => writeFile(options.cache, JSON.stringify({ version: BENCHMARK_VERSION, results: current }, null, 2)));
  };
  await Promise.all(options.paths.map(async (path) => {
    const pathTasks = pending.filter((task) => task.path === path);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, pathTasks.length) }, async () => {
      while (cursor < pathTasks.length) {
        const task = pathTasks[cursor++];
        console.log(`[${completed + 1}/${tasks.length}] ${task.pair.name} / ${task.path}`);
        const result = await runOne(task.pair, task.path);
        byKey.set(task.key, result);
        completed++;
        console.log(result.status === "ok" ? `  ${result.scores!.total.toFixed(1)}% · ${result.totalTokens} tok · ${(result.durationMs / 1000).toFixed(1)}s` : `  ERROR: ${result.error}`);
        checkpoint();
      }
    }));
  }));
  await save;
  const results = tasks.map((task) => byKey.get(task.key)!);
  await writeFile(options.cache, JSON.stringify({ version: BENCHMARK_VERSION, results }, null, 2));
  await writeFile(options.output, reportHtml(results, pairs.length));
  console.log(`\nReport: ${options.output}\nRaw:    ${options.cache}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
