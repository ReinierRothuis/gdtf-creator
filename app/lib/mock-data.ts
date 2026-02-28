export interface DmxChannel {
  channel: number;
  function: string;
  defaultValue: number;
  dmxRange: string;
}

export interface DmxMode {
  name: string;
  channelCount: number;
  channels: DmxChannel[];
}

export interface PhysicalProperties {
  weight: string;
  width: string;
  height: string;
  depth: string;
  powerConsumption: string;
}

export interface FixtureData {
  manufacturer: string;
  name: string;
  shortName: string;
  fixtureType: string;
  dmxModes: DmxMode[];
  physical: PhysicalProperties;
}

export const MOCK_FIXTURE: FixtureData = {
  manufacturer: "Martin Professional",
  name: "MAC Aura XB",
  shortName: "AuraXB",
  fixtureType: "MovingHead",
  dmxModes: [
    {
      name: "Standard",
      channelCount: 23,
      channels: [
        { channel: 1, function: "Shutter / Strobe", defaultValue: 0, dmxRange: "0–255" },
        { channel: 2, function: "Dimmer", defaultValue: 0, dmxRange: "0–255" },
        { channel: 3, function: "Dimmer Fine", defaultValue: 0, dmxRange: "0–255" },
        { channel: 4, function: "Cyan", defaultValue: 0, dmxRange: "0–255" },
        { channel: 5, function: "Magenta", defaultValue: 0, dmxRange: "0–255" },
        { channel: 6, function: "Yellow", defaultValue: 0, dmxRange: "0–255" },
        { channel: 7, function: "CTO", defaultValue: 0, dmxRange: "0–255" },
        { channel: 8, function: "Color Wheel", defaultValue: 0, dmxRange: "0–255" },
        { channel: 9, function: "Aura Dimmer", defaultValue: 0, dmxRange: "0–255" },
        { channel: 10, function: "Aura Color", defaultValue: 0, dmxRange: "0–255" },
        { channel: 11, function: "Pan", defaultValue: 128, dmxRange: "0–255" },
        { channel: 12, function: "Pan Fine", defaultValue: 0, dmxRange: "0–255" },
        { channel: 13, function: "Tilt", defaultValue: 128, dmxRange: "0–255" },
        { channel: 14, function: "Tilt Fine", defaultValue: 0, dmxRange: "0–255" },
        { channel: 15, function: "Zoom", defaultValue: 128, dmxRange: "0–255" },
        { channel: 16, function: "Beam FX Index", defaultValue: 0, dmxRange: "0–255" },
        { channel: 17, function: "Beam FX Rotation", defaultValue: 0, dmxRange: "0–255" },
        { channel: 18, function: "Pan/Tilt Speed", defaultValue: 0, dmxRange: "0–255" },
        { channel: 19, function: "FX Speed", defaultValue: 0, dmxRange: "0–255" },
        { channel: 20, function: "Blackout on Move", defaultValue: 0, dmxRange: "0–255" },
        { channel: 21, function: "Intensity Mode", defaultValue: 0, dmxRange: "0–255" },
        { channel: 22, function: "Control", defaultValue: 0, dmxRange: "0–255" },
        { channel: 23, function: "Reserved", defaultValue: 0, dmxRange: "0–255" },
      ],
    },
    {
      name: "Basic",
      channelCount: 15,
      channels: [
        { channel: 1, function: "Shutter / Strobe", defaultValue: 0, dmxRange: "0–255" },
        { channel: 2, function: "Dimmer", defaultValue: 0, dmxRange: "0–255" },
        { channel: 3, function: "Cyan", defaultValue: 0, dmxRange: "0–255" },
        { channel: 4, function: "Magenta", defaultValue: 0, dmxRange: "0–255" },
        { channel: 5, function: "Yellow", defaultValue: 0, dmxRange: "0–255" },
        { channel: 6, function: "CTO", defaultValue: 0, dmxRange: "0–255" },
        { channel: 7, function: "Color Wheel", defaultValue: 0, dmxRange: "0–255" },
        { channel: 8, function: "Aura Dimmer", defaultValue: 0, dmxRange: "0–255" },
        { channel: 9, function: "Aura Color", defaultValue: 0, dmxRange: "0–255" },
        { channel: 10, function: "Pan", defaultValue: 128, dmxRange: "0–255" },
        { channel: 11, function: "Tilt", defaultValue: 128, dmxRange: "0–255" },
        { channel: 12, function: "Zoom", defaultValue: 128, dmxRange: "0–255" },
        { channel: 13, function: "Pan/Tilt Speed", defaultValue: 0, dmxRange: "0–255" },
        { channel: 14, function: "Control", defaultValue: 0, dmxRange: "0–255" },
        { channel: 15, function: "Reserved", defaultValue: 0, dmxRange: "0–255" },
      ],
    },
  ],
  physical: {
    weight: "6.2 kg",
    width: "328 mm",
    height: "406 mm",
    depth: "253 mm",
    powerConsumption: "260 W",
  },
};

export type SessionStatus = "uploading" | "extracting" | "complete" | "error";

export interface ExtractionStage {
  progress: number;
  label: string;
}

export const EXTRACTION_STAGES: ExtractionStage[] = [
  { progress: 5, label: "Uploading PDF..." },
  { progress: 15, label: "Analyzing document structure..." },
  { progress: 30, label: "Extracting fixture metadata..." },
  { progress: 50, label: "Reading DMX channel table..." },
  { progress: 70, label: "Parsing physical properties..." },
  { progress: 85, label: "Validating extracted data..." },
  { progress: 95, label: "Finalizing fixture profile..." },
  { progress: 100, label: "Extraction complete" },
];
