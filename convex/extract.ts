"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { fixtureDataSchema } from "./schema/fixture";

export const extractFixtureData = internalAction({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    try {
      const session = await ctx.runQuery(internal.sessions.internalGetSession, {
        id: args.sessionId,
      });
      if (!session?.pdfStorageId) {
        throw new Error("Session has no PDF");
      }

      const pdfUrl = await ctx.storage.getUrl(session.pdfStorageId);
      if (!pdfUrl) {
        throw new Error("Could not get PDF URL");
      }

      const pdfResponse = await fetch(pdfUrl);
      const pdfBuffer = await pdfResponse.arrayBuffer();
      const pdfSizeBytes = pdfBuffer.byteLength;
      const startTime = Date.now();

      const result = await generateText({
        model: anthropic("claude-haiku-4-5-20251001"),
        output: Output.object({ schema: fixtureDataSchema }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: Buffer.from(pdfBuffer),
                mediaType: "application/pdf",
              },
              {
                type: "text",
                text: `Extract lighting fixture data from this PDF manual.

# Required data

1. **Manufacturer** and **fixture name** (exact as printed)
2. **Short name** — abbreviated version of the fixture name (e.g. "AuraXB" for "MAC Aura XB")
3. **Fixture type** — one of: MovingHead, Spot, Wash, Beam, Profile, Blinder, Strobe, Laser, Dimmer, Effect, LED, Other
4. **DMX modes** — each mode with:
   - Mode name and total channel count
   - Every channel: channel number, GDTF attribute name (see below), pretty/display name, default DMX value (0–255)
   - **Channel functions**: For each channel, extract ALL DMX value ranges that define different behaviors. Each function needs: name, dmxFrom, dmxTo (0–255 range). Optionally include physicalFrom/physicalTo for continuous ranges.
   - **Sub-fixtures**: If a mode has repeating channel groups for individually controllable pixels, cells, or sections (e.g. "48ch" mode with 12×RGBW pixels), use the \`subFixtures\` field (see below). When using subFixtures, only include the **global/master** channels (virtual dimmer, strobe, macro, etc.) in the \`channels\` array — do NOT repeat individual pixel channels.
5. **Physical properties** — weight (kg), dimensions width/height/depth (mm), power consumption (W). Include units in the string values.
6. **Pan/tilt range** — If this is a moving head or scanner, extract the pan range and tilt range in degrees (e.g. panRange: 540, tiltRange: 270).
7. **Wheels** — Extract color wheel and gobo wheel definitions if present. Each wheel needs a name, type ("Color" or "Gobo"), and an array of slots with names. For color wheels, include the color as a CSS-compatible color string if determinable (e.g. "#ff0000" for red).
8. **Beam properties** — Extract from the spec/technical data section: lampType (e.g. "LED", "Discharge"), beamAngle (degrees), fieldAngle (degrees), colorTemperature (Kelvin), cri (0–100), luminousFlux (lumens), beamType ("Wash", "Spot", or "None").

# Channel functions example

For a shutter channel with these DMX ranges in the PDF:
- 0-19: No function
- 20-24: Shutter open
- 25-64: Strobe (fast to slow)
- 65-69: Shutter open
- 70-84: Opening pulse (fast to slow)
- 85-89: Shutter open
- 90-104: Closing pulse (fast to slow)
- 105-109: Shutter open
- 110-124: Random strobe (fast to slow)
- 125-255: Shutter open

Extract as:
\`\`\`json
{
  "channel": 4,
  "gdtfAttribute": "Shutter1",
  "prettyName": "Strobe effect",
  "defaultValue": 0,
  "functions": [
    { "name": "No function", "dmxFrom": 0, "dmxTo": 19, "attribute": "Shutter1" },
    { "name": "Shutter open", "dmxFrom": 20, "dmxTo": 24, "attribute": "Shutter1" },
    { "name": "Strobe fast to slow", "dmxFrom": 25, "dmxTo": 64, "attribute": "Shutter1Strobe", "physicalFrom": 20.0, "physicalTo": 1.0 },
    { "name": "Shutter open", "dmxFrom": 65, "dmxTo": 69, "attribute": "Shutter1" },
    { "name": "Opening pulse fast to slow", "dmxFrom": 70, "dmxTo": 84, "attribute": "Shutter1StrobePulseOpen", "physicalFrom": 5.0, "physicalTo": 0.5 },
    { "name": "Shutter open", "dmxFrom": 85, "dmxTo": 89, "attribute": "Shutter1" },
    { "name": "Closing pulse fast to slow", "dmxFrom": 90, "dmxTo": 104, "attribute": "Shutter1StrobePulseClose", "physicalFrom": 5.0, "physicalTo": 0.5 },
    { "name": "Shutter open", "dmxFrom": 105, "dmxTo": 109, "attribute": "Shutter1" },
    { "name": "Random strobe fast to slow", "dmxFrom": 110, "dmxTo": 124, "attribute": "Shutter1StrobeRandom", "physicalFrom": 20.0, "physicalTo": 1.0 },
    { "name": "Shutter open", "dmxFrom": 125, "dmxTo": 255, "attribute": "Shutter1" }
  ]
}
\`\`\`

The \`attribute\` field on each function is optional and defaults to the channel's \`gdtfAttribute\`. Use it when a DMX range activates a different GDTF sub-attribute. Common shutter sub-attributes: Shutter1Strobe, Shutter1StrobePulseOpen, Shutter1StrobePulseClose, Shutter1StrobeRandom, Shutter1StrobeRandomPulseOpen, Shutter1StrobeRandomPulseClose.

For a dimmer channel (0–255 = 0–100% intensity):
\`\`\`json
{
  "channel": 1,
  "gdtfAttribute": "Dimmer",
  "prettyName": "Dim",
  "defaultValue": 0,
  "functions": [
    { "name": "Dimmer", "dmxFrom": 0, "dmxTo": 255, "physicalFrom": 0, "physicalTo": 1.0 }
  ]
}
\`\`\`

If a channel has no distinct function ranges (e.g. a simple 0–255 proportional channel), you may omit the \`functions\` array entirely.

# Wheels example

\`\`\`json
{
  "wheels": [
    {
      "name": "Color Wheel 1",
      "type": "Color",
      "slots": [
        { "name": "Open", "color": "#ffffff" },
        { "name": "Red", "color": "#ff0000" },
        { "name": "Blue", "color": "#0000ff" },
        { "name": "Green", "color": "#00ff00" },
        { "name": "Yellow", "color": "#ffff00" },
        { "name": "Magenta", "color": "#ff00ff" },
        { "name": "Orange", "color": "#ff8000" }
      ]
    },
    {
      "name": "Gobo Wheel 1",
      "type": "Gobo",
      "slots": [
        { "name": "Open" },
        { "name": "Dot" },
        { "name": "Star" },
        { "name": "Circle" }
      ]
    }
  ]
}
\`\`\`

# Sub-fixtures (pixel/cell control)

Many fixtures have modes with individually controllable pixels, cells, or LED sections. These appear as repeating channel groups in the DMX chart. When you detect this pattern, use the \`subFixtures\` field on the mode instead of listing every pixel channel individually.

- \`name\`: what each unit is called — "Pixel", "Cell", "Section", "LED", etc.
- \`count\`: how many sub-fixtures there are
- \`channels\`: the channel template for ONE sub-fixture (ordered list of attributes)
- \`firstChannel\`: the 1-based channel number where the sub-fixture range begins in the mode

The mode's \`channels\` array should ONLY contain global/master channels (virtual dimmer, master strobe, effects, etc.) — not the per-pixel channels.

Example: An LED bar with 12 RGBW pixels. Mode "52ch" has channels 1-4 as global controls, then 12×4 pixel channels starting at channel 5:

\`\`\`json
{
  "name": "52ch",
  "channelCount": 52,
  "channels": [
    { "channel": 1, "gdtfAttribute": "Dimmer", "prettyName": "Dim", "defaultValue": 0 },
    { "channel": 2, "gdtfAttribute": "Shutter1", "prettyName": "Strobe", "defaultValue": 255 },
    { "channel": 3, "gdtfAttribute": "ColorMacro", "prettyName": "Color Macro", "defaultValue": 0 },
    { "channel": 4, "gdtfAttribute": "Function", "prettyName": "Control", "defaultValue": 0 }
  ],
  "subFixtures": {
    "name": "Pixel",
    "count": 12,
    "channels": [
      { "gdtfAttribute": "ColorAdd_R", "prettyName": "R", "defaultValue": 0 },
      { "gdtfAttribute": "ColorAdd_G", "prettyName": "G", "defaultValue": 0 },
      { "gdtfAttribute": "ColorAdd_B", "prettyName": "B", "defaultValue": 0 },
      { "gdtfAttribute": "ColorAdd_W", "prettyName": "W", "defaultValue": 0 }
    ],
    "firstChannel": 5
  }
}
\`\`\`

Not every mode needs subFixtures. A simple "4ch RGBW" mode on the same fixture would just list 4 channels with no subFixtures. Only use subFixtures when there are repeating per-pixel/cell channel groups.

# GDTF attribute names

For each DMX channel, use the standard GDTF attribute name in the \`gdtfAttribute\` field. Common mappings:

| Function | gdtfAttribute |
|---|---|
| Dimmer / Intensity | Dimmer |
| Red | ColorAdd_R |
| Green | ColorAdd_G |
| Blue | ColorAdd_B |
| White | ColorAdd_W |
| Amber | ColorAdd_RY |
| Lime | ColorAdd_GY |
| UV | ColorAdd_UV |
| Warm White | ColorAdd_WW |
| Cool White | ColorAdd_CW |
| Cyan | ColorSub_C |
| Magenta | ColorSub_M |
| Yellow | ColorSub_Y |
| Color Temperature / CCT / CTO / CTB | COLORTEMPERATURE |
| Color Macro | ColorMacro |
| Color Wheel | Color1 |
| Pan | Pan |
| Tilt | Tilt |
| Pan/Tilt Speed | PanTiltSpeed |
| Zoom | Zoom |
| Focus | Focus |
| Iris | Iris |
| Shutter / Strobe | Shutter1 |
| Strobe Effect | Shutter1StrobeEffect |
| Strobe Duration | StrobeDuration |
| Strobe Rate | StrobeRate |
| Gobo Wheel | Gobo1 |
| Gobo Rotation | Gobo1Pos |
| Prism | Prism1 |
| Prism Rotation | Prism1Pos |
| Frost | Frost1 |
| Control / Reset / Function | Function |
| Static Effect | Effects1 |
| Moving/Pixel Effect | Effects2 |
| Effect Speed | Effects2Rate |
| Effect Fade / Crossfade | Effects2Fade |
| Background Color | Effects2ColorBacklight |
| Background Dimmer | Effects2IntensityBacklight |
| Color Uniformity / Tint | ColorUniformity |

For attributes not in this list, use a descriptive PascalCase name (e.g. "FanSpeed", "Macro").
For the \`prettyName\` field, use a short human-readable label (e.g. "Dim", "R", "G", "B", "Pan", "Tilt").

Be thorough: extract ALL DMX modes and ALL channels in each mode. If a default value is not specified in the PDF, use 0.`,
              },
            ],
          },
        ],
      });

      const fixtureData = result.output;
      if (!fixtureData) {
        throw new Error("No structured output returned from LLM");
      }

      const extractionStats = {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
        extractionDurationMs: Date.now() - startTime,
        modelId: result.response.modelId,
        finishReason: result.finishReason,
        pdfSizeBytes,
      };

      await ctx.runMutation(internal.sessions.storeFixtureData, {
        sessionId: args.sessionId,
        fixtureData,
        extractionStats,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown extraction error";
      await ctx.runMutation(internal.sessions.storeError, {
        sessionId: args.sessionId,
        errorMessage: message,
      });
    }
  },
});
