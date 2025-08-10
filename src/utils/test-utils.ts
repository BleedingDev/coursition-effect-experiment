import { type Context, Effect, Exit, Layer } from 'effect'

/**
 * Utility function to extract error from an Exit.
 * Returns the error if the exit is a failure with a Fail cause, otherwise returns null.
 */
export const getExitError = <A, E = never>(exit: Exit.Exit<A, E>) => {
  if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
    return exit.cause.error
  }

  // console.log(exit)

  return null
}

const makeUnimplemented = (id: string, prop: PropertyKey) => {
  const dead = Effect.die(`${id}: Unimplemented method "${prop.toString()}"`)
  function unimplemented() {
    return dead
  }
  Object.assign(unimplemented, dead)
  Object.setPrototypeOf(unimplemented, Object.getPrototypeOf(dead))
  return unimplemented
}

const makeUnimplementedProxy = <A extends object>(
  service: string,
  impl: Partial<A>,
): A =>
  new Proxy({ ...impl } as A, {
    get(target, prop, _receiver) {
      if (prop in target) {
        return target[prop as keyof A]
      }
      // biome-ignore lint/suspicious/noAssignInExpressions: official example from Effect repo
      // biome-ignore lint/suspicious/noExplicitAny: official example from Effect repo
      return ((target as any)[prop] = makeUnimplemented(service, prop))
    },
    has: () => true,
  })

export const makeTestLayer =
  <I, S extends object>(tag: Context.Tag<I, S>) =>
  (service: Partial<S>): Layer.Layer<I> =>
    Layer.succeed(tag, makeUnimplementedProxy(tag.key, service))
