#!/usr/bin/env python3
"""Import flags from a JSON file into the Phase Flag API.

Usage:
    python importer.py --api-url http://localhost:8000 --api-key pf_xxx --input flags.json
    python importer.py --input flags.json --api-key pf_xxx --dry-run
    python importer.py --input flags.json --api-key pf_xxx --merge
"""

import argparse
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def api_request(method: str, url: str, api_key: str, body: dict | None = None) -> dict | list | None:
    """Perform an authenticated API request."""
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    req = Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-API-Key", api_key)

    try:
        with urlopen(req, timeout=30) as resp:
            response_data = resp.read().decode("utf-8")
            if response_data:
                return json.loads(response_data)
            return None
    except HTTPError as e:
        body_text = e.read().decode("utf-8") if e.fp else ""
        raise RuntimeError(f"HTTP {e.code}: {body_text}")
    except URLError as e:
        raise RuntimeError(f"Connection error: {e.reason}")


def get_existing_flags(api_url: str, api_key: str) -> set[str]:
    """Fetch all existing flag keys from the API."""
    try:
        data = api_request("GET", f"{api_url}/api/v1/flags", api_key)
    except RuntimeError as e:
        print(f"Warning: Could not fetch existing flags: {e}", file=sys.stderr)
        return set()

    flags = []
    if isinstance(data, list):
        flags = data
    elif isinstance(data, dict):
        flags = data.get("items", data.get("flags", []))

    return {f.get("key", "") for f in flags if isinstance(f, dict)}


def import_flag(api_url: str, api_key: str, flag: dict) -> tuple[bool, str]:
    """Create a single flag via the API. Returns (success, message)."""
    try:
        result = api_request("POST", f"{api_url}/api/v1/flags", api_key, flag)
        key = flag.get("key", "unknown")
        return True, f"Created: {key}"
    except RuntimeError as e:
        key = flag.get("key", "unknown")
        return False, f"Failed: {key} - {e}"


def import_segment(api_url: str, api_key: str, segment: dict) -> tuple[bool, str]:
    """Create a single segment via the API. Returns (success, message)."""
    try:
        result = api_request("POST", f"{api_url}/api/v1/segments", api_key, segment)
        key = segment.get("key", "unknown")
        return True, f"Created segment: {key}"
    except RuntimeError as e:
        key = segment.get("key", "unknown")
        return False, f"Failed segment: {key} - {e}"


def load_import_file(path: str) -> tuple[list[dict], list[dict]]:
    """Load and parse the import file. Returns (flags, segments)."""
    data = json.loads(Path(path).read_text())

    flags = []
    segments = []

    if isinstance(data, list):
        # Assume array of flags
        flags = data
    elif isinstance(data, dict):
        flags = data.get("flags", [])
        segments = data.get("segments", [])

        # If no flags key, treat the whole object as a single flag
        if not flags and "key" in data:
            flags = [data]
    else:
        print("Error: Invalid import file format", file=sys.stderr)
        sys.exit(1)

    return flags, segments


def main():
    parser = argparse.ArgumentParser(
        description="Import flags from JSON into Phase Flag API."
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="JSON file to import",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000",
        help="Phase Flag API base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--api-key",
        required=True,
        help="API key for authentication",
    )
    parser.add_argument(
        "--environment", "-e",
        default=None,
        help="Override environment for all imported flags",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be imported without making changes",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Skip flags that already exist (default: fail on duplicates)",
    )
    parser.add_argument(
        "--include-segments",
        action="store_true",
        help="Also import segments from the file",
    )

    args = parser.parse_args()

    flags, segments = load_import_file(args.input)

    if not flags and not segments:
        print("No flags or segments found in import file.", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(flags)} flag(s) and {len(segments)} segment(s) to import", file=sys.stderr)

    # Override environment if specified
    if args.environment:
        for flag in flags:
            flag["environment"] = args.environment

    # Get existing flags for merge mode
    existing_keys = set()
    if args.merge and not args.dry_run:
        existing_keys = get_existing_flags(args.api_url, args.api_key)
        print(f"Found {len(existing_keys)} existing flag(s) in the API", file=sys.stderr)

    # Import segments first (if requested)
    seg_created = 0
    seg_failed = 0
    if args.include_segments and segments:
        print("\n--- Importing Segments ---", file=sys.stderr)
        for segment in segments:
            key = segment.get("key", "unknown")
            if args.dry_run:
                print(f"  [DRY RUN] Would create segment: {key}")
                seg_created += 1
                continue

            success, message = import_segment(args.api_url, args.api_key, segment)
            print(f"  {message}")
            if success:
                seg_created += 1
            else:
                seg_failed += 1

    # Import flags
    created = 0
    skipped = 0
    failed = 0

    print("\n--- Importing Flags ---", file=sys.stderr)
    for flag in flags:
        key = flag.get("key", "unknown")

        if args.merge and key in existing_keys:
            print(f"  [SKIP] {key} (already exists)")
            skipped += 1
            continue

        if args.dry_run:
            name = flag.get("name", key)
            flag_type = flag.get("flag_type", "boolean")
            env = flag.get("environment", "development")
            print(f"  [DRY RUN] Would create: {key} ({name}) [{flag_type}] env={env}")
            created += 1
            continue

        success, message = import_flag(args.api_url, args.api_key, flag)
        print(f"  {message}")
        if success:
            created += 1
        else:
            failed += 1

    # Summary
    print(f"\n--- Summary ---", file=sys.stderr)
    print(f"Flags:    {created} created, {skipped} skipped, {failed} failed", file=sys.stderr)
    if args.include_segments:
        print(f"Segments: {seg_created} created, {seg_failed} failed", file=sys.stderr)

    if args.dry_run:
        print("\n(Dry run - no changes were made)", file=sys.stderr)

    if failed > 0 or seg_failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
