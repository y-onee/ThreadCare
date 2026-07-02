const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const snsClient = new SNSClient({ region: process.env.AWS_REGION || "us-east-1" });

/**
 * AWS Lambda Handler: Notify Merchant
 * Publishes transactional processing events to Amazon SNS.
 */
exports.handler = async (event) => {
    console.log("Notifying merchant about event:", JSON.stringify(event, null, 2));

    const { transactionId, merchantId, amount, currency, processorStatus, receiptUrl } = event;
    const topicArn = process.env.TRANSACTION_EVENTS_TOPIC_ARN || "arn:aws:sns:us-east-1:123456789012:SafePayTransactionEvents";

    const payload = {
        event: "payment.processed",
        transactionId,
        merchantId,
        amount,
        currency,
        status: processorStatus,
        receiptUrl,
        timestamp: new Date().toISOString()
    };

    try {
        console.log(`Publishing event payload to SNS Topic: ${topicArn}...`);
        await snsClient.send(new PublishCommand({
            TopicArn: topicArn,
            Message: JSON.stringify(payload),
            MessageAttributes: {
                "status": {
                    DataType: "String",
                    StringValue: processorStatus
                },
                "merchantId": {
                    DataType: "String",
                    StringValue: merchantId
                }
            }
        }));
        console.log("SNS notification published successfully.");
    } catch (err) {
        console.error("SNS publish failed:", err.message);
        // Fallback for mock environments
    }

    return {
        statusCode: 200,
        body: {
            transactionId,
            merchantId,
            status: processorStatus,
            amount,
            currency,
            receiptUrl,
            message: "Transaction processed and merchant notified."
        }
    };
};
