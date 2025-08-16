import { Config, ConfigProvider, Layer, LogLevel } from 'effect'

export const envVars = Config.all({
  SERVER_PORT: Config.integer('SERVER_PORT'),
  JOBS_TABLE: Config.string('JOBS_TABLE').pipe(
    Config.withDefault('jobs-table'),
  ),
  LOG_LEVEL: Config.logLevel('LOG_LEVEL').pipe(Config.withDefault(LogLevel.Info)),
  RESTATE_PORT: Config.integer('RESTATE_PORT'),
})

const mockConfigProvider = ConfigProvider.fromJson({
  SERVER_PORT: 3001,
  JOBS_TABLE: 'jobs-table-test',
  LOG_LEVEL: 'debug',
  RESTATE_PORT: 9997,
})

export const MockConfigLayer = Layer.setConfigProvider(mockConfigProvider)
