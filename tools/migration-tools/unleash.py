#!/usr/bin/env python3
"""Convert Unleash feature toggle export to Phase Flag import format.

Usage:
    python unleash.py --input unleash-export.json --output phaseflag-flags.json
"""

import argparse
import json
import sys
from pathlib import Path


def convert_unleash_type(toggle_type: str) -> str:
    """Map Unleash toggle type to Phase Flag classification."""
    mapping = {
        "release": "release",
        "experiment": "experiment",
        "operational": "ops_killswitch",
        "kill-switch": "ops_killswitch",
        "permission": "permission",
    }
    return mapping.get(toggle_type, "release")


def convert_constraint(constraint: dict) -> dict:
    """Convert an Unleash constraint to a Phase Flag condition."""
    context_name = constraint.get("contextName", "")
    operator = constraint.get("operator", "IN")
    values = constraint.get("values", [])
    value = constraint.get("value", "")
    inverted = constraint.get("inverted", False)

    # Map Unleash operators to Phase Flag
    op_map = {
        "IN": "one_of",
        "NOT_IN": "not_one_of",
        "STR_CONTAINS": "contains",
        "STR_STARTS_WITH": "matches_regex",
        "STR_ENDS_WITH": "matches_regex",
        "NUM_EQ": "is",
        "NUM_GT": "gt",
        "NUM_GTE": "gt",
        "NUM_LT": "lt",
        "NUM_LTE": "lt",
        "SEMVER_EQ": "is",
        "SEMVER_GT": "version_gt",
        "SEMVER_LT": "version_lt",
    }

    pf_op = op_map.get(operator, "is")

    # Handle special conversions
    if operator == "STR_STARTS_WITH":
        pf_value = f"^{values[0] if values else value}"
    elif operator == "STR_ENDS_WITH":
        pf_value = f"{values[0] if values else value}$"
    elif pf_op in ("one_of", "not_one_of"):
        pf_value = values if values else [value]
    elif values:
        pf_value = values[0]
    else:
        pf_value = value

    # Handle inversion
    if inverted:
        inversion_map = {
            "is": "is_not",
            "one_of": "not_one_of",
            "contains": "not_contains",
        }
        pf_op = inversion_map.get(pf_op, pf_op)

    return {
        "attribute": context_name,
        "operator": pf_op,
        "value": pf_value,
    }


def convert_strategy(strategy: dict, variations: list[dict], priority: int) -> dict:
    """Convert an Unleash strategy to a Phase Flag targeting rule."""
    name = strategy.get("name", "")
    parameters = strategy.get("parameters", {})
    constraints = strategy.get("constraints", [])

    conditions = [convert_constraint(c) for c in constraints]
    result: dict = {"priority": priority, "conditions": conditions}

    if name == "default":
        # Default strategy = always on, no special conditions
        pass

    elif name == "userWithId":
        user_ids = parameters.get("userIds", "")
        if user_ids:
            id_list = [uid.strip() for uid in user_ids.split(",") if uid.strip()]
            conditions.append({
                "attribute": "userId",
                "operator": "one_of",
                "value": id_list,
            })

    elif name in ("gradualRolloutUserId", "gradualRolloutSessionId", "gradualRolloutRandom"):
        percentage = int(parameters.get("percentage", 0))
        group_id = parameters.get("groupId", "")
        if percentage > 0 and variations:
            # Create percentage rollout
            on_weight = percentage
            off_weight = 100 - percentage
            rollout_vars = []
            if len(variations) >= 2:
                rollout_vars = [
                    {"variation_key": variations[0]["key"], "weight": on_weight},
                    {"variation_key": variations[1]["key"], "weight": off_weight},
                ]
            elif len(variations) == 1:
                rollout_vars = [{"variation_key": variations[0]["key"], "weight": 100}]
            result["percentage_rollout"] = {"variations": rollout_vars}
            return result

    elif name == "flexibleRollout":
        rollout = int(parameters.get("rollout", 0))
        stickiness = parameters.get("stickiness", "default")
        group_id = parameters.get("groupId", "")
        if rollout > 0 and variations:
            on_weight = rollout
            off_weight = 100 - rollout
            rollout_vars = []
            if len(variations) >= 2:
                rollout_vars = [
                    {"variation_key": variations[0]["key"], "weight": on_weight},
                    {"variation_key": variations[1]["key"], "weight": off_weight},
                ]
            elif len(variations) == 1:
                rollout_vars = [{"variation_key": variations[0]["key"], "weight": 100}]
            result["percentage_rollout"] = {"variations": rollout_vars}
            return result

    elif name == "remoteAddress":
        ips = parameters.get("IPs", "")
        if ips:
            ip_list = [ip.strip() for ip in ips.split(",") if ip.strip()]
            conditions.append({
                "attribute": "remoteAddress",
                "operator": "one_of",
                "value": ip_list,
            })

    elif name == "applicationHostname":
        hostnames = parameters.get("hostNames", "")
        if hostnames:
            host_list = [h.strip() for h in hostnames.split(",") if h.strip()]
            conditions.append({
                "attribute": "appName",
                "operator": "one_of",
                "value": host_list,
            })

    # Default: serve first variation
    if "percentage_rollout" not in result and variations:
        result["variation_key"] = variations[0]["key"]

    return result


