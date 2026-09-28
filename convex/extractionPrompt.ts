import type { ExtractionPath } from "./extractionPaths";

const baseExtractionPrompt = `Extract lighting fixture data from this PDF manual.

# Required data

1. **Manufacturer** and **fixture name** (exact as printed)
2. **Short name** — abbreviated version of the fixture name (e.g. "AuraXB" for "MAC Aura XB")
3. **Fixture type** — one of: MovingHead, Spot, Wash, Beam, Profile, Blinder, Strobe, Laser, Dimmer, Effect, LED, Other
4. **DMX modes** — each mode with:
   - Mode name and total channel count
   - Every channel: channel number, GDTF attribute name (see below), pretty/display name, default DMX value (0–255)
   - For a fine/16-bit channel, set \`fineOf\` to the channel number of its coarse channel and use the same GDTF attribute. Never set \`fineOf\` merely because two independent channels share an attribute.
   - **Channel functions**: For each channel, extract ALL DMX value ranges that define different behaviors. Each function needs: name, dmxFrom, dmxTo (0–255 range). Optionally include physicalFrom/physicalTo for continuous ranges.
   - **Sub-fixtures**: If a mode has repeating channel groups for individually controllable pixels, cells, or sections (e.g. "48ch" mode with 12×RGBW pixels), use the \`subFixtures\` field (see below). When using subFixtures, only include the **global/master** channels (virtual dimmer, strobe, macro, etc.) in the \`channels\` array — do NOT repeat individual pixel channels.
5. **Physical properties** — weight (kg), dimensions width/height/depth (mm), power consumption (W). Include units in the string values.
6. **Pan/tilt range** — If this is a moving head or scanner, extract the pan range and tilt range in degrees (e.g. panRange: 540, tiltRange: 270).
7. **Wheels** — Extract color wheel and gobo wheel definitions if present. Each wheel needs a name, type ("Color" or "Gobo"), and an array of slots with names. For color wheels, include the color as a 6-digit hex string if determinable (e.g. "#ff0000" for red).
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

Be thorough: extract ALL DMX modes and ALL channels in each mode. If a default value is not specified in the PDF, use 0.`;

const claudeExtractionPrompt = `Extract production-ready lighting fixture data from the supplied manual into the provided schema. The manual is the only source: do not invent data.

Required coverage:
- Exact manufacturer, complete product/model name, useful short name, and fixture type.
- Every documented DMX mode and every channel position. channelCount is the mode footprint, not the number of records when subFixtures is used. defaultValue is the documented default, otherwise 0. A fine channel uses the coarse channel's attribute and fineOf when represented in mode.channels.
- All distinct behavioral DMX ranges, with complete contiguous 0–255 coverage. The function attribute is the GDTF attribute active in that range and may differ from its channel attribute.
- Physical weight/dimensions/power, movement ranges, optical/beam properties, physical and virtual color/gobo wheels.

Use standard GDTF attributes, not labels copied verbatim. Keep prettyName human-readable. Omit optional data only when the manual does not provide it.`;

