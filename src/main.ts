import * as core from "@actions/core";
import * as github from "@actions/github";
import axios from "axios";
import Papa from "papaparse";

export default async function run(): Promise<void> {
  try {
    const token = core.getInput("token", { required: true });
    const entName = core.getInput("ent_name", { required: true });
    const filePath = core.getInput("file_path", { required: true });

    const octokit = github.getOctokit(token);

    const apiUrl = `https://api.github.com/enterprises/${entName}/copilot/billing/seats`;
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
      },
    });

    if (response.data === undefined) {
      core.setFailed("Error: Fetched data is undefined. Cannot generate CSV.");
      return;
    }

    try {
      const csv = Papa.unparse(response.data);
      const fs = require("fs");
      fs.writeFileSync(filePath, csv);

      core.setOutput("csv_path", filePath);
      console.log(`CSV generated at: ${filePath}`);
    } catch (error) {
      if (error instanceof Error) {
        core.setFailed(`Error parsing data to CSV: ${error.message}`);
      } else {
        // Handle the case where error is not an Error object
        core.setFailed(`Error parsing data to CSV: ${error}`);
      }
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}

run();
