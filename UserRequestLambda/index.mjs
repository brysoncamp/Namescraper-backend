import AWS from "aws-sdk";
import OpenAI from "openai";

// Initialize Secrets Manager and API Gateway Management API
const secretsManager = new AWS.SecretsManager();
const apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({
  endpoint: "https://1wykr5nss2.execute-api.us-east-1.amazonaws.com/development/generate",
});

let openaiApiKey;

// Function to retrieve secrets from Secrets Manager
const getSecrets = async () => {
  if (!openaiApiKey) {
    const secret = await secretsManager
      .getSecretValue({ SecretId: "UserRequestSecrets" })
      .promise();
    const secretValues = JSON.parse(secret.SecretString);
    openaiApiKey = secretValues.OPENAI_API_KEY;
  }
};

// Lambda function handler for the /generate route
export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Retrieve secrets if not already loaded
    await getSecrets();

    // Initialize the OpenAI client with the retrieved API key
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    const prompt = JSON.parse(event.body).prompt;

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "No prompt provided." }),
      };
    }

    // Start the streaming request
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use the correct model name
      messages: [
        {
          role: "system",
          content:
            "Generate 500 quality domain names (without TLD) for the prompt. 10 character max. Do not be verbose.",
        },
        { role: "user", content: prompt },
      ],
      stream: true, // Enable streaming mode
    });

    // Process the stream and send each chunk to the client
    for await (const chunk of stream) {
      const content = chunk.choices[0].delta?.content || ""; // Get the content chunk
      await apiGatewayManagementApi
        .postToConnection({
          ConnectionId: connectionId,
          Data: JSON.stringify({ content }),
        })
        .promise();
    }

    // Send a final message to indicate completion
    await apiGatewayManagementApi
      .postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify({ message: "Complete" }),
      })
      .promise();

    return { statusCode: 200, body: "Data streamed successfully." };
  } catch (error) {
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
    };
  }
};