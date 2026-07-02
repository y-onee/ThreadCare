# Transaction Events SNS Topic
resource "aws_sns_topic" "transaction_events" {
  name = "${var.project_name}-transaction-events-${var.environment}"
}

# Merchant Email Subscription (e.g. for merchant alerts)
resource "aws_sns_topic_subscription" "email_sub" {
  topic_arn = aws_sns_topic.transaction_events.arn
  protocol  = "email"
  endpoint  = var.merchant_notifications_email
}

# CloudWatch Alarm: Lambda High Error Rates
resource "aws_cloudwatch_metric_alarm" "high_error_rate_alarm" {
  alarm_name          = "${var.project_name}-high-lambda-error-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300" # 5 mins
  statistic           = "Sum"
  threshold           = "5" # Alarm if more than 5 errors in 5 mins
  alarm_description   = "Trigger alert if payment processor Lambda experiences elevated errors."
  alarm_actions       = [aws_sns_topic.transaction_events.arn]

  dimensions = {
    FunctionName = aws_lambda_function.process_card.function_name
  }
}

# CloudWatch Executive Dashboard showing System Health
resource "aws_cloudwatch_dashboard" "payment_gateway_dashboard" {
  dashboard_name = "${var.project_name}-executive-dashboard-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      # API Gateway Request count
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", aws_api_gateway_rest_api.safepay_api.name]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Total Payment Transactions Received"
        }
      },
      # SFN Execution Success vs Fail
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/States", "ExecutionsSucceeded", "StateMachineArn", aws_sfn_state_machine.payment_flow.arn],
            ["AWS/States", "ExecutionsFailed", "StateMachineArn", aws_sfn_state_machine.payment_flow.arn]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Workflow Executions Succeeded vs Failed"
        }
      }
    ]
  })
}
