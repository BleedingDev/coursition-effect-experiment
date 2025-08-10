import { describe, expect, it } from '@effect/vitest'
import { Effect as E, Exit } from 'effect'
import { MockConfigLayer } from '../../config'
import { JobResultNotFoundError } from '../../domain/jobs/jobs.errors'
import { getExitError } from '../../utils/test-utils'
import { JobsStore } from './jobs.store'

describe('JobsStore', () => {
  describe('getAllJobs', () => {
    it.effect('should return list of jobs', () =>
      E.gen(function* () {
        const store = yield* JobsStore
        const result = yield* store.getAllJobs()

        expect(result.jobs).toHaveLength(3)
        expect(result.jobs[0]?.name).toBe('Parse Video 1')
        expect(result.jobs[0]?.status).toBe('completed')
      }).pipe(E.provide(JobsStore.Default), E.provide(MockConfigLayer)),
    )
  })

  describe('getJobById', () => {
    it.effect('should return job when found', () =>
      E.gen(function* () {
        const store = yield* JobsStore
        const result = yield* store.getJobById(
          '09467777-7801-40ed-b683-5a9ae8ae3141',
        )

        expect(result.id).toBe('09467777-7801-40ed-b683-5a9ae8ae3141')
        expect(result.name).toBe('Job 09467777-7801-40ed-b683-5a9ae8ae3141')
        expect(result.status).toBe('running')
      }).pipe(E.provide(JobsStore.Default), E.provide(MockConfigLayer)),
    )

    it.effect('should handle not found error', () =>
      E.gen(function* () {
        const store = yield* JobsStore
        const result = yield* store
          .getJobById('0bb4870a-09a9-4adc-8e86-0a024075756d')
          .pipe(E.exit)

        expect(Exit.isFailure(result)).toBe(true)
        const error = getExitError(result)
        expect(error?._tag).toBe('JobNotFoundError')
        expect(error?.jobId).toBe('0bb4870a-09a9-4adc-8e86-0a024075756d')
      }).pipe(E.provide(JobsStore.Default), E.provide(MockConfigLayer)),
    )
  })

  describe('getJobResult', () => {
    it.effect('should return result for completed job', () =>
      E.gen(function* () {
        const store = yield* JobsStore
        const result = yield* store.getJobResult(
          'e9f04d2e-ddf1-4f82-b49b-6180a70ca91a',
        )

        expect(result.id).toBe('e9f04d2e-ddf1-4f82-b49b-6180a70ca91a')
        expect(result.result).toBe(
          'Result for job e9f04d2e-ddf1-4f82-b49b-6180a70ca91a',
        )
      }).pipe(
        E.provide(
          JobsStore.makeTestService({
            getJobById: (id) =>
              E.succeed({
                id,
                name: `Job ${id}`,
                status: 'completed',
              }),
            getJobResult: (jobId) =>
              E.succeed({
                id: jobId,
                result: `Result for job ${jobId}`,
              }),
          }),
        ),
        E.provide(MockConfigLayer),
      ),
    )

    it.effect('should handle result not found for incomplete job', () =>
      E.gen(function* () {
        const store = yield* JobsStore
        const result = yield* store
          .getJobResult('25b26ec4-6ece-4b85-9aea-50cf98b06058')
          .pipe(E.exit)

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result)) {
          const error = getExitError(result)
          expect(error?._tag).toBe('JobResultNotFoundError')
        }
      }).pipe(
        E.provide(
          JobsStore.makeTestService({
            getJobById: (id) =>
              E.succeed({
                id,
                name: `Job ${id}`,
                status: 'running',
              }),
            getJobResult: (jobId) =>
              E.fail(new JobResultNotFoundError({ jobId })),
          }),
        ),
        E.provide(MockConfigLayer),
      ),
    )
  })
})
