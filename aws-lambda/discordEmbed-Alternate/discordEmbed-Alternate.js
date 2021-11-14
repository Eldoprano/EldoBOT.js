// Creates a small JSON file that Discord sometimes uses to display content as embed
exports.handler = async (event) => {
    const jsonResponse = `{
        "author_name": "${event.queryStringParameters.author}",
        "author_url": "${event.queryStringParameters.url}",
        "provider_name": "${event.queryStringParameters.provider}",
        "provider_url": "${event.queryStringParameters.providerURL}",
        "title": "${event.queryStringParameters.title}",
        "type": "video",
        "version": "1.0"
    }`;
    
    const response = {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: jsonResponse,
    };
    return response;
};
