import type { ReferenceSolution, Example } from '@/lib/types'
import type { SectionDef } from '@/lib/types'

export function generateSolutionsPrompt(
  title: string,
  statement: string,
  constraints: string,
  examples: Example[]
): string {
  return `You are a senior competitive programmer. Given a DSA problem, generate ONLY the most asymptotically efficient known solution(s).

PROBLEM: ${title}

STATEMENT:
${statement}

CONSTRAINTS:
${constraints}

EXAMPLES:
${examples.map((e, i) => `Example ${i + 1}:\nInput: ${e.input}\nOutput: ${e.output}${e.explanation ? `\nExplanation: ${e.explanation}` : ''}`).join('\n\n')}

SELECTION RULES — follow strictly:
1. Identify the best known asymptotic time complexity for this problem (think carefully — for problems involving "divisible by k", "subarray sum", "prefix sum", "two sum", etc., there is almost always a linear-time hash-map-of-remainders / prefix-sum solution that beats the naive approach).
2. Return ONLY solutions that achieve this best time complexity. Do NOT include brute force, suboptimal, or "for comparison" approaches.
3. If multiple distinct algorithms tie for the best time complexity (e.g., two different O(n) approaches, or an O(n) and an O(n log n) where O(n) is not achievable), include all of them — up to 3.
4. If only one algorithm achieves the best complexity, return exactly one solution. Quality over quantity.
5. Among equally efficient solutions, prefer the one with better space complexity when ordering them first.

For each solution, write a COMPLETE, RUNNABLE Python function that solves the problem.
The function MUST read arguments from stdin as JSON and print the result as JSON to stdout.

Use this exact wrapper pattern:
import json, sys

def solution(<params>):
    # ... implementation ...

if __name__ == "__main__":
    args = json.loads(sys.stdin.read())
    result = solution(*args)
    print(json.dumps(result))

Return a JSON object with key "solutions" containing an array. Each element must have:
- approach_name: string (short name like "Brute Force" or "Two Pointers")
- rationale: string (1-2 sentences on why this approach works)
- code: string (complete runnable Python code with the stdin/stdout wrapper)
- time_cx: string — MUST use plain, coder-friendly Big-O notation. ALLOWED: O(1), O(log n), O(n), O(n log n), O(n sqrt k), O(n + k), O(n * k), O(n^2), O(2^n), O(n!). BANNED: number-theoretic functions like τ(k), d(k), σ(k), φ(n), ω(n), π(n), Ackermann, or any symbol requiring math-degree knowledge. If a tight bound needs those, state the plain upper bound instead (e.g. write "O(n sqrt k)" not "O(n τ(k))", write "O(n log log n)" not "O(n / log n)"). No "≈" or composite approximations — pick ONE clean expression.
- space_cx: string — same rules as time_cx. ALLOWED: O(1), O(log n), O(n), O(k), O(n + k), O(sqrt k). BANNED: same as above.
- key_insights: array of strings (2-4 key insights about the approach, NO solution-revealing algorithm names unless obvious)`
}

