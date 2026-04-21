import type { SectionDef } from '@/lib/types'

export const SECTIONS: SectionDef[] = [
	{
		key: 'restatement',
		label: 'Problem Restatement',
		description: 'Restate the problem in your own words.',
		placeholder: 'Given... find... return...',
		required_for_gate: true,
		eval_focus: 'restatement',
	},
	{
		key: 'io',
		label: 'Inputs & Outputs',
		description: 'What are the inputs and their types? What does the output look like?',
		placeholder: 'Input: ... Output: ...',
		required_for_gate: true,
		eval_focus: 'io',
	},
	{
		key: 'edge_cases',
		label: 'Edge Cases',
		description: 'What edge cases could trip you up?',
		placeholder: 'Empty array, single element, all same values...',
		required_for_gate: true,
		eval_focus: 'edge_cases',
	},
	{
		key: 'data_structures',
		label: 'Data Structures',
		description: 'Which data structures will you use and why?',
		placeholder: 'I will use a ... because ...',
		required_for_gate: true,
		eval_focus: 'data_structures',
	},
	{
		key: 'variables',
		label: 'Key Variables',
		description: 'What are the main variables and what does each represent?',
		placeholder: 'left = left pointer representing..., right = ...',
		required_for_gate: true,
		eval_focus: 'variables',
	},
	{
		key: 'initialization',
		label: 'Initialization',
		description: 'What initial values do your data structures start with?',
		placeholder: 'Start with... because at the beginning...',
		required_for_gate: true,
		eval_focus: 'initialization',
	},
	{
		key: 'algorithm_steps',
		label: 'Algorithm Steps',
		description: 'High-level steps of your approach. Plain English, no code.',
		placeholder: '1. First... 2. Then... 3. Finally...',
		required_for_gate: true,
		eval_focus: 'algorithm',
	},
	{
		key: 'invariants',
		label: 'Loop / Recursion Invariants',
		description: 'What stays true at every step?',
		placeholder: 'At each step, ... is always true because...',
		required_for_gate: false,
		eval_focus: 'invariants',
	},
	{
		key: 'time_target',
		label: 'Time Complexity Target',
		description: 'What time complexity are you aiming for?',
		placeholder: 'O(...) because ...',
		required_for_gate: true,
		eval_focus: 'complexity',
	},
	{
		key: 'space_target',
		label: 'Space Complexity Target',
		description: 'What additional space does your approach use?',
		placeholder: 'O(...) for ...',
		required_for_gate: true,
		eval_focus: 'complexity',
	},
	{
		key: 'dry_run',
		label: 'Dry Run',
		description: 'Trace through one example by hand.',
		placeholder: 'Example 1: input=[...]\nStep 1: ...\nResult: ...',
		required_for_gate: true,
		eval_focus: 'dry_run',
	},
]

export const SECTION_KEYS = SECTIONS.map((s) => s.key)

export function getSectionDef(key: string): SectionDef | undefined {
	return SECTIONS.find((s) => s.key === key)
}
