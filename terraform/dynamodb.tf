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

# DynamoDB Table: Clothing Products Catalog
resource "aws_dynamodb_table" "products" {
  name         = "${var.project_name}-products-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  # Allow filtering products by category
  global_secondary_index {
    name            = "CategoryIndex"
    hash_key        = "category"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-products-table"
  }
}
