"use node";

import { createAnthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { JSONValue, LanguageModel, UserContent } from "ai";
import { extractText, getDocumentProxy } from "unpdf";

export const EXTRACTION_PATHS = [
  "claude-haiku-native",
  "gemini-flash-lite-native",
  "openai-gpt-nano-native",
  "openrouter-unpdf-qwen",
  "cloudflare-markdown-qwen",
] as const;

export type ExtractionPath = (typeof EXTRACTION_PATHS)[number];

interface ExtractionRequest {
  path: ExtractionPath;
  model: LanguageModel;
  content: UserContent;
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
): UserContent {
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
    case "gemini-flash-lite-native":
      requireEnv("GOOGLE_GENERATIVE_AI_API_KEY");
      return {
        path,
        model: google("gemini-3.5-flash-lite"),
        content: nativePdfContent(pdfBuffer, prompt),
      };
    case "openai-gpt-nano-native":
      requireEnv("OPENAI_API_KEY");
      return {
        path,
        model: openai("gpt-5.4-nano"),
        content: nativePdfContent(pdfBuffer, prompt),
        providerOptions: { openai: { store: false, strictJsonSchema: false } },
      };
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
