const Command = require("../../base/Command.js");
const statsTools = require('../../base/statsTools.js');

module.exports = class EmojiStatsFiller extends Command {
    constructor(client) {
      super(client, {
        name: "emoji_stats_filler",
        category: "Owner",
        description: "Fills the statistics with info from the last 5000 messages of each channel.",
        usage: "emoji_stats_filler",
        permLevel: "Bot Owner",
      });
    }
  
    async run(message, args, level) { // eslint-disable-line no-unused-vars
      const guild = message.guild;
      const channels = await guild.channels.fetch();
      const number_of_messages = 5000;
      let progress_message = "Filling the statistics...\nChannels found: " + channels.size;
  
      // this.client.emoji_stats_guild.clear();
      // this.client.emoji_stats_user.clear();
  
      let progress_updater = await message.channel.send(progress_message);
  
      // Loop over every channel, we just want the text based ones
      for (let channel of channels) {
        channel = channel[1];
        if (channel.type !== "GUILD_TEXT") {
          continue;
        }

        // If the channel has the word "mudae", "log" or "logs" in it, ignore it
        if (channel.name.toLowerCase().search(/\b(mudae|log|logs)\b/) !== -1) {
            continue;
        }
        
        progress_message += "\n🔎Analyzing channel: " + channel.name + "...";
        if (progress_message.length > 1950) {
            progress_message = "🔎Analyzing channel: " + channel.name + "...";
            progress_updater = await message.channel.send(progress_message);
        } else {
            await progress_updater.edit(progress_message);
        }
  
        const out = [];
        if (number_of_messages <= 100) {
          const messages = await channel.messages.fetch({ limit: number_of_messages });
          out.push(...messages.values());
        } else {
          const rounds = (number_of_messages / 100) + (number_of_messages % 100 ? 1 : 0);
          let last_id = "";
          for (let x = 0; x < rounds; x++) {
            const options = {
              limit: 100,
            };
            if (last_id.length > 0) {
              options.before = last_id;
            }
            const messages = await channel.messages.fetch(options);
            out.push(...messages.values());
            if (out.length == 0 || last_id == out[out.length - 1].id) {
              break;
            }
            last_id = out[out.length - 1].id;
          }
        }
  
        for (const a_message of out) {
          statsTools.emoji_stats_updated.apply(this, [a_message]);
        }
        progress_message += "✅";
        await progress_updater.edit(progress_message);
      }
      progress_message += "\nDone!";
      await progress_updater.edit({ content: progress_message, files: ["https://media.tenor.com/vfV8NjmUaagAAAAC/hakase-eating.gif"] });
    }
  };