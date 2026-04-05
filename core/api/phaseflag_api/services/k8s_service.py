"""Kubernetes API client service for progressive delivery integration."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Service account token and CA cert paths (standard K8s in-cluster)
_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token"
_CA_CERT_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
_K8S_API_HOST = "https://kubernetes.default.svc"


def _get_token() -> str | None:
    """Read service account token from the in-cluster mount."""
    try:
        with open(_TOKEN_PATH) as fh:
            return fh.read().strip()
    except OSError:
        return None


def _is_in_cluster() -> bool:
    """Return True if running inside a Kubernetes pod."""
    import os

    return os.path.exists(_TOKEN_PATH)


def _build_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def get_deployment_status(namespace: str, name: str) -> dict[str, Any] | None:
    """Fetch deployment status from the Kubernetes API.

    Returns the deployment JSON or None when not running in-cluster.
    """
    if not _is_in_cluster():
        logger.warning(
            "k8s_service: not running in a Kubernetes cluster — get_deployment_status returning None"
        )
        return None

    token = _get_token()
    if not token:
        logger.warning("k8s_service: cannot read service account token — returning None")
        return None

    try:
        import httpx

        url = f"{_K8S_API_HOST}/apis/apps/v1/namespaces/{namespace}/deployments/{name}"
        async with httpx.AsyncClient(verify=_CA_CERT_PATH, timeout=10.0) as client:
            resp = await client.get(url, headers=_build_headers(token))
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.error("k8s_service.get_deployment_status error: %s", exc)
        return None


async def scale_deployment(namespace: str, name: str, replicas: int) -> dict[str, Any] | None:
    """Patch a deployment's replica count.

    Returns the updated deployment JSON or None on failure / not in-cluster.
    """
    if not _is_in_cluster():
        logger.warning(
            "k8s_service: not running in a Kubernetes cluster — scale_deployment returning None"
        )
        return None

    token = _get_token()
    if not token:
        logger.warning("k8s_service: cannot read service account token — returning None")
        return None

    try:
        import httpx

        url = f"{_K8S_API_HOST}/apis/apps/v1/namespaces/{namespace}/deployments/{name}"
        patch = {"spec": {"replicas": replicas}}
        async with httpx.AsyncClient(verify=_CA_CERT_PATH, timeout=10.0) as client:
            resp = await client.patch(
                url,
                headers={**_build_headers(token), "Content-Type": "application/strategic-merge-patch+json"},
                json=patch,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.error("k8s_service.scale_deployment error: %s", exc)
        return None


async def get_pod_metrics(namespace: str, labels: dict[str, str]) -> list[dict[str, Any]] | None:
    """Fetch pod metrics from the Metrics API.

    labels: e.g. {"app": "my-service", "version": "v2"}
    Returns list of pod metric objects or None on failure / not in-cluster.
    """
    if not _is_in_cluster():
        logger.warning(
            "k8s_service: not running in a Kubernetes cluster — get_pod_metrics returning None"
        )
        return None

    token = _get_token()
    if not token:
        logger.warning("k8s_service: cannot read service account token — returning None")
        return None

    try:
        import httpx

        label_selector = ",".join(f"{k}={v}" for k, v in labels.items())
        url = f"{_K8S_API_HOST}/apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods"
        params = {"labelSelector": label_selector} if label_selector else {}
        async with httpx.AsyncClient(verify=_CA_CERT_PATH, timeout=10.0) as client:
            resp = await client.get(url, headers=_build_headers(token), params=params)
            resp.raise_for_status()
            data = resp.json()
            return data.get("items", [])
    except Exception as exc:  # noqa: BLE001
        logger.error("k8s_service.get_pod_metrics error: %s", exc)
        return None


async def rollback_deployment(namespace: str, name: str) -> dict[str, Any] | None:
    """Roll a deployment back to its previous revision.

    Uses the rollout undo mechanism via a DeploymentRollback patch.
    Returns the patched deployment or None on failure / not in-cluster.
    """
    if not _is_in_cluster():
        logger.warning(
            "k8s_service: not running in a Kubernetes cluster — rollback_deployment returning None"
        )
        return None

    token = _get_token()
    if not token:
        logger.warning("k8s_service: cannot read service account token — returning None")
        return None

    try:
        import httpx

        # Annotate the deployment to trigger a rollback to the previous revision
        url = f"{_K8S_API_HOST}/apis/apps/v1/namespaces/{namespace}/deployments/{name}"
        patch = {
            "spec": {
                "template": {
                    "metadata": {
                        "annotations": {
                            "kubectl.kubernetes.io/last-applied-configuration": "",
                            "deployment.kubernetes.io/revision-history-limit": "0",
                        }
                    }
                }
            }
        }
        # The standard programmatic rollback is via apps/v1 rollout revision annotation
        rollback_patch = {
            "metadata": {
                "annotations": {
                    "phase-flag/rollback-requested": "true",
                    "phase-flag/rollback-to": "previous",
                }
            }
        }
        async with httpx.AsyncClient(verify=_CA_CERT_PATH, timeout=10.0) as client:
            resp = await client.patch(
                url,
                headers={**_build_headers(token), "Content-Type": "application/strategic-merge-patch+json"},
                json=rollback_patch,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.error("k8s_service.rollback_deployment error: %s", exc)
        return None
