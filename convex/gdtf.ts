import type { DmxChannel, FixtureData } from "./schema/fixture";

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

function getFeatureForAttribute(attrName: string): string {
  if (attrName === "Dimmer") return "Dimmer.Dimmer";
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
  "{0,0,0,1}";

/**
 * A resolved channel merges coarse+fine into a single DMXChannel
 * with multi-byte offsets when duplicates are detected.
 */
interface ResolvedChannel {
  attribute: string;
  prettyName: string;
  offsets: number[];
  defaultValue: number;
}

/**
 * Merge fine/coarse channel pairs that share the same gdtfAttribute.
 * - 1 occurrence → single-byte channel
 * - 2 occurrences → coarse+fine pair (16-bit), merged into one DMXChannel
 * - 3+ occurrences → first two merged, rest get suffixed attribute names
 */
function resolveChannels(channels: DmxChannel[]): ResolvedChannel[] {
  const attrGroups = new Map<string, DmxChannel[]>();
  for (const ch of channels) {
    const group = attrGroups.get(ch.gdtfAttribute) ?? [];
    group.push(ch);
    attrGroups.set(ch.gdtfAttribute, group);
  }

  const resolved: ResolvedChannel[] = [];
  const seen = new Set<string>();

  for (const ch of channels) {
    if (seen.has(ch.gdtfAttribute)) continue;
    seen.add(ch.gdtfAttribute);

    const group = attrGroups.get(ch.gdtfAttribute)!;
    if (group.length === 1) {
      resolved.push({
        attribute: ch.gdtfAttribute,
        prettyName: ch.prettyName,
        offsets: [ch.channel],
        defaultValue: ch.defaultValue,
      });
    } else if (group.length === 2) {
      resolved.push({
        attribute: ch.gdtfAttribute,
        prettyName: group[0].prettyName,
        offsets: [group[0].channel, group[1].channel],
        defaultValue: group[0].defaultValue,
      });
    } else {
      // 3+ duplicates — merge first two as coarse+fine, suffix the rest
      resolved.push({
        attribute: ch.gdtfAttribute,
        prettyName: group[0].prettyName,
        offsets: [group[0].channel, group[1].channel],
        defaultValue: group[0].defaultValue,
      });
      for (let i = 2; i < group.length; i++) {
        resolved.push({
          attribute: `${ch.gdtfAttribute}${i + 1}`,
          prettyName: group[i].prettyName,
          offsets: [group[i].channel],
          defaultValue: group[i].defaultValue,
        });
      }
    }
  }

  return resolved;
}

/**
 * Generate a valid GDTF 1.2 description.xml from extracted fixture data.
 */
export function generateDescriptionXml(fixture: FixtureData): string {
  const fixtureTypeId = generateUuid();
  const geometryName = "Base";

  // Resolve channels per mode (merge fine/coarse pairs)
  const resolvedModes = fixture.dmxModes.map((mode) => ({
    ...mode,
    resolved: resolveChannels(mode.channels),
  }));

  // Collect unique attributes across all resolved modes
  const attributeMap = new Map<string, string>();
  for (const mode of resolvedModes) {
    for (const ch of mode.resolved) {
      if (!attributeMap.has(ch.attribute)) {
        attributeMap.set(ch.attribute, ch.prettyName);
      }
    }
  }

  const attributes = Array.from(attributeMap.entries());

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<GDTF DataVersion="1.2">`);
  lines.push(
    `  <FixtureType Name="${escapeXml(fixture.name)}" ShortName="${escapeXml(fixture.shortName)}" LongName="${escapeXml(fixture.name)}" Manufacturer="${escapeXml(fixture.manufacturer)}" Description="" FixtureTypeID="${fixtureTypeId}" CanHaveChildren="No" RefFT="">`
  );

  // Attribute Definitions
  lines.push(`    <AttributeDefinitions>`);
  lines.push(`      <ActivationGroups/>`);
  lines.push(`      <FeatureGroups>`);
  lines.push(`        <FeatureGroup Name="Dimmer" Pretty="">`);
  lines.push(`          <Feature Name="Dimmer"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Position" Pretty="">`);
  lines.push(`          <Feature Name="Position"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Color" Pretty="">`);
  lines.push(`          <Feature Name="Color"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Gobo" Pretty="">`);
  lines.push(`          <Feature Name="Gobo"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Beam" Pretty="">`);
  lines.push(`          <Feature Name="Beam"/>`);
  lines.push(`        </FeatureGroup>`);
  lines.push(`        <FeatureGroup Name="Control" Pretty="">`);
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

  // Wheels (required by GrandMA3 even if empty)
  lines.push(`    <Wheels/>`);

  // PhysicalDescriptions
  lines.push(`    <PhysicalDescriptions>`);
  lines.push(`      <ColorSpace Name="" Mode="sRGB"/>`);
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

  // Geometries
  lines.push(`    <Geometries>`);
  lines.push(
    `      <Geometry Name="${geometryName}" Position="${IDENTITY_MATRIX}" Model="">`
  );
  lines.push(
    `        <Beam Name="Beam" Model="" Position="${IDENTITY_MATRIX}" LampType="Discharge" PowerConsumption="${parsePower(fixture.physical.powerConsumption)}" LuminousFlux="10000.000000" ColorTemperature="6000.000000" BeamAngle="25.000000" BeamRadius="0.050000" FieldAngle="25.000000" BeamType="Wash" ColorRenderingIndex="100"/>`
  );
  lines.push(`      </Geometry>`);
  lines.push(`    </Geometries>`);

  // DMX Modes
  lines.push(`    <DMXModes>`);

  for (const mode of resolvedModes) {
    lines.push(
      `      <DMXMode Name="${escapeXml(mode.name)}" Description="" Geometry="${geometryName}">`
    );
    lines.push(`        <DMXChannels>`);

    for (const ch of mode.resolved) {
      const attrName = ch.attribute;
      const channelNodeName = `${geometryName}_${attrName}`;
      const cfName = `${attrName} 1`;
      const initialFn = `${channelNodeName}.${attrName}.${cfName}`;
      const offsetStr = ch.offsets.join(",");
      const defaultVal = `${Math.round(ch.defaultValue)}/1`;
      const highlight = attrName === "Dimmer" ? "255/1" : "0/1";

      lines.push(
        `          <DMXChannel DMXBreak="1" Offset="${offsetStr}" Highlight="${highlight}" Geometry="${geometryName}" InitialFunction="${escapeXml(initialFn)}">`
      );
      lines.push(
        `            <LogicalChannel Attribute="${escapeXml(attrName)}" Snap="No" Master="${attrName === "Dimmer" ? "Grand" : "None"}" MibFade="0.000000" DMXChangeTimeLimit="0.000000">`
      );
      lines.push(
        `              <ChannelFunction Name="${escapeXml(cfName)}" Default="${defaultVal}" DMXFrom="0/1" PhysicalFrom="0.000000" PhysicalTo="1.000000" RealFade="0.000000" RealAcceleration="0.000000" Min="0.000000" Max="0.000000" CustomName="" OriginalAttribute="" Attribute="${escapeXml(attrName)}"/>`
      );
      lines.push(`            </LogicalChannel>`);
      lines.push(`          </DMXChannel>`);
    }

    lines.push(`        </DMXChannels>`);
    lines.push(`        <Relations/>`);
    lines.push(`        <FTMacros/>`);
    lines.push(`      </DMXMode>`);
  }

  lines.push(`    </DMXModes>`);

  lines.push(`  </FixtureType>`);
  lines.push(`</GDTF>`);

  return lines.join("\n");
}

function parseWeight(weight: string): string {
  const match = weight.match(/([\d.]+)/);
  return match ? match[1] : "0.000000";
}

function parsePower(power: string): string {
  const match = power.match(/([\d.]+)/);
  return match ? match[1] : "1000.000000";
}
