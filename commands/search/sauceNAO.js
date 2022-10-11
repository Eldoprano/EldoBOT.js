const Command = require("../../base/Command.js");
const sagiri = require('sagiri');
const config = require('../../config.js');
const { MessageActionRow, MessageButton } = require('discord.js');
const searchTools = require('../../base/searchTools.js');
const globals = require("../../base/Globals");


const sauceNAO_token = config.sauceNAO_token;
const sauceNAO_client = sagiri(sauceNAO_token);

module.exports = class sauceNAO extends Command {
  constructor(client) {
    super(client, {
      name: 'name',
      description: 'Searches the origin of an image',
      category: 'search',
      options: [],
      guildOnly: false, // Set this to false if you want it to be global.
    });
  }

  async run(message, [action, key, ...value], level) {
    try {
      let urlToSearch;
      if (message.attachments.size == 0) {return;}
      if (message.attachments.first()) {
        urlToSearch = message.attachments.first().url;
      } else {
        // Search for a link on the message if it doesn't have an attachment
        urlToSearch = searchTools.extractURLs(message.content);
        if (urlToSearch) {
          urlToSearch = urlToSearch[0];
        } else {
          // If it doesn't contain an URL, ignore message
          return;
        }
      }
      await message.channel.sendTyping();
      // console.log("All results", results);
      
      
      // console.log(results);
      const pageButtons = new MessageActionRow()
        .addComponents(
          new MessageButton().setCustomId('previous')
                             .setLabel('◀')
                             .setStyle('PRIMARY'))
                             .addComponents(
          new MessageButton().setCustomId('next')
                             .setLabel('▶')
                             .setStyle('PRIMARY'))
                             .addComponents(
          new MessageButton().setCustomId('links')
                             .setLabel('LINKS DE BÚSQUEDA')
                             .setStyle('SECONDARY'))
                             .addComponents(
          new MessageButton().setCustomId('delete')
                             .setLabel('🗑️')
                             .setStyle('DANGER'));
     
      const linksButtons_1 = new MessageActionRow()
        .addComponents(
          new MessageButton().setLabel('YANDEX')
                             .setURL('https://yandex.com/images/search?rpt=imageview&url=' + urlToSearch)
                             .setStyle('LINK'))
                            .addComponents(
          new MessageButton().setLabel('GOOGLE')
                             .setURL('https://www.google.com/searchbyimage?image_url=' + urlToSearch)
                             .setStyle('LINK'))
                             .addComponents(
          new MessageButton().setLabel('ASCII2D')
                             .setURL('https://ascii2d.net/search/url/' + urlToSearch)
                             .setStyle('LINK'));

      const linksButtons_2 = new MessageActionRow()
        .addComponents(
          new MessageButton().setLabel('IMAGE-OPS')
                             .setURL('https://imgops.com/' + urlToSearch)
                             .setStyle('LINK'))
                             .addComponents(
          new MessageButton().setLabel('TINY-EYE')
                             .setURL('https://www.tineye.com/search/?url=' + urlToSearch)
                             .setStyle('LINK'))
                             .addComponents(
          new MessageButton().setCustomId('back')
                             .setLabel('BACK')
                             .setStyle('PRIMARY'));
                                
      const linksButtons = [linksButtons_1, linksButtons_2];

      // Not used at the moment. Waiting for Sagiri to update the wrapper that filters NSFW out
      //const isChannelNSFW = message.channel.nsfw;
                              
      let currentResultPage = 0;
      let currentPage;
      let currentButtons = [pageButtons];
      let results = await sauceNAO_client(urlToSearch);

      // Show first result page to user, together with buttons
      currentPage = await message.reply({
        embeds: [searchTools.makeEmbed(results[currentResultPage], "Loading!!", urlToSearch, searchTools.getUsername(message), message.author.avatarURL())],
        components: currentButtons,
        fetchReply: true,
      });

      // Upload to Discord asynchronically and update results when finished
      searchTools.sauceToDiscord(results).then(out => { 
        results = out;
        if (!currentPage) { return; } // Ignore if message was already deleted
        currentPage.edit({ embeds: [searchTools.makeEmbed(results[currentResultPage], currentResultPage, urlToSearch, searchTools.getUsername(message), message.author.avatarURL())], components: currentButtons }).then(discordMsg => {
          currentPage = discordMsg;
        });
      });
      
      const collector = await currentPage.createMessageComponentCollector({ componentType: 'BUTTON', time: 1800_000 }); // 30 minutes  1800_000
      
      collector.on('collect', async (i) => {
        switch (i.customId) {
          case 'previous':
            if (currentResultPage <= 0) {
              currentResultPage = results.length - 1;
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
          case 'video':
            // TODO
            break;
          case 'delete':
            await currentPage.delete();
            currentPage = undefined;
            break;
          case 'links':
            currentButtons = linksButtons;
            break;
          case 'back':
            currentButtons = [pageButtons];
            break;
          default:
            break;
        }
        if (!currentPage) { return; } // Ignore if message was deleted
        i.deferUpdate();
        // Save it's image to discord
        currentPage = await currentPage.edit({ embeds: [searchTools.makeEmbed(
              results[currentResultPage],         // SauceNAO result list
              currentResultPage,                  // Page number
              urlToSearch,                        // Url of image that the user is searching
              searchTools.getUsername(message),   // User name
              message.author.avatarURL(),         // User pfp
          )], components: currentButtons });      // Buttons to add to the message
      });

      // Deactivate buttons if we are not reading them anymore
      collector.on('end', async () => {
        if (!currentPage) {return; }
        currentPage.edit({ embeds: [searchTools.makeEmbed(results[currentResultPage], currentResultPage, urlToSearch, searchTools.getUsername(message), message.author.avatarURL())], components: deactivateButtons([pageButtons]) });

        function deactivateButtons(buttons) {
          buttons.forEach(buttonRow => {
            buttonRow.components.forEach(button => {
              button.setDisabled();
            });
          });
          return buttons;
        }
      });

    } catch (e) {
      console.log(e);
      if (e.name == 'SagiriClientError') {
        return message.reply(`No pude entender tu mensaje ＞︿＜ Segur@ que enviaste una imagen junto al comando?. \nError: \`\`${e.message}\`\``);
      }
      return message.reply(`There was a problem with your request.\n\`\`\`${e.message}\`\`\``);
    }
  }
};