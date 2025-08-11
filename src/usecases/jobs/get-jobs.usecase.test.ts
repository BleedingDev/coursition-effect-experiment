import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { MockConfigLayer } from '../../config'
import { JobsStore } from '../../stores/jobs/jobs.store'
import { getJobsUsecase } from './get-jobs.usecase'

describe('getJobsUsecase', () => {
  it.effect('should return jobs list', () =>
    Effect.gen(function* () {
      const result = yield* getJobsUsecase()

      expect(result.jobs).toHaveLength(3)
      expect(result.jobs[0]?.name).toBe('Parse Video 1')
      expect(result.jobs[1]?.name).toBe('Parse Audio 2')
      expect(result.jobs[2]?.name).toBe('Parse Document 3')
    }).pipe(Effect.provide(JobsStore.Default), Effect.provide(MockConfigLayer)),
  )

  it.effect('should work with test service', () =>
    Effect.gen(function* () {
      const result = yield* getJobsUsecase()

      expect(result.jobs).toHaveLength(2)
      expect(result.jobs[0]?.name).toBe('Test Job 1')
      expect(result.jobs[1]?.status).toBe('completed')
    }).pipe(
      Effect.provide(
        JobsStore.makeTestService({
          getAllJobs: () =>
            Effect.succeed({
              jobs: [
                {
                  id: 'e2fd39c8-0324-4c91-bd01-d94509aad7c1',
                  name: 'Test Job 1',
                  status: 'running',
                },
                {
                  id: 'acc2e3d9-09c0-4cd4-b80f-020a39b6424a',
                  name: 'Test Job 2',
                  status: 'completed',
                },
              ],
            }),
        }),
      ),
      Effect.provide(MockConfigLayer),
    ),
  )
})
