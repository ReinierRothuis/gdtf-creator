import type {
  ChannelFunction,
  DmxChannel,
  FixtureData,
} from "./schema/fixture";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
    .replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
    .toUpperCase();
}

function sanitizeName(name: string): string {
  return name.replace(/[^A-Za-z0-9_.-]/g, "_");
}

function channelFunctionName(name: string, index: number): string {
  return `${sanitizeName(name)}_${index + 1}`;
}

function isDimmerAttribute(attrName: string): boolean {
  return /^Dimmer\d*$/.test(attrName);
}

function getFeatureForAttribute(attrName: string): string {
  if (isDimmerAttribute(attrName)) return "Dimmer.Dimmer";
  if (attrName.startsWith("Pan") || attrName.startsWith("Tilt"))
    return "Position.Position";
  if (
    attrName.startsWith("Color") ||
    attrName.startsWith("COLORT") ||
    attrName.startsWith("CTO") ||
    attrName.startsWith("CTB")
  )
    return "Color.Color";
  if (attrName.startsWith("Gobo")) return "Gobo.Gobo";
  if (
    attrName === "Zoom" ||
    attrName === "Focus" ||
    attrName === "Iris" ||
    attrName.startsWith("Frost") ||
    attrName.startsWith("Prism") ||
    attrName.startsWith("Shutter") ||
    attrName.startsWith("Strobe") ||
    attrName.startsWith("Effects")
  )
    return "Beam.Beam";
  return "Control.Control";
}

const IDENTITY_MATRIX =
  "{1.000000,0.000000,0.000000,0.000000}" +
  "{0.000000,1.000000,0.000000,0.000000}" +
  "{0.000000,0.000000,1.000000,0.000000}" +
  "{0.000000,0.000000,0.000000,1.000000}";

/**
 * A resolved channel merges coarse+fine into a single DMXChannel
 * with multi-byte offsets when duplicates are detected.
 */
interface ResolvedChannel {
  attribute: string;
  prettyName: string;
  offsets: number[];
  defaultValue: number;
  functions?: ChannelFunction[];
}

/** Merge only explicitly linked coarse/fine channels. */
function resolveChannels(channels: DmxChannel[]): ResolvedChannel[] {
  const fineByCoarse = new Map(
    channels
      .filter((channel) => channel.fineOf !== undefined)
      .map((channel) => [channel.fineOf!, channel])
  );
  const usedAttributes = new Set<string>();
  const resolved: ResolvedChannel[] = [];

  for (const channel of channels) {
    if (channel.fineOf !== undefined) continue;
    let attribute = channel.gdtfAttribute;
    for (let suffix = 2; usedAttributes.has(attribute); suffix++) {
      attribute = `${channel.gdtfAttribute}${suffix}`;
    }
    usedAttributes.add(attribute);
    const fine = fineByCoarse.get(channel.channel);
    resolved.push({
      attribute,
      prettyName: channel.prettyName,
      offsets: fine
        ? [channel.channel, fine.channel]
        : [channel.channel],
      defaultValue: channel.defaultValue,
      functions: channel.functions,
    });
  }

  return resolved;
}

function emitVirtualDimmerChannel(lines: string[], geometry: string): void {
  const channelNodeName = `${geometry}_Dimmer`;
  const initialFn = `${channelNodeName}.Dimmer.Dimmer 1`;
  lines.push(
    `          <DMXChannel DMXBreak="1" Offset="" Highlight="255/1" Geometry="${geometry}" InitialFunction="${escapeXml(initialFn)}">`
  );
  lines.push(
    `            <LogicalChannel Attribute="Dimmer" Snap="No" Master="None" MibFade="0.000000" DMXChangeTimeLimit="0.000000">`
  );
  lines.push(
    `              <ChannelFunction Name="Dimmer 1" Default="255/1" DMXFrom="0/1" PhysicalFrom="0.000000" PhysicalTo="1.000000" RealFade="0.000000" RealAcceleration="0.000000" Min="0.000000" Max="1.000000" CustomName="" OriginalAttribute="" Attribute="Dimmer"/>`
  );
  lines.push(`            </LogicalChannel>`);
  lines.push(`          </DMXChannel>`);
}

function formatDmxValue(
  value: number,
  byteCount: number,
  shift = false
): string {
  return `${Math.round(value)}/1${shift && byteCount > 1 ? "s" : ""}`;
}

