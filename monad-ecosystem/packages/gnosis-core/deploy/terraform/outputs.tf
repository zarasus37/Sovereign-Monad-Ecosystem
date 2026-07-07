/**
 * Outputs for the Sovereign Agent Registry AWS ECS module.
 */

output "load_balancer_dns" {
  description = "DNS name of the application load balancer"
  value       = aws_lb.this.dns_name
}

output "registry_url" {
  description = "HTTPS URL to the /agents endpoint"
  value       = "https://${aws_lb.this.dns_name}/agents"
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.this.name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.this.name
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for the registry"
  value       = aws_cloudwatch_log_group.this.name
}
