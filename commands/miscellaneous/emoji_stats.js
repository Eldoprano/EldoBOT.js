const Command = require("../../base/Command.js");
const moment = require('moment-timezone');
const { MessageActionRow, MessageButton } = require('discord.js');

module.exports = class EmojiStats extends Command {
  constructor(client) {
    super(client, {
      name: "emoji_stats",
      category: "miscellaneous",
      description: "Gives some stats [in development].",
      usage: "emoji_stats",
      // permLevel: "Bot Owner",
    });
  }

  async run(message, args, level) { // eslint-disable-line no-unused-vars
    // Get the statistics for the current guild
    const guild_stats = this.client.emoji_stats_guild.get(message.guild.id.toString());

    // Get all the emojis sent on the current day, week and month
    const lowest_day_timestamp = moment().tz('America/Lima').startOf('day').unix();
    const lowest_day_emojis = this.filter_by_timestamp(guild_stats, lowest_day_timestamp);
        
    const lowest_week_timestamp = moment().tz('America/Lima').startOf('week').unix();
    const lowest_week_emojis = this.filter_by_timestamp(guild_stats, lowest_week_timestamp);
    
    const lowest_month_timestamp = moment().tz('America/Lima').startOf('month').unix();
    const lowest_month_emojis = this.filter_by_timestamp(guild_stats, lowest_month_timestamp);

    // Combine the counters and sort the emoji data from high to low
    const day_top_emojis = this.combine_and_sort_stats(lowest_day_emojis);
    const day_top_emojis_names = Object.keys(day_top_emojis).sort((a, b) => day_top_emojis[b] - day_top_emojis[a]);
    
    const week_top_emojis = this.combine_and_sort_stats(lowest_week_emojis);
    const week_top_emojis_names = Object.keys(week_top_emojis).sort((a, b) => week_top_emojis[b] - week_top_emojis[a]);
    
    const month_top_emojis = this.combine_and_sort_stats(lowest_month_emojis);
    const month_top_emojis_names = Object.keys(month_top_emojis).sort((a, b) => month_top_emojis[b] - month_top_emojis[a]);

    // Create the initial fields
    // const field_data = this.fill_fields(title, top_emojis, top_emojis_names, begin, number_of_emojis);
    // Returns a field object with the data to be sent
    const emojis_per_page = 10;
    const number_of_pages = Math.ceil(day_top_emojis_names.length / emojis_per_page);

    let field_data = [
        this.fill_fields("Día", day_top_emojis, day_top_emojis_names, 0, emojis_per_page),
        this.fill_fields("Semana", week_top_emojis, week_top_emojis_names, 0, emojis_per_page),
        this.fill_fields("Mes", month_top_emojis, month_top_emojis_names, 0, emojis_per_page),
    ];

    const pageButtons = [new MessageActionRow()
    .addComponents(
      new MessageButton().setCustomId('previous')
                         .setLabel('◀')
                         .setStyle('PRIMARY'))
                         .addComponents(
      new MessageButton().setCustomId('next')
                         .setLabel('▶')
                         .setStyle('PRIMARY'))];

    let discord_message = await message.channel.send({
      embeds: [{
          color: 3447003,
          title: "Emoji Stats",
          fields: field_data,
          footer: { "text": "Page 1/" + (number_of_pages + 1) },
      }],
      components: pageButtons,
      // fetchReply: true,
    });

    const collector = await discord_message.createMessageComponentCollector({ componentType: 'BUTTON', time: 1800_000 }); // 30 minutes  1800_000

    let currentResultPage = 0;
    collector.on('collect', async (i) => {
      switch (i.customId) {
        case 'previous':
          if (currentResultPage <= 0) {
            currentResultPage = number_of_pages;
          } else {
            currentResultPage -= 1;
          }
          break;
        case 'next':
          if (currentResultPage >= number_of_pages) {
            currentResultPage = 0;
          } else {
            currentResultPage += 1;
          }
          break;
        default: break;
      }
      if (!discord_message) { return; } // Ignore if message was deleted
      i.deferUpdate();
      // Update Discord message
      field_data = [
        this.fill_fields("Día", day_top_emojis, day_top_emojis_names, currentResultPage * emojis_per_page, emojis_per_page),
        this.fill_fields("Semana", week_top_emojis, week_top_emojis_names, currentResultPage * emojis_per_page, emojis_per_page),
        this.fill_fields("Mes", month_top_emojis, month_top_emojis_names, currentResultPage * emojis_per_page, emojis_per_page),
      ];
      discord_message = await discord_message.edit({ 
        embeds: [{
          color: 3447003,
          title: "Emoji Stats",
          fields: field_data,
          footer: { "text": "Page " + (currentResultPage + 1) + "/" + (number_of_pages + 1) },
        }],
        components: pageButtons,
      });
    });

    // Deactivate buttons if we are not reading them anymore
    collector.on('end', async () => {
      if (!discord_message) {return; }
      discord_message.edit({ embeds: [{
        color: 3447003,
        title: "Emoji Stats",
        fields: field_data,
        footer: { "text": "Page " + (currentResultPage + 1) + "/" + (number_of_pages + 1) },
      }], components: deactivateButtons([pageButtons]) });

      function deactivateButtons(buttons) {
        buttons.forEach(buttonRow => {
          buttonRow.components.forEach(button => {
            button.setDisabled();
          });
        });
        return buttons;
      }
    });

    // await message.channel.send("```json\n" + JSON.stringify((JSON.parse(this.client.emoji_stats_guild.export())),null, 2) + "```");
    // await message.channel.send("```json\n" + JSON.stringify((JSON.parse(this.client.emoji_stats_user.export())),null, 2) + "```");
  }

  filter_by_timestamp(guild_stats, lowest_day_timestamp) {
    const lowest_day_emojis = {};
    for (const timestamp in guild_stats.stats) {
      if (timestamp >= lowest_day_timestamp) {
        lowest_day_emojis[timestamp] = guild_stats.stats[timestamp];
      }
    }
    return lowest_day_emojis;
  }

  fill_fields(title, top_emojis, top_emojis_names, begin, number_of_emojis) { 
    if (top_emojis_names.length == 0) {
      return {
        name: title,
        value: "None :<",
        inline: true,
      };
    }
    let emoji_out_stats = "";

    // The Verhalten we want to simulate with this is:
    // User scrolls through page results. One category suddenly has no more info to show, but the other have more pages.
    // Once the user access the next page, we want that category wothout more pages to show it's last page.
    if (begin >= top_emojis_names.length) {
        begin = Math.max(top_emojis_names.length - number_of_emojis, 0);
    }
    for (let i = begin; i < begin + Math.min(top_emojis_names.length, number_of_emojis); i++) {
      emoji_out_stats += `${top_emojis_names[i]} - ${top_emojis[top_emojis_names[i]]}\n`;
    }
    
    const field_data = {
      name: title,
      value: emoji_out_stats,
      inline: true,
    };
    return field_data;
  }

  combine_and_sort_stats(guild_stats) {
    const top_emojis = {};
    for (const timestamp in guild_stats) {
      for (const emoji_id in guild_stats[timestamp]) {
        const emoji_code = "<:" + guild_stats[timestamp][emoji_id].name + ":" + emoji_id + ">";
        if (top_emojis[emoji_code] === undefined) {
          top_emojis[emoji_code] = 0;
        }
        top_emojis[emoji_code] += guild_stats[timestamp][emoji_id].counter;
      }
    }
    return top_emojis;
  }
};