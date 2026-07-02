resource "aws_sfn_state_machine" "payment_flow" {
  name     = "${var.project_name}-payment-flow-${var.environment}"
  role_arn = aws_iam_role.sfn_exec_role.arn

  definition = jsonencode({
    Comment = "Orchestrates the SafePay Fintech Payment Gateway with AI-Powered Fraud Detection"
    StartAt = "ValidateTransaction"
    States = {
      # Step 1: Input Validation
      ValidateTransaction = {
        Type       = "Task"
        Resource   = aws_lambda_function.validate_transaction.arn
        Next       = "AnalyzeRisk"
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next        = "HandleFailure"
          }
        ]
      }

      # Step 2: Bedrock AI Fraud Risk Scoring
      AnalyzeRisk = {
        Type       = "Task"
        Resource   = aws_lambda_function.analyze_risk.arn
        Next       = "EvaluateRiskStatus"
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next        = "HandleFailure"
          }
        ]
      }

      # Step 3: Decision Branch based on Fraud Risk
      EvaluateRiskStatus = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.riskStatus"
            StringMatches = "DENIED_FRAUD"
            Next          = "RejectFraud"
          }
        ]
        Default = "ProcessCardPayment"
      }

      # Step 3a: High Risk Flag - Skip Processor
      RejectFraud = {
        Type = "Pass"
        Result = {
          processorStatus  = "DECLINED_FRAUD"
          gatewayReference = null
        }
        ResultPath = "$.processorResult"
        Next       = "RecordReceiptAndAudit"
      }

      # Step 4: Card Processor Call
      ProcessCardPayment = {
        Type       = "Task"
        Resource   = aws_lambda_function.process_card.arn
        ResultPath = "$.processorResult"
        Next       = "EvaluateProcessorStatus"
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next        = "HandleFailure"
          }
        ]
      }

      # Step 4a: Choice block on payment approval
      EvaluateProcessorStatus = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.processorResult.processorStatus"
            StringMatches = "SUCCESS"
            Next          = "RecordReceiptAndAudit"
          }
        ]
        Default = "NotifyMerchantDecline"
      }

      # Step 5: S3 Archive & DynamoDB Write (Executed for approved payments and fraud flags)
      RecordReceiptAndAudit = {
        Type     = "Task"
        Resource = aws_lambda_function.generate_receipt.arn
        Parameters = {
          "transactionId.$"      = "$.transactionId"
          "merchantId.$"         = "$.merchantId"
          "amount.$"             = "$.amount"
          "currency.$"           = "$.currency"
          "cardLast4.$"          = "$.cardLast4"
          "processorStatus.$"    = "$.processorResult.processorStatus"
          "riskScore.$"          = "$.riskScore"
          "gatewayReference.$"   = "$.processorResult.gatewayReference"
          "processedAt.$"        = "$.processorResult.processedAt"
        }
        Next = "NotifyMerchantSuccess"
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next        = "HandleFailure"
          }
        ]
      }

      # Step 6: SNS Webhook Notification for Success
      NotifyMerchantSuccess = {
        Type     = "Task"
        Resource = aws_lambda_function.notify_merchant.arn
        End      = true
      }

      # Step 6b: SNS Webhook Notification for declines
      NotifyMerchantDecline = {
        Type     = "Task"
        Resource = aws_lambda_function.notify_merchant.arn
        Parameters = {
          "transactionId.$"   = "$.transactionId"
          "merchantId.$"      = "$.merchantId"
          "amount.$"          = "$.amount"
          "currency.$"        = "$.currency"
          "processorStatus.$" = "$.processorResult.processorStatus"
          "receiptUrl"        = null
        }
        End = true
      }

      # Generic Error State
      HandleFailure = {
        Type = "Fail"
        Error = "PaymentOrchestrationError"
        Cause = "An unhandled execution exception occurred in the payment processing chain."
      }
    }
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn_log_group.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tracing_configuration {
    enabled = true
  }
}

# CloudWatch Log Group for State Machine
resource "aws_cloudwatch_log_group" "sfn_log_group" {
  name              = "/aws/vendedlogs/states/${var.project_name}-payment-flow-${var.environment}"
  retention_in_days = 30
}