export function selectSolutionsPrompt(
  title: string,
  statement: string,
  constraints: string,
  examples: Example[],
  snippets: Array<{ source_url: string; code: string }>
): string {
  const snippetBlock = snippets
    .map((s, i) => `--- CANDIDATE ${i + 1} (from ${s.source_url}) ---\n${s.code}`)
    .join('\n\n')

  return `You are curating reference solutions for a DSA problem. You have been given raw Python code snippets pulled from the web. Your job is to SELECT the best ones, CLEAN them into a runnable form, and ANNOTATE them with complexity — NOT to invent new algorithms.

PROBLEM: ${title}

STATEMENT:
${statement}

CONSTRAINTS:
${constraints}

EXAMPLES:
${examples.map((e, i) => `Example ${i + 1}:\nInput: ${e.input}\nOutput: ${e.output}${e.explanation ? `\nExplanation: ${e.explanation}` : ''}`).join('\n\n')}

RAW SNIPPETS FROM WEB SEARCH:
${snippetBlock}

TASK:
1. Read every snippet. Discard ones that are unrelated, incomplete, syntactically broken, or clearly do not solve this problem.
2. Among the remaining, identify the BEST asymptotic time complexity present. Keep only snippets that achieve this best complexity. If two distinct algorithms tie, keep both (up to 3 total).
3. For each kept snippet, rewrite it as a clean, self-contained Python program using the exact wrapper below. Preserve the algorithm; fix imports and I/O only.
4. Annotate plain Big-O time and space. ALLOWED: O(1), O(log n), O(n), O(n log n), O(n sqrt k), O(n + k), O(n * k), O(n^2), O(2^n), O(n!). BANNED: τ(k), d(k), σ(k), φ(n), Ackermann, ≈, or any math-degree notation.
5. If no snippet is usable, return an empty solutions array.

WRAPPER — every solution MUST use this exact pattern:
import json, sys

def solution(<params>):
    # ... implementation ...

if __name__ == "__main__":
    args = json.loads(sys.stdin.read())
    result = solution(*args)
    print(json.dumps(result))

Return a JSON object with key "solutions" containing an array. Each element must have:
- approach_name: short name (e.g. "Hash Map Remainders", "Two Pointers")
- rationale: 1-2 sentences on why this approach works
- code: the cleaned, runnable Python with the wrapper above
- time_cx: plain Big-O (per the rules above)
- space_cx: plain Big-O (per the rules above)
- key_insights: 2-4 short insights about the approach
- source_url: the URL of the snippet this came from`
}

export function criticPrompt(
  title: string,
  statement: string,
  constraints: string,
  candidate: { approach_name: string; code: string; time_cx: string; space_cx: string }
): string {
  return `You are a rigorous algorithm correctness reviewer.

PROBLEM: ${title}
STATEMENT: ${statement}
CONSTRAINTS: ${constraints}

CANDIDATE SOLUTION (approach: ${candidate.approach_name}):
${candidate.code}

Claimed time complexity: ${candidate.time_cx}
Claimed space complexity: ${candidate.space_cx}

Review this solution critically. Return a JSON object with:
- looks_correct: boolean (true if the logic appears correct for all cases)
- issues: array of strings (describe each logical flaw, edge case miss, or bug; empty array if none)
- complexity_claims_match: boolean (true if claimed complexities are accurate)`
}

export function generateTestCasesPrompt(
  title: string,
  statement: string,
  constraints: string,
  examples: Example[],
  referenceCode: string
): string {
  const exampleBlock = examples
    .map((e, i) => `Example ${i + 1}:\nInput: ${e.input}\nOutput: ${e.output}`)
    .join('\n\n')

  return `You are generating ADDITIONAL hidden test inputs for a DSA problem. The reference solution is provided so you can match its function signature exactly.

PROBLEM: ${title}

STATEMENT:
${statement}

CONSTRAINTS:
${constraints}

VISIBLE EXAMPLES (already used as visible tests — do NOT duplicate):
${exampleBlock}

REFERENCE SOLUTION (for signature matching only — do NOT execute or replicate logic):
${referenceCode}

TASK:
Generate 6 to 10 ADDITIONAL test inputs that exercise edge cases and varied sizes. These will be run through the reference solution to obtain canonical expected outputs — so the inputs MUST be valid per the constraints and MUST match the reference function signature.

Each test input must be a JSON array. The elements of that array correspond, in order, to the parameters of the reference solution's \`solution(...)\` function. Match types exactly (a list parameter is a JSON array, a string parameter is a JSON string, etc.).

Cover a mix:
- Smallest valid input (e.g. single element, empty if allowed)
- Boundary values at constraint extremes
- All-same / all-distinct
- Already-sorted / reverse-sorted (if order is meaningful)
- Negative / zero / very large numbers (if allowed)
- One medium-size random case

Return a JSON object exactly in this shape:
{
  "tests": [
    [<arg1>, <arg2>, ...],
    [<arg1>, <arg2>, ...]
  ]
}

Do NOT include expected outputs. Do NOT include explanations. Output JSON only.`
}

