import { MongoMemoryServer } from 'mongodb-memory-server'
import type { TestProject } from 'vitest/node'

let server: MongoMemoryServer | undefined

export async function setup(project: TestProject): Promise<void> {
  server = await MongoMemoryServer.create()
  project.provide('mongoUri', server.getUri())
}

export async function teardown(): Promise<void> {
  await server?.stop()
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string
  }
}
