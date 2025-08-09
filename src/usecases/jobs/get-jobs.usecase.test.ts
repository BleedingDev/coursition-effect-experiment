import { describe, expect, it } from '@effect/vitest'
import { Effect as E } from 'effect'
import { MockConfigLayer } from '../../config'
import { JobsStore } from '../../stores/jobs/jobs.store'
import { getJobsUsecase } from './get-jobs.usecase'

describe('getJobsUsecase', () => {
  it.effect('should return jobs list', () =>
    E.gen(function* () {
      const result = yield* getJobsUsecase()

      expect(result.jobs).toHaveLength(3)
      expect(result.jobs[0]?.name).toBe('Parse Video 1')
      expect(result.jobs[1]?.name).toBe('Parse Audio 2')
      expect(result.jobs[2]?.name).toBe('Parse Document 3')
    }).pipe(E.provide(JobsStore.Default), E.provide(MockConfigLayer)),
  )

  it.effect('should work with test service', () =>
    E.gen(function* () {
      const result = yield* getJobsUsecase()

      expect(result.jobs).toHaveLength(2)
      expect(result.jobs[0]?.name).toBe('Test Job 1')
      expect(result.jobs[1]?.status).toBe('completed')
    }).pipe(
      E.provide(
        JobsStore.makeTestService({
          getAllJobs: () =>
            E.succeed({
              jobs: [
                { id: '1', name: 'Test Job 1', status: 'in-progress' },
                { id: '2', name: 'Test Job 2', status: 'completed' },
              ],
            }),
        }),
      ),
      E.provide(MockConfigLayer),
    ),
  )
})