export function generateCppTemplatePrompt(
  title: string,
  statement: string,
  constraints: string,
  examples: Example[],
  referenceCode: string
): string {
  const exampleBlock = examples
    .map((e, i) => `Example ${i + 1}:\nInput: ${e.input}\nOutput: ${e.output}`)
    .join('\n\n')

  return `You are generating a LeetCode-style C++ scaffold for a DSA problem. The user will write ONLY the body of \`class Solution\`. You must produce two pieces:

1. \`starter\` — what the user starts with: a \`class Solution { public: <signature> { ... } };\` skeleton with a TODO body.
2. \`harness\` — a hidden \`int main()\` that reads a JSON array from stdin, unpacks it into the typed parameters, instantiates \`Solution\`, calls the method, and prints the JSON-encoded return value to stdout.

PROBLEM: ${title}

STATEMENT:
${statement}

CONSTRAINTS:
${constraints}

EXAMPLES:
${exampleBlock}

PYTHON REFERENCE (for inferring signature & types — do NOT translate logic):
${referenceCode}

A C++ prelude is automatically prepended to the compilation unit. You MAY assume these symbols already exist — do NOT redeclare or re-include them:
- \`#include <bits/stdc++.h>\`, \`using namespace std;\`
- \`#include "json.hpp"\`, \`using json = nlohmann::json;\`
- \`struct TreeNode { int val; TreeNode *left, *right; ... };\` with all standard constructors
- \`struct ListNode { int val; ListNode *next; ... };\` with all standard constructors
- \`TreeNode* treeFromJson(const json&)\` — build tree from LeetCode level-order array (nulls allowed)
- \`json treeToJson(TreeNode*)\` — serialize tree back to level-order JSON, trailing nulls stripped
- \`ListNode* listFromJson(const json&)\` — build list from JSON array
- \`json listToJson(ListNode*)\` — serialize list to JSON array

TYPE MAPPING — map the Python signature to C++ idiomatically:
- Python list of ints  → \`vector<int>\`
- Python list of list of ints → \`vector<vector<int>>\`
- Python list of strings → \`vector<string>\`
- Python str → \`string\`
- Python int → \`int\` (use \`long long\` if constraints exceed 2^31)
- Python bool → \`bool\`
- Python TreeNode (root) → \`TreeNode*\`
- Python ListNode (head) → \`ListNode*\`
- Tuple/list return → \`vector<...>\` or \`pair<...>\`

STARTER REQUIREMENTS:
- Exactly one \`class Solution { public: ... };\` with one public method.
- Method signature must match the inferred types.
- Body: a single \`// TODO: write your solution\` comment plus a sensible default \`return ...;\` so it compiles. The default return must be valid for the type (e.g. \`return {};\` for vectors, \`return 0;\` for int, \`return nullptr;\` for pointers, \`return "";\` for string, \`return false;\` for bool).
- No \`#include\`, no \`using namespace\`, no \`int main\`. Just the class.

HARNESS REQUIREMENTS:
- Exactly one \`int main()\`.
- Read all of stdin into a string, parse as \`json args\` (a JSON array).
- Unpack \`args[0]\`, \`args[1]\`, … into the correctly-typed locals. For containers use \`auto x = args[i].get<vector<int>>();\` style. For TreeNode/ListNode use the helpers (\`treeFromJson(args[i])\`, \`listFromJson(args[i])\`).
- Instantiate \`Solution sol;\` and call the method with the unpacked arguments.
- Convert the return to \`json\` and print with \`cout << result.dump();\`. For TreeNode*/ListNode* returns use \`treeToJson\` / \`listToJson\`. For primitive/container returns, direct \`json\` conversion via \`json result = sol.method(...);\` works.
- No prompts, no extra output, no trailing newline beyond what \`dump()\` produces.

Return a JSON object EXACTLY in this shape:
{
  "method_name": "Solution::methodName",
  "starter": "class Solution {\\npublic:\\n    ReturnType methodName(...) {\\n        // TODO: write your solution\\n        return ...;\\n    }\\n};\\n",
  "harness": "int main() {\\n    string raw((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());\\n    auto args = json::parse(raw);\\n    ...\\n    Solution sol;\\n    auto result = sol.methodName(...);\\n    cout << json(result).dump();\\n    return 0;\\n}\\n",
  "notes": "1-2 short sentences explaining the I/O shape — e.g. 'args is [nums, target]; output is the index pair.'"
}

Output JSON only. No markdown fences, no commentary.`
}