def convert_variants(variants: list[dict]) -> list[dict]:
    """Convert Unleash variants to Phase Flag variations."""
    if not variants:
        return [
            {"key": "on", "name": "Enabled", "value": True},
            {"key": "off", "name": "Disabled", "value": False},
        ]

    variations = []
    for variant in variants:
        name = variant.get("name", "")
        weight = variant.get("weight", 0)
        payload = variant.get("payload", {})

        value = payload.get("value", name) if payload else name

        # Try to parse JSON payload values
        if payload and payload.get("type") == "json":
            try:
                value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                pass

        variations.append({
            "key": name.lower().replace(" ", "-"),
            "name": name,
            "value": value,
            "weight": weight // 10 if weight else 0,  # Unleash uses per-mille
        })

    return variations


def convert_feature(feature: dict) -> dict:
    """Convert a single Unleash feature toggle to Phase Flag format."""
    name = feature.get("name", "")
    description = feature.get("description", "")
    toggle_type = feature.get("type", "release")
    enabled = feature.get("enabled", False)
    stale = feature.get("stale", False)
    impression_data = feature.get("impressionData", False)

    # Convert variants/variations
    variants = feature.get("variants", [])
    variations = convert_variants(variants)

    # Determine flag type
    if not variants:
        flag_type = "boolean"
    else:
        sample_values = [v.get("value") for v in variations]
        if all(isinstance(v, bool) for v in sample_values):
            flag_type = "boolean"
        elif all(isinstance(v, (int, float)) for v in sample_values):
            flag_type = "number"
        elif all(isinstance(v, str) for v in sample_values):
            flag_type = "string"
        else:
            flag_type = "json"

    # Convert strategies to targeting rules
    strategies = feature.get("strategies", [])
    targeting_rules = []
    for i, strategy in enumerate(strategies):
        rule = convert_strategy(strategy, variations, priority=i + 1)
        targeting_rules.append(rule)

    # Tags
    tags = []
    for tag in feature.get("tags", []):
        tag_value = tag.get("value", "")
        if tag_value:
            tags.append(tag_value)

    # Default variation
    default_variation = variations[-1]["key"] if variations else "off"

    pf_flag = {
        "key": name,
        "name": name,
        "description": description,
        "flag_type": flag_type,
        "status": "active" if enabled else "inactive",
        "flag_classification": convert_unleash_type(toggle_type),
        "is_permanent": toggle_type in ("operational", "kill-switch"),
        "tags": tags,
        "variations": variations,
        "targeting_rules": targeting_rules,
        "default_variation": default_variation,
    }

    if stale:
        pf_flag["lifecycle_stage"] = "stale"

    return pf_flag


def convert_export(data: dict | list) -> list[dict]:
    """Convert an Unleash export to Phase Flag format."""
    if isinstance(data, list):
        features = data
    elif isinstance(data, dict):
        features = data.get("features", data.get("toggles", []))
        if not features and "name" in data:
            features = [data]
    else:
        features = []

    return [convert_feature(f) for f in features if isinstance(f, dict)]


def main():
    parser = argparse.ArgumentParser(
        description="Convert Unleash feature toggle export to Phase Flag format."
    )
    parser.add_argument("--input", "-i", required=True, help="Unleash export JSON file")
    parser.add_argument("--output", "-o", required=True, help="Phase Flag import JSON file")
    parser.add_argument("--environment", "-e", default="development", help="Target environment")

    args = parser.parse_args()

    input_data = json.loads(Path(args.input).read_text())
    converted = convert_export(input_data)

    for flag in converted:
        flag["environment"] = args.environment

    output = {
        "version": "1.0",
        "source": "unleash",
        "environment": args.environment,
        "flags": converted,
    }

    Path(args.output).write_text(json.dumps(output, indent=2))
    print(f"Converted {len(converted)} toggles from Unleash to Phase Flag format.")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
