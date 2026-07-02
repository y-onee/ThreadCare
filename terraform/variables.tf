variable "aws_region" {
  type        = string
  description = "AWS region to deploy resources"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "production"
}

variable "project_name" {
  type        = string
  description = "Project name prefix"
  default     = "safepay"
}

variable "merchant_notifications_email" {
  type        = string
  description = "Email address for subscribing to payment event alerts"
  default     = "merchant-alerts@safepay.example.com"
}
