Prefer Effect-style discriminated unions with a `_tag` field and handle them with `Match.tags` / `Match.tagsExhaustive` for compile-time exhaustiveness.

Why
- `_tag`-based unions compose naturally with Effect’s pattern matching utilities.
- `Match.tagsExhaustive` guarantees you handle every case (no silent fallthroughs).
- Clear shapes prevent the “bag of optionals” problem.

Effect-native discriminated unions (recommended)

- If you don't need runtime decoding, prefer `Data` helpers for ergonomics and value equality/hashing.
- If you need runtime decoding/derivations (Arbitrary, JSON Schema, etc.), prefer `Schema.TaggedStruct` and `Schema.Union`.

Using Data.taggedEnum (compile-time only, ergonomic, value-equality)

```ts
import { Data } from "effect";

// Define the union shape once and get constructors + $match/$is utilities
type Event = Data.TaggedEnum<{
  "user.created": { id: string; email: string };
  "user.deleted": { id: string };
}>;

const { $match, UserCreated, UserDeleted } = Data.taggedEnum<Event>();

// Construct safely (no need to set _tag manually)
const e1 = UserCreated({ id: "123", email: "a@b.com" });
const e2 = UserDeleted({ id: "123" });

// Pattern match with the generated matcher (exhaustive by keys)
const handle = $match({
  "user.created": ({ email }) => console.log(email),
  "user.deleted": ({ id }) => console.log(id),
});

handle(e1);
```

Modeling events (Effect-friendly)

```ts
// Use `_tag` as the discriminator; keep payload fields flat.
type Event =
  | { _tag: "user.created"; id: string; email: string }
  | { _tag: "user.deleted"; id: string };

// Constructors (optional, but nice for consistency)
const UserCreated = (id: string, email: string): Event => ({ _tag: "user.created", id, email });
const UserDeleted = (id: string): Event => ({ _tag: "user.deleted", id });
```

Handling with Match (exhaustive)

```ts
import * as Match from "effect/Match";

// `tagsExhaustive` produces a function (Event) => R and enforces exhaustiveness at compile-time.
const handleEvent = Match.type<Event>().pipe(
  Match.tagsExhaustive({
    "user.created": ({ email }) => {
      console.log(email);
    },
    "user.deleted": ({ id }) => {
      console.log(id);
    },
  })
);

// usage
handleEvent(UserCreated("123", "a@b.com"));
```

Custom discriminant keys

```ts
import * as Match from "effect/Match";

// If you cannot use `_tag`, use a custom discriminator via Match.discriminator
type E =
  | { kind: "A"; a: number }
  | { kind: "B"; b: string };

const run = Match.type<E>().pipe(
  Match.discriminator("kind")("A", ({ a }) => a.toFixed(2)),
  Match.discriminator("kind")("B", ({ b }) => b.toUpperCase()),
  Match.exhaustive
);
```

Partial matching with an explicit fallback

```ts
import * as Match from "effect/Match";

const logEvent = (event: Event) =>
  Match.value(event).pipe(
    Match.tags({
      "user.created": ({ id }) => console.log("created", id),
    }),
    // Provide an explicit fallback for unhandled tags
    Match.orElse((e) => console.warn("unhandled event", e._tag))
  );
```

Avoiding the “bag of optionals” with proper unions

```ts
// BAD - allows impossible states
type FetchingState<T> = {
  status: "idle" | "loading" | "success" | "error";
  data?: T;
  error?: Error;
};

// GOOD - prevents impossible states and matches cleanly with Match.tagsExhaustive
type FetchingState<T> =
  | { _tag: "Idle" }
  | { _tag: "Loading" }
  | { _tag: "Success"; data: T }
  | { _tag: "Error"; error: Error };

import * as Match from "effect/Match";

const render = Match.type<FetchingState<{ name: string }>>().pipe(
  Match.tagsExhaustive({
    Idle: () => "Idle",
    Loading: () => "Loading…",
    Success: ({ data }) => `Welcome ${data.name}`,
    Error: ({ error }) => `Oops: ${error.message}`,
  })
);
```

Effectful handlers (optional)

```ts
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";

const processEvent = (event: Event) =>
  Match.value(event).pipe(
    Match.tags({
      "user.created": ({ id }) => Effect.logInfo(`created: ${id}`),
      "user.deleted": ({ id }) => Effect.logInfo(`deleted: ${id}`),
    }),
    Match.exhaustive // ensure all cases are covered
  );
```

Tips
- Always use `_tag` as the discriminant to leverage `Match.tags*` helpers.
- Keep payloads flat; avoid nesting under `data` when not necessary.
- Prefer `tagsExhaustive` whenever you need compile-time assurances that all cases are handled.
- When you intentionally handle a subset, use `Match.tags` with `Match.orElse` (or `Match.exhaustive` after adding the remaining cases).

Choosing between Data and Schema

- Use `Data.taggedEnum`/`Data.tagged` when you want:
  - Ergonomic constructors and built-in value equality/hash.
  - Pure compile-time modeling (no runtime decoding required).
  - Optional generated `$match`/`$is` utilities.
