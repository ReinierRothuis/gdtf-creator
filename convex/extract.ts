"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { fixtureDataSchema, repairFixtureData } from "./schema/fixture";
import { createExtractionRequest, getExtractionPath } from "./extractionPaths";
import { getExtractionPrompt } from "./extractionPrompt";
import type { Id } from "./_generated/dataModel";

export const extractFixtureData = internalAction({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    let pdfStorageId: Id<"_storage"> | undefined;
    try {
      const session = await ctx.runQuery(internal.sessions.internalGetSession, {
        id: args.sessionId,
      });
      if (!session?.pdfStorageId) {
        throw new Error("Session has no PDF");
      }
      pdfStorageId = session.pdfStorageId;

      const pdfUrl = await ctx.storage.getUrl(pdfStorageId);
      if (!pdfUrl) {
        throw new Error("Could not get PDF URL");
      }

      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Could not download PDF: ${pdfResponse.status}`);
      }
      const pdfBuffer = await pdfResponse.arrayBuffer();
      const pdfSizeBytes = pdfBuffer.byteLength;
      const startTime = Date.now();

      const extractionPath = getExtractionPath();
      const extraction = await createExtractionRequest(
        pdfBuffer,
        getExtractionPrompt(extractionPath),
        extractionPath,
        pdfUrl
      );
      const result = await (async () => {
        try {
          const generated = await generateText({
            model: extraction.model,
            output: Output.object({ schema: fixtureDataSchema }),
            messages: [{ role: "user", content: extraction.content }],
            providerOptions: extraction.providerOptions,
            temperature: extraction.path === "openai-gpt-nano-native" ? undefined : 0,
            maxOutputTokens: 65536,
          });
          if (!generated.output) throw new Error("No structured output returned from LLM");
          return {
            fixtureData: generated.output,
            usage: generated.usage,
            modelId: generated.response.modelId,
            finishReason: generated.finishReason,
            repairedOutput: false,
          };
        } catch (error) {
          if (!NoObjectGeneratedError.isInstance(error) || !error.text) throw error;
          return {
            fixtureData: repairFixtureData(error.text),
            usage: error.usage,
            modelId: error.response?.modelId ?? "unknown",
            finishReason: error.finishReason ?? "unknown",
            repairedOutput: true,
          };
        } finally {
          await extraction.cleanup?.().catch((error) =>
            console.warn("Anthropic file cleanup failed", error)
          );
        }
      })();

      const extractionStats = {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
        extractionDurationMs: Date.now() - startTime,
        modelId: result.modelId,
        finishReason: result.finishReason,
        repairedOutput: result.repairedOutput,
        pdfSizeBytes,
        extractionPath: extraction.path,
        ...(extraction.sourcePageCount === undefined
          ? {}
          : { sourcePageCount: extraction.sourcePageCount }),
        ...(extraction.sourceCharacterCount === undefined
          ? {}
          : { sourceCharacterCount: extraction.sourceCharacterCount }),
      };

      await ctx.runMutation(internal.sessions.storeFixtureData, {
        sessionId: args.sessionId,
        fixtureData: result.fixtureData,
        extractionStats,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown extraction error";
      await ctx.runMutation(internal.sessions.storeError, {
        sessionId: args.sessionId,
        errorMessage: message,
      });
    } finally {
      if (pdfStorageId) {
        await ctx.runMutation(internal.sessions.deletePdf, {
          sessionId: args.sessionId,
          storageId: pdfStorageId,
        });
      }
    }
  },
});
