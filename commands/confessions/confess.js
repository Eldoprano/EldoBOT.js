const Command = require("../../base/Command.js");
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');

module.exports = class Confess extends Command {
    constructor(client) {
        super(client, {
            name: "confess",
            description: "Te permite confesar algo anónimamente 😳",
            usage: "confess <Me gusta ||DeCo||>",
            guildOnly: false,
        });
    }

    async run(message, args, level) {
        if (!this.client.users.get(message.author.id)) {
            this.client.users.set(message.author.id, {
                'anonNick': '',
                'anonDefault': true,
                'anonImage':'',
            });
        }
    }
};