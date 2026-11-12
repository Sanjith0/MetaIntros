import { prisma } from "@/lib/db";
import { toJson } from "@/lib/json";
import { publish } from "./bus";

export interface TraceStep {
  agent: string;
  kind: "tool_call" | "reasoning" | "decision" | "safety_check";
  toolName?: string;
  input?: unknown;
  output?: unknown;
  summary: string;
}

/** Persist agent steps for a party (appends after any existing steps) and stream them. */
export async function writeTrace(partyId: string, steps: TraceStep[]) {
  const existing = await prisma.agentTrace.count({ where: { partyId } });
  const members = (await prisma.partyMember.findMany({ where: { partyId }, select: { userId: true } })).map((m) => m.userId);
  for (const [i, s] of steps.entries()) {
    const row = await prisma.agentTrace.create({
      data: {
        partyId,
        agent: s.agent,
        stepIndex: existing + i,
        kind: s.kind,
        toolName: s.toolName,
        input: s.input === undefined ? undefined : toJson(s.input),
        output: s.output === undefined ? undefined : toJson(s.output),
        summary: s.summary,
      },
    });
    publish("trace", { partyId, step: row }, members);
  }
}

export async function getTrace(partyId: string) {
  return prisma.agentTrace.findMany({ where: { partyId }, orderBy: { stepIndex: "asc" } });
}
