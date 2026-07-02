resource "aws_dynamodb_table" "transactions" {
  name         = "${var.project_name}-transactions-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "transactionId"

  attribute {
    name = "transactionId"
    type = "S"
  }

  # Secondary index for query by merchantId
  global_secondary_index {
    name            = "MerchantIndex"
    hash_key        = "merchantId"
    projection_type = "ALL"
  }

  attribute {
    name = "merchantId"
    type = "S"
  }

  # Enable Point-In-Time-Recovery for compliance and backups
  point_in_time_recovery {
    enabled = true
  }

  # Server-Side Encryption enabled by default
  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-transactions-table"
  }
}
