const Command = require("../../base/Command.js");
const searchTools = require('../../base/searchTools.js');
const config = require('../../config.js');
const { Player, RepeatMode } = require("discord-music-player");
let player;

module.exports = class traceMOE extends Command {
    constructor(client) {
        super(client, {
            name: 'play',
            description: 'May play some tunes',
            category: 'music',
            options: [],
            guildOnly: false, // Set this to false if you want it to be global.
        });

        // Configure Music bot
        this.client.player = new Player(client, {
            leaveOnEmpty: false, // This options are optional.
        });
    }

    async run(message, [action, key, ...value], level) {
        const guildQueue = this.client.player.getQueue(message.guild.id);
        const queue = this.client.player.createQueue(message.guild.id);
        await queue.join(message.member.voice.channel);
        let song = await queue.play(action + key + value.join(' ')).catch(_ => {
            if (!guildQueue) {
                queue.stop();
            }
        });
    }
};