// Simplified and updated main.ts with octokit.paginate

import * as core from '@actions/core'
import * as github from '@actions/github'
import { parse } from 'json2csv'
import { dirname } from 'path'
import makeDir from 'make-dir'
import * as fs from 'fs'

const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN')
const octokit = github.getOctokit(GITHUB_TOKEN)

const ent_name: string = core.getInput('ent_name')
const file_path: string = core.getInput('file_path')

const fields = [
  { label: 'User', value: 'assignee.login' },
  { label: 'Created At', value: 'created_at' },
  { label: 'Updated At', value: 'updated_at' },
  { label: 'Last Activity At', value: 'last_activity_at' },
  { label: 'Last Activity Editor', value: 'last_activity_editor' },
  { label: 'Pending Cancellation Date', value: 'pending_cancellation_date' },
  { label: 'Team', value: 'assigning_team.name' }
]

let isRunCalled = false

async function getUsage() {
  const endpoint = 'GET /enterprises/{ent}/copilot/billing/seats'
  const parameters = {
    ent: ent_name,
    per_page: 100,
    headers: { 'X-GitHub-Api-Version': '2022-11-28' }
  }

  try {
    const seatsData = []
    for await (const response of octokit.paginate.iterator(
      endpoint,
      parameters
    )) {
      // Check if response.data is iterable
      if (Array.isArray(response.data)) {
        seatsData.push(...response.data)
      } else {
        // Handle the case where response.data is not iterable
        // For example, push response.data directly if it's an object you want to include
        console.error('response.data is not iterable', response.data)
      }
    }
    return seatsData
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }
  }
}

export async function run() {
  if (isRunCalled) {
    console.log('run function is already called.')
    return
  }

  isRunCalled = true
  console.log('TRACE')

  try {
    await makeDir(dirname(file_path))
    if (fs.existsSync(file_path)) {
      fs.unlinkSync(file_path)
    }

    const seatsData = await getUsage()
    if (!seatsData) return

    if (file_path.endsWith('.csv')) {
      const csv = parse(seatsData, { fields, header: true })
      fs.writeFileSync(file_path, csv)
    } else {
      fs.writeFileSync(file_path, JSON.stringify(seatsData, null, 2))
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }
  }
}

run()
