// The MESSAGE event runs anytime a message is received
// Note that due to the binding of client to every event, every event
// goes `client, other, args` when this function is run.

const { RESIZE_NEAREST_NEIGHBOR } = require("jimp");
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const fs = require('fs');
const moment = require('moment-timezone');

const suspicious_words = ["nitro", "steam", "gift", "airdrop", "skin", "trade", "trading", "@everyone"];
const safe_websites = ["https://media.discordapp.net/", "https://images-ext-1.discordapp.net/", "https://tenor.com/"];

module.exports = class {
  constructor(client) {
    this.client = client;
  }

  async run(message) {

    // It's good practice to ignore other bots. This also makes your bot ignore itself
    //  and not get into a spam loop (we call that "botception").
    if (message.author.bot) return;

    // Handle spam messages
    spam_handler(message);

    // Get emoji stats
    emoji_stats_updated.apply(this, [message]);

    // Grab the settings for this server from the Enmap
    // If there is no guild, get default conf (DMs)
    const settings = message.settings = this.client.getSettings(message.guild);

    // Checks if the bot was mentioned, with no message after it, returns the prefix.
    const prefixMention = new RegExp(`^<@!?${this.client.user.id}> ?$`);
    if (message.content.match(prefixMention)) {
      return message.reply(`En este servidor me puedes llamar usando \`${settings.prefix}\``);
    }

    // Also good practice to ignore any message that does not start with our prefix,
    // which is set in the configuration file.
    // But first, we ignore the return if the message.content as the word "name" as the first word
    if (message.content.toLowerCase().split()[0] == "name" && message.content.split().length == 1) {
      message.content = settings.prefix + message.content;
    } else if (message.content.indexOf(settings.prefix) !== 0) { return; }

    // Here we separate our "command" name, and our "arguments" for the command.
    // e.g. if we have the message "+say Is this the real life?" , we'll get the following:
    // command = say
    // args = ["Is", "this", "the", "real", "life?"]
    const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // If the member on a guild is invisible or not cached, fetch them.
    if (message.guild && !message.member) await message.guild.members.fetch(message.author);

    // Get the user or member's permission level from the elevation
    const level = this.client.permlevel(message);

    // Check whether the command, or alias, exist in the collections defined
    // in app.js.
    const cmd = this.client.commands.get(command) || this.client.commands.get(this.client.aliases.get(command));
    // using this const varName = thing OR otherThing; is a pretty efficient
    // and clean way to grab one of 2 values!
    if (!cmd) return;

    // Some commands may not be useable in DMs. This check prevents those commands from running
    // and return a friendly error message.
    if (cmd && !message.guild && cmd.conf.guildOnly) {
      return message.channel.send("Sorry :/ No puedo usar este comando por DMs. Intenta ejecutándolo en un server.");
    }
    // Do a quick little check to see if the command is actually enabled, if it isn't stop.
    if (!cmd.conf.enabled) return;

    if (level < this.client.levelCache[cmd.conf.permLevel]) {
      if (settings.systemNotice === "true") {
        return message.channel.send(`No tienes los permisos suficientes para ejecutar este comando.
Tu nivel de permiso es ${level} (${this.client.config.permLevels.find(l => l.level === level).name})
Este comando requiere un nivel de ${this.client.levelCache[cmd.conf.permLevel]} (${cmd.conf.permLevel})`);
      } else {
        return;
      }
    }

    // To simplify message arguments, the author's level is now put on level (not member, so it is supported in DMs)
    // The "level" command module argument will be deprecated in the future.
    message.author.permLevel = level;

    message.flags = [];
    while (args[0] && args[0][0] === "-") {
      message.flags.push(args.shift().slice(1));
    }

    // If the command exists, **AND** the user has permission, run it.
    try {
      await cmd.run(message, args, level);
      this.client.logger.log(`${this.client.config.permLevels.find(l => l.level === level).name} ${message.author.id} ran command ${cmd.help.name}`, "cmd");
    } catch (e) {
      message.channel.send({ content: `Tuvimos un problema con tu mensaje.\n\`\`\`${e.message}\`\`\``, files: ['https://i.kym-cdn.com/photos/images/newsfeed/000/708/396/3d6.gif'] })
        .catch(ee => console.error("An error occurred replying on an error", ee));
    }
  }


};

