"use node";

import { createAnthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import type { JSONValue, LanguageModel, ModelMessage, UserContent } from "ai";
import { extractText, getDocumentProxy } from "unpdf";
import {
  fixtureDataSchema,
  repairFixtureDataWithReport,
  type FixtureData,
} from "./schema/fixture.ts";

export const EXTRACTION_PATHS = [
  "claude-haiku-native",
  "gemini-flash-lite-native",
  "openai-gpt-nano-native",
  "openrouter-unpdf-qwen",
  "cloudflare-markdown-qwen",
] as const;

export type ExtractionPath = (typeof EXTRACTION_PATHS)[number];

export interface ExtractionRequest {
  path: ExtractionPath;
  model: LanguageModel;
  content: UserContent;
  additionalContents?: UserContent[];
  modeTargets?: Array<{ name: string; channelCount: number }>;
  providerOptions?: Record<string, Record<string, JSONValue>>;
  sourcePageCount?: number;
  sourceCharacterCount?: number;
  cleanup?: () => Promise<void>;
}

export function getExtractionPath(
  value = process.env.PDF_EXTRACTION_PATH
): ExtractionPath {
  const path = value ?? "claude-haiku-native";
  if (!EXTRACTION_PATHS.includes(path as ExtractionPath)) {
    throw new Error(
      `Invalid PDF_EXTRACTION_PATH "${path}". Expected: ${EXTRACTION_PATHS.join(", ")}`
    );
  }
  return path as ExtractionPath;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

async function cloudflareToMarkdown(pdfBuffer: ArrayBuffer): Promise<string> {
  const form = new FormData();
  form.append(
    "files",
    new Blob([pdfBuffer], { type: "application/pdf" }),
    "manual.pdf"
  );
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${requireEnv("CLOUDFLARE_ACCOUNT_ID")}/ai/tomarkdown`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("CLOUDFLARE_AI_API_TOKEN")}`,
      },
      body: form,
    }
  );
  const body = (await response.json()) as {
    success: boolean;
    result?: Array<{ data?: string; error?: string }>;
    errors?: Array<{ message: string }>;
  };
  const result = body.result?.[0];
  if (!response.ok || !body.success || !result?.data) {
    throw new Error(
      result?.error ??
        body.errors?.map((error) => error.message).join(", ") ??
        `Cloudflare Markdown conversion failed: ${response.status}`
    );
  }
  return result.data;
}

function qwenModel() {
  return createOpenRouter({
    apiKey: requireEnv("OPENROUTER_API_KEY"),
  })("qwen/qwen-plus");
}

function nativePdfContent(
  pdfBuffer: ArrayBuffer,
  prompt: string,
  pdfUrl?: string
): Exclude<UserContent, string> {
  return [
    {
      type: "file",
      data: pdfUrl ? new URL(pdfUrl) : new Uint8Array(pdfBuffer),
      mediaType: "application/pdf",
    },
    { type: "text", text: prompt },
  ];
}

export function sanitizeAnthropicSchema(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(sanitizeAnthropicSchema);
    return;
  }
  const schema = value as Record<string, unknown>;
  if (schema.type === "integer" || schema.type === "number") {
    delete schema.minimum;
    delete schema.maximum;
    delete schema.exclusiveMinimum;
    delete schema.exclusiveMaximum;
    delete schema.multipleOf;
  }
  Object.values(schema).forEach(sanitizeAnthropicSchema);
}

