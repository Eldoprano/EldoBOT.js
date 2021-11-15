const Command = require("../../base/Command.js");
const searchTools = require('../../base/searchTools.js');
const config = require('../../config.js');
const { MessageActionRow, MessageButton } = require('discord.js');
const anitomy = require('anitomy-js');


// import fetch from 'node-fetch';
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const AWS = require("aws-sdk");

const embedBaseURL = 'https://rotf.lol/traceMoe?id=';
const traceMOEBaseURL = "https://api.trace.moe/search?anilistInfo&size=l&url=";
AWS.config.update({
  accessKeyId: config.accessKeyId,
  accessSecretKey: config.accessSecretKey,
  region: config.awsRegion,
});

module.exports = class traceMOE extends Command {
  constructor(client) {
    super(client, {
      name: 'aiuraho',
      description: 'Searches a frame from an anime',
      category: 'search',
      options: [],
      guildOnly: false, // Set this to false if you want it to be global.
    });
  }

  async run(message, [, ]) {
    try {
      // Extract the image to search for in form of a URL
      let urlToSearch;
      if (message.attachments.first()) {
        // Extract this URL from the attachment
        urlToSearch = message.attachments.first().url;
      } else {
        // Search for a link on the message if there wasn't an attachment
        urlToSearch = searchTools.extractURLs(message.content);
        if (urlToSearch) {
          urlToSearch = urlToSearch[0];
        } else {
          // If it doesn't contain an URL or attachment, ignore message
          return;
        }
      }
      await message.channel.sendTyping();

      // Send it to TraceMOE API and save result
      const tMoeResponse = await fetch(traceMOEBaseURL + `${encodeURIComponent(urlToSearch)}`);
      // if (tMoeResponse==404) // Handle this in a future
      const tMoeData = await tMoeResponse.json();

      const linkList = [];

      // Save result information on the AWS Database
      let id = await saveToAWS(tMoeData.result[0]);

      let linkAppendIfNSFW = "";
      if (message.channel.nsfw) {
        linkAppendIfNSFW = "&nsfw=1";
      }


      linkList.push(embedBaseURL + id + linkAppendIfNSFW);

      const pageButtons = new MessageActionRow()
                              .addComponents(
                                new MessageButton()
                                  .setCustomId('previous')
                                  .setLabel('⮪')
                                  .setStyle('PRIMARY'))
                              .addComponents(
                                new MessageButton()
                                  .setCustomId('next')
                                  .setLabel('➥')
                                  .setStyle('PRIMARY'));
      
      let traceMoeMSG = await message.channel.send({
        content: linkList[0],
        components: [pageButtons],
      });

      for (const tMoeElement of tMoeData.result.slice(1)) {
        id = await saveToAWS(tMoeElement);
        linkList.push(embedBaseURL + id + linkAppendIfNSFW);
      }

      const collector = await traceMoeMSG.createMessageComponentCollector({ componentType: 'BUTTON', time: 300000 });

      let currentResultPage = 0;


      collector.on('collect', async (i) => {
        switch (i.customId) {
          case 'previous':
            if (currentResultPage <= 0) {
              currentResultPage = linkList.length - 1;
            } else {
              currentResultPage -= 1;
            }
            break;
          case 'next':
            if (currentResultPage >= linkList.length - 1) {
              currentResultPage = 0;
            } else {
              currentResultPage += 1;
            }
            break;
        }
        i.deferUpdate();
        traceMoeMSG = await traceMoeMSG.edit(linkList[currentResultPage]);
      });

      collector.on('end', async () => {
        traceMoeMSG.edit({ content: linkList[currentResultPage], components: deactivateButtons([pageButtons]) });
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
      return message.reply(`There was a problem with your request.\n\`\`\`${e.message}\`\`\``);
    }

    async function saveToAWS(tMoeElement) {
      let id, name, idAnilist, adult, episode, similarity, video, image, censoredImage, timestamp, color;
      if ("anilist" in tMoeElement && isNaN(tMoeElement.anilist)) {
        if ("english" in tMoeElement.anilist.title && tMoeElement.anilist.title.english) {
          id = name = tMoeElement.anilist.title.english;
        } else if ("romaji" in tMoeElement.anilist.title && tMoeElement.anilist.title.romaji) {
          id = name = tMoeElement.anilist.title.romaji;
        } else if ("synonyms" in tMoeElement.anilist && tMoeElement.anilist.synonyms[0]) {
          id = name = tMoeElement.anilist.synonyms[0];
        } else if ("native" in tMoeElement.anilist.title && tMoeElement.anilist.title.native) {
          id = name = tMoeElement.anilist.title.native;
        } else {
          id = name = "ERROR! Esto no debería pasar..";
        }

        if (tMoeElement.anilist.id) {
          idAnilist = tMoeElement.anilist.id;
        } else {
          idAnilist = 1639; // We do a little trolling
        }

        if (tMoeElement.anilist.isAdult !== null) {
          adult = tMoeElement.anilist.isAdult;
        }

      } else if ("anilist" in tMoeElement) {
        // In case we didn't received Anilist information, we extract it from the file tittle
        const tittleParsed = anitomy.parse(tMoeElement.filename);
        if (tittleParsed.anime_title) {
          id = name = tittleParsed.anime_title;
        } else {
          id = name = tittleParsed.file_name;
        }

        if (tittleParsed.episode_number && !tMoeElement.episode) {
          id += ' (' + tittleParsed.episode_number + ')';
        }

        idAnilist = tMoeElement.anilist;
        adult = true; // Adult per default
      }

      if (tMoeElement.episode && !episode) {
        episode = tMoeElement.episode;
        id += ' (' + episode + ')';
      } else {
        episode = 1;
      }

      if (tMoeElement.similarity) {
        similarity = tMoeElement.similarity;
        if (similarity > 0.85) {
          color = '#15BF15'; // Happy Green
        } else if (similarity > 0.65) {
          color = '#FFFF00'; // Doubtfull yellow
        } else {
          color = '#EE0000'; // Worrying red
        }
      } else {
        color = '#216BDE'; // Blue
      }

      if (tMoeElement.video) {
        video = tMoeElement.video;
      } else {
        // What if there is no video? How can you show just a photo?
        video = null;
      }

      if (tMoeElement.image) {
        image = tMoeElement.image;
      }

      if (tMoeElement.from) {
        timestamp = tMoeElement.from;
        id += '(' + timestamp + ')';
      }

      if (adult) {
        // Create an image censored image preview
        censoredImage = await searchTools.getBlurredNSFWLink(image);
        //console.log(censoredImage);
      }

      // Change all spaces and makes it URL friendly
      id = id.replace(/ /g, '-');
      id = encodeURIComponent(id);

      const docClient = new AWS.DynamoDB.DocumentClient();

      const table = "traceMOE";

      const params = {
        TableName: table,
        Item: {
          "id": id,
          "name": name,
          "idAnilist": idAnilist,
          "adult": adult,
          "episode": episode,
          "similarity": similarity,
          "video": video,
          "image": image,
          "censoredImage": censoredImage,
          "timestamp": timestamp,
          "color": color,
          "width": 320,
          "height": 180,
        },
      };

      docClient.put(params, function(err) {
        if (err) {
          console.log("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
          // console.log("Added item:", JSON.stringify(data, null, 2));
        }
      });

      return id;
    }
  }

};