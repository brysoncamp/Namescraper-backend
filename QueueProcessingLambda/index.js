// create the most basic Lambda function that will process the queue. This function will be triggered by the SQS queue and will simply log the message it receives. Here's the code for the QueueProcessingLambda function:


export const handler = async (event) => {
    try {
        const message = event.Records[0].body;
        console.log('Received message:', message);
        // Add your processing logic here
        // ...
        return {
            statusCode: 200,
            body: 'Message processed successfully',
        };
    } catch (error) {
        console.error('Error processing message:', error);
        return {
            statusCode: 500,
            body: 'Error processing message',
        };
    }
};