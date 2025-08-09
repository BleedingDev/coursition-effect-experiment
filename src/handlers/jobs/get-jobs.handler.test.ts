import { describe, expect, it } from '@effect/vitest'
import { Effect as E } from 'effect'
import { MockConfigLayer } from '../../config'
import { JobsStore } from '../../stores/jobs/jobs.store'
import { getJobsHandler } from './get-jobs.handler'

describe('getJobsHandler', () => {
  it.effect('should return jobs response', () =>
    E.gen(function* () {
      const result = yield* getJobsHandler()

      expect(result.jobs).toHaveLength(3)
      expect(result.jobs[0]?.name).toBe('Parse Video 1')
      expect(result.jobs[0]?.status).toBe('completed')
      expect(result.jobs[1]?.name).toBe('Parse Audio 2')
      expect(result.jobs[2]?.name).toBe('Parse Document 3')
    }).pipe(E.provide(JobsStore.Default), E.provide(MockConfigLayer)),
  )

  it.effect('should work with test service', () =>
    E.gen(function* () {
      const result = yield* getJobsHandler()

      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0]?.name).toBe('Handler Test Job')
    }).pipe(
      E.provide(
        JobsStore.makeTestService({
          getAllJobs: () =>
            E.succeed({
              jobs: [{ id: '99', name: 'Handler Test Job', status: 'pending' }],
            }),
        }),
      ),
      E.provide(MockConfigLayer),
    ),
  )
})
