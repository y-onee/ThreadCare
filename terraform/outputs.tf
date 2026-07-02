output "apigateway_base_url" {
  description = "Base URL for the SafePay API Gateway (use as the React app API endpoint)"
  value       = "https://${aws_api_gateway_rest_api.safepay_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "step_function_arn" {
  description = "ARN of the payment orchestration state machine"
  value       = aws_sfn_state_machine.payment_flow.arn
}

output "transactions_table_name" {
  description = "DynamoDB table name for order transactions"
  value       = aws_dynamodb_table.transactions.name
}

output "receipts_bucket_name" {
  description = "S3 bucket name for payment receipts/invoices"
  value       = aws_s3_bucket.receipts.id
}

output "rds_instance_endpoint" {
  description = "PostgreSQL DB instance endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "sns_topic_arn" {
  description = "SNS topic ARN for transaction event notifications"
  value       = aws_sns_topic.transaction_events.arn
}
