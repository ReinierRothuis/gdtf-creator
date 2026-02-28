"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import JSZip from "jszip";
import { generateDescriptionXml } from "./gdtf";
import type { FixtureData } from "./schema/fixture";

export const exportGdtf = action({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(
      internal.sessions.internalGetSession,
      { id: args.sessionId }
    );
    if (!session?.fixtureData) {
      throw new Error("Session has no fixture data");
    }

    const fixtureData = session.fixtureData as FixtureData;
    const xml = generateDescriptionXml(fixtureData);

    const zip = new JSZip();
    zip.file("description.xml", xml);

    const gdtfBuffer = await zip.generateAsync({
      type: "arraybuffer",
      compression: "STORE",
    });

    const blob = new Blob([gdtfBuffer], {
      type: "application/zip",
    });

    const storageId = await ctx.storage.store(blob);

    await ctx.runMutation(internal.sessions.storeGdtfFile, {
      sessionId: args.sessionId,
      storageId,
    });

    const url = await ctx.storage.getUrl(storageId);
    return url;
  },
});
