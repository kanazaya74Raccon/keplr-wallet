/* eslint-disable import/no-extraneous-dependencies, @typescript-eslint/no-var-requires */

import "zx/globals";
import semver from "semver";
import { Octokit } from "@octokit/core";

(async () => {
  const versions = (await $`git tag --points-at HEAD`).stdout
    .split(/\s/)
    .map((v) => v.trim())
    .filter((v) => !!v);

  let mobileTagFounded = false;

  for (const version of versions) {
    if (!version.startsWith("mobile/v")) {
      continue;
    }

    const semantic = semver.parse(version.replace("mobile/v", ""));

    if (semantic) {
      mobileTagFounded = true;
      break;
    }
  }

  if (mobileTagFounded) {
    const authKey = process.env["MOBILE_PUBLISH_AUTH_KEY"];
    if (!authKey) {
      throw new Error("MOBILE_PUBLISH_AUTH_KEY is not provided");
    }
    const owner = process.env["MOBILE_PUBLISH_OWNER"];
    if (!owner) {
      throw new Error("MOBILE_PUBLISH_OWNER is not provided");
    }
    const repo = process.env["MOBILE_PUBLISH_REPO"];
    if (!repo) {
      throw new Error("MOBILE_PUBLISH_REPO is not provided");
    }

    const octokit = new Octokit({ auth: authKey });

    await octokit.request(`POST /repos/${owner}/${repo}/dispatches`, {
      event_type: "mobile_publish",
      client_payload: {
        ref: process.env["GITHUB_REF"],
        sha: process.env["GITHUB_SHA"],
      },
    });
  }
})();

/* eslint-enable import/no-extraneous-dependencies, @typescript-eslint/no-var-requires */
