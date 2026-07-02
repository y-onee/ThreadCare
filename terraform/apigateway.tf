resource "aws_api_gateway_rest_api" "safepay_api" {
  name        = "${var.project_name}-api-${var.environment}"
  description = "SafePay REST API Gateway"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "charge" {
  rest_api_id = aws_api_gateway_rest_api.safepay_api.id
  parent_id   = aws_api_gateway_rest_api.safepay_api.root_resource_id
  path_part   = "charge"
}

resource "aws_api_gateway_method" "charge_post" {
  rest_api_id   = aws_api_gateway_rest_api.safepay_api.id
  resource_id   = aws_api_gateway_resource.charge.id
  http_method   = "POST"
  authorization = "NONE" # In prod, configure API Key or Custom Authorizer
}

# AWS Service Integration mapping POST /charge directly to Step Functions StartExecution
resource "aws_api_gateway_integration" "sfn_integration" {
  rest_api_id             = aws_api_gateway_rest_api.safepay_api.id
  resource_id             = aws_api_gateway_resource.charge.id
  http_method             = aws_api_gateway_method.charge_post.http_method
  type                    = "AWS"
  integration_http_method = "POST"
  uri                     = "arn:aws:apigateway:${var.aws_region}:states:action/StartExecution"
  credentials             = aws_iam_role.apigw_sfn_role.arn

  # Request template to map request payload into SFN execution format
  request_templates = {
    "application/json" = jsonencode({
      stateMachineArn = aws_sfn_state_machine.payment_flow.arn
      input           = "$util.escapeJavaScript($input.json('$'))"
    })
  }
}

# Success 200 Response
resource "aws_api_gateway_method_response" "charge_200" {
  rest_api_id = aws_api_gateway_rest_api.safepay_api.id
  resource_id = aws_api_gateway_resource.charge.id
  http_method = aws_api_gateway_method.charge_post.http_method
  status_code = "200"

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "charge_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.safepay_api.id
  resource_id = aws_api_gateway_resource.charge.id
  http_method = aws_api_gateway_method.charge_post.http_method
  status_code = aws_api_gateway_method_response.charge_200.status_code

  # Respond with execution metadata back to the client
  response_templates = {
    "application/json" = jsonencode({
      status       = "PROCESSING"
      executionArn = "$input.path('$.executionArn')"
      startDate    = "$input.path('$.startDate')"
    })
  }

  depends_on = [aws_api_gateway_integration.sfn_integration]
}

# Deployment
resource "aws_api_gateway_deployment" "safepay_deployment" {
  rest_api_id = aws_api_gateway_rest_api.safepay_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.charge.id,
      aws_api_gateway_method.charge_post.id,
      aws_api_gateway_integration.sfn_integration.id,
      aws_api_gateway_resource.products.id,
      aws_api_gateway_resource.transactions.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.sfn_integration,
    aws_api_gateway_integration.products_integration,
    aws_api_gateway_integration.transactions_integration,
  ]
}

# API Stage
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.safepay_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.safepay_api.id
  stage_name    = var.environment
}

# ─── /products endpoint ───────────────────────────────────────────────────────
resource "aws_api_gateway_resource" "products" {
  rest_api_id = aws_api_gateway_rest_api.safepay_api.id
  parent_id   = aws_api_gateway_rest_api.safepay_api.root_resource_id
  path_part   = "products"
}

resource "aws_api_gateway_method" "products_get" {
  rest_api_id   = aws_api_gateway_rest_api.safepay_api.id
  resource_id   = aws_api_gateway_resource.products.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "products_integration" {
  rest_api_id             = aws_api_gateway_rest_api.safepay_api.id
  resource_id             = aws_api_gateway_resource.products.id
  http_method             = aws_api_gateway_method.products_get.http_method
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = aws_lambda_function.list_products.invoke_arn
}

resource "aws_lambda_permission" "apigw_list_products" {
  statement_id  = "AllowAPIGWInvokeListProducts"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.list_products.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.safepay_api.execution_arn}/*/*"
}

# ─── /transactions endpoint ───────────────────────────────────────────────────
resource "aws_api_gateway_resource" "transactions" {
  rest_api_id = aws_api_gateway_rest_api.safepay_api.id
  parent_id   = aws_api_gateway_rest_api.safepay_api.root_resource_id
  path_part   = "transactions"
}

resource "aws_api_gateway_method" "transactions_get" {
  rest_api_id   = aws_api_gateway_rest_api.safepay_api.id
  resource_id   = aws_api_gateway_resource.transactions.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "transactions_integration" {
  rest_api_id             = aws_api_gateway_rest_api.safepay_api.id
  resource_id             = aws_api_gateway_resource.transactions.id
  http_method             = aws_api_gateway_method.transactions_get.http_method
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = aws_lambda_function.list_transactions.invoke_arn
}

resource "aws_lambda_permission" "apigw_list_transactions" {
  statement_id  = "AllowAPIGWInvokeListTransactions"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.list_transactions.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.safepay_api.execution_arn}/*/*"
}
