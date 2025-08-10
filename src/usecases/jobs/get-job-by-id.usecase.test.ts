import { describe, expect, it } from '@effect/vitest'
import { Effect as E, Exit } from 'effect'
import { MockConfigLayer } from '../../config'
import { JobsStore } from '../../stores/jobs/jobs.store'
import { getExitError } from '../../utils/test-utils'
import { getJobByIdUsecase } from './get-job-by-id.usecase'

describe('getJobByIdUsecase', () => {
  it.effect('should return job when found', () =>
    E.gen(function* () {
      const result = yield* getJobByIdUsecase('1')

      expect(result.id).toBe('1')
      expect(result.name).toBe('Job 1')
      expect(result.status).toBe('in-progress')
    }).pipe(E.provide(JobsStore.Default), E.provide(MockConfigLayer)),
  )

  it.effect('should handle not found error', () =>
    E.gen(function* () {
      const result = yield* getJobByIdUsecase('999').pipe(E.exit)

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = getExitError(result)
        expect(error?._tag).toBe('JobNotFoundError')
      }
    }).pipe(E.provide(JobsStore.Default), E.provide(MockConfigLayer)),
  )

  it.effect('should work with test service', () =>
    E.gen(function* () {
      const result = yield* getJobByIdUsecase('42')

      expect(result.id).toBe('42')
      expect(result.name).toBe('Custom Test Job')
      expect(result.status).toBe('completed')
    }).pipe(
      E.provide(
        JobsStore.makeTestService({
          getJobById: (id) =>
            E.succeed({
              id,
              name: 'Custom Test Job',
              status: 'completed',
            }),
        }),
      ),
      E.provide(MockConfigLayer),
    ),
  )
})