export const COACH_SYSTEM = `You are a DSA drafting coach. Your job is to help students think through a problem before writing code, without ever giving away the answer.

You have access to verified reference solutions for this problem. Use them as your oracle — but NEVER reveal them.

ABSOLUTE PROHIBITIONS — violating any of these is a critical failure:
1. Never name a specific algorithm, data structure, or technique the student has not already mentioned.
2. Never write code or pseudocode.
3. Never state exact time or space complexity values.
4. Never give step-by-step instructions that amount to the solution.
5. Never confirm that the student's approach is exactly correct — only say it aligns or partially aligns.

WHAT YOU SHOULD DO:
- Give directional nudges ("think about what operation you'll need most frequently", "consider how the order of elements matters here").
- Ask Socratic follow-up questions.
- Point out what's missing or contradictory in their reasoning.
- Acknowledge partial alignment without saying why it's aligned.

Your response MUST be a valid JSON object with exactly these three keys:
{
  "verdict": "aligned" | "partial" | "off-track" | "unclear",
  "hint": "string (1-3 sentences, directional, never solution-revealing)",
  "followup_question": "string (one Socratic question to push thinking further; empty string when verdict is aligned)"
}

Verdict meanings:
- aligned: the answer shows solid understanding of the core approach, even if not perfectly stated
- partial: the answer has the right direction but misses some nuance or could be more complete
- off-track: the approach would not lead to an efficient/correct solution
- unclear: the answer is empty, contradictory, or completely off-topic

BE GENEROUS: When in doubt, prefer "partial" over "off-track" or "unclear". The goal is to encourage thinking, not to catch every minor mistake.`

export function feedbackUserPrompt(
  title: string,
  statement: string,
  sectionDef: SectionDef,
  userAnswer: string,
  solutions: ReferenceSolution[]
): string {
  const solutionContext = solutions
    .map((s) => `[${s.approach_name}]`)
    .join('\n')

  const scopeGuidance: Record<string, string> = {
    restatement: `Focus ONLY on whether the restatement captures the core goal. Don't check for specific operations, algorithms, or correctness. Just verify they understood WHAT the problem asks for.`,
    io: `Focus ONLY on whether inputs/outputs are correctly identified. Don't check the solution approach.`,
    edge_cases: `Focus ONLY on whether sensible edge cases are mentioned. Minor omissions are fine.`,
    data_structures: `Focus ONLY on whether reasonable data structures are mentioned. The exact choice matters less than having a logical reason.`,
    variables: `Focus ONLY on whether key variables are identified. Names and purposes matter.`,
    initialization: `Focus ONLY on whether initial values make sense. Don't evaluate the full algorithm.`,
    algorithm: `Focus ONLY on whether the high-level steps are reasonable. Minor ordering issues are fine.`,
    invariants: `Focus ONLY on whether the invariant makes sense.`,
    complexity: `Two things must be present to mark "aligned": (1) the stated Big-O matches what an efficient approach would achieve, AND (2) the student gives a brief but valid explanation for WHY — tying the complexity to the work their approach does (e.g. "O(N log K) because we scan N nodes and each heap op is log K"). A bare "O(n)" or "O(n log n)" with no reasoning is NOT aligned — mark it "partial" and in followup_question ask them to justify the complexity by describing what drives each factor. Wrong Big-O → "off-track".`,
    dry_run: `Focus ONLY on whether the trace shows reasonable logic. Small arithmetic errors are fine.`,
  }

  const guidance = scopeGuidance[sectionDef.eval_focus ?? ''] ?? `Evaluate whether the answer shows reasonable understanding.`

  return `PROBLEM: ${title}
STATEMENT: ${statement.slice(0, 400)}

REFERENCE SOLUTIONS (for context only):
${solutionContext}

SECTION: ${sectionDef.label}
GOAL: ${sectionDef.description}

${guidance}

STUDENT'S ANSWER:
${userAnswer}

Respond with JSON:
{
  "verdict": "aligned" | "partial" | "off-track" | "unclear",
  "hint": "1-2 sentence directional hint if needed",
  "followup_question": "one question to push thinking further if needed; leave empty when verdict is aligned"
}

Be GENEROUS — short, well-formatted answers that show understanding should get "aligned" or "partial".`
}
