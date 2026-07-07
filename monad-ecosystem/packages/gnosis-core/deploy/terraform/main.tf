/**
 * Terraform module: Sovereign Agent Registry on AWS ECS Fargate.
 *
 * Deploys the registry container behind an Application Load Balancer with
 * HTTPS (ACM certificate). Data is loaded from an S3 object at container
 * startup via an init container and served from a shared EFS volume.
 */

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  name = var.name
  tags = merge(
    {
      Project   = "sovereign-agent-registry"
      ManagedBy = "terraform"
    },
    var.tags
  )
}

# Networking

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.tags, { Name = local.name })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.tags, { Name = local.name })
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${local.name}-public-${count.index}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(local.tags, { Name = "${local.name}-public" })
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# EFS for shared agents.json

resource "aws_security_group" "efs" {
  name        = "${local.name}-efs"
  description = "Allow NFS traffic from ECS tasks"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = merge(local.tags, { Name = "${local.name}-efs" })
}

resource "aws_efs_file_system" "this" {
  encrypted = true
  tags      = merge(local.tags, { Name = local.name })
}

resource "aws_efs_mount_target" "this" {
  count           = length(aws_subnet.public)
  file_system_id  = aws_efs_file_system.this.id
  subnet_id       = aws_subnet.public[count.index].id
  security_groups = [aws_security_group.efs.id]
}

# IAM

resource "aws_iam_role" "ecs_execution" {
  name = "${local.name}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name}-s3-read"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = "arn:aws:s3:::${var.agents_s3_bucket}/${var.agents_s3_key}"
    }]
  })
}

# Security

resource "aws_security_group" "ecs" {
  name        = "${local.name}-ecs"
  description = "Allow traffic from ALB"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-ecs" })
}

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Allow public HTTPS"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-alb" })
}

# ALB

resource "aws_lb" "this" {
  name               = local.name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = merge(local.tags, { Name = local.name })
}

resource "aws_lb_target_group" "this" {
  name        = local.name
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/health"
    port                = var.container_port
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }

  tags = merge(local.tags, { Name = local.name })
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ECS

resource "aws_ecs_cluster" "this" {
  name = local.name
  tags = merge(local.tags, { Name = local.name })
}

resource "aws_ecs_task_definition" "this" {
  family                   = local.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  volume {
    name = "agents"

    efs_volume_configuration {
      file_system_id = aws_efs_file_system.this.id
      root_directory = "/"
    }
  }

  container_definitions = jsonencode([
    {
      name  = "init"
      image = "public.ecr.aws/aws-cli/aws-cli:latest"
      essential = false
      command = [
        "s3", "cp",
        "s3://${var.agents_s3_bucket}/${var.agents_s3_key}",
        "/data/agents.json"
      ]
      mountPoints = [{
        sourceVolume  = "agents"
        containerPath = "/data"
      }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "init"
        }
      }
    },
    {
      name  = "registry"
      image = var.registry_image
      essential = true
      portMappings = [{
        containerPort = var.container_port
        protocol      = "tcp"
      }]
      environment = [
        { name = "REGISTRY_PORT", value = tostring(var.container_port) },
        { name = "REGISTRY_DATA_PATH", value = "/data/agents.json" },
        { name = "NODE_ENV", value = "production" }
      ]
      secrets = var.auth_token_secret_arn != null ? [
        {
          name      = "REGISTRY_AUTH_TOKEN"
          valueFrom = var.auth_token_secret_arn
        }
      ] : []
      mountPoints = [{
        sourceVolume  = "agents"
        containerPath = "/data"
        readOnly      = true
      }]
      dependsOn = [{
        containerName = "init"
        condition     = "SUCCESS"
      }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "registry"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"require('http').get('http://localhost:${var.container_port}/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])

  tags = merge(local.tags, { Name = local.name })
}

resource "aws_ecs_service" "this" {
  name            = local.name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name     = "registry"
    container_port     = var.container_port
  }

  depends_on = [aws_lb_listener.https]

  tags = merge(local.tags, { Name = local.name })
}

resource "aws_appautoscaling_target" "this" {
  count              = var.enable_autoscaling ? 1 : 0
  max_capacity       = var.autoscaling_max
  min_capacity       = var.autoscaling_min
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  count              = var.enable_autoscaling ? 1 : 0
  name               = "${local.name}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this[0].resource_id
  scalable_dimension = aws_appautoscaling_target.this[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.this[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
  tags              = merge(local.tags, { Name = local.name })
}
