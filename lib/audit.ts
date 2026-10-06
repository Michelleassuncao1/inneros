// Journal d'audit des administrateurs et référents. Jamais de données de répondants.
import { auditLog } from "./db/schema";
import type { Db } from "./db/types";

export async function journaliser(
  db: Db,
  entree: {
    actorUserId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
  },
) {
  await db.insert(auditLog).values({
    actorUserId: entree.actorUserId ?? null,
    action: entree.action,
    targetType: entree.targetType,
    targetId: entree.targetId,
    details: entree.details,
  });
}
