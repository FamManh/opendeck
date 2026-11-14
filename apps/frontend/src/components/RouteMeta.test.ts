import { pageFor } from './RouteMeta'

test.each([
  ['/', 'home', true],
  ['/login', 'login', true],
  ['/register', 'register', true],
  ['/forgot', 'forgot', false],
  ['/reset', 'reset', false],
  ['/rooms/new', 'createRoom', false],
  ['/r/abc123', 'room', false],
  ['/r/abc123/summary', 'summary', false],
  ['/nope', 'home', false],
] as const)('%s → %s (indexable=%s)', (path, key, indexable) => {
  expect(pageFor(path)).toEqual({ key, indexable })
})
