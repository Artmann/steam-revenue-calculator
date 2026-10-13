import { findQuery, queries } from './registry'
import { runQuery } from './runner'
import { closeDb } from './utils/db'

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage()
    return
  }

  if (args.includes('--list')) {
    printList()
    return
  }

  const toRun = args.includes('--all')
    ? queries
    : args
        .filter((arg) => !arg.startsWith('--'))
        .map((name) => {
          const query = findQuery(name)
          if (!query) {
            console.error(`Unknown query: ${name}`)
            console.error('Run with --list to see available queries.')
            process.exit(1)
          }
          return query
        })

  if (toRun.length === 0) {
    printUsage()
    return
  }

  if (!process.env.DB_URL || !process.env.DB_DATABASE) {
    console.error('Missing DB_URL or DB_DATABASE. Set them in .env or the environment.')
    process.exitCode = 1
    return
  }

  for (const query of toRun) {
    await runQuery(query)
  }
}

function printUsage(): void {
  console.log('Usage: yarn stats <query-name> [<query-name> ...]')
  console.log('       yarn stats --all')
  console.log('       yarn stats --list')
}

function printList(): void {
  console.log('Available queries:')
  for (const query of queries) {
    console.log(`  ${query.name.padEnd(24)} ${query.description}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDb()
  })
