# Sovereign Agent Registry — Kubernetes Deployment

Production Kubernetes manifests for the agent registry.

## Files

| File | Purpose |
|---|---|
| `namespace.yaml` | `sovereign` namespace |
| `configmap.yaml` | URL to download `agents.json` |
| `secret.yaml` | Optional bearer token |
| `deployment.yaml` | Registry pods with init container |
| `service.yaml` | ClusterIP service |
| `ingress.yaml` | HTTPS ingress (ingress-nginx + cert-manager) |
| `hpa.yaml` | Horizontal pod autoscaling |

## Deploy

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/deployment.yaml
kubectl apply -f deploy/k8s/service.yaml
kubectl apply -f deploy/k8s/ingress.yaml
kubectl apply -f deploy/k8s/hpa.yaml
```

## Before applying

1. Edit `configmap.yaml` → set a real `agents-source-url`.
2. Edit `secret.yaml` → set a strong `auth-token` (base64 it if using `data` instead of `stringData`).
3. Edit `ingress.yaml` → set your real host and ingress class.

## Updating agents.json

Upload the new file to your hosted URL, then restart the deployment so pods re-fetch:

```bash
kubectl rollout restart deployment/sovereign-agent-registry -n sovereign
```
