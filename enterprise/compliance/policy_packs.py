"""Pre-built compliance policy packs for regulated industries.

Each pack is a list of rule definition dicts compatible with the
CompliancePolicy.rule_definition schema understood by service._evaluate_rule().
"""

from __future__ import annotations

from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# GDPR Pack — 8 rules
# ---------------------------------------------------------------------------

GDPR_PACK: List[Dict[str, Any]] = [
    {
        "type": "require_audit_log",
        "description": "All flag changes must be captured in the immutable audit log.",
        "severity": "high",
    },
    {
        "type": "require_approval",
        "description": "Production flag changes require explicit approval before activation.",
        "severity": "high",
    },
    {
        "type": "max_flag_age_days",
        "max_days": 365,
        "description": "Feature flags must not remain active for more than 365 days without review.",
        "severity": "medium",
    },
    {
        "type": "pii_restriction",
        "restricted_attributes": ["ssn", "dob", "credit_card", "passport", "national_id", "ip_address"],
        "description": "PII attributes are prohibited in flag targeting rules.",
        "severity": "critical",
    },
    {
        "type": "require_description",
        "description": "Every flag must carry a human-readable description of its purpose.",
        "severity": "low",
    },
    {
        "type": "require_owner",
        "description": "Every flag must have a named owner accountable for its lifecycle.",
        "severity": "medium",
    },
    {
        "type": "data_retention_90_days",
        "retention_days": 90,
        "data_type": "evaluation_logs",
        "description": "Evaluation logs must be retained for exactly 90 days then deleted.",
        "severity": "high",
    },
    {
        "type": "right_to_erasure",
        "description": "Flags that store user identifiers must support erasure of linked data on request.",
        "severity": "critical",
    },
]

# ---------------------------------------------------------------------------
# HIPAA Pack — 6 rules
# ---------------------------------------------------------------------------

HIPAA_PACK: List[Dict[str, Any]] = [
    {
        "type": "require_audit_log",
        "description": "PHI-adjacent flag changes must be fully audit-logged.",
        "severity": "critical",
    },
    {
        "type": "require_approval",
        "description": "Any change affecting clinical or PHI-adjacent flags requires approval.",
        "severity": "critical",
    },
    {
        "type": "require_owner",
        "description": "All flags must have a HIPAA-designated owner.",
        "severity": "high",
    },
    {
        "type": "pii_restriction",
        "restricted_attributes": [
            "ssn", "dob", "medical_record_number", "health_plan_id",
            "account_number", "certificate_number", "diagnosis_code",
        ],
        "description": "Protected Health Information (PHI) identifiers must not appear in targeting.",
        "severity": "critical",
    },
    {
        "type": "access_review_required",
        "review_interval_days": 90,
        "description": "Access to production flags must be reviewed quarterly.",
        "severity": "high",
    },
    {
        "type": "encryption_required",
        "description": "Flags controlling PHI-processing features must enforce data encryption.",
        "severity": "critical",
    },
]

# ---------------------------------------------------------------------------
# SOC 2 Pack — 10 rules
# ---------------------------------------------------------------------------

SOC2_PACK: List[Dict[str, Any]] = [
    {
        "type": "require_audit_log",
        "description": "All configuration changes must be logged for SOC 2 CC7.2 evidence.",
        "severity": "high",
    },
    {
        "type": "require_approval",
        "description": "Production flag changes require an approval workflow (CC6.1).",
        "severity": "high",
    },
    {
        "type": "change_window",
        "allowed_hours_utc": [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
        "description": "Flag changes are only permitted during approved change windows.",
        "severity": "medium",
    },
    {
        "type": "two_person_rule",
        "description": "High-risk flag changes require review and approval by a second person (CC6.3).",
        "severity": "high",
    },
    {
        "type": "require_description",
        "description": "All flags must be documented to satisfy change management requirements.",
        "severity": "medium",
    },
    {
        "type": "require_owner",
        "description": "Each flag must have a designated owner for accountability tracking.",
        "severity": "medium",
    },
    {
        "type": "max_rollout_step",
        "max_step": 25,
        "description": "Rollout increments must not exceed 25% to limit blast radius (CC7.1).",
        "severity": "medium",
    },
    {
        "type": "freeze_window_holidays",
        "freeze_periods": [
            {"name": "year_end", "start": "--12-20", "end": "--01-03"},
            {"name": "black_friday", "start": "--11-24", "end": "--11-28"},
        ],
        "description": "No production flag changes during designated freeze windows.",
        "severity": "high",
    },
    {
        "type": "access_review",
        "review_interval_days": 90,
        "description": "User access to flag management must be reviewed quarterly (CC6.2).",
        "severity": "high",
    },
    {
        "type": "incident_response",
        "description": "Flags involved in production incidents must trigger an incident response process.",
        "severity": "critical",
    },
]

# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

POLICY_PACKS: Dict[str, Dict[str, Any]] = {
    "gdpr": {
        "name": "GDPR",
        "slug": "gdpr",
        "description": "General Data Protection Regulation compliance pack (EU 2016/679) — 8 rules.",
        "framework": "gdpr",
        "rule_count": len(GDPR_PACK),
        "rules": GDPR_PACK,
    },
    "hipaa": {
        "name": "HIPAA",
        "slug": "hipaa",
        "description": "Health Insurance Portability and Accountability Act compliance pack — 6 rules.",
        "framework": "hipaa",
        "rule_count": len(HIPAA_PACK),
        "rules": HIPAA_PACK,
    },
    "soc2": {
        "name": "SOC 2",
        "slug": "soc2",
        "description": "SOC 2 Type II compliance pack (Trust Service Criteria) — 10 rules.",
        "framework": "soc2",
        "rule_count": len(SOC2_PACK),
        "rules": SOC2_PACK,
    },
}


def get_pack(name: str) -> Dict[str, Any] | None:
    """Return a policy pack by slug name (case-insensitive), or None."""
    return POLICY_PACKS.get(name.lower())


def list_packs() -> List[Dict[str, Any]]:
    """Return metadata for all available policy packs (without the rules list)."""
    return [
        {
            "slug": pack["slug"],
            "name": pack["name"],
            "description": pack["description"],
            "framework": pack["framework"],
            "rule_count": pack["rule_count"],
        }
        for pack in POLICY_PACKS.values()
    ]
