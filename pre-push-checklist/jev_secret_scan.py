#!/usr/bin/env python3
"""Scan a diff for likely secrets (regex) and security concerns (Jev)
before it gets pushed.

Usage:
    jev_secret_scan.py --diff-file DIFF.txt

Always runs the regex pass, which needs no network access or API key.
The Jev pass additionally runs if TYPESAFE_API_KEY is set; if it's not,
the script still reports regex findings and notes Jev was skipped.

Prints a single JSON object to stdout:
{
  "regex_matches": [{"pattern": "...", "line": "..."}, ...],
  "jev": {"has_hardcoded_secret": 0.0-1.0, "has_security_concern": 0.0-1.0}
         | {"skipped": "TYPESAFE_API_KEY is not set"} | {"error": "..."}
}
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

API_URL = "https://api.typesafe.ai/v1/systemone"

# Deterministic patterns for well-known secret formats, plus a generic
# fallback for "KEY = <long non-placeholder value>" assignments. Not
# exhaustive -- this is a cheap first pass, not a replacement for judgment.
SECRET_PATTERNS = [
    ("AWS access key ID", r"AKIA[0-9A-Z]{16}"),
    ("GitHub token", r"gh[pousr]_[A-Za-z0-9]{20,}"),
    ("Slack token", r"xox[baprs]-[A-Za-z0-9-]{10,}"),
    ("Google API key", r"AIza[0-9A-Za-z_-]{35}"),
    ("Private key header", r"-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    (
        "Generic hardcoded credential",
        r"(?i)(api[_-]?key|secret|token|password|passwd)\s*[:=]\s*"
        r"['\"][A-Za-z0-9/+_.-]{12,}['\"]",
    ),
]
PLACEHOLDER_RE = re.compile(
    r"(?i)^(x+|changeme|your[_-]?key|example|placeholder|<.*>|\$\{.*\}|xxx.*|dummy|test|fake)$"
)

JEV_QUESTIONS = {
    "has_hardcoded_secret": {
        "type": "noul",
        "instructions": (
            "Does `diff` add a real, usable credential, API key, token, or "
            "password hardcoded in source -- as opposed to a placeholder, "
            "an example value, or a reference to an environment variable?"
        ),
    },
    "has_security_concern": {
        "type": "noul",
        "instructions": (
            "Does `diff` introduce a plausible security concern other than "
            "a hardcoded secret (e.g. injection, unsafe deserialization, "
            "broadened permissions, disabled validation, exposed internal "
            "endpoints)?"
        ),
    },
}


def scan_regex(diff_text):
    matches = []
    for line in diff_text.splitlines():
        if not line.startswith("+") or line.startswith("+++"):
            continue
        for name, pattern in SECRET_PATTERNS:
            m = re.search(pattern, line)
            if not m:
                continue
            if name == "Generic hardcoded credential":
                value = re.search(r"['\"]([^'\"]+)['\"]\s*$", m.group(0))
                if value and PLACEHOLDER_RE.match(value.group(1)):
                    continue
            matches.append({"pattern": name, "line": line.strip()[:200]})
    return matches


def call_jev(diff_text, api_key):
    payload = {
        "state": {"diff": diff_text},
        "model": "jev-latest",
        "questions": JEV_QUESTIONS,
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
        return {"error": f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}"}
    except urllib.error.URLError as e:
        return {"error": f"request failed: {e.reason}"}

    return {qid: answer["noul"] for qid, answer in body.get("answers", {}).items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--diff-file", required=True)
    args = parser.parse_args()

    with open(args.diff_file, encoding="utf-8") as f:
        diff_text = f.read()

    result = {"regex_matches": scan_regex(diff_text)}

    api_key = os.environ.get("TYPESAFE_API_KEY")
    if not api_key:
        result["jev"] = {"skipped": "TYPESAFE_API_KEY is not set"}
    else:
        result["jev"] = call_jev(diff_text, api_key)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