function emitDmxChannel(
  lines: string[],
  ch: ResolvedChannel,
  geometry: string,
  fixture: FixtureData
): void {
  const attrName = ch.attribute;
  const channelNodeName = `${geometry}_${attrName}`;
  const byteCount = ch.offsets.length;
  const offsetStr = ch.offsets.join(",");
  const feature = getFeatureForAttribute(attrName);
  let highlight = "None";
  if (isDimmerAttribute(attrName)) highlight = formatDmxValue(255, byteCount);
  else if (feature === "Color.Color")
    highlight = formatDmxValue(255, byteCount);

  const functions =
    ch.functions && ch.functions.length > 0 ? ch.functions : null;
  const initialFnIndex = functions
    ? Math.max(
        0,
        functions.findIndex(
          (fn) => ch.defaultValue >= fn.dmxFrom && ch.defaultValue <= fn.dmxTo
        )
      )
    : 0;
  const initialFnName = functions
    ? channelFunctionName(functions[initialFnIndex].name, initialFnIndex)
    : `${attrName} 1`;
  const initialFn = `${channelNodeName}.${attrName}.${initialFnName}`;

  const defaultVal = formatDmxValue(ch.defaultValue, byteCount);
  const physicalRange = getPhysicalRange(attrName, fixture);

  lines.push(
    `          <DMXChannel DMXBreak="1" Offset="${offsetStr}" Highlight="${highlight}" Geometry="${geometry}" InitialFunction="${escapeXml(initialFn)}">`
  );
  lines.push(
    `            <LogicalChannel Attribute="${escapeXml(attrName)}" Snap="No" Master="${isDimmerAttribute(attrName) ? "Grand" : "None"}" MibFade="0.000000" DMXChangeTimeLimit="0.000000">`
  );

  if (functions) {
    for (const [index, fn] of functions.entries()) {
      const fnName = channelFunctionName(fn.name, index);
      const fnAttr = fn.attribute ?? attrName;
      const physFrom = fn.physicalFrom ?? physicalRange.from;
      const physTo = fn.physicalTo ?? physicalRange.to;
      const wheelSlot = findWheelSlot(attrName, fn, fixture);
      const wheel = wheelSlot
        ? ` Wheel="${escapeXml(wheelSlot.wheel.name)}"`
        : "";
      const functionDefault = formatDmxValue(
        Math.max(fn.dmxFrom, Math.min(fn.dmxTo, ch.defaultValue)),
        byteCount
      );
      const dmxFrom = formatDmxValue(fn.dmxFrom, byteCount, true);
      const channelFunction = `              <ChannelFunction Name="${escapeXml(fnName)}" Default="${functionDefault}" DMXFrom="${dmxFrom}" PhysicalFrom="${physFrom.toFixed(6)}" PhysicalTo="${physTo.toFixed(6)}" RealFade="0.000000" RealAcceleration="0.000000" Min="${physFrom.toFixed(6)}" Max="${physTo.toFixed(6)}" CustomName="" OriginalAttribute="" Attribute="${escapeXml(fnAttr)}"${wheel}`;
      if (wheelSlot) {
        lines.push(`${channelFunction}>`);
        lines.push(
          `                <ChannelSet Name="${escapeXml(wheelSlot.slot.name)}" DMXFrom="${dmxFrom}" WheelSlotIndex="${wheelSlot.index}"/>`
        );
        lines.push(`              </ChannelFunction>`);
      } else {
        lines.push(`${channelFunction}/>`);
      }
    }
  } else {
    const cfName = `${attrName} 1`;
    const physFrom = physicalRange.from;
    const physTo = physicalRange.to;
    lines.push(
      `              <ChannelFunction Name="${escapeXml(cfName)}" Default="${defaultVal}" DMXFrom="${formatDmxValue(0, byteCount, true)}" PhysicalFrom="${physFrom.toFixed(6)}" PhysicalTo="${physTo.toFixed(6)}" RealFade="0.000000" RealAcceleration="0.000000" Min="${physFrom.toFixed(6)}" Max="${physTo.toFixed(6)}" CustomName="" OriginalAttribute="" Attribute="${escapeXml(attrName)}"/>`
    );
  }

  lines.push(`            </LogicalChannel>`);
  lines.push(`          </DMXChannel>`);
}

/**
 * Generate a valid GDTF 1.2 description.xml from extracted fixture data.
 */
