# Sovereign Agent Registry — AWS ECS Fargate Deployment

Production Terraform module for the agent registry container.

## Architecture

- **AWS ECS Fargate** — serverless container tasks
- **Application Load Balancer** — HTTPS termination
- **Amazon EFS** — shared volume for `agents.json`
- **S3 init container** — pulls the latest `agents.json` into EFS at startup
- **AWS Secrets Manager** — optional bearer token
- **CloudWatch Logs** — container logs
- **Auto Scaling** — target tracking on CPU

## Usage

```bash
cd deploy/terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Outputs

| Output | Description |
|---|---|
| `load_balancer_dns` | ALB DNS name |
| `registry_url` | Full `https://.../agents` endpoint |
| `ecs_cluster_name` | ECS cluster name |
| `cloudwatch_log_group` | Log group for debugging |

## Updating agents.json

Upload a new JSON file to S3:

```bash
aws s3 cp agents.json s3://YOUR_BUCKET/agents.json
```

Then restart the ECS service so the init container re-pulls it:

```bash
aws ecs update-service --cluster sovereign-agent-registry --service sovereign-agent-registry --force-new-deployment
```