const geminiExtractionPrompt = `Extract production-ready GDTF fixture data from the complete lighting-manual PDF and appended machine text. Return only schema-conforming structured data.

Required:
- Exact printed manufacturer, full product/model name, useful short name, fixture type.
- Physical weight, W/H/D, max power, movement ranges; beam lamp type, minimum beam/field angles, CCT, CRI, lumens, and Spot/Wash/None when printed.
- Assigned DMX mode with exact declared channel count and every channel/function. An instruction after the document identifies the one mode assigned to this extraction shard.
- Complete virtual LED COLOR and CCT wheels when requested by the shard instruction.

DMX table rules:
1. Read the entire multi-page DMX protocol. In a combined table, each mode column supplies a separate channel number; blank mode cells mean only that row is absent from that mode.
2. Simple channels need channel, GDTF attribute, short pretty name, default. Fine bytes use the same attribute and fineOf the coarse offset when listed explicitly.
3. Add ordered contiguous ranges only when ranges activate different GDTF attributes. Put the activated sub-attribute on shutter ranges: open/closed -> Shutter1; regular strobe -> Shutter1Strobe; pulse-open -> Shutter1StrobePulseOpen; pulse-close -> Shutter1StrobePulseClose; random -> Shutter1StrobeRandom. Omit functions entirely for CTO/CCT presets, Color1 presets, ColorEffects1 macros, and proportional channels because their ranges retain one attribute. For a Function/control channel, merge printed options by GDTF operation attribute: unavailable/null -> Dummy or Function; dimmer curves -> DimmerCurve; fan -> Function; LED frequency enable/disable -> LEDFrequency; frequency values -> Refresh Rate; position reset -> PositionReset; effect reset -> Effect Reset; head invert -> PanTiltMode; all reset -> All Reset; dimmer speed/mode -> DimmerMode; dimming start -> Dimming Start Mode; pixel order -> Inver Pixel Order; pan invert -> Pan Inver; tilt invert -> Tilt Inver. Adjacent options with one operation attribute form one range.
4. Compact a contiguous fixed-width block repeated for heads/pixels/cells with subFixtures. Template order must exactly match one complete repeated block. firstChannel + count * templateWidth - 1 must equal the repeated region's last channel. Keep only non-overlapping global channels in mode.channels. Otherwise list channels explicitly. Never omit channels to make validation pass.

Use these GDTF attributes exactly where labels match: Pan, Tilt, Zoom, Dimmer, ColorAdd_R, ColorAdd_G, ColorAdd_B, ColorAdd_W, ColorAdd_GY (lime), CTO (CCT), Color1 (LED COLOR), ColorEffects1 (ring/color macro effect), Shutter1, Function, and PT Speed (pan/tilt speed). Fine channels retain their coarse attribute. Do not change a named emitter into a macro. Do not invent Shutter2 unless manual explicitly numbers shutters.

Defaults when manual has no default column: additive RGB emitters 255, Pan/Tilt coarse and Zoom 127, fine bytes 0, other channels 0.

Virtual wheels, in this order: LED COLOR preset table -> wheel named Color 1 with Open then Color 1, Color 2, ... in table order; CCT -> wheel named CCT with Open then every Kelvin preset exactly as printed. Derive optional hex colors from printed filter names. Never sample, truncate, or use printed filter text as virtual slot names.

Use Spot for a primary narrow beam whose minimum beam angle is 10° or less; use the minimum printed beam and field angles. Audit layout arithmetic, all function boundaries, full identity, and requested wheel slot count before returning.`;

