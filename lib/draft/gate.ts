import { getSections, setGatePassed, getOrCreateDraft } from '@/lib/db/schema'
import { SECTIONS } from './sections'
import type { Verdict } from '@/lib/types'

const PASSING: Verdict[] = ['aligned', 'partial']

export async function evaluateAndUpdateGate(problemId: number): Promise<boolean> {
  const draft = await getOrCreateDraft(problemId)
  const sections = await getSections(draft.id)
  const sectionMap = new Map(sections.map((s) => [s.section_key, s]))

  const required = SECTIONS.filter((s) => s.required_for_gate)
  const allPassed = required.every((def) => {
    const section = sectionMap.get(def.key)
    return section?.latest_verdict != null && PASSING.includes(section.latest_verdict as Verdict)
  })

  await setGatePassed(draft.id, allPassed)
  return allPassed
}