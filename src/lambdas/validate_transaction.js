/**
 * AWS Lambda Handler: Validate Transaction
 * Validates the schema of incoming payment transaction requests.
 */
exports.handler = async (event) => {
    console.log("Received transaction validation request:", JSON.stringify(event, null, 2));

    const transaction = event.transaction || event;
    const { merchantId, amount, currency, card } = transaction;

    const errors = [];

    if (!merchantId || typeof merchantId !== 'string') {
        errors.push("Missing or invalid 'merchantId'.");
    }
    if (amount === undefined || typeof amount !== 'number' || amount <= 0) {
        errors.push("Invalid or non-positive 'amount'.");
    }
    if (!currency || typeof currency !== 'string' || currency.length !== 3) {
        errors.push("Invalid 'currency'. Must be a 3-character ISO code.");
    }
    if (!card || typeof card !== 'object') {
        errors.push("Missing 'card' information.");
    } else {
        const { cardNumber, cvv, expiryMonth, expiryYear } = card;
        if (!cardNumber || typeof cardNumber !== 'string' || cardNumber.length < 13 || cardNumber.length > 19) {
            errors.push("Invalid credit card number length.");
        }
        if (!cvv || typeof cvv !== 'string' || cvv.length < 3 || cvv.length > 4) {
            errors.push("Invalid CVV format.");
        }
        if (!expiryMonth || typeof expiryMonth !== 'number' || expiryMonth < 1 || expiryMonth > 12) {
            errors.push("Invalid expiry month.");
        }
        if (!expiryYear || typeof expiryYear !== 'number' || expiryYear < new Date().getFullYear()) {
            errors.push("Invalid expiry year.");
        }
    }

    if (errors.length > 0) {
        console.error("Validation failed:", errors.join(" "));
        throw new Error(JSON.stringify({
            statusCode: 400,
            status: "VALIDATION_FAILED",
            errors: errors
        }));
    }

    console.log("Transaction details validated successfully.");

    // Pass validated transaction details downstream
    return {
        transactionId: event.transactionId || `tx_${Math.random().toString(36).substring(2, 11)}`,
        merchantId,
        amount,
        currency,
        cardLast4: card.cardNumber.slice(-4),
        cardBrand: card.cardNumber.startsWith('4') ? 'Visa' : 'Mastercard',
        timestamp: transaction.timestamp || new Date().toISOString(),
        clientIp: event.clientIp || "127.0.0.1"
    };
};
