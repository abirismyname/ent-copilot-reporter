// libs for github & graphql
import * as core from '@actions/core'
import * as github from '@actions/github'
import { parse } from 'json2csv'

// libs for csv file creation
import { dirname } from 'path'
import makeDir from 'make-dir'
import * as fs from 'fs'

// get the octokit handle
const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN')
const octokit = github.getOctokit(GITHUB_TOKEN)

// inputs defined in action metadata file
const ent_name: string = core.getInput('ent_name')
const file_path: string = core.getInput('file_path')

let totalSeats = 0

// Our CSV output fields
const fields = [
  {
    label: 'User',
    value: 'assignee.login'
  },
  {
    label: 'Created At',
    value: 'created_at'
  },
  {
    label: 'Updated At',
    value: 'updated_at'
  },
  {
    label: 'Last Acivity At',
    value: 'last_activity_at'
  },
  {
    label: 'Last Acivity Editor',
    value: 'last_activity_editor'
  },
  {
    label: 'Pending Cancellation Date',
    value: 'pending_cancellation_date'
  },
  {
    label: 'Team',
    value: 'assigning_team.name'
  }
]

// Copilot User Management API call
async function getUsage(pageNo: number) {
  try {
    console.log(`getUsage Page: ${pageNo}`)
    return await octokit.request(
      'GET /enterprises/{ent}/copilot/billing/seats',
      {
        ent: ent_name,
        page: pageNo,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )
  } catch (error: unknown) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      // Handle cases where the error is not an instance of Error
      core.setFailed('An unknown error occurred')
    }
  }
}

// Extract Copilot usage data with a pagination of 50 records per page
export async function run() {
  console.trace('TRACE')
  let addTitleRow = true
  let pageNo = 1
  let remainingRecs = 0

  try {
    await makeDir(dirname(file_path))
    // delete the file, if exists
    if (fs.existsSync(file_path)) {
      fs.unlinkSync(file_path)
    }
    do {
      await getUsage(pageNo).then(usageResult => {
        // if usageResult is null, then exit the loop
        if (usageResult == null) {
          return
        }

        const seatsData = usageResult.data.seats

        if (addTitleRow) {
          totalSeats = usageResult.data.total_seats
          console.log(`Seat Count ${totalSeats}`)
          remainingRecs = totalSeats
        }

        // check whether the file extension is csv or not
        if (file_path.endsWith('.csv')) {
          // ALERT! - create our updated opts
          const opts = { fields, header: addTitleRow }

          // append to the existing file (or create and append if needed)
          fs.appendFileSync(file_path, `${parse(seatsData, opts)}\n`)
        } else {
          // Export to JSON file
          //check the file exists or not
          if (!fs.existsSync(file_path)) {
            // The file doesn't exist, create a new one with an empty JSON object
            fs.writeFileSync(file_path, JSON.stringify([], null, 2))
          }

          //check the file is empty or not
          const data = fs.readFileSync(file_path, 'utf8') // read the file

          // file contains only [] indicating a blank file
          // append the entire data to the file
          if (data.trim() === '[]') {
            console.log('The JSON data array is empty.')
            fs.writeFileSync(file_path, JSON.stringify(seatsData, null, 2))
          } else {
            //TODO: find the delta and append to existung file
            let jsonData = JSON.parse(data) // parse the JSON data into a JavaScript array
            jsonData = jsonData.concat(seatsData)
            fs.writeFileSync(file_path, JSON.stringify(jsonData, null, 2))
          }
        }
        // pagination to get next page data
        remainingRecs = remainingRecs - seatsData.length
        console.log(`Remaining Records ${remainingRecs}`)
        if (remainingRecs > 0) {
          pageNo = pageNo + 1
          addTitleRow = false
        }
      })
    } while (remainingRecs > 0)
  } catch (error: unknown) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      // Handle cases where the error is not an instance of Error
      core.setFailed('An unknown error occurred')
    }
  }
}

// run the action code
run()
