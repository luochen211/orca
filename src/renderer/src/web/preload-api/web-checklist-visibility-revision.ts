import { createBrowserUuid } from '@/lib/browser-uuid'
import { readJson, writeJson } from './web-storage'

const CHECKLIST_VISIBILITY_REVISION_KEY = 'orca.web.checklistVisibilityRevision.v1'

type ChecklistVisibilityRevision = {
  observation: string
  issuedWrite: number
  appliedWrite: number
}

type ChecklistVisibilityWrite = { observation: string; write: number }

function freshRevision(): ChecklistVisibilityRevision {
  return { observation: createBrowserUuid(), issuedWrite: 0, appliedWrite: 0 }
}

function readRevision(): ChecklistVisibilityRevision {
  const revision = readJson(CHECKLIST_VISIBILITY_REVISION_KEY, freshRevision())
  if (
    typeof revision.observation !== 'string' ||
    revision.observation.length === 0 ||
    !Number.isSafeInteger(revision.issuedWrite) ||
    !Number.isSafeInteger(revision.appliedWrite) ||
    revision.appliedWrite < 0 ||
    revision.issuedWrite < revision.appliedWrite ||
    revision.issuedWrite >= Number.MAX_SAFE_INTEGER
  ) {
    return freshRevision()
  }
  return revision
}

/** A host observation supersedes pending writes even when its checklist value is unchanged. */
export function advanceChecklistVisibilityRevision(value: boolean | undefined): void {
  if (typeof value === 'boolean') {
    writeJson(CHECKLIST_VISIBILITY_REVISION_KEY, freshRevision())
  }
}

/** Orders write attempts without letting a failed attempt suppress another successful save. */
export function beginChecklistVisibilityWrite(
  value: boolean | undefined
): ChecklistVisibilityWrite | null {
  if (typeof value !== 'boolean') {
    return null
  }
  const revision = readRevision()
  const write = revision.issuedWrite + 1
  writeJson(CHECKLIST_VISIBILITY_REVISION_KEY, { ...revision, issuedWrite: write })
  return { observation: revision.observation, write }
}

/** Allows only writes newer than the last applied save and not superseded by a host observation. */
export function acceptChecklistVisibilityWrite(attempt: ChecklistVisibilityWrite | null): boolean {
  if (!attempt) {
    return false
  }
  const revision = readRevision()
  if (attempt.observation !== revision.observation || attempt.write <= revision.appliedWrite) {
    return false
  }
  writeJson(CHECKLIST_VISIBILITY_REVISION_KEY, { ...revision, appliedWrite: attempt.write })
  return true
}
