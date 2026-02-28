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
      const session = await ctx.runQuery(
        internal.sessions.internalGetSession,
        { id: args.sessionId }
      );
      if (!session?.pdfStorageId) {
        throw new Error("Session has no PDF");
      }

      const pdfUrl = await ctx.storage.getUrl(session.pdfStorageId);
      if (!pdfUrl) {
        throw new Error("Could not get PDF URL");
      }

      const pdfResponse = await fetch(pdfUrl);
      const pdfBuffer = await pdfResponse.arrayBuffer();

      const result = await generateText({
        model: anthropic("claude-sonnet-4-5-20250929"),
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
5. **Physical properties** — weight (kg), dimensions width/height/depth (mm), power consumption (W). Include units in the string values.

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

      await ctx.runMutation(internal.sessions.storeFixtureData, {
        sessionId: args.sessionId,
        fixtureData,
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
