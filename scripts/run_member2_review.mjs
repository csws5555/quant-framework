/**
 * Part D opt-in integration runner. Uses Member 1's frozen fixture and real Host.
 * No market data, no publication, and no external model calls in scripted mode.
 * Usage: node scripts/run_member2_review.mjs --fixture build/member2-clean/fixture.json --python .venv/Scripts/python.exe
 */
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCollaborationHost } from '../integrations/conexus/collaboration/host.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] }
const fixturePath = resolve(option('--fixture', 'build/member2-clean/fixture.json'))
const pythonExecutable = resolve(option('--python', process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python'))
if (args.includes('--live')) throw new Error('Live review requires a separate model-driven researcher and review contract adapter; this runner is scripted only.')
const live = false
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
if (!['clean', 'seeded-formula', 'seeded-pit', 'seeded-report', 'seeded-claim', 'missing-evidence'].includes(fixture.scenario)) {
  throw new Error('This Part D runner supports single-candidate review scenarios only.')
}
const v = fixture.versions[0]
const taskId = fixture.task_id
const manifestId = v.manifest.manifest_id
const seen = { researcher: 0, reviewer: 0 }
const reads = []
const makeCall = (name, payload) => ({
  id: `call-${name}-${Math.random().toString(36).slice(2)}`,
  type: 'function', function: { name, arguments: JSON.stringify(payload) },
})
const response = (call) => ({
  finish_reason: 'tool_calls', content: null, tool_calls: [call],
})
const done = (status, summary) =>
  response(makeCall('complete', {
    status,
    summary,
    ...(status === 'blocked'
      ? {
          blocker:
            'The reviewer identified unresolved findings. ' +
            'The researcher must address these findings and ' +
            'submit a revised candidate for re-review.'
        }
      : {})
  }))
const scripted = async ({ identity }) => {
  const role = identity.role
  const step = seen[role]++
  if (role === 'researcher') {
    if (step === 0) return response(makeCall('use', { node_id: 'review-control', capability: 'tool.invoke',
      input: { operation: 'start', delegation: v.delegation } }))
    if (step === 1) return response(makeCall('use', { node_id: 'review-control', capability: 'tool.invoke',
      input: { operation: 'wait', child_task_id: v.delegation.child_task_id } }))
    return done(v.review.status === 'pass' ? 'done' : 'blocked',
      v.review.status === 'pass' ? 'Review completed; final publication not performed.' : 'Review findings require correction.')
  }
  if (step === 0) return response(makeCall('use', { node_id: 'review-evidence', capability: 'tool.invoke',
    input: { operation: 'manifest', manifest_id: manifestId } }))
  if (step <= v.evidence_ids.length) {
    const artifact_id = v.evidence_ids[step - 1]
    reads.push(artifact_id)
    return response(makeCall('use', { node_id: 'review-evidence', capability: 'tool.invoke',
      input: { operation: 'read', manifest_id: manifestId, artifact_id } }))
  }
  if (step === v.evidence_ids.length + 1) return response(makeCall('use', { node_id: 'review-submit',
    capability: 'tool.invoke', input: { review: v.review } }))
  return done('done', 'Scripted review submitted.')
}
const scriptedModel = async request => ({ response: await scripted(request),
  usage: { input_tokens: 20, output_tokens: 20, total_tokens: 40 } })
const host = await createCollaborationHost({
  pythonExecutable, storeRoot: resolve(dirname(fixturePath), 'control'),
  evidenceRoot: resolve(dirname(fixturePath), 'evidence'), taskId, candidate: v.candidate,
  scopes: ['model.invoke', 'evidence.read', 'review.submit', 'review.delegate'],
  operations: [],
  callModel: scriptedModel,
  budget: { version: 1, max_model_calls: 48, max_tool_calls: 160, wall_time_ms: 120000,
    max_output_tokens: 4096, max_total_tokens: null, max_cost_micros: null, currency: null },
})
const result = await host.run()
const snapshot = await host.snapshot()
const accounting = await host.accounting()
const child = snapshot.children.at(-1)
const report = {
  scenario: fixture.scenario, mode: live ? 'live' : 'scripted',
  root_status: result.status, task_state: snapshot.status,
  child_status: child?.status ?? null, review_status: child?.review?.status ?? null,
  review_accepted: Boolean(child?.review), evidence_reads_requested: live ? null : reads,
  findings: child?.review?.findings?.length ?? 0, accounting,
  publication_performed: false,
}
console.log(JSON.stringify(report, null, 2))
if (!child?.review || (live ? false : child.review.status !== v.review.status)) process.exitCode = 1
