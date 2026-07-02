const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

/**
 * AWS Lambda Handler: Analyze Risk
 * Performs AI-powered fraud risk scoring of the transaction using Amazon Bedrock.
 * Falls back to rule-based scoring if the AI service is unavailable or credentials are mock.
 */
exports.handler = async (event) => {
    console.log("Analyzing transaction risk for event:", JSON.stringify(event, null, 2));

    const { transactionId, amount, cardBrand, cardLast4, clientIp } = event;
    let riskScore = 0.1; // Default low risk (0.0 to 1.0)
    let evaluationMethod = "Rule-based scoring (Bedrock fallback)";
    let flags = [];

    // Rule-based preliminary checks
    if (amount > 10000) {
        riskScore += 0.4;
        flags.push("High transaction value (>10k)");
    }
    if (amount > 50000) {
        riskScore += 0.3;
        flags.push("Extreme transaction value (>50k)");
    }
    if (clientIp === "127.0.0.1" || clientIp.startsWith("10.") || clientIp.startsWith("192.")) {
        // Internal testing IPs, keep baseline low
    } else {
        // Mock geo check
        if (Math.random() > 0.95) {
            riskScore += 0.2;
            flags.push("Suspicious IP geolocation mismatch");
        }
    }

    // AI-powered risk evaluation using Bedrock Anthropic Claude
    try {
        console.log("Invoking Amazon Bedrock for AI-powered risk assessment...");
        const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

        const prompt = `Human: Evaluate the fraud risk of this transaction:
- ID: ${transactionId}
- Amount: $${amount}
- Card Brand: ${cardBrand}
- Card Last 4: ${cardLast4}
- Client IP: ${clientIp}
Provide a JSON response containing "riskScore" (a number between 0.0 and 1.0) and "aiJustification" (string). Output ONLY the JSON block.
Assistant:`;

        const command = new InvokeModelCommand({
            modelId: "anthropic.claude-v2",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                prompt: prompt,
                max_tokens_to_sample: 200,
                temperature: 0.1,
                top_k: 250,
                top_p: 0.999,
                stop_sequences: ["\n\nHuman:"]
            })
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const completion = JSON.parse(responseBody.completion.trim());

        if (completion.riskScore !== undefined) {
            riskScore = parseFloat(completion.riskScore);
            evaluationMethod = `AI-powered Bedrock (Claude)`;
            console.log(`Bedrock AI Risk Assessment: Score=${riskScore}, Justification=${completion.aiJustification}`);
            flags.push(completion.aiJustification || "AI identified patterns");
        }
    } catch (err) {
        console.warn("Could not reach Amazon Bedrock or parse response. Using fallback heuristics. Error:", err.message);
        if (process.env.NODE_ENV !== 'test') {
            riskScore = Math.min(1.0, Math.max(0.0, riskScore + (Math.random() * 0.1 - 0.05)));
        }
    }

    // Determine final status
    let status = "APPROVED";
    if (riskScore >= 0.8) {
        status = "DENIED_FRAUD";
    } else if (riskScore >= 0.5) {
        status = "REVIEW_REQUIRED";
    }

    console.log(`Risk Analysis Completed. Score: ${riskScore.toFixed(2)}, Status: ${status}`);

    return {
        ...event,
        riskScore: parseFloat(riskScore.toFixed(2)),
        riskStatus: status,
        evaluationMethod,
        riskFlags: flags
    };
};
