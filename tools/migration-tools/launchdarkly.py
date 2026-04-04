#!/usr/bin/env python3
"""Convert LaunchDarkly flag export JSON to Phase Flag import format.

Usage:
    python launchdarkly.py --input ld-export.json --output phaseflag-flags.json
"""

import argparse
import json
import sys
from pathlib import Path


def convert_ld_operator(op: str) -> str:
    """Map a LaunchDarkly operator to a Phase Flag operator."""
    mapping = {
        "in": "one_of",
        "endsWith": "matches_regex",
        "startsWith": "matches_regex",
        "matches": "matches_regex",
        "contains": "contains",
        "lessThan": "lt",
        "lessThanOrEqual": "lt",
        "greaterThan": "gt",
        "greaterThanOrEqual": "gt",
        "semVerEqual": "is",
        "semVerLessThan": "version_lt",
        "semVerGreaterThan": "version_gt",
    }
    return mapping.get(op, "is")


def convert_ld_value_for_regex(op: str, values: list) -> str:
    """Convert LaunchDarkly startsWith/endsWith to a regex pattern."""
    if not values:
        return ".*"
    val = str(values[0])
    if op == "startsWith":
        return f"^{val}"
    if op == "endsWith":
        return f"{val}$"
    return val


def convert_variation(variation: dict, index: int) -> dict:
    """Convert a LaunchDarkly variation to Phase Flag format."""
    value = variation.get("value")
    name = variation.get("name") or variation.get("description") or f"Variation {index}"

    # Generate a key from the name or value
    if isinstance(value, bool):
        key = "on" if value else "off"
    elif isinstance(value, str):
        key = value.lower().replace(" ", "-")[:50]
    else:
        key = f"variation-{index}"

    return {
        "key": key,
        "name": name,
        "value": value,
    }


def convert_clause(clause: dict) -> dict:
    """Convert a LaunchDarkly targeting clause to a Phase Flag condition."""
    attribute = clause.get("attribute", "")
    op = clause.get("op", "in")
    values = clause.get("values", [])
    negate = clause.get("negate", False)

    pf_op = convert_ld_operator(op)

    # Handle negation
    negation_map = {
        "is": "is_not",
        "one_of": "not_one_of",
        "contains": "not_contains",
    }
    if negate and pf_op in negation_map:
        pf_op = negation_map[pf_op]

    # Handle special operators
    if op in ("startsWith", "endsWith"):
        value = convert_ld_value_for_regex(op, values)
    elif pf_op == "one_of" or pf_op == "not_one_of":
        value = values
    elif len(values) == 1:
        value = values[0]
    else:
        value = values

    return {
        "attribute": attribute,
        "operator": pf_op,
        "value": value,
    }


def convert_rule(rule: dict, variations: list[dict], priority: int) -> dict:
    """Convert a LaunchDarkly targeting rule to a Phase Flag targeting rule."""
    conditions = []
    for clause in rule.get("clauses", []):
        conditions.append(convert_clause(clause))

    result: dict = {
        "priority": priority,
        "conditions": conditions,
    }

    # Handle variation or rollout
    variation_idx = rule.get("variation")
    rollout = rule.get("rollout")

    if variation_idx is not None and variation_idx < len(variations):
        result["variation_key"] = variations[variation_idx]["key"]
    elif rollout:
        weighted_variations = rollout.get("variations", [])
        pf_rollout = []
        for wv in weighted_variations:
            idx = wv.get("variation", 0)
            weight = wv.get("weight", 0) // 1000  # LD uses thousandths
            if idx < len(variations):
                pf_rollout.append({
                    "variation_key": variations[idx]["key"],
                    "weight": weight,
                })
        result["percentage_rollout"] = {"variations": pf_rollout}

    return result


def convert_individual_targets(targets: list[dict], variations: list[dict]) -> list[dict]:
    """Convert LaunchDarkly individual user targets to targeting rules."""
    rules = []
    for target in targets:
        variation_idx = target.get("variation", 0)
        values = target.get("values", [])
        if not values or variation_idx >= len(variations):
            continue

        rules.append({
            "priority": 0,  # Individual targets have highest priority
            "conditions": [
                {
                    "attribute": "key",  # LD uses "key" as user identifier
                    "operator": "one_of",
                    "value": values,
                },
            ],
            "variation_key": variations[variation_idx]["key"],
        })

    return rules


