import { describe, expect, it } from '@effect/vitest'
import { Effect as E, Exit } from 'effect'
import { MockConfigLayer } from '../../config'
import { JobsStore } from '../../stores/jobs/jobs.store'
import { getExitError } from '../../utils/test-utils'
import { getJobByIdUsecase } from './get-job-by-id.usecase'

describe('getJobByIdUsecase', () => {
  it.effect('should return job when found', () =>
    E.gen(function* () {
      const result = yield* getJobByIdUsecase(
        '13c7cc78-1637-45a8-af8a-55af568683e2',
      )

      expect(result.id).toBe('13c7cc78-1637-45a8-af8a-55af568683e2')
      expect(result.name).toBe('Job 13c7cc78-1637-45a8-af8a-55af568683e2')
      expect(result.status).toBe('running')
    }).pipe(E.provide(JobsStore.Default), E.provide(MockConfigLayer)),
  )

  it.effect('should handle not found error', () =>
    E.gen(function* () {
      const result = yield* getJobByIdUsecase(
        '0bb4870a-09a9-4adc-8e86-0a024075756d',
      ).pipe(E.exit)

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = getExitError(result)
        expect(error?._tag).toBe('JobNotFoundError')
      }
    }).pipe(E.provide(JobsStore.Default), E.provide(MockConfigLayer)),
  )

  it.effect('should work with test service', () =>
    E.gen(function* () {
      const result = yield* getJobByIdUsecase(
        'd129da81-54a3-461b-8239-450154dcfcb1',
      )

      expect(result.id).toBe('d129da81-54a3-461b-8239-450154dcfcb1')
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
