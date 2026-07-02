/**
 * AWS Lambda Handler: Process Card
 * Integrates with mock credit card processing networks.
 */
exports.handler = async (event) => {
    console.log("Processing card payment:", JSON.stringify(event, null, 2));

    const { transactionId, amount, currency, cardLast4, riskStatus } = event;

    if (riskStatus === "DENIED_FRAUD") {
        console.log(`Aborting card processing. Transaction ${transactionId} marked as high-risk fraud.`);
        return {
            ...event,
            processorStatus: "DECLINED_FRAUD",
            gatewayReference: null,
            processedAt: new Date().toISOString()
        };
    }

    // Simulate merchant card network processing
    console.log(`Contacting payment processor for transaction ${transactionId} for $${amount} ${currency}...`);
    
    // Simulating card failures based on digits or patterns
    let processorStatus = "SUCCESS";
    let gatewayReference = `gw_ref_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    if (cardLast4 === "9999") {
        processorStatus = "DECLINED_INSUFFICIENT_FUNDS";
        gatewayReference = null;
        console.error("Card processing failed: Insufficient funds.");
    } else if (cardLast4 === "0000") {
        processorStatus = "DECLINED_EXPIRED_CARD";
        gatewayReference = null;
        console.error("Card processing failed: Expired Card.");
    } else {
        console.log(`Payment processor approved transaction. Reference: ${gatewayReference}`);
    }

    return {
        ...event,
        processorStatus,
        gatewayReference,
        processedAt: new Date().toISOString()
    };
};
