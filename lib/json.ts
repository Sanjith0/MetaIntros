import type { Prisma } from "@prisma/client";

/** Narrow a plain serializable value to Prisma's JSON input type. */
export const toJson = <T>(v: T) => v as unknown as Prisma.InputJsonValue;