- Use `Schema.TaggedStruct` + `Schema.Union` when you want:
  - Runtime decoding/validation and derivations (Arbitrary, JSON Schema, pretty printers, etc.).
  - Type-safe constructors via `Schema.make` and literal tag enforcement at runtime.
- Both approaches work with `Match.tagsExhaustive` because they produce the same `_tag`-discriminated shapes.

Modeling with Effect Schema (runtime-safe)

```ts
import { Schema } from "effect";

// Prefer TaggedStruct for less boilerplate (adds `_tag` automatically)
const UserCreatedSchema = Schema.TaggedStruct("user.created", {
  id: Schema.String,
  email: Schema.String,
});

const UserDeletedSchema = Schema.TaggedStruct("user.deleted", {
  id: Schema.String,
});

// Union by tag
export const EventSchema = Schema.Union(UserCreatedSchema, UserDeletedSchema);

// Derive the static TypeScript type from the schema
export type Event = Schema.Type<typeof EventSchema>;

// Optional: decode unknown input at runtime
export const decodeEvent = Schema.decodeUnknown(EventSchema);
```

Using Schema-derived types with Match

```ts
import * as Match from "effect/Match";
// import type { Event } from "./path/to/EventSchema";

export const handleEvent = Match.type<Event>().pipe(
  Match.tagsExhaustive({
    "user.created": ({ email }) => {
      console.log(email);
    },
    "user.deleted": ({ id }) => {
      console.log(id);
    },
  })
);
```

Fetching state with Effect Schema

```ts
import { Schema } from "effect";

// TaggedStruct variants (preferred)
export const IdleSchema = Schema.TaggedStruct("Idle", {});
export const LoadingSchema = Schema.TaggedStruct("Loading", {});
export const SuccessSchema = <T extends Schema.Schema.Any>(T: T) =>
  Schema.TaggedStruct("Success", { data: T });
export const ErrorSchema = Schema.TaggedStruct("Error", { error: Schema.UnknownError });

// Example instantiation for a concrete T
const UserSchema = Schema.Struct({ name: Schema.String });

export const FetchingStateSchema = Schema.Union(
  IdleSchema,
  LoadingSchema,
  SuccessSchema(UserSchema),
  ErrorSchema
);

export type FetchingState = Schema.Type<typeof FetchingStateSchema>;
```

Note
- The examples use `_tag` for the discriminator to align with `Match.tags*` APIs. If you already have schemas using `kind`, prefer migrating to `_tag` for consistency.

Using Schema.TaggedStruct (concise)

Why use TaggedStruct
- Less boilerplate: the `_tag` field is added for you with a literal type.
- Consistent with Match.tags* defaults (discriminator `_tag`).
- Ensures the tag is always present and correct at both type- and runtime.

Example: shapes

```ts
import { Schema } from "effect";

// Tagged variants (discriminator `_tag` added automatically)
const Circle = Schema.TaggedStruct("circle", {
  radius: Schema.Number,
});

const Square = Schema.TaggedStruct("square", {
  sideLength: Schema.Number,
});

// Union
export const Shape = Schema.Union(Circle, Square);
export type Shape = Schema.Type<typeof Shape>;
```

Using with Match

```ts
import * as Match from "effect/Match";
// import type { Shape } from "./path/to/Shape";

export const area = Match.type<Shape>().pipe(
  Match.tagsExhaustive({
    circle: ({ radius }) => Math.PI * radius * radius,
    square: ({ sideLength }) => sideLength * sideLength,
  })
);
```

When not to use TaggedStruct
- If you must use a different discriminator key (e.g. `kind`), `TaggedStruct` uses `_tag` and does not (currently) allow customizing the key. Use `Schema.Struct({ _tag: Schema.Literal(...), ... })` (or migrate to `_tag`).
- If the union is purely compile-time (no runtime decoding needed), plain TypeScript types plus `Match.tagsExhaustive` may be sufficient. Use `Schema` only when you need runtime safety/derivations.

Why ever use Schema.Struct with `_tag`?

- You need a different discriminator key via `Schema.Struct({ kind: Schema.Literal(...) })` and plan to match with `Match.discriminator("kind")`.
- You need to build a shape that `TaggedStruct` cannot express (e.g., advanced property annotations or migration from an existing struct where you can't switch to `_tag`).
- Otherwise, prefer `Schema.TaggedStruct` for brevity and stronger invariants.

Data equivalents (no runtime schema)

```ts
import { Data } from "effect";

// Single tagged struct
interface Circle { readonly _tag: "circle"; readonly radius: number }
const Circle = Data.tagged<Circle>("circle");

// Tagged union
type Shape = Data.TaggedEnum<{
  circle: { radius: number };
  square: { sideLength: number };
}>;
const { circle, square, $match } = Data.taggedEnum<Shape>();

const area = $match({
  circle: ({ radius }) => Math.PI * radius * radius,
  square: ({ sideLength }) => sideLength * sideLength,
});
```
