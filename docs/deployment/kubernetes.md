# Kubernetes Deployment Guide

## Prerequisites

- Kubernetes 1.25+
- Helm 3.12+
- A PostgreSQL database (managed service recommended)
- kubectl configured for your cluster

## Installation

### 1. Add the Helm Repository

```bash
helm repo add phaseflag https://charts.phaseflag.dev
helm repo update
```

Or install from local chart:

```bash
cd phaseflag/infra/k8s/helm
```

### 2. Create Namespace

```bash
kubectl create namespace phaseflag
```

### 3. Create Secrets

```bash
kubectl create secret generic phaseflag-secrets \
  --namespace phaseflag \
  --from-literal=database-url="postgresql+asyncpg://user:pass@host:5432/phaseflag" \
  --from-literal=jwt-secret="$(openssl rand -base64 32)" \
  --from-literal=api-secret="$(openssl rand -base64 32)"
```

### 4. Install the Chart

```bash
helm install phaseflag phaseflag/phaseflag \
  --namespace phaseflag \
  --set secrets.existingSecret=phaseflag-secrets \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=phaseflag.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

### 5. Verify

```bash
kubectl get pods -n phaseflag
kubectl get svc -n phaseflag

# Port-forward for testing
kubectl port-forward -n phaseflag svc/phaseflag-api 8000:80
curl http://localhost:8000/health
```

## Configuration

### Custom values.yaml

```yaml
replicaCount: 3

api:
  logLevel: INFO
  deploymentMode: oss

secrets:
  existingSecret: phaseflag-secrets

relay:
  enabled: true
  replicaCount: 2
  pollInterval: "15s"
  cacheTTL: "2m"

dashboard:
  enabled: true

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: phaseflag.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: phaseflag-tls
      hosts:
        - phaseflag.example.com

resources:
  limits:
    cpu: "2"
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

Install with custom values:

```bash
helm install phaseflag phaseflag/phaseflag \
  --namespace phaseflag \
  -f values-production.yaml
```

## Upgrading

```bash
helm repo update
helm upgrade phaseflag phaseflag/phaseflag \
  --namespace phaseflag \
  -f values-production.yaml
```

## Monitoring

### Health Checks

The API exposes:
- `/health` -- liveness probe (is the process alive?)
- `/ready` -- readiness probe (can it serve traffic?)

### Metrics

When observability is enabled, Prometheus metrics are available at `/metrics`.

### Pod Disruption Budget

The chart creates a PDB ensuring at least 1 API pod and 1 relay pod remain available during disruptions.

## Uninstalling

```bash
helm uninstall phaseflag --namespace phaseflag
kubectl delete namespace phaseflag
```
