const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const ddbDoc = DynamoDBDocumentClient.from(ddbClient);

/**
 * AWS Lambda Handler: List Transactions/Orders
 * Fetches the latest 50 orders from the DynamoDB table.
 */
exports.handler = async (event) => {
    console.log("Fetching order transactions history...");
    const tableName = process.env.TRANSACTIONS_TABLE_NAME || "SafePayTransactions";

    try {
        const result = await ddbDoc.send(new ScanCommand({
            TableName: tableName,
            Limit: 50
        }));

        // Sort items by createdAt descending
        const items = (result.Items || []).sort((a, b) => {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        console.log(`Successfully fetched ${items.length} records.`);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,OPTIONS"
            },
            body: JSON.stringify(items)
        };
    } catch (err) {
        console.error("DynamoDB Scan failed:", err.message);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                error: "Failed to query order database.",
                details: err.message
            })
        };
    }
};
