import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

export const createSession = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.insert("sessions", {
      status: "uploading",
      createdAt: Date.now(),
    });
  },
});

export const getSession = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const internalGetSession = internalQuery({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const savePdf = mutation({
  args: {
    sessionId: v.id("sessions"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      pdfStorageId: args.storageId,
      status: "extracting",
    });
    await ctx.scheduler.runAfter(0, internal.extract.extractFixtureData, {
      sessionId: args.sessionId,
    });
  },
});

export const storeFixtureData = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    fixtureData: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      fixtureData: args.fixtureData,
      status: "complete",
    });
  },
});

export const storeError = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      errorMessage: args.errorMessage,
      status: "error",
    });
  },
});

export const storeGdtfFile = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      gdtfStorageId: args.storageId,
    });
  },
});
