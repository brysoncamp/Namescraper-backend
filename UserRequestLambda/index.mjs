import AWS from "aws-sdk";
import OpenAI from "openai";

const secretsManager = new AWS.SecretsManager();
const sqs = new AWS.SQS();

let openaiApiKey;
let queueUrl;

// Function to retrieve secrets from Secrets Manager
const getSecrets = async () => {
  if (!openaiApiKey || !queueUrl) {
    const secret = await secretsManager
      .getSecretValue({ SecretId: "UserRequestSecrets" })
      .promise();
    const secretValues = JSON.parse(secret.SecretString);
    openaiApiKey = secretValues.OPENAI_API_KEY;
    queueUrl = secretValues.SQS_QUEUE_URL;
  }
};

// Lambda function handler
export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2))


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

    // Query GPT-4o-mini to generate domain names
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use the correct model name
      messages: [
        {
          role: "system",
          content:
            "Generate 500 quality domain names (without TLD) for the prompt. 10 character max. Do not be verbose.",
        },
        { role: "user", content: prompt },
      ],
    });

    // Process the generated names
    const names = completion.choices[0].message.content
      .trim()
      .split("\n")
      .map((name) => name.trim());
    const uniqueNames = [...new Set(names)]; // Remove duplicates

    // Push the generated names to the SQS queue
    const sqsResponse = await sqs
      .sendMessage({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ names: uniqueNames }),
      })
      .promise();

    // Return a successful response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Names generated and sent to queue successfully.",
        sqsResponse,
      }),
    };
  } catch (error) {
    console.error("Error querying GPT or pushing to queue:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
    };
  }
};

// Access key: AKIAQKPIMCL6L2UKAVP6
// Secret Access key: 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