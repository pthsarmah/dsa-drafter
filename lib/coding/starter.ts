// Fallback starter shown only when the per-problem LLM-generated template is missing.
// The real starter (with the correct method signature) lives in problem_cpp_templates.
export const STARTER_CPP = `class Solution {
public:
    // TODO: write your solution.
    // The harness will instantiate Solution and call your method.
    // Re-ingest the problem to generate the correct method signature.
};
`

export function starterCpp(): string {
  return STARTER_CPP
}
