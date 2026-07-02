// Mocking AWS SDKs before importing Lambda handlers
jest.mock("@aws-sdk/client-bedrock-runtime", () => {
    return {
        BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
            send: jest.fn().mockResolvedValue({
                body: new TextEncoder().encode(JSON.stringify({
                    completion: JSON.stringify({ riskScore: 0.15, aiJustification: "Standard customer profiles match." })
                }))
            })
        })),
        InvokeModelCommand: jest.fn()
    };
});

jest.mock("@aws-sdk/client-s3", () => {
    return {
        S3Client: jest.fn().mockImplementation(() => ({
            send: jest.fn().mockResolvedValue({})
        })),
        PutObjectCommand: jest.fn()
    };
});

jest.mock("@aws-sdk/client-dynamodb", () => {
    return {
        DynamoDBClient: jest.fn()
    };
});

jest.mock("@aws-sdk/lib-dynamodb", () => {
    return {
        DynamoDBDocumentClient: {
            from: jest.fn().mockImplementation(() => ({
                send: jest.fn().mockImplementation((command) => {
                    if (command && command.isScan) {
                        // Scan condition
                        if (command.TableName && command.TableName.includes("Products")) {
                            return Promise.resolve({
                                Items: [
                                    { id: "prod_1", name: "Jacket", price: 89.99 },
                                    { id: "prod_2", name: "Shirt", price: 48.50 }
                                ]
                            });
                        }
                        return Promise.resolve({
                            Items: [
                                { transactionId: "tx_1", merchantId: "mch_1", amount: 100, createdAt: "2026-07-02T10:00:00Z" },
                                { transactionId: "tx_2", merchantId: "mch_2", amount: 200, createdAt: "2026-07-02T11:00:00Z" }
                            ]
                        });
                    }
                    return Promise.resolve({});
                })
            }))
        },
        PutCommand: jest.fn().mockImplementation((input) => ({ isPut: true, ...input })),
        ScanCommand: jest.fn().mockImplementation((input) => ({ isScan: true, ...input }))
    };
});

jest.mock("@aws-sdk/client-sns", () => {
    return {
        SNSClient: jest.fn().mockImplementation(() => ({
            send: jest.fn().mockResolvedValue({})
        })),
        PublishCommand: jest.fn()
    };
});

// Import Lambda handlers
const validateTransaction = require("../src/lambdas/validate_transaction").handler;
const analyzeRisk = require("../src/lambdas/analyze_risk").handler;
const processCard = require("../src/lambdas/process_card").handler;
const generateReceipt = require("../src/lambdas/generate_receipt").handler;
const notifyMerchant = require("../src/lambdas/notify_merchant").handler;
const listTransactions = require("../src/lambdas/list_transactions").handler;
const listProducts = require("../src/lambdas/list_products").handler;