function anthropicModel(apiKey: string, file?: { marker: string; id: string }) {
  return createAnthropic({
    apiKey,
    fetch: async (input, init) => {
      if (typeof init?.body === "string") {
        const body = JSON.parse(init.body) as {
          messages?: Array<{ content?: Array<any> }>;
          output_config?: { format?: { schema?: unknown } };
        };
        sanitizeAnthropicSchema(body.output_config?.format?.schema);
        if (file) {
          for (const message of body.messages ?? []) {
            for (const part of message.content ?? []) {
              if (part.type === "document" && part.source?.data === file.marker) {
                part.source = { type: "file", file_id: file.id };
              }
            }
          }
        }
        const headers = new Headers(init.headers);
        if (file) {
          const betas = new Set(
            `${headers.get("anthropic-beta") ?? ""},files-api-2025-04-14`
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          );
          headers.set("anthropic-beta", [...betas].join(","));
        }
        init = { ...init, headers, body: JSON.stringify(body) };
      }
      return fetch(input, init);
    },
  })("claude-haiku-4-5-20251001");
}

async function anthropicUploadedPdfRequest(
  pdfBuffer: ArrayBuffer,
  prompt: string,
  path: ExtractionPath
): Promise<ExtractionRequest> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const form = new FormData();
  form.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), "manual.pdf");
  const upload = await fetch("https://api.anthropic.com/v1/files", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "files-api-2025-04-14",
    },
    body: form,
  });
  const uploaded = (await upload.json()) as { id?: string; error?: { message?: string } };
  if (!upload.ok || !uploaded.id) {
    throw new Error(uploaded.error?.message ?? `Anthropic file upload failed: ${upload.status}`);
  }

  // Valid base64 prevents AI SDK from treating the marker as a URL to download.
  const marker = btoa(`anthropic-upload:${uploaded.id}`);
  const model = anthropicModel(apiKey, { marker, id: uploaded.id });

  return {
    path,
    model,
    content: [
      { type: "file", data: marker, mediaType: "application/pdf" },
      { type: "text", text: prompt },
    ],
    cleanup: async () => {
      const deleted = await fetch(`https://api.anthropic.com/v1/files/${uploaded.id}`, {
        method: "DELETE",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "files-api-2025-04-14",
        },
      });
      if (!deleted.ok) throw new Error(`Could not delete Anthropic file: ${deleted.status}`);
    },
  };
}

