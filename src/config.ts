import { Config, ConfigProvider, Layer } from 'effect'

export const envVars = {
  PORT: Config.integer('PORT').pipe(Config.withDefault(3001)),
  JOBS_TABLE: Config.string('JOBS_TABLE').pipe(
    Config.withDefault('jobs-table'),
  ),
  LOG_LEVEL: Config.string('LOG_LEVEL').pipe(Config.withDefault('info')),
  RESTATE_PORT: Config.integer('RESTATE_PORT').pipe(Config.withDefault(9997)),
} as const

const mockConfigProvider = ConfigProvider.fromJson({
  PORT: 3001,
  JOBS_TABLE: 'jobs-table-test',
  LOG_LEVEL: 'debug',
  RESTATE_PORT: 9997,
})

export const MockConfigLayer = Layer.setConfigProvider(mockConfigProvider)
