#!/usr/bin/env python3
"""Send an original dev request + a git diff to TypeSafe's Jev model and
print back structured judgments about whether the diff matches the request.

Usage:
    jev_review.py --request-file REQUEST.txt --diff-file DIFF.txt

Reads the API key from the TYPESAFE_API_KEY environment variable. Prints a
single JSON object to stdout: {"answers": {...}} on success, or
{"error": "..."} on failure.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

API_URL = "https://api.typesafe.ai/v1/systemone"

QUESTIONS = {
    "is_aligned": {
        "type": "noul",
        "instructions": (
            "Does the code change in `diff` implement what was asked for "
            "in `request`?"
        ),
        "criteria": {
            "true": "The diff's changes plausibly satisfy the request",
            "false": "The diff does something different from, or unrelated to, the request",
        },
    },
    "has_unrelated_changes": {
        "type": "noul",
        "instructions": (
            "Does `diff` contain edits that have nothing to do with "
            "`request` (e.g. unrelated files, drive-by refactors, "
            "formatting-only changes to untouched code)?"
        ),
    },
    "has_missing_requirements": {
        "type": "noul",
        "instructions": (
            "Does `request` describe something that `diff` does not "
            "appear to fully implement?"
        ),
    },
    "has_security_concern": {
        "type": "noul",
        "instructions": (
            "Does `diff` introduce a plausible security concern (e.g. "
            "secrets, injection, unsafe deserialization, broadened "
            "permissions, disabled validation)?"
        ),
    },
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request-file", required=True)
    parser.add_argument("--diff-file", required=True)
    args = parser.parse_args()

    api_key = os.environ.get("TYPESAFE_API_KEY")
    if not api_key:
        print(json.dumps({"error": "TYPESAFE_API_KEY is not set"}))
        sys.exit(1)

    with open(args.request_file, encoding="utf-8") as f:
        request_text = f.read()
    with open(args.diff_file, encoding="utf-8") as f:
        diff_text = f.read()

    payload = {
        "state": {"request": request_text, "diff": diff_text},
        "model": "jev-latest",
        "questions": QUESTIONS,
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

    print(json.dumps(body, indent=2))


if __name__ == "__main__":
    main()