export async function createExtractionRequest(
  pdfBuffer: ArrayBuffer,
  prompt: string,
  pathValue?: string,
  pdfUrl?: string
): Promise<ExtractionRequest> {
  const path = getExtractionPath(pathValue);

  switch (path) {
    case "claude-haiku-native":
      requireEnv("ANTHROPIC_API_KEY");
      if (!pdfUrl && pdfBuffer.byteLength > 20 * 1024 * 1024) {
        return anthropicUploadedPdfRequest(pdfBuffer, prompt, path);
      }
      return {
        path,
        model: anthropicModel(requireEnv("ANTHROPIC_API_KEY")),
        content: nativePdfContent(pdfBuffer, prompt, pdfUrl),
      };
    case "gemini-flash-lite-native": {
      requireEnv("GOOGLE_GENERATIVE_AI_API_KEY");
      const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer.slice(0)));
      const extracted = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
      const text = pages
        .map((page, index) => `--- PAGE ${index + 1} ---\n${page}`)
        .join("\n\n");
      const modeTargets = [...text.matchAll(/(\d+)\s*ch(?:annel)?s?\s*\(\s*mode\s*([^)]+)\)/gi)]
        .map((match) => ({ name: `Mode ${match[2].trim()}`, channelCount: Number(match[1]) }))
        .filter((target, index, all) =>
          all.findIndex((item) => item.name === target.name && item.channelCount === target.channelCount) === index
        );
      return {
        path,
        model: google("gemini-3.5-flash-lite"),
        content: [
          ...nativePdfContent(pdfBuffer, prompt),
          { type: "text", text: `# Machine-extracted PDF text\n\n${text}` },
        ],
        providerOptions: {
          google: { thinkingConfig: { thinkingLevel: "medium" } },
        },
        sourcePageCount: extracted.totalPages,
        sourceCharacterCount: text.length,
        ...(modeTargets.length > 1 ? { modeTargets } : {}),
      };
    }
    case "openai-gpt-nano-native": {
      requireEnv("OPENAI_API_KEY");
      let pages: string[] = [];
      let pageCount: number | undefined;
      try {
        const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer.slice(0)));
        const extracted = await extractText(pdf, { mergePages: false });
        pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
        pageCount = extracted.totalPages;
      } catch {}
      const headingPattern = /\b(\d{1,3})\s*(?:ch|channels?)\s*\(\s*mode\s*(\d+)\s*\)/gi;
      const detectedHeadings = pages.flatMap((page, pageIndex) =>
        [...page.matchAll(headingPattern)].map(([, channels, mode]) => ({
          heading: `Mode ${mode}: ${channels} channels`,
          pageIndex,
        }))
      ).filter((item, index, all) =>
        all.findIndex(({ heading }) => heading === item.heading) === index
      );
      const modeHeadings = detectedHeadings.map(({ heading }) => heading);
      const groups = detectedHeadings.length
        ? [...new Set(detectedHeadings.map(({ pageIndex }) => pageIndex))].map((pageIndex) =>
            detectedHeadings.filter((item) => item.pageIndex === pageIndex).map(({ heading }) => heading))
        : [modeHeadings];
      const text = pages
        .map((page, index) => `--- PAGE ${index + 1} ---\n${page}`)
        .join("\n\n");
      const contents = groups.map((group, index) => {
        const inventory = group.length
          ? `\n\n# This extraction pass\n\nReturn exactly these modes: ${group.join("; ")}. Do not include other modes in this pass.`
          : "";
        const wheelInstruction = index === 0
          ? " Extract every virtual or physical wheel."
          : " Omit wheels in this pass to save output.";
        const start = detectedHeadings.find(({ heading }) => heading === group[0])?.pageIndex ?? 0;
        const next = detectedHeadings.find(({ pageIndex }) => pageIndex > start)?.pageIndex ?? pages.length;
        const selected = new Set([
          ...pages.slice(0, 10).map((_, pageIndex) => pageIndex),
          ...pages.slice(start, Math.min(next, start + 12)).map((_, pageIndex) => start + pageIndex),
        ]);
        const focusedText = [...selected]
          .sort((left, right) => left - right)
          .map((pageIndex) => `--- PAGE ${pageIndex + 1} ---\n${pages[pageIndex]}`)
          .join("\n\n");
        const passPrompt = focusedText
          ? `${prompt}${inventory}${wheelInstruction}\n\n# Focused machine-extracted PDF text\n\n${focusedText}${inventory}\n\nReturn the complete schema object now.`
          : prompt;
        return index === 0
          ? nativePdfContent(pdfBuffer, passPrompt)
          : [{ type: "text" as const, text: passPrompt }];
      });
      return {
        path,
        model: openai("gpt-5.4-nano"),
        content: contents[0],
        additionalContents: contents.slice(1),
        providerOptions: {
          openai: {
            store: false,
            strictJsonSchema: false,
            reasoningEffort: "medium",
            textVerbosity: "low",
          },
        },
        sourcePageCount: pageCount,
        sourceCharacterCount: text.length || undefined,
      };
    }
    case "openrouter-unpdf-qwen": {
      const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
      const extracted = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(extracted.text)
        ? extracted.text
        : [extracted.text];
      const text = pages
        .map((page, index) => `--- PAGE ${index + 1} ---\n${page}`)
        .join("\n\n");
      if (!text.replace(/--- PAGE \d+ ---/g, "").trim()) {
        throw new Error(
          "PDF contains no extractable text; use a native PDF extraction path"
        );
      }
      return {
        path,
        model: qwenModel(),
        content: [
          {
            type: "text",
            text: `${prompt}\n\n# Extracted PDF text\n\n${text}`,
          },
        ],
        sourcePageCount: extracted.totalPages,
        sourceCharacterCount: text.length,
      };
    }
    case "cloudflare-markdown-qwen": {
      const text = await cloudflareToMarkdown(pdfBuffer);
      return {
        path,
        model: qwenModel(),
        content: [
          {
            type: "text",
            text: `${prompt}\n\n# Cloudflare-converted PDF Markdown\n\n${text}`,
          },
        ],
        sourceCharacterCount: text.length,
      };
    }
  }
}

