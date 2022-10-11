const { MessageEmbed } = require('discord.js');
const Command = require("../../base/Command");
const config =  require('../../config.js');
const fetch = require('node-fetch');

module.exports = class setWebConfess extends Command {
    constructor(client) {
        super(client, {
            name: "set_web_confess",
            description: "Configura WebConfess en el server",
            category: "Confess",
            options: [],
            usage: "set_web_confess",
            guildOnly: true,
            permLevel: "Administrator",
        });
    }

    // This command will create a webhook on the channel it's called from. 
    // Then it will send this to our API. The API creates a new entry and sends us a tempID
    // We then use this tempID as a name for the channel containing the instructions for web confess
    async run(message, args, level) {
        console.log("setWebConfess running");
        // Crea el webhook
        const confessWebhook = await message.channel.createWebhook("Web Confessions", {
            avatar: "https://media.discordapp.net/attachments/708648213774598164/912026675171192882/unknown.png?height=64&width=64",
            reason: 'Web-Confessions Webhook',
        });
        const serverID = message.guild.id;
        let tempID = "";

        // Add this webhook to our API
        const params = new URLSearchParams();
        params.append('serverID', serverID);
        params.append('webhook_url', confessWebhook.url);
        params.append('secret', config.webConfessSecret);
        const response = await fetch('https://bot.gabby.moe/confessionHandler/add_server', {
            method: 'POST',
            body: params,
        });

        // The API responds with a tempID or errors
        if (response.ok) {
            tempID = await response.text();
        } else if (response.status === 403) {
            message.channel.send("La SECRET KEY usada es incorrecta. Por favor, contacta a un administrador.");
        } else if (response.status === 409) {
            message.channel.send("Ya existe un WebConfess en este servidor. Por favor, contacta a un administrador.");
        } else {
            message.channel.send("Ha ocurrido un error. Por favor, contacta a un administrador.");
        }
        
        // Create the Webhook message with the tempID, and send it
        const embedWithResults = generateConfessIDWebhook(tempID);
        const webhookMessage = await confessWebhook.send({ 
            embeds: [embedWithResults],
            username: "EldoBOT",
            avatar_url: "https://media.discordapp.net/attachments/708648213774598164/912026675171192882/unknown.png?height=64&width=64",      
        });
        const webhookMessageID = webhookMessage.id;

        // Save the message sent with the webhook in the JSON file ../../data/webhooks.json
        // That way we can edit it later
        const webhooks = require('../../data/webhooks.json');
        webhooks.push({
            url: "https://discord.com/api/webhooks/" + 
                        confessWebhook.id + "/" + 
                        confessWebhook.token + 
                        "/messages/" + webhookMessageID,
            serverID: message.guild.id,
        });
        // Save the JSON file
        require('fs').writeFileSync('./data/webhooks.json', JSON.stringify(webhooks, null, 4));
    }
};

function generateConfessIDWebhook(tempID) {
    return new MessageEmbed()
            .setTitle("Confesiónes web activadas!")
            .setDescription("Ahora podrás enviar mensajes anónimos a este canal vía web!\nEstos mensajes tendrán un cooldown global, para evitar spam.")
            .setColor(1153422)
            .setFooter("By Doprano")
            .setFields(
                [
                    {
                        "name": "Link web",
                        "value": "[Acceder vía web](https://bot.gabby.moe/confess?tempID=" + tempID + ")",
                        "inline": true,
                    },
                    {
                        "name": "Link onion",
                        "value": "[Acceder vía tor](http://dopranoba7plfc56joinjqf45r4egjoczqmey6zrecfl4phm76jym3id.onion/bot/confess?tempID=" + tempID + ")",
                        "inline": true,
                    },
                    {
                        "name": "Código (normalmente no es necesario)",
                        "value": "__**" + tempID + "**__",
                    },
            ])
            .setTimestamp();
}

// Function that runs every 1 hour, reads the JSOn webhooks.json and edit's it's messages
// This function is called by the bot.js file
async function editWebhooks() {
    //console.log("[Webhooks] Actualizando webhooks ids");
    // Open webhooks.json
    const webhooks = require('../../data/webhooks.json');
    // For each webhook in the JSON file
    for (let i = 0; i < webhooks.length; i++) {
        // Get the webhook
        const webhook = webhooks[i].url;
        const serverID = webhooks[i].serverID;
        let newTempID = "";	

        // Send a GET request to bot.gabby.moe/confessionHandler/change_tempID/:secret/:serverID
        // The response will be the new tempID
        const newTempID_response = await fetch('https://bot.gabby.moe/confessionHandler/change_tempID/' + config.webConfessSecret + '/' + serverID);
        // If the response is ok, edit the webhook message with PATCH
        if (newTempID_response.ok) {
            newTempID = await newTempID_response.text();
            const discordResponse = await fetch(webhook, { 
                method: 'PATCH', 
                body: JSON.stringify({
                    embeds: [generateConfessIDWebhook(newTempID).toJSON()],
                    username: "EldoBOT",
                    avatar_url: "https://media.discordapp.net/attachments/708648213774598164/912026675171192882/unknown.png?height=64&width=64",
                }), 
                headers: { 'Content-Type': 'application/json' } });
            if (discordResponse.ok) {
                // console.log("[Webhooks] Webhook actualizado");
            } else {
                const errorResponse = await discordResponse.text();
                if (errorResponse === "Unknown Webhook") {
                    console.log("[Webhooks] Webhook fué eliminado");
                    webhooks.splice(i, 1);
                    i--;
                } else {
                    console.log("[Webhooks] Error al actualizar webhook " + webhook);
                    console.log(errorResponse);
                }
            }
        } else {
            console.log(newTempID_response.status);
            console.log("Error al cambiar el tempID de " + serverID + " webhook " + webhook);
        }
    }
}

// call EditWebhooks every 1 hour
setInterval(editWebhooks, 3600000);

//setInterval(editWebhooks, 60000);
editWebhooks();