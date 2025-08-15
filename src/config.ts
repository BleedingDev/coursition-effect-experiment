import { Config, ConfigProvider, Layer } from 'effect'

export const envVars = {
  SERVER_PORT: Config.integer('SERVER_PORT'),
  JOBS_TABLE: Config.string('JOBS_TABLE').pipe(
    Config.withDefault('jobs-table'),
  ),
  LOG_LEVEL: Config.string('LOG_LEVEL').pipe(Config.withDefault('info')),
  RESTATE_PORT: Config.integer('RESTATE_PORT'),
} as const

const mockConfigProvider = ConfigProvider.fromJson({
  PORT: 3001,
  JOBS_TABLE: 'jobs-table-test',
  LOG_LEVEL: 'debug',
  RESTATE_PORT: 9997,
})

export const MockConfigLayer = Layer.setConfigProvider(mockConfigProvider)
