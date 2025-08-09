import { HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'

export const idParam = HttpApiSchema.param('id', Schema.String)
