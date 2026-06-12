export const STAGES = ['triage', 'backlog', 'planned', 'in_dev', 'in_qa', 'ready_to_merge', 'merged', 'staged']
export const NEXT = {
  backlog: 'planned',
  planned: 'in_dev',
  in_dev: 'in_qa',
  in_qa: 'ready_to_merge',
  ready_to_merge: 'merged',
  merged: 'staged',
}
