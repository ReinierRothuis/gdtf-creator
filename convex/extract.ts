"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  createExtractionRequest,
  generateFixtureData,
  getExtractionPath,
} from "./extractionPaths";
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
      const result = await generateFixtureData(extraction).finally(() =>
        extraction.cleanup?.().catch((error) =>
          console.warn("Anthropic file cleanup failed", error)
        )
      );

      const extractionStats = {
        promptTokens: result.inputTokens,
        completionTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        extractionDurationMs: Date.now() - startTime,
        modelId: result.modelId,
        finishReason: result.finishReason,
        repairedOutput: result.repairs.length > 0,
        retryCount: result.retryCount,
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
