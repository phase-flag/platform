#!/usr/bin/env python3
"""Convert Flagsmith feature export to Phase Flag import format.

Usage:
    python flagsmith.py --input flagsmith-export.json --output phaseflag-flags.json
"""

import argparse
import json
from pathlib import Path


def convert_feature(feature: dict) -> dict:
    """Convert a single Flagsmith feature to Phase Flag format."""
    name = feature.get("name", "")
    description = feature.get("description", "")
    feature_type = feature.get("type", "STANDARD")
    default_enabled = feature.get("default_enabled", False)
    initial_value = feature.get("initial_value", "")
    is_archived = feature.get("is_archived", False)

    # Determine flag type from initial_value
    flag_type = "boolean"
    parsed_value = initial_value

    if initial_value:
        if initial_value.lower() in ("true", "false"):
            flag_type = "boolean"
            parsed_value = initial_value.lower() == "true"
        else:
            try:
                parsed_value = int(initial_value)
                flag_type = "number"
            except ValueError:
                try:
                    parsed_value = float(initial_value)
                    flag_type = "number"
                except ValueError:
                    try:
                        parsed_value = json.loads(initial_value)
                        flag_type = "json"
                    except (json.JSONDecodeError, TypeError):
                        flag_type = "string"
                        parsed_value = initial_value

    # Build variations based on flag type
    if flag_type == "boolean":
        variations = [
            {"key": "on", "name": "Enabled", "value": True},
            {"key": "off", "name": "Disabled", "value": False},
        ]
        default_variation = "on" if default_enabled else "off"
    else:
        variations = [
            {"key": "default", "name": "Default", "value": parsed_value},
        ]
        if flag_type == "string":
            variations.append({"key": "empty", "name": "Empty", "value": ""})
        elif flag_type == "number":
            variations.append({"key": "zero", "name": "Zero", "value": 0})
        else:
            variations.append({"key": "null", "name": "Null", "value": None})
        default_variation = "default"

    # Convert multivariate options if present
    multivariate_options = feature.get("multivariate_options", [])
    if multivariate_options:
        variations = []
        for opt in multivariate_options:
            opt_value = opt.get("string_value", opt.get("value", ""))
            # Try to parse the value
            try:
                opt_value = json.loads(opt_value)
            except (json.JSONDecodeError, TypeError):
                pass

            variations.append({
                "key": f"variant-{opt.get('id', len(variations))}",
                "name": opt.get("string_value", str(opt_value))[:50],
                "value": opt_value,
                "weight": opt.get("default_percentage_allocation", 0),
            })

        if variations:
            default_variation = variations[0]["key"]

    # Convert segment overrides to targeting rules
    targeting_rules = []
    segment_overrides = feature.get("segment_overrides", [])
    for i, override in enumerate(segment_overrides):
        segment = override.get("segment", {})
        segment_name = segment.get("name", f"segment-{i}")
        rules = segment.get("rules", [])
        enabled = override.get("enabled", True)
        value = override.get("value", "")
        feature_segment_value = override.get("feature_segment_value", {})

        conditions = []
        for rule in rules:
            rule_conditions = rule.get("conditions", [])
            for cond in rule_conditions:
                prop = cond.get("property", "")
                operator = cond.get("operator", "EQUAL")
                cond_value = cond.get("value", "")

                op_map = {
                    "EQUAL": "is",
                    "NOT_EQUAL": "is_not",
                    "CONTAINS": "contains",
                    "NOT_CONTAINS": "not_contains",
                    "REGEX": "matches_regex",
                    "GREATER_THAN": "gt",
                    "GREATER_THAN_INCLUSIVE": "gt",
                    "LESS_THAN": "lt",
                    "LESS_THAN_INCLUSIVE": "lt",
                    "IN": "one_of",
                    "IS_SET": "is_not",
                    "IS_NOT_SET": "is",
                    "PERCENTAGE_SPLIT": "is",
                }

                pf_op = op_map.get(operator, "is")

                if pf_op in ("one_of", "not_one_of") and isinstance(cond_value, str):
                    cond_value = [v.strip() for v in cond_value.split(",")]

                conditions.append({
                    "attribute": prop,
                    "operator": pf_op,
                    "value": cond_value,
                })

        if conditions:
            rule_result: dict = {
                "priority": i + 1,
                "conditions": conditions,
            }
            if variations:
                rule_result["variation_key"] = variations[0]["key"]
            targeting_rules.append(rule_result)

    # Handle identity overrides
    identity_overrides = feature.get("identity_overrides", [])
    for override in identity_overrides:
        identity = override.get("identity", {})
        identifier = identity.get("identifier", "")
        if identifier:
            targeting_rules.insert(0, {
                "priority": 0,
                "conditions": [
                    {"attribute": "user_id", "operator": "is", "value": identifier},
                ],
                "variation_key": variations[0]["key"] if variations else "on",
            })

    # Map feature type to classification
    classification_map = {
        "STANDARD": "release",
        "MULTIVARIATE": "release",
    }
    classification = classification_map.get(feature_type, "release")

    # Determine status
    if is_archived:
        status = "archived"
    elif default_enabled:
        status = "active"
    else:
        status = "inactive"

    # Tags
    tags = []
    for tag in feature.get("tags", []):
        tag_label = tag.get("label", "")
        if tag_label:
            tags.append(tag_label)

    return {
        "key": name.lower().replace(" ", "-"),
        "name": name,
        "description": description,
        "flag_type": flag_type,
        "status": status,
        "flag_classification": classification,
        "is_permanent": False,
        "tags": tags,
        "variations": variations,
        "targeting_rules": targeting_rules,
        "default_variation": default_variation,
    }


def convert_export(data: dict | list) -> list[dict]:
    """Convert a Flagsmith export to Phase Flag format."""
    if isinstance(data, list):
        features = data
    elif isinstance(data, dict):
        features = data.get("results", data.get("features", []))
        if not features and "name" in data:
            features = [data]
    else:
        features = []

    return [convert_feature(f) for f in features if isinstance(f, dict)]


def main():
    parser = argparse.ArgumentParser(
        description="Convert Flagsmith feature export to Phase Flag format."
    )
    parser.add_argument("--input", "-i", required=True, help="Flagsmith export JSON file")
    parser.add_argument("--output", "-o", required=True, help="Phase Flag import JSON file")
    parser.add_argument("--environment", "-e", default="development", help="Target environment")

    args = parser.parse_args()

    input_data = json.loads(Path(args.input).read_text())
    converted = convert_export(input_data)

    for flag in converted:
        flag["environment"] = args.environment

    output = {
        "version": "1.0",
        "source": "flagsmith",
        "environment": args.environment,
        "flags": converted,
    }

    Path(args.output).write_text(json.dumps(output, indent=2))
    print(f"Converted {len(converted)} features from Flagsmith to Phase Flag format.")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