async function spam_handler(message) {
  if (message.channel.type === "dm") return;
  if (message.content.length < 25) return;

  const message_to_analyse = message.content.toLowerCase();

  // Check if the message contains http(s) or www.
  if (message_to_analyse.includes("http") || message_to_analyse.includes("www.")) {
    // Check if the message contains a safe website
    if (safe_websites.some(word => message_to_analyse.includes(word))) {
      return;
    }
    // Check if the message contains suspicious words
    if (suspicious_words.some(word => message_to_analyse.includes(word))) {
      // It's a suspicious message. Send a message telling the user to react to it in 10 seconds or it will be deleted.
      const user_reaction = new MessageActionRow()
        .addComponents(
          new MessageButton()
            .setCustomId('confirm')
            .setLabel('No es spam!')
            .setStyle('PRIMARY'));

      // Send warning to user as an embed
      const embedWithResults = new MessageEmbed()
        .setTitle("Posible spam detectado..")
        .setDescription(` Hey ${message.author}, tu mensaje me suena mucho a spam... 
                        Presiona el botón en los próximos 10 segundos o tu mensaje será eliminado.`);
      const spam_alert = await message.channel.send(
        {
          embeds: [embedWithResults],
          components: [user_reaction],
        },
      );
      let message_confirmed = false;
      const collector = await spam_alert.createMessageComponentCollector({ componentType: 'BUTTON', time: 11000 });

      collector.on('collect', async (i) => {
        i.deferUpdate();
        switch (i.customId) {
          case 'confirm':
            // If the reaction came from the user who sent the message, delete it.

            if (i.user.id === message.author.id) {
              message_confirmed = true;
              await spam_alert.delete();
            }
        }
      });

      console.log("Sus msg in #" + message.channel.name + ": " + message.content);
      // Write the same message to the ./spam.log file, together with the user who sent it and the time.
      fs.appendFile("./spam.log", `${message.createdAt.toLocaleString("de-DE")} | ${message.author.id} - @${message.author.username} - # ${message.channel.name}:\n${message.content}\n------\n`, function (err) {
        if (err) {
          console.log(err);
        }
      });

      collector.on('end', async () => {
        if (!message_confirmed) {
          console.log("Sus nomore #" + message.channel.name + ": " + message.content);
          await spam_alert.delete();
          try {
            await message.delete();
          } catch (e) {
            // pass
          }
        }
      });

    }
  }
}

async function emoji_stats_updated(message) {
  // -- First we extract the emoji from the message --
  // Regex to extract name and id from the Discord message
  const discordEmojiRegex = /<a?:(\w+):(\d+)>/g;
  let emojiArray = [];
  const discordEmojis = message.content.matchAll(discordEmojiRegex);
  if (discordEmojis) {
    for (const emojiMatch of discordEmojis) {
      const name = emojiMatch[1];
      const id = emojiMatch[2];
      emojiArray.push({ name: name, id: id });
    }
  }
  // Remove all duplicates from emojiArray. Those who have the same name and ID
  const uniqueArray = [];
  for (let i = 0; i < emojiArray.length; i++) {
    const item = emojiArray[i];
    if (!uniqueArray.find(uniqueItem => uniqueItem.id === item.id)) {
      uniqueArray.push(item);
    }
  }
  emojiArray = uniqueArray;

  // -- Then we update the emoji entries
  const guild_id = message.guild.id.toString();
  const guild_name = message.guild.name;

  const user_id = message.author.id.toString();
  const user_name = message.author.username;

  // Get the timestamp to use. This will be the unix timestamp for the current day in Perú, at 00:00
  const timestamp = moment().tz('America/Lima').startOf('day').unix();
  
  // Get the info from the database. If not existing, return the default
  const db_guildEmoji = this.client.emoji_stats_guild.ensure(guild_id, {
    name: guild_name,
    stats: {},
  });
  const db_userEmoji = this.client.emoji_stats_user.ensure(user_id, {
    name: user_name,
    private: false,
    stats: {},
  });

  // Update the emoji stats of the guild and the user
  for (const emoji of emojiArray) {
    const emoji_id = emoji.id.toString();
    
    // First we make sure both have at least the defaults
    if (!db_guildEmoji.stats[timestamp]) {
        db_guildEmoji.stats[timestamp] = {};
    }
    if (!db_guildEmoji.stats[timestamp][emoji_id]) {
      db_guildEmoji.stats[timestamp][emoji_id] = {
        name: emoji.name,
        counter: 0,
      };
    }
    if (!db_userEmoji.stats[timestamp]) {
      db_userEmoji.stats[timestamp] = {};
    }
    if (!db_userEmoji.stats[timestamp][emoji_id]) {
      db_userEmoji.stats[timestamp][emoji_id] = {
        name: emoji.name,
        counter: 0,
      };
    }

    // And then we update the stats of the emoji
    db_userEmoji.stats[timestamp][emoji_id].counter++;
    db_guildEmoji.stats[timestamp][emoji_id].counter++;
  }
  // To finish, we write changes to the db
  this.client.emoji_stats_guild.set(guild_id, db_guildEmoji);
  this.client.emoji_stats_user.set(user_id, db_userEmoji);
}
