"use node";

import { anthropic } from "@ai-sdk/anthropic";
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
  if (!value) throw new Error(`Missing Convex environment variable: ${name}`);
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
  prompt: string
): UserContent {
  return [
    {
      type: "file",
      data: new Uint8Array(pdfBuffer),
      mediaType: "application/pdf",
    },
    { type: "text", text: prompt },
  ];
}

export async function createExtractionRequest(
  pdfBuffer: ArrayBuffer,
  prompt: string
): Promise<ExtractionRequest> {
  const path = getExtractionPath();

  switch (path) {
    case "claude-haiku-native":
      requireEnv("ANTHROPIC_API_KEY");
      return {
        path,
        model: anthropic("claude-haiku-4-5-20251001"),
        content: nativePdfContent(pdfBuffer, prompt),
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
        providerOptions: { openai: { store: false } },
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
