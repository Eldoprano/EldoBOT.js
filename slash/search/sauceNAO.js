const slashCommand = require('../../base/slashCommand.js');
const sagiri = require('sagiri');
const config = require('../../config.js');
const { MessageActionRow, MessageButton } = require('discord.js');
const searchTools = require('../../base/searchTools.js');


const sauceNAO_token = config.sauceNAO_token;
const sauceNAO_client = sagiri(sauceNAO_token);

module.exports = class sauceNAO extends slashCommand {

  constructor(client) {
    super(client, {
      name: 'name',
      description: 'Searches the origin of an image',
      options: [],
      guildOnly: true, // Set this to false if you want it to be global.
    });
  }

  async run(client, interaction) {
    try {
      await interaction.deferReply();

      const results = await sauceNAO_client('https://media.discordapp.net/attachments/653348223901237250/886391161172946944/unknown.png');
      let currentResultPage = 0;

      // console.log(results);
      const pageButtons = new MessageActionRow()
                            .addComponents(
                              new MessageButton()
                                .setCustomId('previous')
                                .setLabel('PREVIOUS')
                                .setStyle('PRIMARY'))
                            .addComponents(
                              new MessageButton()
                                .setCustomId('next')
                                .setLabel('NEXT')
                                .setStyle('PRIMARY'),
                            );

      console.log('INTERACTION', interaction);
      let currentPage = await interaction.editReply({
        embeds: [searchTools.makeEmbed(results[currentResultPage], currentResultPage, interaction.member.displayName)],
        components: [pageButtons],
        fetchReply: true,
      });

      const collector = await currentPage.createMessageComponentCollector({ componentType: 'BUTTON', time: 300000 });

      collector.on('collect', async (i) => {
        // console.log('WARE WARE COLLECTOR',i)
        switch (i.customId) {
          case 'previous':
            if (currentResultPage <= 0) {
              currentResultPage = results.length;
            } else {
              currentResultPage -= 1;
            }
            break;
          case 'next':
            if (currentResultPage >= results.length - 1) {
              currentResultPage = 0;
            } else {
              currentResultPage += 1;
            }
            break;
          default:
            break;
        }
        i.deferUpdate();
        currentPage = await interaction.editReply({ embeds: [searchTools.makeEmbed(results[currentResultPage], currentResultPage, interaction.member.displayName)], components: [pageButtons] });
      });

    } catch (e) {
      console.log(e);
      return await interaction.editReply(`There was a problem with your request.\n\`\`\`${e.message}\`\`\``);
    }
  }
};