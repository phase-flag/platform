---
title: "Kubernetes / Helm"
description: "Deploy Phase Flag to a Kubernetes cluster using the official Helm chart."
---

## Prerequisites

- A Kubernetes cluster (1.26+) — e.g., DigitalOcean DOKS, AWS EKS, GKE, or self-managed
- [Helm 3](https://helm.sh/docs/intro/install/) installed locally
- `kubectl` configured to point at your cluster
- A PostgreSQL database accessible from the cluster (or enable the bundled chart)
- A container registry pull secret if using a private registry

---

## 1. Clone the Repository

The Helm chart lives in the repo at `infra/k8s/helm/phaseflag/`:

```bash
git clone https://github.com/phaseflag/phaseflag.git
cd phaseflag
```

---

## 2. Create a Namespace

```bash
kubectl create namespace phaseflag
```

---

## 3. Create Secrets

```bash
kubectl create secret generic phaseflag-secrets \
  --namespace phaseflag \
  --from-literal=jwt-secret=$(openssl rand -hex 32) \
  --from-literal=api-secret=$(openssl rand -hex 32) \
  --from-literal=database-url="postgresql+asyncpg://phaseflag:PASSWORD@postgres-host:5432/phaseflag"
```

---

## 4. Configure values.yaml

Create a `my-values.yaml` file to override chart defaults:

```yaml
# my-values.yaml

image:
  repository: ghcr.io/phaseflag/api
  tag: "1.0.0"          # pin to a specific release tag
  pullPolicy: IfNotPresent

replicaCount: 2

api:
  deploymentMode: saas   # "oss", "saas", or "enterprise"
  existingSecret: phaseflag-secrets   # created above
  env:
    PHASEFLAG_LOG_LEVEL: INFO
    PHASEFLAG_CORS_ORIGINS: "https://app.yourdomain.com"

postgresql:
  enabled: false          # set to true to deploy bundled PostgreSQL (not for production)
  # If enabled: false, set externalDatabaseUrl in secret above

dashboard:
  enabled: true
  image:
    repository: ghcr.io/phaseflag/dashboard
    tag: "1.0.0"

relay:
  enabled: true
  replicaCount: 3
  image:
    repository: ghcr.io/phaseflag/relay
    tag: "1.0.0"

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: api.yourdomain.com
      paths:
        - path: /
          service: api
    - host: app.yourdomain.com
      paths:
        - path: /
          service: dashboard
    - host: relay.yourdomain.com
      paths:
        - path: /
          service: relay
  tls:
    - secretName: phaseflag-tls
      hosts:
        - api.yourdomain.com
        - app.yourdomain.com
        - relay.yourdomain.com

resources:
  api:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 512Mi
  relay:
    requests:
      cpu: 100m
      memory: 64Mi
    limits:
      cpu: 500m
      memory: 128Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

---

## 5. Install the Chart

```bash
helm install phaseflag ./infra/k8s/helm/phaseflag \
  --namespace phaseflag \
  --values my-values.yaml
```

### Verify the deployment

```bash
kubectl get pods -n phaseflag
kubectl get services -n phaseflag
kubectl get ingress -n phaseflag
```

Expected pods:
```
NAME                                READY   STATUS    RESTARTS
phaseflag-api-7d9f8b6c-x4n2p       1/1     Running   0
phaseflag-api-7d9f8b6c-k8m3q       1/1     Running   0
phaseflag-dashboard-6c8f7d-p9x1r   1/1     Running   0
phaseflag-relay-5b9d8c-q2w3e       1/1     Running   0
phaseflag-relay-5b9d8c-r4t5y       1/1     Running   0
phaseflag-relay-5b9d8c-u6i7o       1/1     Running   0
```

---

## 6. Run Database Migrations

```bash
kubectl exec -n phaseflag \
  $(kubectl get pod -n phaseflag -l app=phaseflag-api -o jsonpath='{.items[0].metadata.name}') \
  -- alembic upgrade head
```

---

## 7. Upgrade an Existing Release

```bash
helm upgrade phaseflag ./infra/k8s/helm/phaseflag \
  --namespace phaseflag \
  --values my-values.yaml
```

---

## 8. Horizontal Pod Autoscaling

The chart deploys an HPA resource automatically when `autoscaling.enabled: true`. View its status:

```bash
kubectl get hpa -n phaseflag
kubectl describe hpa phaseflag-api -n phaseflag
```

---

## Bundled PostgreSQL (Development Only)

For development or staging clusters, you can deploy a bundled PostgreSQL instance:

```yaml
# my-values.yaml (dev only)
postgresql:
  enabled: true
  auth:
    username: phaseflag
    password: phaseflag
    database: phaseflag
  persistence:
    size: 10Gi
```

<Warning>
  Do not use the bundled PostgreSQL chart in production. Use a managed database (RDS, Cloud SQL, DigitalOcean Managed Postgres) with automated backups.
</Warning>

---

## Key Chart Values Reference

| Value | Default | Description |
|-------|---------|-------------|
| `image.tag` | `latest` | API image tag — always pin in production |
| `replicaCount` | `1` | API replica count |
| `api.deploymentMode` | `oss` | Deployment mode: `oss`, `saas`, `enterprise` |
| `postgresql.enabled` | `false` | Deploy bundled PostgreSQL |
| `relay.enabled` | `false` | Deploy relay proxy |
| `ingress.enabled` | `false` | Deploy Ingress resources |
| `autoscaling.enabled` | `false` | Enable HPA |
| `autoscaling.maxReplicas` | `10` | HPA max replica count |

---

## Uninstall

```bash
helm uninstall phaseflag --namespace phaseflag
kubectl delete namespace phaseflag
```
