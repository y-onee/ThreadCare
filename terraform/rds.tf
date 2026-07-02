# VPC Subnets definition for RDS Aurora multi-AZ layout
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "${var.project_name}-private-subnet-a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name = "${var.project_name}-private-subnet-b"
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "aurora_subnet_group" {
  name       = "${var.project_name}-db-subnet-group-${var.environment}"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name = "SafePay DB Subnet Group"
  }
}

# DB Security Group
resource "aws_security_group" "rds_sg" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  description = "Access to Aurora DB from Lambda functions"
  vpc_id      = aws_vpc.main.id

  # Inbound Postgres access from within VPC
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# RDS Aurora Serverless v2 PostgreSQL DB Cluster
resource "aws_rds_cluster" "aurora" {
  cluster_identifier     = "${var.project_name}-db-cluster-${var.environment}"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "15.4"
  database_name          = "safepayaudit"
  master_username        = "safepay_admin"
  master_password        = "SuperSecurePassword123!" # In real prod, retrieve from Secrets Manager
  db_subnet_group_name   = aws_db_subnet_group.aurora_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  skip_final_snapshot    = true
  deletion_protection    = false

  serverless_v2_scaling_configuration {
    max_capacity = 2.0
    min_capacity = 0.5
  }
}

# DB Instance
resource "aws_rds_cluster_instance" "aurora_instance" {
  cluster_identifier = aws_rds_cluster.aurora.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.aurora.engine
  engine_version     = aws_rds_cluster.aurora.engine_version
  identifier         = "${var.project_name}-db-instance-${var.environment}"
}