const openAiExtractionPrompt = `Extract production-ready lighting fixture data from the complete attached manual into the provided schema. Return only the object.

Accuracy order: (1) every mode assigned to the current focused extraction pass and its exact channel layout, (2) exact GDTF attributes and function ranges, (3) virtual/physical wheels, (4) identity and physical/beam data. Search the focused page-marked transcription for the assigned mode. It preserves source page numbers and includes fixture specifications plus the complete relevant DMX-table span. Never infer a different mode's column. Never stop after the first DMX table.

# DMX modes

Find every advertised mode heading. Modes sharing one table heading are assigned together: build every assigned mode from its own channel-number column, and never shift values across blank cells in parallel columns. Preserve printed mode names and exact channel counts.

Use subFixtures whenever 2+ identical contiguous channel blocks control repeated heads, modules, cells, sections, rings, or pixels. Describe ONE complete block in subFixtures.channels; count is the number of blocks; firstChannel is the first block's channel. Put only channels outside those repeated blocks in mode.channels. Global channels after the repeated range belong in mode.channels and do not make subFixtures redundant. Repeated templates may contain pan/tilt/fine, zoom, dimmer/fine, shutter functions, RGB emitters, and effects—not only pixels. Use the focused transcription's parallel columns, then count represented channels before emitting JSON. Sparse layouts are invalid: every channel number from 1 through channelCount must be represented exactly once by either explicit channels or the subFixtures expansion. For every mode verify both total represented channels = channelCount and:
max(highest explicit channel, firstChannel + count * template width - 1) = channelCount.
A sub-fixture template has no fineOf field; represent coarse and fine bytes as adjacent entries with the same attribute. On explicit channels, fineOf is only the exact earlier coarse byte with the same attribute.

Schema functions represent GDTF ChannelFunctions, not every printed preset/ChannelSet. Omit the functions PROPERTY entirely for plain proportional channels and for macro/color/CCT preset choices represented by one unchanged attribute (their presets belong in wheels); never emit functions: []. ColorEffects1 channels MUST NOT have functions.

For shutter channels preserve every printed boundary. Default every shutter/strobe channel and its functions to Shutter1 unless the manual explicitly labels a second physical shutter mechanism. Assign standard function attributes: close/open/no-function=Shutter1; regular strobe=Shutter1Strobe; opening pulse=Shutter1StrobePulseOpen; closing pulse=Shutter1StrobePulseClose; random strobe=Shutter1StrobeRandom.

For control channels, one GDTF function spans all consecutive choices/ChannelSets in the same semantic category. Never create one function per curve, frequency, macro number, or yes/no choice. Example groupings: all dimmer curves→DimmerCurve; frequency enable/disable→LEDFrequency; all numeric Hz choices→RefreshRate; fan and CCT-calibration choices→Function; pan/tilt reset→PositionReset; effect reset→EffectReset; head invert choices→PanTiltMode; dimmer speed choices→DimmerMode; each other reset/invert category→its matching attribute. Include null gaps in the surrounding semantic group where needed, while covering 0–255 exactly once. A complex control channel should usually have 10–20 grouped functions, never dozens of one-value functions.

# Attributes

Dimmer=Dimmer; red/green/blue/white=ColorAdd_R/G/B/W; lime=ColorAdd_GY; amber=ColorAdd_RY; UV=ColorAdd_UV; pan=Pan; tilt=Tilt; zoom=Zoom; pan/tilt speed=PanTiltSpeed; shutter/strobe=Shutter1 (use numbered shutters when independently controlled); named discrete color presets=Color1; CCT/CTO preset control=CTO; ring RGB remains ColorAdd_R/G/B; ring macro=ColorEffects1; control/reset=Function. Use the same attribute on coarse and fine bytes.

# Wheels and fixture data

Treat each printed COLOR, colour-gel, CCT, CTO, or CTB preset table as a virtual Color wheel. Order color/gel wheels before CCT/CTO wheels. Name null/open slots "Open". For a gel/color-macro table, use stable slot names "Color 1", "Color 2", etc.; for CCT use the printed Kelvin names. Include every preset in order. slot.color accepts only a literal #RRGGBB value—never put a gel label or color name there; omit color when no reliable hex is available. Do not turn effect macros into wheels. Also extract physical color/gobo wheels.

Use exact full manufacturer and product/model names from the title or specification, including model suffixes. Extract weight, width, height, depth, power, pan/tilt ranges, lamp type, beam/field angles, color temperature, CRI, luminous flux, and beam type. For a variable beam-angle range, beamAngle is its minimum/narrow angle; do not invent a field angle. Physical strings require units. Omit unknown optional fields; never invent numeric zero placeholders. Never emit null, empty wheels, empty modes/channels/subFixtures, or fineOf=0.

If no explicit default is printed, use conventional GDTF defaults: pan/tilt/zoom 127, additive red/green/blue/white 255, other color emitters 0, dimmer 0, and shutter an Open value before its first strobe range. Fine-byte defaultValue is 0.`;

