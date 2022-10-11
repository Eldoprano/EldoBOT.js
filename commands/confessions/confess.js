const Command = require("../../base/Command");
const globals = require('../../base/Globals');

module.exports = class Confess extends Command {
    constructor(client) {
        super(client, {
            name: "confess",
            aliases: ["anon"],
            description: "Te permite confesar algo anónimamente 😳",
            category: "Confess",
            options: [],
            usage: "confess <Me gusta ||DeCo||>",
            guildOnly: false,
        });
    }

    async run(message, args, level) {
        // Get necessary info before deleting the message
        const author_id = message.author.id;
        const guild_id = message.guild.id;
        const msgchannel = message.channel;
        await message.delete();

        // Get the key where the user info may be
        const key = `${guild_id}-${author_id}`;
        // Fill defaults if user didn't existed
        const userConf = this.client.users_conf.ensure(key, globals.defaultUserConf);
        let textToSend = args.join(' ');
        textToSend = await this.client.clean(textToSend);

        // Makes the user IDs change every ~12 days
        const currentTime = Math.floor(Math.floor(+new Date() / 1000) / 1000000);

        // Set defaults if user didn't set personalized values here
        if (!userConf.anon.image) {
            userConf.anon.image = globals.defaultAnonPhoto[(currentTime + author_id) % globals.defaultAnonPhoto.length];
        }
        if (!userConf.anon.name) {
            userConf.anon.name = "Usuario anónimo #" + ((10267 * author_id + currentTime) % 10000 ); // A lazy hash :P
        }

        const anonWebhook = await msgchannel.createWebhook(userConf.anon.name, {
            avatar: userConf.anon.image,
            reason: 'eldoBOT Anon-Confess Webhook',
        });


        await anonWebhook.send(textToSend);
        await anonWebhook.delete();
       // */
    }
};