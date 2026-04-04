#!/usr/bin/env python3
"""Export all flags from the Phase Flag API to a JSON file.

Usage:
    python exporter.py --api-url http://localhost:8000 --api-key pf_xxx --output flags.json
    python exporter.py --api-url http://localhost:8000 --api-key pf_xxx --environment production
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def api_get(url: str, api_key: str) -> dict | list:
    """Perform an authenticated GET request to the Phase Flag API."""
    req = Request(url, method="GET")
    req.add_header("Accept", "application/json")
    req.add_header("X-API-Key", api_key)

    try:
        with urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
            return json.loads(data)
    except HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        print(f"API error (HTTP {e.code}): {body}", file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print(f"Connection error: {e.reason}", file=sys.stderr)
        sys.exit(1)


def export_flags(api_url: str, api_key: str, environment: str | None = None) -> list[dict]:
    """Fetch all flags from the API."""
    url = f"{api_url}/api/v1/flags"
    if environment:
        url += f"?environment={environment}"

    data = api_get(url, api_key)

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("items", data.get("flags", [data]))
    return []


def export_segments(api_url: str, api_key: str) -> list[dict]:
    """Fetch all segments from the API."""
    url = f"{api_url}/api/v1/segments"

    try:
        data = api_get(url, api_key)
    except SystemExit:
        print("Warning: Could not export segments", file=sys.stderr)
        return []

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("items", data.get("segments", []))
    return []


def main():
    parser = argparse.ArgumentParser(
        description="Export flags from Phase Flag API to JSON."
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
        "--output", "-o",
        default=None,
        help="Output file path (default: stdout)",
    )
    parser.add_argument(
        "--environment", "-e",
        default=None,
        help="Filter by environment",
    )
    parser.add_argument(
        "--include-segments",
        action="store_true",
        help="Also export segments",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        default=True,
        help="Pretty-print JSON (default: true)",
    )

    args = parser.parse_args()

    print(f"Exporting flags from {args.api_url}...", file=sys.stderr)

    flags = export_flags(args.api_url, args.api_key, args.environment)

    export_data: dict = {
        "version": "1.0",
        "exported_by": "phaseflag-exporter",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "api_url": args.api_url,
        "environment": args.environment or "all",
        "flags": flags,
    }

    if args.include_segments:
        segments = export_segments(args.api_url, args.api_key)
        export_data["segments"] = segments
        print(f"Exported {len(segments)} segment(s)", file=sys.stderr)

    indent = 2 if args.pretty else None
    output_json = json.dumps(export_data, indent=indent, default=str)

    if args.output:
        Path(args.output).write_text(output_json)
        print(f"Exported {len(flags)} flag(s) to {args.output}", file=sys.stderr)
    else:
        print(output_json)
        print(f"\nExported {len(flags)} flag(s)", file=sys.stderr)


if __name__ == "__main__":
    main()
