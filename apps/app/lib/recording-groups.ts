import "server-only";

import { randomUUID } from "node:crypto";
import {
  database,
  ImportedRecordingGroupAssignmentAction,
} from "@repo/database";

export interface RecordingGroupAssignmentInput {
  readonly changedByMemberId: string;
  readonly confirmReassignment?: boolean;
  readonly groupId: string;
  readonly memberId: string;
}

export interface RecordingGroupRevokeInput {
  readonly changedByMemberId: string;
  readonly groupId: string;
}

export interface RecordingGroupMutationResult {
  readonly changed: boolean;
  readonly groupId: string;
  readonly memberId: string | null;
  readonly previousMemberId: string | null;
}

/**
 * The current member on ImportedRecordingGroup is the canonical authorization
 * pointer. The assignment table is an append-only audit trail. Updating the
 * group and writing that trail happen in one transaction, and the conditional
 * update prevents two administrators from silently overwriting each other.
 */
export const assignRecordingGroup = async ({
  changedByMemberId,
  confirmReassignment,
  groupId,
  memberId,
}: RecordingGroupAssignmentInput): Promise<RecordingGroupMutationResult> =>
  database.$transaction(async (transaction) => {
    const [group, member] = await Promise.all([
      transaction.importedRecordingGroup.findUnique({
        where: { id: groupId },
        select: { id: true, memberId: true },
      }),
      transaction.member.findUnique({
        where: { id: memberId },
        select: { id: true },
      }),
    ]);

    if (!(group && member)) {
      throw new Error("recording_group_or_member_not_found");
    }
    if (group.memberId === memberId) {
      return {
        changed: false,
        groupId: group.id,
        previousMemberId: group.memberId,
        memberId: group.memberId,
      };
    }

    if (group.memberId && !confirmReassignment) {
      throw new Error("recording_group_reassignment_requires_confirmation");
    }

    const action = group.memberId
      ? ImportedRecordingGroupAssignmentAction.REASSIGNED
      : ImportedRecordingGroupAssignmentAction.ASSIGNED;
    const assignedAt = new Date();
    const updated = await transaction.importedRecordingGroup.updateMany({
      where: { id: group.id, memberId: group.memberId },
      data: {
        memberId,
        assignedAt,
        assignedByMemberId: changedByMemberId,
      },
    });

    if (updated.count !== 1) {
      throw new Error("recording_group_changed_concurrently");
    }

    await transaction.importedRecordingGroupAssignment.create({
      data: {
        id: randomUUID(),
        groupId: group.id,
        previousMemberId: group.memberId,
        memberId,
        changedByMemberId,
        action,
      },
    });

    return {
      changed: true,
      groupId: group.id,
      previousMemberId: group.memberId,
      memberId,
    };
  });

export const revokeRecordingGroup = async ({
  changedByMemberId,
  groupId,
}: RecordingGroupRevokeInput): Promise<RecordingGroupMutationResult> =>
  database.$transaction(async (transaction) => {
    const group = await transaction.importedRecordingGroup.findUnique({
      where: { id: groupId },
      select: { id: true, memberId: true },
    });

    if (!group) {
      throw new Error("recording_group_not_found");
    }
    if (!group.memberId) {
      return {
        changed: false,
        groupId: group.id,
        previousMemberId: null,
        memberId: null,
      };
    }

    const updated = await transaction.importedRecordingGroup.updateMany({
      where: { id: group.id, memberId: group.memberId },
      data: {
        memberId: null,
        assignedAt: null,
        // Keep the last operator for audit context. The assignment history
        // still records the exact revocation event and previous member.
        assignedByMemberId: changedByMemberId,
      },
    });

    if (updated.count !== 1) {
      throw new Error("recording_group_changed_concurrently");
    }

    await transaction.importedRecordingGroupAssignment.create({
      data: {
        id: randomUUID(),
        groupId: group.id,
        previousMemberId: group.memberId,
        memberId: null,
        changedByMemberId,
        action: ImportedRecordingGroupAssignmentAction.REVOKED,
      },
    });

    return {
      changed: true,
      groupId: group.id,
      previousMemberId: group.memberId,
      memberId: null,
    };
  });
