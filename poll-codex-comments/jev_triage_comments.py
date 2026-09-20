#!/usr/bin/env python3
"""Score a batch of Codex PR review comments against the diff using
TypeSafe's Jev model, to help prioritize which are likely real issues.

Usage:
    jev_triage_comments.py --diff-file DIFF.txt --comments-file COMMENTS.json

COMMENTS.json is a JSON array of objects, each with at least an "id" and a
"body" (the comment text); "path"/"line" are included if present but not
required. One Noul question is asked per comment, in a single API call.

Reads the API key from the TYPESAFE_API_KEY environment variable. Prints a
single JSON object to stdout: {"scores": {"<comment id>": 0.0-1.0, ...}} on
success, or {"error": "..."} on failure.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

API_URL = "https://api.typesafe.ai/v1/systemone"

INSTRUCTIONS = (
    "Given the code change in `diff`, is the review comment at "
    "`comments[{index}]` describing a real, actionable issue in that diff "
    "-- as opposed to a false positive, something the diff already "
    "handles, or a purely stylistic nit?"
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--diff-file", required=True)
    parser.add_argument("--comments-file", required=True)
    args = parser.parse_args()

    api_key = os.environ.get("TYPESAFE_API_KEY")
    if not api_key:
        print(json.dumps({"error": "TYPESAFE_API_KEY is not set"}))
        sys.exit(1)

    with open(args.diff_file, encoding="utf-8") as f:
        diff_text = f.read()
    with open(args.comments_file, encoding="utf-8") as f:
        comments = json.load(f)

    if not comments:
        print(json.dumps({"scores": {}}))
        return

    questions = {}
    id_by_question = {}
    for index, comment in enumerate(comments):
        qid = f"q{index}"
        questions[qid] = {
            "type": "noul",
            "instructions": INSTRUCTIONS.format(index=index),
        }
        id_by_question[qid] = comment["id"]

    payload = {
        "state": {"diff": diff_text, "comments": comments},
        "model": "jev-latest",
        "questions": questions,
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        print(json.dumps({"error": f"HTTP {e.code}: {detail}"}))
        sys.exit(1)
    except urllib.error.URLError as e:
        print(json.dumps({"error": f"request failed: {e.reason}"}))
        sys.exit(1)

    scores = {
        str(id_by_question[qid]): answer["noul"]
        for qid, answer in body.get("answers", {}).items()
    }
    print(json.dumps({"scores": scores}, indent=2))


if __name__ == "__main__":
    main()