export function generateDescriptionXml(fixture: FixtureData): string {
  const fixtureTypeId = generateUuid();
  const geometryName = "Base";
  const hasSubFixtures = fixture.dmxModes.some((mode) => mode.subFixtures);

  const resolvedModes = fixture.dmxModes.map((mode, index) => ({
    ...mode,
    geometryName: hasSubFixtures ? `${geometryName}_${index + 1}` : geometryName,
    resolved: resolveChannels(mode.channels),
  }));

  // Collect unique attributes across all resolved modes (including sub-fixture channels)
  const attributeMap = new Map<string, string>();
  for (const mode of resolvedModes) {
    for (const ch of mode.resolved) {
      if (!attributeMap.has(ch.attribute)) {
        attributeMap.set(ch.attribute, ch.prettyName);
      }
      for (const fn of ch.functions ?? []) {
        if (fn.attribute && !attributeMap.has(fn.attribute)) {
          attributeMap.set(fn.attribute, fn.name);
        }
      }
    }
    if (mode.subFixtures) {
      for (const ch of mode.subFixtures.channels) {
        if (!attributeMap.has(ch.gdtfAttribute)) {
          attributeMap.set(ch.gdtfAttribute, ch.prettyName);
        }
        for (const fn of ch.functions ?? []) {
          if (fn.attribute && !attributeMap.has(fn.attribute)) {
            attributeMap.set(fn.attribute, fn.name);
          }
        }
      }
      // Virtual dimmer on template geometry needs its attribute registered
      if (!attributeMap.has("Dimmer")) {
        attributeMap.set("Dimmer", "Dimmer");
      }
    }
  }

  const attributes = Array.from(attributeMap.entries());

  // Beam properties with fallbacks
  const lampType = fixture.beam?.lampType ?? "Discharge";
  const beamAngle = fixture.beam?.beamAngle ?? 25;
  const fieldAngle = fixture.beam?.fieldAngle ?? beamAngle;
  const colorTemperature = fixture.beam?.colorTemperature ?? 6000;
  const cri = fixture.beam?.cri ?? 100;
  const luminousFlux = fixture.beam?.luminousFlux ?? 10000;
  const beamType = fixture.beam?.beamType ?? "Wash";
  const powerConsumption = parsePower(fixture.physical.powerConsumption);

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<GDTF DataVersion="1.2">`);
  lines.push(
    `  <FixtureType Name="${escapeXml(sanitizeName(fixture.name))}" ShortName="${escapeXml(fixture.shortName)}" LongName="${escapeXml(fixture.name)}" Manufacturer="${escapeXml(fixture.manufacturer)}" Description="" FixtureTypeID="${fixtureTypeId}" CanHaveChildren="No" RefFT="">`
  );

  // Attribute Definitions
  lines.push(`    <AttributeDefinitions>`);
  lines.push(`      <ActivationGroups/>`);
  lines.push(`      <FeatureGroups>`);
  lines.push(`        <FeatureGroup Name="Dimmer" Pretty="Dimmer">`);
  lines.push(`          <Feature Name="Dimmer"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Position" Pretty="Position">`);
  lines.push(`          <Feature Name="Position"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Color" Pretty="Color">`);
  lines.push(`          <Feature Name="Color"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Gobo" Pretty="Gobo">`);
  lines.push(`          <Feature Name="Gobo"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Beam" Pretty="Beam">`);
  lines.push(`          <Feature Name="Beam"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Control" Pretty="Control">`);
  lines.push(`          <Feature Name="Control"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`      </FeatureGroups>`);
  lines.push(`      <Attributes>`);

  for (const [attrName, prettyName] of attributes) {
    const feature = getFeatureForAttribute(attrName);
    lines.push(
      `        <Attribute Name="${escapeXml(attrName)}" Pretty="${escapeXml(prettyName)}" Feature="${feature}" PhysicalUnit="None"/>`
    );
  }

  lines.push(`      </Attributes>`);
  lines.push(`    </AttributeDefinitions>`);

  // Wheels
  if (fixture.wheels && fixture.wheels.length > 0) {
    lines.push(`    <Wheels>`);
    for (const wheel of fixture.wheels) {
      lines.push(
        `      <Wheel Name="${escapeXml(wheel.name)}">`
      );
      for (const slot of wheel.slots) {
        if (slot.color) {
          const { x, y, Y } = hexToCie(slot.color);
          lines.push(
            `        <Slot Name="${escapeXml(slot.name)}" Color="${x.toFixed(6)},${y.toFixed(6)},${Y.toFixed(6)}"/>`
          );
        } else {
          lines.push(
            `        <Slot Name="${escapeXml(slot.name)}"/>`
          );
        }
      }
      lines.push(`      </Wheel>`);
    }
    lines.push(`    </Wheels>`);
  } else {
    lines.push(`    <Wheels/>`);
  }

  // PhysicalDescriptions
  lines.push(`    <PhysicalDescriptions>`);
  lines.push(`      <ColorSpace Name="Default" Mode="sRGB"/>`);
  lines.push(`      <AdditionalColorSpaces/>`);
  lines.push(`      <Gamuts/>`);
  lines.push(`      <Filters/>`);
  lines.push(`      <Emitters/>`);
  lines.push(`      <DMXProfiles/>`);
  lines.push(`      <CRIs/>`);
  lines.push(`      <Connectors/>`);
  lines.push(`      <Properties>`);
  lines.push(
    `        <OperatingTemperature Low="0.000000" High="40.000000"/>`
  );
  lines.push(
    `        <Weight Value="${parseWeight(fixture.physical.weight)}"/>`
  );
  lines.push(`        <LegHeight Value="0.000000"/>`);
  lines.push(`      </Properties>`);
  lines.push(`    </PhysicalDescriptions>`);

  // Models
  lines.push(`    <Models/>`);

  // Geometries
  // Find the max sub-fixture count across all modes for geometry definitions
  const maxSubFixtures = fixture.dmxModes.reduce(
    (max, m) => Math.max(max, m.subFixtures?.count ?? 0),
    0
  );

  lines.push(`    <Geometries>`);
  if (maxSubFixtures > 0) {
    // Top-level beam geometry — template for GeometryReference (must be top-level)
    lines.push(
      `      <Beam Name="Beam" Position="${IDENTITY_MATRIX}" LampType="${escapeXml(lampType)}" PowerConsumption="${(parseFloat(powerConsumption) / maxSubFixtures).toFixed(6)}" LuminousFlux="${(luminousFlux / maxSubFixtures).toFixed(6)}" ColorTemperature="${colorTemperature.toFixed(6)}" BeamAngle="${beamAngle.toFixed(6)}" BeamRadius="0.050000" FieldAngle="${fieldAngle.toFixed(6)}" BeamType="${escapeXml(beamType)}" ColorRenderingIndex="${cri}"/>`
    );
    for (const mode of resolvedModes) {
      lines.push(
        `      <Geometry Name="${mode.geometryName}" Position="${IDENTITY_MATRIX}">`
      );
      if (mode.subFixtures) {
        const sf = mode.subFixtures;
        for (let i = 1; i <= sf.count; i++) {
          const dmxOffset =
            sf.firstChannel + (i - 1) * sf.channels.length;
          lines.push(
            `        <GeometryReference Name="${escapeXml(sanitizeName(sf.name))}_${i}" Geometry="Beam" Position="${IDENTITY_MATRIX}">`
          );
          lines.push(
            `          <Break DMXBreak="1" DMXOffset="${dmxOffset}"/>`
          );
          lines.push(`        </GeometryReference>`);
        }
      } else {
        lines.push(
          `        <GeometryReference Name="Beam" Geometry="Beam" Position="${IDENTITY_MATRIX}"/>`
        );
      }
      lines.push(`      </Geometry>`);
    }
  } else {
    lines.push(
      `      <Geometry Name="${geometryName}" Position="${IDENTITY_MATRIX}">`
    );
    lines.push(
      `        <Beam Name="Beam" Position="${IDENTITY_MATRIX}" LampType="${escapeXml(lampType)}" PowerConsumption="${parseFloat(powerConsumption).toFixed(6)}" LuminousFlux="${luminousFlux.toFixed(6)}" ColorTemperature="${colorTemperature.toFixed(6)}" BeamAngle="${beamAngle.toFixed(6)}" BeamRadius="0.050000" FieldAngle="${fieldAngle.toFixed(6)}" BeamType="${escapeXml(beamType)}" ColorRenderingIndex="${cri}"/>`
    );
    lines.push(`      </Geometry>`);
  }
  lines.push(`    </Geometries>`);

  // DMX Modes
  lines.push(`    <DMXModes>`);

  for (const mode of resolvedModes) {
    lines.push(
      `      <DMXMode Name="${escapeXml(mode.name)}" Description="" Geometry="${mode.geometryName}">`
    );
    lines.push(`        <DMXChannels>`);

    // Global channels
    for (const ch of mode.resolved) {
      emitDmxChannel(lines, ch, mode.geometryName, fixture);
    }

    // Sub-fixture channels — emit once against template geometry (Geometry Collect pattern)
    // GeometryReferences handle replication via DMXOffset
    if (mode.subFixtures) {
      const sf = mode.subFixtures;
      for (let j = 0; j < sf.channels.length; j++) {
        const sfCh = sf.channels[j];
        const resolved: ResolvedChannel = {
          attribute: sfCh.gdtfAttribute,
          prettyName: sfCh.prettyName,
          offsets: [j + 1], // 1-based relative offset within sub-fixture block
          defaultValue: sfCh.defaultValue,
          functions: sfCh.functions,
        };
        emitDmxChannel(lines, resolved, "Beam", fixture);
      }

      // Virtual dimmer on template geometry — acts as Multiply master for pixel color channels
      emitVirtualDimmerChannel(lines, "Beam");
    }

    lines.push(`        </DMXChannels>`);

    // Relations — Multiply relations for virtual dimmer on template → sub-fixture color channels
    if (mode.subFixtures) {
      const sf = mode.subFixtures;
      const masterName = "Beam_Dimmer";
      lines.push(`        <Relations>`);
      for (const sfCh of sf.channels) {
        const attr = sfCh.gdtfAttribute;
        const feature = getFeatureForAttribute(attr);
        // Only color channels are followers — virtual dimmer itself is the master
        if (feature === "Color.Color") {
          const followerNode = `Beam_${attr}`;
          const fnName = sfCh.functions?.[0]
            ? channelFunctionName(sfCh.functions[0].name, 0)
            : `${attr} 1`;
          const follower = `${followerNode}.${attr}.${fnName}`;
          lines.push(
            `          <Relation Name="${masterName}_${attr}" Master="${masterName}" Follower="${escapeXml(follower)}" Type="Multiply"/>`
          );
        }
      }
      lines.push(`        </Relations>`);
    } else {
      lines.push(`        <Relations/>`);
    }

    lines.push(`        <FTMacros/>`);
    lines.push(`      </DMXMode>`);
  }

  lines.push(`    </DMXModes>`);
  lines.push(`    <Revisions/>`);
  lines.push(`    <FTPresets/>`);
  lines.push(`    <Protocols/>`);

  lines.push(`  </FixtureType>`);
  lines.push(`</GDTF>`);

  return lines.join("\n");
}

function getPhysicalRange(
  attrName: string,
  fixture: FixtureData
): { from: number; to: number } {
  if (attrName === "Pan" && fixture.physical.panRange) {
    const half = fixture.physical.panRange / 2;
    return { from: -half, to: half };
  }
  if (attrName === "Tilt" && fixture.physical.tiltRange) {
    const half = fixture.physical.tiltRange / 2;
    return { from: -half, to: half };
  }
  return { from: 0, to: 1 };
}

function findWheelSlot(
  attrName: string,
  fn: ChannelFunction,
  fixture: FixtureData
) {
  if (fn.attribute && fn.attribute !== attrName) return undefined;
  const match = /^(Color|Gobo)(\d+)$/.exec(attrName);
  if (!match) return undefined;
  const wheel = fixture.wheels?.filter((item) => item.type === match[1])[
    Number(match[2]) - 1
  ];
  if (!wheel) return undefined;
  const fnName = fn.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  // ponytail: name matching covers extracted slots; add an explicit slot index if names become ambiguous.
  const slotIndex = wheel.slots.findIndex((slot) => {
    const slotName = slot.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return slotName.length > 0 && fnName.includes(slotName);
  });
  if (slotIndex === -1) return undefined;
  return { wheel, slot: wheel.slots[slotIndex], index: slotIndex + 1 };
}

function hexToCie(hex: string): { x: number; y: number; Y: number } {
  const linearize = (value: number) =>
    value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  const clean = hex.slice(1);
  const r = linearize(parseInt(clean.slice(0, 2), 16) / 255);
  const g = linearize(parseInt(clean.slice(2, 4), 16) / 255);
  const b = linearize(parseInt(clean.slice(4, 6), 16) / 255);
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const sum = X + Y + Z;
  return sum === 0
    ? { x: 0.3127, y: 0.329, Y: 0 }
    : { x: X / sum, y: Y / sum, Y: Y * 100 };
}

function parseWeight(weight: string): string {
  const match = weight.match(/([\d.]+)/);
  return match ? match[1] : "0.000000";
}

function parsePower(power: string): string {
  const match = power.match(/([\d.]+)/);
  return match ? match[1] : "1000.000000";
}
