/**
 * Input variables for the Sovereign Agent Registry AWS ECS module.
 */

variable "name" {
  description = "Name prefix for all created resources"
  type        = string
  default     = "sovereign-agent-registry"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "registry_image" {
  description = "Docker image URI for the registry container"
  type        = string
}

variable "container_port" {
  description = "Container port the registry listens on"
  type        = number
  default     = 8080
}

variable "agents_s3_bucket" {
  description = "S3 bucket containing agents.json"
  type        = string
}

variable "agents_s3_key" {
  description = "S3 key for agents.json"
  type        = string
  default     = "agents.json"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the HTTPS listener"
  type        = string
}

variable "auth_token_secret_arn" {
  description = "Optional AWS Secrets Manager ARN for REGISTRY_AUTH_TOKEN"
  type        = string
  default     = null
}

variable "desired_count" {
  description = "Initial number of registry tasks"
  type        = number
  default     = 2
}

variable "cpu" {
  description = "Task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Task memory in MiB"
  type        = number
  default     = 512
}

variable "enable_autoscaling" {
  description = "Enable ECS target tracking autoscaling"
  type        = bool
  default     = true
}

variable "autoscaling_min" {
  description = "Minimum task count when autoscaling"
  type        = number
  default     = 2
}

variable "autoscaling_max" {
  description = "Maximum task count when autoscaling"
  type        = number
  default     = 10
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