export function normalizeGeminiMode(
  mode: FixtureData["dmxModes"][number]
): FixtureData["dmxModes"][number] {
  const normalized = structuredClone(mode);
  const channels = [
    ...normalized.channels,
    ...(normalized.subFixtures?.channels ?? []),
  ];
  for (const channel of channels) {
    if (channel.functions?.length === 0) delete channel.functions;
    if (["CTO", "Color1", "ColorEffects1"].includes(channel.gdtfAttribute)) {
      delete channel.functions;
      continue;
    }
    if (!channel.functions) continue;
    for (const fn of channel.functions) {
      const name = fn.name.toLowerCase();
      if (channel.gdtfAttribute.startsWith("Shutter")) {
        fn.attribute = name.includes("random") ? "Shutter1StrobeRandom"
          : name.includes("fast open slow close") ? "Shutter1StrobePulseOpen"
          : name.includes("slow open fast close") ? "Shutter1StrobePulseClose"
          : name.includes("strobe") ? "Shutter1Strobe"
          : "Shutter1";
      } else if (channel.gdtfAttribute === "Function") {
        fn.attribute = fn.dmxFrom === 0 && /null|no function/.test(name) ? "Dummy"
          : name.includes("dimmer curve") ? "DimmerCurve"
          : name.includes("led frequency") && /enable|disable/.test(name) ? "LEDFrequency"
          : /\b\d+\s*k?hz\b/i.test(fn.name) ? "Refresh Rate"
          : name.includes("pan/tilt reset") ? "PositionReset"
          : name.includes("effect reset") ? "Effect Reset"
          : name.includes("head invert") ? "PanTiltMode"
          : name.includes("all reset") ? "All Reset"
          : /dimmer (speed|mode)/.test(name) ? "DimmerMode"
          : name.includes("dimming start") ? "Dimming Start Mode"
          : name.includes("invert pixel") ? "Inver Pixel Order"
          : name.includes("pan invert") ? "Pan Inver"
          : name.includes("tilt invert") ? "Tilt Inver"
          : "Function";
      }
    }
    if (channel.gdtfAttribute === "Function") {
      channel.functions = channel.functions.reduce<typeof channel.functions>((merged, fn) => {
        const previous = merged.at(-1);
        if (previous && previous.attribute === fn.attribute) previous.dmxTo = fn.dmxTo;
        else merged.push({ ...fn });
        return merged;
      }, []);
    }
  }
  return normalized;
}

