import { DevTools } from '@effect/experimental'
import * as Otlp from '@effect/opentelemetry/Otlp'
import {
  FetchHttpClient,
  HttpApiBuilder,
  HttpApiScalar,
  HttpMiddleware,
  HttpServer,
} from '@effect/platform'
import { BunHttpServer, BunRuntime } from '@effect/platform-bun'
import * as restate from '@restatedev/restate-sdk'
import { GetRandomValues } from '@typed/id'
import { Config, Effect, Layer, Logger } from 'effect'
import { api } from './api'
import { envVars } from './config'
import { getJobByIdHandler } from './handlers/jobs/get-job-by-id.handler'
import { getJobResultHandler } from './handlers/jobs/get-job-result.handler'
import { getJobsHandler } from './handlers/jobs/get-jobs.handler'
import { transcribeWorkflowHandler } from './handlers/media/transcribe-workflow.handler.ts'
import { JobsStore } from './stores/jobs/jobs.store'
import { MediaStore } from './stores/media/media.store'
import {
  RestateClientLive,
  WorkflowStore,
} from './stores/workflow/workflow-store.ts'
import { transcribeWorkflowDefinition } from './usecases/media/transcribe-workflow.usecase.ts'

const mediaGroupImplementation = HttpApiBuilder.group(
  api,
  'media',
  (handlers) =>
    handlers
      .handle('parseMedia', ({ payload }) => transcribeWorkflowHandler(payload))
      .handle('getJobs', () => getJobsHandler())
      .handle('getJob', ({ path: { id } }) => getJobByIdHandler(id))
      .handle('getJobResult', ({ path: { id } }) => getJobResultHandler(id)),
)

const restatePort = Effect.runSync(Effect.gen(function* () {
  return (yield* envVars).RESTATE_PORT
}))
restate.endpoint().bind(transcribeWorkflowDefinition).listen(restatePort)

const ApiImplementation = HttpApiBuilder.api(api).pipe(
  Layer.provide(mediaGroupImplementation),
  Layer.provide(JobsStore.Default),
  Layer.provide(Layer.succeed(MediaStore, MediaStore.Deepgram)),
  Layer.provide(
    Layer.mergeAll(
      Layer.succeed(WorkflowStore, WorkflowStore.RestateStore),
      RestateClientLive,
    ),
  ),
)

const ServerLayer = Effect.gen(function* () {
  const port = (yield* envVars).SERVER_PORT

  return Layer.mergeAll(
    DevTools.layer(),
    Otlp.layer({
      baseUrl: 'http://localhost:4318',
      resource: { serviceName: 'coursition-api' },
    }).pipe(Layer.provide(FetchHttpClient.layer)),
    HttpApiScalar.layer(),
    HttpApiBuilder.middlewareCors(),
    BunHttpServer.layer({ port }),
  )
}).pipe(Layer.unwrapEffect)

const LogLevelLive = envVars.pipe(
  Effect.map((env) => Logger.minimumLogLevel(env.LOG_LEVEL)),
  Layer.unwrapEffect,
)

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  HttpServer.withLogAddress,
  Layer.provide(ServerLayer),
  Layer.provide(ApiImplementation),
  Layer.provide(GetRandomValues.CryptoRandom),
  Layer.provide(LogLevelLive),
)

BunRuntime.runMain(Layer.launch(HttpLive))