describe("SafePay Lambdas Suite", () => {

    describe("1. validate_transaction Lambda", () => {
        const validPayload = {
            transaction: {
                merchantId: "mch_123",
                amount: 150.00,
                currency: "USD",
                card: {
                    cardNumber: "4111222233334444",
                    cvv: "123",
                    expiryMonth: 12,
                    expiryYear: 2030
                }
            }
        };

        it("should successfully validate correct transaction data", async () => {
            const result = await validateTransaction(validPayload);
            expect(result.merchantId).toBe("mch_123");
            expect(result.amount).toBe(150.00);
            expect(result.cardBrand).toBe("Visa");
            expect(result.cardLast4).toBe("4444");
        });

        it("should fail validation on missing merchantId", async () => {
            const badPayload = JSON.parse(JSON.stringify(validPayload));
            delete badPayload.transaction.merchantId;
            await expect(validateTransaction(badPayload)).rejects.toThrow("Missing or invalid 'merchantId'.");
        });

        it("should fail validation on negative amount", async () => {
            const badPayload = JSON.parse(JSON.stringify(validPayload));
            badPayload.transaction.amount = -10;
            await expect(validateTransaction(badPayload)).rejects.toThrow("Invalid or non-positive 'amount'.");
        });

        it("should fail validation on expired card year", async () => {
            const badPayload = JSON.parse(JSON.stringify(validPayload));
            badPayload.transaction.card.expiryYear = 2020;
            await expect(validateTransaction(badPayload)).rejects.toThrow("Invalid expiry year.");
        });
    });

    describe("2. analyze_risk Lambda", () => {
        it("should calculate low risk for typical transaction", async () => {
            const payload = {
                transactionId: "tx_123456",
                amount: 150.00,
                cardBrand: "Visa",
                cardLast4: "4444",
                clientIp: "127.0.0.1"
            };
            const result = await analyzeRisk(payload);
            expect(result.riskScore).toBeLessThan(0.5);
            expect(result.riskStatus).toBe("APPROVED");
        });

        it("should tag risk higher for large transaction amounts", async () => {
            // Mocking dynamic Bedrock failure to trigger rules fallback
            const bedrock = require("@aws-sdk/client-bedrock-runtime");
            bedrock.BedrockRuntimeClient.mockImplementationOnce(() => ({
                send: jest.fn().mockRejectedValue(new Error("Bedrock Timeout"))
            }));

            const payload = {
                transactionId: "tx_huge",
                amount: 75000.00,
                cardBrand: "Visa",
                cardLast4: "4444",
                clientIp: "99.99.99.99"
            };
            const result = await analyzeRisk(payload);
            expect(result.riskScore).toBeGreaterThanOrEqual(0.8); 
            expect(result.riskStatus).toBe("DENIED_FRAUD");
        });
    });

    describe("3. process_card Lambda", () => {
        it("should process normal card payment successfully", async () => {
            const payload = {
                transactionId: "tx_123456",
                amount: 150.00,
                cardLast4: "4444",
                riskStatus: "APPROVED"
            };
            const result = await processCard(payload);
            expect(result.processorStatus).toBe("SUCCESS");
            expect(result.gatewayReference).toContain("gw_ref_");
        });

        it("should skip processor and deny transaction if marked as FRAUD", async () => {
            const payload = {
                transactionId: "tx_fraud",
                amount: 150.00,
                cardLast4: "4444",
                riskStatus: "DENIED_FRAUD"
            };
            const result = await processCard(payload);
            expect(result.processorStatus).toBe("DECLINED_FRAUD");
            expect(result.gatewayReference).toBeNull();
        });

        it("should mock NSF decline if card ends in 9999", async () => {
            const payload = {
                transactionId: "tx_nsf",
                amount: 150.00,
                cardLast4: "9999",
                riskStatus: "APPROVED"
            };
            const result = await processCard(payload);
            expect(result.processorStatus).toBe("DECLINED_INSUFFICIENT_FUNDS");
            expect(result.gatewayReference).toBeNull();
        });
    });

    describe("4. generate_receipt Lambda", () => {
        it("should generate receipt metadata and call DynamoDB/S3", async () => {
            const payload = {
                transactionId: "tx_123456",
                merchantId: "mch_123",
                amount: 150.00,
                currency: "USD",
                cardLast4: "4444",
                processorStatus: "SUCCESS",
                riskScore: 0.15,
                gatewayReference: "gw_ref_123",
                processedAt: new Date().toISOString()
            };
            const result = await generateReceipt(payload);
            expect(result.receiptUrl).toContain("s3://safepay-receipts-archive/receipts/mch_123/tx_123456.json");
        });
    });

    describe("5. notify_merchant Lambda", () => {
        it("should publish message to SNS and return success API payload", async () => {
            const payload = {
                transactionId: "tx_123456",
                merchantId: "mch_123",
                amount: 150.00,
                currency: "USD",
                processorStatus: "SUCCESS",
                receiptUrl: "s3://safepay-receipts-archive/receipts/mch_123/tx_123456.json"
            };
            const result = await notifyMerchant(payload);
            expect(result.statusCode).toBe(200);
            expect(result.body.message).toBe("Transaction processed and merchant notified.");
        });
    });

    describe("6. list_transactions Lambda", () => {
        it("should successfully fetch and sort transaction items", async () => {
            const result = await listTransactions({});
            expect(result.statusCode).toBe(200);
            
            const body = JSON.parse(result.body);
            expect(body.length).toBe(2);
            // tx_2 should be first since it has a later timestamp (11:00 vs 10:00)
            expect(body[0].transactionId).toBe("tx_2");
            expect(body[1].transactionId).toBe("tx_1");
        });
    });

    describe("7. list_products Lambda", () => {
        it("should successfully fetch clothing listings", async () => {
            const result = await listProducts({});
            expect(result.statusCode).toBe(200);
            
            const body = JSON.parse(result.body);
            expect(body.length).toBeGreaterThanOrEqual(2);
            expect(body[0].name).toBe("Jacket");
        });
    });
});
