#!/usr/bin/env python3
"""Phase Flag Code Reference Scanner.

Scans a directory tree for feature flag key usage patterns across
Python, JavaScript/TypeScript, Go, and Java source files.

Usage:
    python scanner.py /path/to/project
    python scanner.py /path/to/project --output refs.json
    python scanner.py /path/to/project --format table
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

# Patterns for each language that match common flag evaluation calls.
# Each pattern should capture the flag key in group 1.
PATTERNS = {
    ".py": [
        # phaseflag SDK
        r'''get_boolean_value\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''get_string_value\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''get_number_value\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''get_json_value\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''get_evaluation_detail\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''is_enabled\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        # LaunchDarkly (migration detection)
        r'''variation\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        # Generic feature flag patterns
        r'''feature_flag\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''get_feature\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
    ],
    ".js": [
        r'''getBooleanValue\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''getStringValue\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''getNumberValue\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''getJsonValue\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''getEvaluationDetail\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''isEnabled\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''useFeatureFlag\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''useFlag\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        # LaunchDarkly
        r'''variation\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        # Generic
        r'''getFeatureFlag\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
    ],
    ".ts": None,  # Uses same patterns as .js
    ".tsx": None,
    ".jsx": None,
    ".go": [
        r'''GetBooleanValue\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''GetStringValue\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''GetFloat64Value\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''GetJSONValue\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''GetEvaluationDetail\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''IsEnabled\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''BoolVariation\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''GetBooleanValueWithContext\(\s*"([a-zA-Z0-9_.-]+)"''',
    ],
    ".java": [
        r'''getBooleanValue\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''getStringValue\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''getNumberValue\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''getJsonValue\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''getEvaluationDetail\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''isEnabled\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''boolVariation\(\s*"([a-zA-Z0-9_.-]+)"''',
    ],
    ".kt": None,  # Uses same patterns as .java
    ".rb": [
        r'''get_boolean_value\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''get_string_value\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''enabled\?\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''feature_enabled\?\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
    ],
    ".php": [
        r'''getBooleanValue\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''getStringValue\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
        r'''isEnabled\(\s*["\']([a-zA-Z0-9_.-]+)["\']''',
    ],
    ".rs": [
        r'''get_boolean_value\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''get_string_value\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''is_enabled\(\s*"([a-zA-Z0-9_.-]+)"''',
    ],
    ".swift": [
        r'''getBooleanValue\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''getStringValue\(\s*"([a-zA-Z0-9_.-]+)"''',
        r'''isEnabled\(\s*"([a-zA-Z0-9_.-]+)"''',
    ],
}

# Map extensions that share patterns with another extension
PATTERN_ALIASES = {
    ".ts": ".js",
    ".tsx": ".js",
    ".jsx": ".js",
    ".kt": ".java",
}

# Directories to skip
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", "vendor", "dist", "build",
    ".next", ".nuxt", "target", "bin", "obj", ".venv", "venv",
}


@dataclass
class FlagReference:
    """A single flag key reference found in source code."""
    flag_key: str
    file_path: str
    line_number: int
    line_content: str
    language: str


def get_patterns(ext: str) -> list[re.Pattern]:
    """Get compiled regex patterns for a file extension."""
    actual_ext = PATTERN_ALIASES.get(ext, ext)
    raw_patterns = PATTERNS.get(actual_ext)
    if raw_patterns is None:
        return []
    return [re.compile(p) for p in raw_patterns]


def get_language(ext: str) -> str:
    """Map file extension to language name."""
    lang_map = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".jsx": "javascript",
        ".go": "go",
        ".java": "java",
        ".kt": "kotlin",
        ".rb": "ruby",
        ".php": "php",
        ".rs": "rust",
        ".swift": "swift",
    }
    return lang_map.get(ext, "unknown")


def scan_file(file_path: Path, patterns: list[re.Pattern], language: str) -> list[FlagReference]:
    """Scan a single file for flag references."""
    refs = []
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except (OSError, PermissionError):
        return refs

    for line_number, line in enumerate(content.splitlines(), start=1):
        for pattern in patterns:
            for match in pattern.finditer(line):
                flag_key = match.group(1)
                refs.append(FlagReference(
                    flag_key=flag_key,
                    file_path=str(file_path),
                    line_number=line_number,
                    line_content=line.strip(),
                    language=language,
                ))

    return refs


def scan_directory(root: str, extensions: set[str] | None = None) -> list[FlagReference]:
    """Recursively scan a directory for flag references."""
    root_path = Path(root)
    if not root_path.is_dir():
        print(f"Error: {root} is not a directory", file=sys.stderr)
        sys.exit(1)

    if extensions is None:
        extensions = set(PATTERNS.keys()) | set(PATTERN_ALIASES.keys())

    all_refs: list[FlagReference] = []

    for dirpath, dirnames, filenames in os.walk(root):
        # Skip excluded directories
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        for filename in filenames:
            ext = Path(filename).suffix
            if ext not in extensions:
                continue

            patterns = get_patterns(ext)
            if not patterns:
                continue

            file_path = Path(dirpath) / filename
            language = get_language(ext)
            refs = scan_file(file_path, patterns, language)
            all_refs.extend(refs)

    return all_refs


def summarize(refs: list[FlagReference]) -> dict:
    """Build a summary of all found flag references."""
    by_key: dict[str, list[dict]] = {}
    by_file: dict[str, list[str]] = {}
    by_language: dict[str, int] = {}

    for ref in refs:
        if ref.flag_key not in by_key:
            by_key[ref.flag_key] = []
        by_key[ref.flag_key].append({
            "file": ref.file_path,
            "line": ref.line_number,
            "language": ref.language,
        })

        if ref.file_path not in by_file:
            by_file[ref.file_path] = []
        if ref.flag_key not in by_file[ref.file_path]:
            by_file[ref.file_path].append(ref.flag_key)

        by_language[ref.language] = by_language.get(ref.language, 0) + 1

    return {
        "total_references": len(refs),
        "unique_flags": len(by_key),
        "files_scanned_with_refs": len(by_file),
        "by_language": by_language,
        "flags": {
            key: {
                "reference_count": len(locations),
                "locations": locations,
            }
            for key, locations in sorted(by_key.items())
        },
    }


def print_table(refs: list[FlagReference]) -> None:
    """Print results as a human-readable table."""
    if not refs:
        print("No flag references found.")
        return

    summary = summarize(refs)
    print(f"Found {summary['total_references']} references to {summary['unique_flags']} unique flag(s)\n")

    # Group by flag key
    by_key: dict[str, list[FlagReference]] = {}
    for ref in refs:
        by_key.setdefault(ref.flag_key, []).append(ref)

    for key in sorted(by_key.keys()):
        flag_refs = by_key[key]
        print(f"  {key} ({len(flag_refs)} reference(s))")
        for ref in flag_refs:
            print(f"    {ref.file_path}:{ref.line_number} [{ref.language}]")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Scan source code for Phase Flag feature flag key references."
    )
    parser.add_argument(
        "directory",
        help="Root directory to scan",
    )
    parser.add_argument(
        "--output", "-o",
        help="Output file path (default: stdout)",
        default=None,
    )
    parser.add_argument(
        "--format", "-f",
        help="Output format: json or table (default: json)",
        choices=["json", "table"],
        default="json",
    )
    parser.add_argument(
        "--extensions", "-e",
        help="Comma-separated file extensions to scan (e.g., .py,.js,.go)",
        default=None,
    )

    args = parser.parse_args()

    extensions = None
    if args.extensions:
        extensions = {e.strip() if e.startswith(".") else f".{e.strip()}" for e in args.extensions.split(",")}

    refs = scan_directory(args.directory, extensions)

    if args.format == "table":
        print_table(refs)
        return

    # JSON output
    result = {
        "scan_directory": os.path.abspath(args.directory),
        "summary": summarize(refs),
        "references": [asdict(ref) for ref in refs],
    }

    output_json = json.dumps(result, indent=2)

    if args.output:
        Path(args.output).write_text(output_json)
        print(f"Wrote {len(refs)} references to {args.output}", file=sys.stderr)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
