const moment = require('moment-timezone');

const discordEmojiRegex = /<a?:(\w+):(\d+)>/g;

function emoji_stats_updated(message) {
  // Ignore if bot
  if (message.author.bot) return;
  // -- First we extract the emoji from the message --
  // Regex to extract name and id from the Discord message
  let emojiArray = [];
  const discordEmojis = message.content.matchAll(discordEmojiRegex);
  if (discordEmojis) {
    for (const emojiMatch of discordEmojis) {
      const name = emojiMatch[1];
      const id = emojiMatch[2];
      emojiArray.push({ name: name, id: id });
    }
  }

  if (emojiArray.length == 0) {
    return;
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
  const timestamp = moment(message.createdAt).tz('America/Lima').startOf('day').unix();

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

module.exports.emoji_stats_updated = emoji_stats_updated;