// Re-export types from Zod schemas
export type {
  DmxChannel,
  DmxMode,
  PhysicalProperties,
  FixtureData,
} from "../../convex/schema/fixture";

export type SessionStatus = "uploading" | "extracting" | "complete" | "error";
