const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const ddbDoc = DynamoDBDocumentClient.from(ddbClient);

// Static catalog items as fallback
const DEFAULT_PRODUCTS = [
    { id: "prod_001", name: "Classic Indigo Denim Jacket", category: "Outerwear", price: 89.99, image: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=400&q=80", rating: 4.8, description: "Heavyweight denim jacket featuring metal buttons and adjustable cuffs. Timeless style." },
    { id: "prod_002", name: "Premium Knit Crewneck Sweater", category: "Tops", price: 65.00, image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=400&q=80", rating: 4.6, description: "Soft cotton-blend knit sweater with ribbed cuffs and neckband. Relaxed fit." },
    { id: "prod_003", name: "Tailored Linen Summer Shirt", category: "Tops", price: 48.50, image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80", rating: 4.5, description: "Ultralight, breathable linen blend button-down. Perfect for warm-weather styles." },
    { id: "prod_004", name: "Stretch Utility Cargo Pants", category: "Bottoms", price: 72.00, image: "https://images.unsplash.com/photo-1517423568366-8b83523034fd?auto=format&fit=crop&w=400&q=80", rating: 4.7, description: "Durable stretch ripstop material with multiple cargo storage pockets. Comfort fit." },
    { id: "prod_005", name: "Minimalist Leather Court Sneaker", category: "Shoes", price: 110.00, image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80", rating: 4.9, description: "Full-grain calfskin leather sneaker with orthotic insoles and durable vulcanized soles." }
];

/**
 * AWS Lambda Handler: List Products
 * Fetches the active e-commerce clothing products list.
 */
exports.handler = async (event) => {
    console.log("Fetching clothing products list...");
    const tableName = process.env.PRODUCTS_TABLE_NAME || "SafePayProducts";

    try {
        const result = await ddbDoc.send(new ScanCommand({
            TableName: tableName
        }));

        const items = result.Items && result.Items.length > 0 ? result.Items : DEFAULT_PRODUCTS;
        console.log(`Returning ${items.length} products.`);

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
        console.warn("DynamoDB Products Scan failed, returning default catalog:", err.message);
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify(DEFAULT_PRODUCTS)
        };
    }
};
