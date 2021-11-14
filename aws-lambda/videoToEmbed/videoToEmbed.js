// Generates the website from which discord will extract information to build it's webhook.
// Connect with Database
const AWS = require("aws-sdk");
AWS.config.update({
  region: "us-east-1",
});
const database = new AWS.DynamoDB.DocumentClient();

        
exports.handler = async (event) => {
    let website = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            
            <meta content='text/html; charset=UTF-8' http-equiv='Content-Type' />
            <meta content="{color}" data-react-helmet="true" name="theme-color" />
            <meta property="{textUp}" content="{textUp}">
        
            <meta name="twitter:card"                       content="player" />
            <meta name="twitter:title"                      content="{textDown}" />
            <meta name="twitter:image"                      content="{thumbnail}" />
            <meta name="twitter:player:width"               content="{width}" />
            <meta name="twitter:player:height"              content="{height}" />
            <meta name="twitter:player:stream"              content="{video}" />
            <meta name="twitter:player:stream:content_type" content="video/mp4" /> 
        
            
            <meta property="og:url"                content="" />
            <meta property="og:video"              content="{video}" />
            <meta property="og:video:secure_url"   content="{video}" />
            <meta property="og:video:type"         content="video/mp4" />
            <meta property="og:video:width"        content="{width}" />
            <meta property="og:video:height"       content="{height}" />
            <meta property="og:title"              content="og:title" />
            <!--<meta property="og:description"        content="og:description" />!-->
            <meta property="og:image"              content="{thumbnail}" />
        
                <!--!-->
            <link rel="alternate" href="https://rhw03rq446.execute-api.us-east-1.amazonaws.com/default/discordEmbed-Alternate?author={textMid}&url={url}&provider={textUp}&providerURL={url}&title=ee" type="application/json+oembed" title="JSON EMBED TITLE">
            <meta http-equiv = "refresh" content = "0; url = 'https://anilist.co/anime/{idAnilist}'" />
        
        </head>
        <body>
            
        
        
        </body>
        </html>`;
        
        let websiteForImage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            
            <meta content='text/html; charset=UTF-8' http-equiv='Content-Type' />
            <meta content="{color}" data-react-helmet="true" name="theme-color" />
        	<meta property="og:site_name" content="{textUp}" />
        	<meta property="og:type" content="website" />
        	<meta content="{textDown} | {textMid}" property="og:title" />
        	<meta content="{textDown} | {textMid}" property="twitter:title" />
        	<meta content="{thumbnail}" property="og:image" />
        	<meta content="{thumbnail}" property="twitter:image" />
        	<meta content="photo" name="twitter:card" />
        	<meta content="auto" property="og:determiner" />
        	<meta content="https://anilist.co/anime/{idAnilist}" property="og:url" />
        	<meta content="{textDown} | {textMid}" property="og:description" />
            
            
            <meta http-equiv = "refresh" content = "0; url = 'https://anilist.co/anime/{idAnilist}'" />
        
        </head>
        <body>
            
        
        
        </body>
        </html>`;
    
    try {
    
        if (!("queryStringParameters" in event && "id" in event.queryStringParameters)) {
            const response = {
                statusCode: 200,
                headers: { "content-type": "text/html" },
                body: '<!DOCTYPE html> <html> <head> <title>EldoBOT.js</title> <meta http-equiv="refresh" content="0; url = https://github.com/Eldoprano/EldoBOT.js" /> </head> </html>',
                //body: JSON.stringify(database),
            };
            return response;
        }
        
        
        const id = encodeURIComponent(event.queryStringParameters.id);
        // Set NSFW value (false by default)
        let nsfw = false;
        if ("nsfw" in event.queryStringParameters && event.queryStringParameters.nsfw === '1') {
            nsfw = true;
        }
    
        // Data to search on Database
        const params = {
            TableName: 'traceMOE',
            Key:{
                "id": id,
            },
        };
        
        // Get results from database
        const data = await database.get(params).promise();

        if (!nsfw && data.Item.adult) {
            data.Item.image = data.Item.censoredImage;
            data.Item.video = data.Item.censoredImage;
            website = websiteForImage;
        }

        // Replace placeholders with DB data
        website = website.replace(/{textDown}/g, data.Item.name)
                        .replace(/{textMid}/g, "Episode: " + data.Item.episode)
                        .replace(/{textUp}/g, convertHMS(data.Item.timestamp))
                        .replace(/{color}/g, data.Item.color)
                        .replace(/{thumbnail}/g, data.Item.image)
                        .replace(/{video}/g, data.Item.video)
                        .replace(/{width}/g, data.Item.width)
                        .replace(/{height}/g, data.Item.height)
                        .replace(/{idAnilist}/g, data.Item.idAnilist);
                        
        // This should be changed to just return website in the future. 
        // It's good for debugging now (and it doesn't break Discord)
        website = "<!-- ID: " + id + "\ndata: " + JSON.stringify(data) + "\nHTML -->" + website; 
                        
        const response = {
            statusCode: 200,
            headers: { "content-type": "text/html" },
            body: website,
            //body: JSON.stringify(database),
        };
        return response;
            
            
            
            
    } catch (e) {
        // Return the error, if there was one
        const response = {
                statusCode: 400,
                headers: { "content-type": "text/html" },
                body: e + JSON.stringify(e),
                //body: JSON.stringify(database),
            };
        return response;
    }
};


// Get a String saying the time. Input: 42069 Output: 00:32:05
function convertHMS(value) {
    const sec = parseInt(value, 10); // convert value to number if it's string
    let hours = Math.floor(sec / 3600); // get hours
    let minutes = Math.floor((sec - (hours * 3600)) / 60); // get minutes
    let seconds = sec - (hours * 3600) - (minutes * 60); //  get seconds
    // add 0 if value < 10; Example: 2 => 02
    if (hours < 10) {hours = "0" + hours;}
    if (minutes < 10) {minutes = "0" + minutes;}
    if (seconds < 10) {seconds = "0" + seconds;}
    return hours + ':' + minutes + ':' + seconds; // Return is HH : MM : SS
}