export async function generateFixtureData(request: ExtractionRequest): Promise<{
  fixtureData: FixtureData;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  modelId: string;
  finishReason: string;
  retryCount: number;
  repairs: string[];
  rawOutput?: string;
}> {
  if (request.modeTargets?.length) {
    const results = [];
    for (const [index, target] of request.modeTargets.entries()) {
      results.push(await generateFixtureData({
        ...request,
        additionalContents: undefined,
        modeTargets: undefined,
        content: [
          ...(typeof request.content === "string"
            ? [{ type: "text" as const, text: request.content }]
            : request.content),
          {
            type: "text",
            text: `# Assigned extraction shard\n\nExtract exactly ${target.name}, declared as ${target.channelCount} channels. Ignore requests to return other modes; another shard handles each one. Return every channel in this mode and no other mode. If one table has multiple mode columns, use only the column headed ${target.channelCount}ch; a number present only in another mode's column is absent here, so never infer this layout by dividing channelCount. In particular, keep any per-head strobe and ring macro row selected by this column; do not substitute dimmer rows from a neighboring mode column. Set mode.name to "${target.name} ${target.channelCount} DMX". If this mode has three or more identical fixed-width head/pixel blocks, you MUST use one subFixtures template; do not expand repeated blocks or omit their repeated shutter function ranges. A fixed global suffix after the repeated blocks must remain in channels: find its first master dimmer/strobe/speed/function channel and end the template immediately before it; never enlarge the template merely to reach channelCount. A strobe DMX channel's gdtfAttribute is Shutter1, while only its range attributes use exact Shutter1Strobe, Shutter1StrobePulseOpen, Shutter1StrobePulseClose, or Shutter1StrobeRandom variants. Delete functions from CTO, Color1, and ColorEffects1 channels. On Function channels, merge adjacent ranges with one operation attribute; numeric Hz selections use Refresh Rate.${index === 0 ? " Extract all fixture metadata and complete virtual color/CCT wheels too." : " Omit wheels; they are handled by the first shard."}`,
          },
        ],
      }));
    }
    const first = results[0];
    return {
      fixtureData: fixtureDataSchema.parse({
        ...first.fixtureData,
        ...(first.fixtureData.wheels ? {
          wheels: [...first.fixtureData.wheels]
            .sort((left, right) => Number(/cct/i.test(left.name)) - Number(/cct/i.test(right.name)))
            .map((wheel) => wheel.slots.some((slot) => /\bLEE\s*\d+/i.test(slot.name))
              ? {
                  ...wheel,
                  slots: wheel.slots.map((slot, index) => ({
                    ...slot,
                    name: index === 0 ? "Open" : `Color ${index}`,
                  })),
                }
              : wheel),
        } : {}),
        dmxModes: results.map((result, index) => {
          const target = request.modeTargets![index];
          const mode = result.fixtureData.dmxModes.find(
            (item) => item.channelCount === target.channelCount
          ) ?? result.fixtureData.dmxModes[0];
          return normalizeGeminiMode({
            ...mode,
            name: `${target.name} ${target.channelCount} DMX`,
          });
        }),
      }),
      inputTokens: results.reduce((sum, result) => sum + result.inputTokens, 0),
      outputTokens: results.reduce((sum, result) => sum + result.outputTokens, 0),
      totalTokens: results.reduce((sum, result) => sum + result.totalTokens, 0),
      modelId: first.modelId,
      finishReason: results.at(-1)!.finishReason,
      retryCount: results.reduce((sum, result) => sum + result.retryCount, 0),
      repairs: results.flatMap((result) => result.repairs),
    };
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  const generate = async (
    messages: ModelMessage[],
    reasoningEffort?: "medium" | "high"
  ) => {
    try {
      const result = await generateText({
        model: request.model,
        output: Output.object({ schema: fixtureDataSchema }),
        messages,
        providerOptions: reasoningEffort && request.providerOptions?.openai
          ? {
              ...request.providerOptions,
              openai: { ...request.providerOptions.openai, reasoningEffort },
            }
          : request.providerOptions,
        temperature: request.path === "openai-gpt-nano-native" ? undefined : 0,
        maxOutputTokens: 65536,
      });
      inputTokens += result.usage.inputTokens ?? 0;
      outputTokens += result.usage.outputTokens ?? 0;
      totalTokens += result.usage.totalTokens ??
        (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);
      return result;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        inputTokens += error.usage?.inputTokens ?? 0;
        outputTokens += error.usage?.outputTokens ?? 0;
        totalTokens += error.usage?.totalTokens ??
          (error.usage?.inputTokens ?? 0) + (error.usage?.outputTokens ?? 0);
      }
      throw error;
    }
  };

  const extract = async (
    content: UserContent,
    reasoningEffort?: "medium" | "high"
  ) => {
    const firstMessages = [{ role: "user" as const, content }];
    try {
      const result = await generate(firstMessages, reasoningEffort);
      if (!result.output) throw new Error("No structured output returned from LLM");
      return {
        fixtureData: result.output,
        modelId: result.response.modelId,
        finishReason: result.finishReason,
        retryCount: 0,
        repairs: [] as string[],
        rawOutput: undefined as string | undefined,
      };
    } catch (firstError) {
      if (!NoObjectGeneratedError.isInstance(firstError) || !firstError.text) throw firstError;

      try {
        const result = await generate([
          ...firstMessages,
          { role: "assistant" as const, content: firstError.text },
          {
            role: "user" as const,
            content: `The previous extraction failed schema validation. Return the complete corrected fixture data, preserving all valid extracted information.${request.path === "gemini-flash-lite-native" ? " Fix every mode's channel layout; do not drop modes or channels to satisfy validation. Use a subFixtures template for a contiguous repeated layout." : ""} Do not explain the correction.\n\nValidation error:\n${firstError.message}`,
          },
        ], reasoningEffort);
        if (!result.output) throw new Error("No structured output returned from retry");
        return {
          fixtureData: result.output,
          modelId: result.response.modelId,
          finishReason: result.finishReason,
          retryCount: 1,
          repairs: [] as string[],
          rawOutput: undefined as string | undefined,
        };
      } catch (retryError) {
        const failedRetry = NoObjectGeneratedError.isInstance(retryError) ? retryError : undefined;
        for (const rawOutput of [failedRetry?.text, firstError.text]) {
          if (!rawOutput) continue;
          try {
            const { fixtureData, repairs } = repairFixtureDataWithReport(rawOutput);
            return {
              fixtureData,
              modelId: failedRetry?.response?.modelId ?? firstError.response?.modelId ?? "unknown",
              finishReason: failedRetry?.finishReason ?? firstError.finishReason ?? "unknown",
              retryCount: 1,
              repairs,
              rawOutput,
            };
          } catch {}
        }
        throw retryError;
      }
    }
  };

  const extractions: Awaited<ReturnType<typeof extract>>[] = [];
  for (const [index, content] of [request.content, ...(request.additionalContents ?? [])].entries()) {
    const fixture: FixtureData | undefined = extractions[0]?.fixtureData;
    const parts = typeof content === "string"
      ? [{ type: "text" as const, text: content }]
      : content;
    const passContent: UserContent = fixture
      ? [
          ...parts,
          {
            type: "text" as const,
            text: `Use these fixture-level values from the first extraction pass exactly:\n${JSON.stringify({
              manufacturer: fixture.manufacturer,
              name: fixture.name,
              shortName: fixture.shortName,
              fixtureType: fixture.fixtureType,
              physical: fixture.physical,
              beam: fixture.beam,
            })}`,
          },
        ]
      : content;
    extractions.push(await extract(
      passContent,
      request.path === "openai-gpt-nano-native" && index > 0 ? "high" : undefined
    ));
  }
  const first = extractions[0];
  if (extractions.length === 1) {
    return { ...first, inputTokens, outputTokens, totalTokens };
  }

  const seenModes = new Set<string>();
  const dmxModes = extractions.flatMap(({ fixtureData }) => fixtureData.dmxModes).filter((mode) => {
    const key = `${mode.channelCount}:${mode.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    if (seenModes.has(key)) return false;
    seenModes.add(key);
    return true;
  });
  const wheels = extractions
    .map(({ fixtureData }) => fixtureData.wheels)
    .filter((value): value is NonNullable<FixtureData["wheels"]> => Boolean(value))
    .sort((left, right) =>
      right.reduce((sum, wheel) => sum + wheel.slots.length, 0) -
      left.reduce((sum, wheel) => sum + wheel.slots.length, 0)
    )[0];
  return {
    fixtureData: fixtureDataSchema.parse({
      ...first.fixtureData,
      dmxModes,
      ...(wheels ? { wheels } : {}),
    }),
    inputTokens,
    outputTokens,
    totalTokens,
    modelId: first.modelId,
    finishReason: extractions.at(-1)!.finishReason,
    retryCount: extractions.reduce((sum, result) => sum + result.retryCount, 0),
    repairs: extractions.flatMap((result) => result.repairs),
  };
}