export const extractionPromptAddenda = {
  "claude-haiku-native": `Work methodically from the manual's technical specifications and DMX protocol tables.

Before returning data, silently verify all of the following:
- Use the manufacturer and complete printed product/model name, including model codes and suffixes.
- Find the authoritative list of DMX personalities/channel counts. Return exactly those modes, once each. Repeated headers or continued tables are not new modes.
- In a side-by-side table for several modes, each mode-number column is independent. A blank cell means that channel is absent from that mode; never shift another mode's channel numbers into it. Example: under headers A | B | C, a row blank | 9 | 11 | STROBE means no Strobe in A, channel 9 in B, channel 11 in C. Reconstruct each column top-to-bottom; smaller modes are NOT prefixes of the largest mode.
- The highest expanded channel must equal channelCount and every documented channel position must have the correct attribute. For repeated-head modes, solve channelCount = head count × per-head block width + global-tail width separately for every mode. A smaller mode commonly removes per-head dimmer/fine/strobe channels, renumbers everything after each omission, then retains global controls at the tail. Never implement it by truncating the largest mode.

Compact repeated layouts aggressively. If a mode consists of identical contiguous blocks for heads, cells, rings, pixels, or sections plus global channels, represent one complete block as subFixtures and keep only channels outside those blocks in mode.channels. A block may include movement, fine bytes, color, dimmer, shutter, zoom, effects, and repeated pixel channels—not only RGB pixels. firstChannel is the first block's actual DMX channel. Do not use subFixtures unless every block has exactly the same ordered template. This compact representation is preferred over expanding hundreds of repeated channels.

Keep output focused:
- Omit functions for simple proportional 0–255 channels.
- Wheel/preset and macro channels are modeled by wheels or one feature: OMIT functions entirely from CTO/CCT preset, Color1/color-preset, and ColorEffects1/macro-effect channels. Do not emit dozens of same-attribute ranges for them. Wheel slots preserve the discrete presets.
- Include functions only for other channels with distinct behaviors. EVERY returned function object MUST include its semantic GDTF attribute; never rely on the optional default. Merge adjacent ranges when that attribute is identical. Keep the channel's broad parent attribute (for example Function) separate from its range attributes. For shutter/strobe ranges use Shutter1 for closed/open, Shutter1Strobe, Shutter1StrobePulseOpen, Shutter1StrobePulseClose, and Shutter1StrobeRandom as appropriate. Use the same numbered shutter family (for example Shutter2*) when independent shutter controls exist.
- Common manufacturer-GDTF mappings: Lime = ColorAdd_GY; color-temperature preset/CTO channel = CTO; electronic color preset channel = Color1; ring/color macro effect = ColorEffects1; pan/tilt speed = PT Speed. Preserve exact standard spelling shown here.
- For a general Function/Control channel, keep gdtfAttribute Function. Set range attributes semantically: initial no-op = Dummy; dimmer curves = DimmerCurve; fan and reserved ranges = Function; LED-frequency enable = LEDFrequency; numeric Hz choices = Refresh Rate; pan/tilt reset = PositionReset; effect reset = Effect Reset; head invert = PanTiltMode; calibration = Function; all reset = All Reset; dimmer speed = DimmerMode; dimming start = Dimming Start Mode; pixel/pan/tilt inversion = Inver Pixel Order/Pan Inver/Tilt Inver. Merge adjacent entries sharing one attribute into one range.

Electronic presets count as virtual wheels and wheels MUST be returned whenever such channels exist. For each discrete color-preset channel, return a Color wheel with Open followed by one slot per preset in DMX order; slot names MUST be generic Color 1, Color 2, etc., not LEE/filter descriptions. For each discrete CCT preset channel, return a separate Color wheel with Open followed by every Kelvin label in DMX order. Include both virtual wheels even though no physical wheel exists; never mistake function ranges alone for wheel extraction.

Use technical-spec values exactly. For variable beam/field ranges, beamAngle and fieldAngle are the narrow/minimum values. Choose beamType from the fixture's primary optical output, not its body shape.

Finally verify mode count, mode uniqueness, expanded channel positions, fine links where explicitly represented, function coverage from 0 through 255, and virtual wheels. Return one complete result; never restart or append duplicate modes.`,
  "gemini-flash-lite-native": `Work methodically across the whole manual, especially the complete DMX protocol section near the end. Use the appended machine-extracted text to follow multi-page tables; consult the PDF rendering when text columns are ambiguous. Before composing output, identify every mode heading and its declared channel count; the output must contain one mode for every heading. Never return only the first or simplest mode.

DMX tables often span many pages. A table headed by several mode columns (for example 41ch / 53ch / 61ch) defines several separate modes: read only the assigned count's column, and each row's nonblank number in that column is that row's channel number in that mode. Preserve selected per-head strobe and ring macro rows; blank cells mean that function is absent only from that mode. Continue through every page until the next section heading. Preserve exact channel offsets, 16-bit coarse/fine pairs, defaults, and every non-proportional DMX range. Map identical manual function labels to identical GDTF attributes in all modes.

Compact genuinely repeated fixed-width head/pixel/cell blocks with subFixtures. The template may represent a complete repeated moving head, including Pan, Pan fine, Tilt, Tilt fine, emitters, zoom, dimmer, shutter, and ring/cell channels. Set count, firstChannel, and template width so firstChannel + count * width - 1 exactly reaches the end of the repeated region; keep only later global channels in channels. For modes without one contiguous repeated block, list channels explicitly. Do not drop a mode to satisfy layout validation.

Attribute fidelity:
- CCT/CTO preset channel -> CTO.
- Ring/color preset or macro effect -> ColorEffects1 unless the manual explicitly describes a conventional physical color wheel.
- Preserve an unlisted manufacturer's concise function attribute rather than inventing a generic alias.
- For separate beam and ring shutters, use Shutter1 and Shutter2 consistently when needed.

Virtual wheels are required. Convert an LED COLOR preset table into a Color wheel and a CCT table into a Color wheel named CCT. Include one slot per preset in table order. Convert Null/open to Open. For a virtual numbered color-preset wheel, name slots Open, Color 1, Color 2, ... while using the printed color/filter to estimate each hex color. Preserve Kelvin names for CCT slots; do not collapse or sample either table.

Final audit before returning: assigned mode only; repeated template excludes any trailing master dimmer/strobe/speed/function suffix; expanded layout ends exactly at channelCount with no gaps or overlaps; base channel attribute remains Shutter1 for every strobe channel; ColorEffects1/Color1/CTO have no functions; function ranges ordered, contiguous, start at 0, end at 255; all requested preset wheel slots present; exact printed manufacturer and full fixture model name used.`,
  "openai-gpt-nano-native": `Plan the complete layout internally before emitting JSON; do not output the plan. Search the appended page-marked transcription for every DMX mode heading and table, using the PDF to resolve visual column layout. Include modes found on later pages and modes sharing a table; preserve each mode separately with its exact advertised channel count.

Compact repeated layouts aggressively. Whenever a mode contains two or more identical contiguous blocks for heads, modules, cells, sections, rings, or pixels, subFixtures is REQUIRED: describe one complete repeated block in subFixtures.channels, set count to the number of blocks and firstChannel to the first block channel, and put only non-repeated channels in mode.channels. A repeated block may include pan/tilt/fine, zoom, dimmer/fine, shutter ranges, colors, and effects; it is not limited to RGB pixels. In a shared multi-mode table, build the distinct block width for each mode. Verify firstChannel + count * subFixtures.channels.length - 1 and the highest global channel equal channelCount. Sub-fixture channel templates have no fineOf field; represent coarse and fine bytes as adjacent entries with the same attribute. For global fine channels, fineOf must reference the exact earlier coarse channel with the same attribute.

Keep output compact enough to finish all assigned modes. ColorEffects1 MUST have no functions. Group control ChannelSets into at most 20 semantic functions. Preserve exact shutter boundaries and default to Shutter1 plus Shutter1Strobe/PulseOpen/PulseClose/Random function attributes; use Shutter2 only when explicitly printed. Never use generic labels like Open or Strobe as attributes. Never emit null, zero fineOf values, empty wheels, empty modes, empty channels, or empty subFixtures. Omit unknown optional fields instead of inventing zero values.

Follow attribute mappings and default conventions literally. Build color/gel virtual wheels before CCT/CTO wheels, normalize their first null slot to Open, and do not create effect-macro wheels. Before returning, verify every mode layout reaches its declared channelCount and all five fixture-level physical dimensions/weight/power strings are present.`,
  "openrouter-unpdf-qwen": "Use page headings and DMX table boundaries to keep modes separate. Use subFixtures for repeated pixels.",
  "cloudflare-markdown-qwen": "Use page headings and DMX table boundaries to keep modes separate. Use subFixtures for repeated pixels.",
} as const satisfies Record<ExtractionPath, string>;

export function getExtractionPrompt(path: ExtractionPath): string {
  const prompt = path === "claude-haiku-native" ? claudeExtractionPrompt
    : path === "gemini-flash-lite-native" ? geminiExtractionPrompt
    : path === "openai-gpt-nano-native" ? openAiExtractionPrompt
    : baseExtractionPrompt;
  return `${prompt}\n\n# Model-specific instructions\n\n${extractionPromptAddenda[path]}`;
}
