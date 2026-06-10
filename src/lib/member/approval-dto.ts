/**
 * Shaping of `subject_approvals` rows into the member-facing approval DTO
 * (§4.8). Each row carries the subject triple, the five-state status, evidence,
 * the manager's decision note, and the `direct_grant` flag (manager-granted rows
 * have evidence NULL and render "Granted by a manager").
 */
import type { Database } from "@/types/database";

type ApprovalRow = Database["public"]["Tables"]["subject_approvals"]["Row"];

export type MemberApprovalDTO = {
  id: string;
  status: Database["public"]["Enums"]["approval_status"];
  subject: { id: string; name: string; category: string | null; grade_level: number | null };
  evidence: string | null;
  decision_note: string | null;
  direct_grant: boolean;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApprovalWithSubject = ApprovalRow & {
  subject: { id: string; name: string; category: string | null; grade_level: number | null } | null;
};

/** PostgREST select that hydrates an approval with its subject via the composite FK. */
export const APPROVAL_SELECT = `
  *,
  subject:org_subjects!subject_approvals_subject_fk ( id, name, category, grade_level )
` as const;

export function toMemberApprovalDTO(row: ApprovalWithSubject): MemberApprovalDTO {
  return {
    id: row.id,
    status: row.status,
    subject: row.subject ?? { id: row.org_subject_id, name: "Unknown subject", category: null, grade_level: null },
    evidence: row.evidence,
    decision_note: row.decision_note,
    direct_grant: row.direct_grant,
    decided_at: row.decided_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export type { ApprovalWithSubject };
