import { db } from "@/lib/db";
import { leadActivities } from "@/lib/schema";

interface LogActivityParams {
  leadId: number;
  action: string;
  actorName: string;
  oldValue?: string | null;
  newValue?: string | null;
  detail?: string | null;
}

export async function logActivity(params: LogActivityParams) {
  await db.insert(leadActivities).values({
    leadId: params.leadId,
    action: params.action,
    actorName: params.actorName,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    detail: params.detail ?? null,
  });
}
