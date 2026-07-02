# Archive Lambda function handlers into ZIP files
data "archive_file" "validate_zip" {
  type        = "zip"
  source_file = "${path.module}/../src/lambdas/validate_transaction.js"
  output_path = "${path.module}/files/validate_transaction.zip"
}

data "archive_file" "analyze_zip" {
  type        = "zip"
  source_file = "${path.module}/../src/lambdas/analyze_risk.js"
  output_path = "${path.module}/files/analyze_risk.zip"
}

data "archive_file" "process_zip" {
  type        = "zip"
  source_file = "${path.module}/../src/lambdas/process_card.js"
  output_path = "${path.module}/files/process_card.zip"
}

data "archive_file" "receipt_zip" {
  type        = "zip"
  source_file = "${path.module}/../src/lambdas/generate_receipt.js"
  output_path = "${path.module}/files/generate_receipt.zip"
}

data "archive_file" "notify_zip" {
  type        = "zip"
  source_file = "${path.module}/../src/lambdas/notify_merchant.js"
  output_path = "${path.module}/files/notify_merchant.zip"
}

# AWS Lambda Functions
resource "aws_lambda_function" "validate_transaction" {
  filename         = data.archive_file.validate_zip.output_path
  function_name    = "${var.project_name}-validate-transaction-${var.environment}"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "validate_transaction.handler"
  source_code_hash = data.archive_file.validate_zip.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 10

  tracing_config {
    mode = "Active"
  }
}

resource "aws_lambda_function" "analyze_risk" {
  filename         = data.archive_file.analyze_zip.output_path
  function_name    = "${var.project_name}-analyze-risk-${var.environment}"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "analyze_risk.handler"
  source_code_hash = data.archive_file.analyze_zip.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30 # Higher timeout for Bedrock call

  tracing_config {
    mode = "Active"
  }
}

resource "aws_lambda_function" "process_card" {
  filename         = data.archive_file.process_zip.output_path
  function_name    = "${var.project_name}-process-card-${var.environment}"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "process_card.handler"
  source_code_hash = data.archive_file.process_zip.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 15

  tracing_config {
    mode = "Active"
  }
}

resource "aws_lambda_function" "generate_receipt" {
  filename         = data.archive_file.receipt_zip.output_path
  function_name    = "${var.project_name}-generate-receipt-${var.environment}"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "generate_receipt.handler"
  source_code_hash = data.archive_file.receipt_zip.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 15

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      RECEIPTS_BUCKET_NAME    = aws_s3_bucket.receipts.id
      TRANSACTIONS_TABLE_NAME = aws_dynamodb_table.transactions.name
    }
  }
}

resource "aws_lambda_function" "notify_merchant" {
  filename         = data.archive_file.notify_zip.output_path
  function_name    = "${var.project_name}-notify-merchant-${var.environment}"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "notify_merchant.handler"
  source_code_hash = data.archive_file.notify_zip.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 15

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      TRANSACTION_EVENTS_TOPIC_ARN = aws_sns_topic.transaction_events.arn
    }
  }
}

data "archive_file" "list_transactions_zip" {
  type        = "zip"
  source_file = "${path.module}/../src/lambdas/list_transactions.js"
  output_path = "${path.module}/files/list_transactions.zip"
}

data "archive_file" "list_products_zip" {
  type        = "zip"
  source_file = "${path.module}/../src/lambdas/list_products.js"
  output_path = "${path.module}/files/list_products.zip"
}

resource "aws_lambda_function" "list_transactions" {
  filename         = data.archive_file.list_transactions_zip.output_path
  function_name    = "${var.project_name}-list-transactions-${var.environment}"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "list_transactions.handler"
  source_code_hash = data.archive_file.list_transactions_zip.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 15

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      TRANSACTIONS_TABLE_NAME = aws_dynamodb_table.transactions.name
    }
  }
}

resource "aws_lambda_function" "list_products" {
  filename         = data.archive_file.list_products_zip.output_path
  function_name    = "${var.project_name}-list-products-${var.environment}"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "list_products.handler"
  source_code_hash = data.archive_file.list_products_zip.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 15

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      PRODUCTS_TABLE_NAME = aws_dynamodb_table.products.name
    }
  }
}
