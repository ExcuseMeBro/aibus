// Deterministic fake CI: fails only when the MR title contains [ci-fail],
// so tests and demos can exercise both the pass and fail gate paths.
export class FakeCI {
  runPipeline(mr) {
    const fail = /\[ci-fail\]/i.test(mr.title || '')
    return fail
      ? { status: 'fail', report: 'fake CI: 1 test failed' }
      : { status: 'pass', report: 'fake CI: all green' }
  }
}
