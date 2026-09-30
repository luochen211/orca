// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { getDefaultUIState } from '../../../../shared/constants'
import { readLocalWebUIState } from './web-preferences-store'
import { createWebUiApi } from './web-ui-api'

const runtime = vi.hoisted(() => ({ call: vi.fn(), id: 'checklist-host' }))
vi.mock('./web-runtime-calls', () => ({ callRuntimeResult: runtime.call }))
vi.mock('./web-runtime-session', () => ({
  webRuntimeState: { activeEnvironment: null },
  requireActiveEnvironmentOrNull: () => ({ id: runtime.id })
}))

beforeEach(() => {
  localStorage.clear()
  runtime.call.mockReset().mockRejectedValue(new Error('Offline'))
  runtime.id = 'checklist-host'
})

it.each([false, true])(
  'keeps the acknowledged checklist choice after failure and offline remount (dismissed: %j)',
  async (dismissed) => {
    runtime.call.mockResolvedValueOnce({
      ui: { ...getDefaultUIState(), setupGuideSettingsDismissed: dismissed }
    })
    const ui = createWebUiApi()
    await ui.get()
    const updates = { setupGuideSettingsDismissed: !dismissed }

    await expect(ui.setWithAck!(updates)).rejects.toThrow('Offline')

    expect(runtime.call).toHaveBeenLastCalledWith('ui.set', updates, 15_000)
    expect(readLocalWebUIState().setupGuideSettingsDismissed).toBe(dismissed)
    const reopened = createWebUiApi()
    expect((await reopened.get()).setupGuideSettingsDismissed).toBe(dismissed)

    runtime.call.mockResolvedValueOnce({})
    await reopened.setWithAck!(updates)

    expect(runtime.call).toHaveBeenLastCalledWith('ui.set', updates, 15_000)
    expect(readLocalWebUIState().setupGuideSettingsDismissed).toBe(!dismissed)
    expect((await createWebUiApi().get()).setupGuideSettingsDismissed).toBe(!dismissed)
  }
)

it('does not overwrite the new host checklist preference when a previous host acknowledges', async () => {
  runtime.call.mockResolvedValueOnce({
    ui: { ...getDefaultUIState(), setupGuideSettingsDismissed: false }
  })
  const previousHost = createWebUiApi()
  await previousHost.get()
  let acknowledge!: () => void
  runtime.call.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      acknowledge = resolve
    })
  )
  const saving = previousHost.setWithAck!({ setupGuideSettingsDismissed: true })

  runtime.id = 'another-host'
  runtime.call.mockResolvedValueOnce({
    ui: { ...getDefaultUIState(), setupGuideSettingsDismissed: false, sidebarWidth: 420 }
  })
  const currentHost = createWebUiApi()
  await currentHost.get()

  acknowledge()
  await saving

  expect(readLocalWebUIState()).toMatchObject({
    setupGuideSettingsDismissed: false,
    sidebarWidth: 420
  })
  expect(await createWebUiApi().get()).toMatchObject({
    setupGuideSettingsDismissed: false,
    sidebarWidth: 420
  })
})

it.each([false, true])(
  'publishes the checklist choice only after acknowledgement without losing concurrent preferences (dismissed: %j)',
  async (dismissed) => {
    runtime.call.mockResolvedValueOnce({
      ui: {
        ...getDefaultUIState(),
        setupGuideSettingsDismissed: dismissed,
        sidebarWidth: 280
      }
    })
    const ui = createWebUiApi()
    await ui.get()
    let acknowledge!: () => void
    runtime.call.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        acknowledge = resolve
      })
    )

    const saving = ui.setWithAck!({ setupGuideSettingsDismissed: !dismissed })

    expect(readLocalWebUIState().setupGuideSettingsDismissed).toBe(dismissed)
    expect((await createWebUiApi().get()).setupGuideSettingsDismissed).toBe(dismissed)
    await ui.set({ sidebarWidth: 360 })
    expect(readLocalWebUIState()).toMatchObject({
      setupGuideSettingsDismissed: dismissed,
      sidebarWidth: 360
    })

    acknowledge()
    await saving

    expect(readLocalWebUIState()).toMatchObject({
      setupGuideSettingsDismissed: !dismissed,
      sidebarWidth: 360
    })
    expect(await createWebUiApi().get()).toMatchObject({
      setupGuideSettingsDismissed: !dismissed,
      sidebarWidth: 360
    })
  }
)