def detect_flag_type(variations: list[dict]) -> str:
    """Detect the flag type from variation values."""
    if not variations:
        return "boolean"

    values = [v.get("value") for v in variations]

    if all(isinstance(v, bool) for v in values):
        return "boolean"
    if all(isinstance(v, (int, float)) for v in values):
        return "number"
    if all(isinstance(v, str) for v in values):
        return "string"
    return "json"


def convert_flag(ld_flag: dict) -> dict:
    """Convert a single LaunchDarkly flag to Phase Flag format."""
    key = ld_flag.get("key", "")
    name = ld_flag.get("name", key)
    description = ld_flag.get("description", "")
    tags = ld_flag.get("tags", [])

    # Convert variations
    ld_variations = ld_flag.get("variations", [])
    variations = [convert_variation(v, i) for i, v in enumerate(ld_variations)]

    flag_type = detect_flag_type(ld_variations)

    # Default variation
    fallthrough = ld_flag.get("fallthrough", {})
    off_variation = ld_flag.get("offVariation", 0)
    default_variation = variations[off_variation]["key"] if off_variation < len(variations) else ""

    # Convert targeting rules
    targeting_rules = []

    # Individual targets first (highest priority)
    targets = ld_flag.get("targets", [])
    targeting_rules.extend(convert_individual_targets(targets, variations))

    # Then rule-based targeting
    rules = ld_flag.get("rules", [])
    for i, rule in enumerate(rules):
        converted = convert_rule(rule, variations, priority=i + 1)
        targeting_rules.append(converted)

    # Fallthrough (lowest priority)
    if fallthrough:
        ft_variation = fallthrough.get("variation")
        ft_rollout = fallthrough.get("rollout")

        if ft_variation is not None and ft_variation < len(variations):
            targeting_rules.append({
                "priority": len(targeting_rules) + 1,
                "conditions": [],
                "variation_key": variations[ft_variation]["key"],
            })
        elif ft_rollout:
            weighted = ft_rollout.get("variations", [])
            pf_rollout = []
            for wv in weighted:
                idx = wv.get("variation", 0)
                weight = wv.get("weight", 0) // 1000
                if idx < len(variations):
                    pf_rollout.append({
                        "variation_key": variations[idx]["key"],
                        "weight": weight,
                    })
            targeting_rules.append({
                "priority": len(targeting_rules) + 1,
                "conditions": [],
                "percentage_rollout": {"variations": pf_rollout},
            })

    # Determine status
    on = ld_flag.get("on", False)
    status = "active" if on else "inactive"

    # Flag classification
    kind = ld_flag.get("kind", "boolean")
    temporary = ld_flag.get("temporary", True)

    pf_flag = {
        "key": key,
        "name": name,
        "description": description,
        "flag_type": flag_type,
        "status": status,
        "tags": tags,
        "variations": variations,
        "targeting_rules": targeting_rules,
        "default_variation": default_variation,
        "is_permanent": not temporary,
        "flag_classification": "release",
    }

    # Add optional metadata
    maintainer = ld_flag.get("_maintainer", {})
    if maintainer:
        pf_flag["owner"] = maintainer.get("email", "")

    return pf_flag


def convert_export(ld_data: dict | list) -> list[dict]:
    """Convert a LaunchDarkly export (single flag or array) to Phase Flag format."""
    if isinstance(ld_data, list):
        flags = ld_data
    elif isinstance(ld_data, dict):
        if "items" in ld_data:
            flags = ld_data["items"]
        elif "key" in ld_data:
            flags = [ld_data]
        else:
            flags = list(ld_data.values())
    else:
        flags = []

    return [convert_flag(f) for f in flags if isinstance(f, dict)]


def main():
    parser = argparse.ArgumentParser(
        description="Convert LaunchDarkly flag export to Phase Flag format."
    )
    parser.add_argument("--input", "-i", required=True, help="LaunchDarkly export JSON file")
    parser.add_argument("--output", "-o", required=True, help="Phase Flag import JSON file")
    parser.add_argument("--environment", "-e", default="development", help="Target environment")

    args = parser.parse_args()

    input_data = json.loads(Path(args.input).read_text())
    converted = convert_export(input_data)

    for flag in converted:
        flag["environment"] = args.environment

    output = {
        "version": "1.0",
        "source": "launchdarkly",
        "environment": args.environment,
        "flags": converted,
    }

    Path(args.output).write_text(json.dumps(output, indent=2))
    print(f"Converted {len(converted)} flags from LaunchDarkly to Phase Flag format.")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
