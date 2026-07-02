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
      status         = "PROCESSING"
      executionArn   = "$input.path('$.executionArn')"
      startDate      = "$input.path('$.startDate')"
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
      aws_api_gateway_integration.sfn_integration.id
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_api_gateway_integration.sfn_integration]
}

# API Stage
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.safepay_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.safepay_api.id
  stage_name    = var.environment
}
