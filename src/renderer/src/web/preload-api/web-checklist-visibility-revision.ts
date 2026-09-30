import { createBrowserUuid } from '@/lib/browser-uuid'

const CHECKLIST_VISIBILITY_REVISION_KEY = 'orca.web.checklistVisibilityRevision.v1'

/** Distinguishes checklist writes and observations, including same-value refreshes across API instances. */
export function advanceChecklistVisibilityRevision(value: boolean | undefined): string | null {
  if (typeof value !== 'boolean') {
    return null
  }
  const revision = createBrowserUuid()
  window.localStorage.setItem(CHECKLIST_VISIBILITY_REVISION_KEY, revision)
  return revision
}

/** Allows an acknowledgement to update the cache only while its checklist intent remains current. */
export function isCurrentChecklistVisibilityRevision(revision: string | null): boolean {
  return (
    revision !== null && window.localStorage.getItem(CHECKLIST_VISIBILITY_REVISION_KEY) === revision
  )
}
