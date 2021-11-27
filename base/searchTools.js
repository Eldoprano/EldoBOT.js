const { MessageEmbed, MessageAttachment } = require('discord.js');
const https = require('https');
const http = require('http');
const fetch = require('node-fetch');
const ogs = require('open-graph-scraper');
const sharp = require('sharp');
const axios = require('axios');
const globals = require('./Globals');

async function down_to_up(url) {
    const response = await fetch(url);
    return await response.buffer();
}

async function saveToDiscord(file_list) {
    const getFileName = new RegExp(/([\w_-]+)+(?!.*(\w+)(\.\w+)+)/);
    const link_list = [];
    while (file_list.length > 0) {
        const files_to_send = file_list.slice(0, 10);
        let result_msg = "";
        file_list = file_list.slice(10);

        result_msg = await globals.logChannel.send({ files: files_to_send });  
        
        const attach = Array.from(result_msg.attachments.values());
        let attach_counter = 0;
        for (let i = 0; i < files_to_send.length; i++) {

            if (attach_counter < attach.length && attach[attach_counter].name.includes(getFileName.exec(files_to_send[i])[0])) {
                link_list.push(attach[attach_counter].url);
                attach_counter++;
                
            } else { // If Discord didn't uploaded our file, we download it, and send it again, as buffer
                let tmp_result = await down_to_up(files_to_send[i]);

                if (tmp_result.byteLength / 1000000 > 8) {
                    // TODO: If file size is greater than 8mb, we should compress it
                    console.log("FILE TOO BIG!");
                }

                tmp_result = new MessageAttachment().setFile(tmp_result, 'Discord_baka.jpg');
                tmp_result = await globals.logChannel.send({content: "Discord is a little whiny baby that can't detect an image file, so we need to explicitly give him this piece of Buffer", files: [tmp_result] });  

                tmp_result.attachments.forEach(attachment => {
                    // do something with the attachment
                    link_list.push(attachment.url);
                });
            }

        }

    }

    return link_list;
}

// Get's the buffer of an image as input, and gives you back a blurred image with NSFW! text
async function censorBuffer(buffer) {
    let imageData;
    try {
        imageData = sharp(buffer);
        const imageMetadata = await imageData.metadata();

        const nsfwWatermark = await sharp("base/img/nsfw_watermark.png")
            .resize({ width: Math.round(imageMetadata.width * 0.65), height: Math.round(imageMetadata.height * 0.65), fit: sharp.fit.contain, background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();
        
        imageData = await imageData
            .blur(8)
            .composite([{ input: nsfwWatermark, gravity: 'center' }])
            .toBuffer();
    } catch (err) {
        console.log(err);
    }
    return imageData;
}

// Becomes an image url as input and outputs a url with that image blurred and with NSFW! as text
async function getBlurredNSFWLink(image) {
    let output;
    const imageResponse = await axios({ url: image, responseType: 'arraybuffer' });
    const buffer = Buffer.from(imageResponse.data, 'binary');
    const imageData = await censorBuffer(buffer);

    const fileToSend = new MessageAttachment().setFile(imageData, 'BlurredForTheGreaterGood.jpg');
    const discordMsg = await globals.logChannel.send({ content: "A blurred NSFW Pic OwO", files: [fileToSend] });  

    discordMsg.attachments.forEach(attachment => {
        output = attachment.url;
    });

    return output;
}

async function sauceToDiscord(sauceNAO_result) {
    const output = [];
    const links_to_grab = [];
    const sitesWithWebPreview = ['Gelbooru', 'Danbooru'];
    for (let i = 0; i < sauceNAO_result.length; i++) {
        const sauceNAO_element = sauceNAO_result[i];
        
        if (sitesWithWebPreview.includes(sauceNAO_element.site)) {
            const ogs_response = await ogs({ url: sauceNAO_element.url });
            if (!ogs_response.error) {
                if ('ogImage' in ogs_response.result) {
                    links_to_grab.push(ogs_response.result.ogImage.url);
                    output.push(sauceNAO_element);
                }
            } else if ("thumbnail" in sauceNAO_element) {
                links_to_grab.push(sauceNAO_element.thumbnail);
                output.push(sauceNAO_element);

            }    

        } else if ("thumbnail" in sauceNAO_element) {
            links_to_grab.push(sauceNAO_element.thumbnail);
            output.push(sauceNAO_element);
        }

    }
    const ogs_response = await saveToDiscord(links_to_grab);
    for (let i = 0; i < ogs_response.length; i++) {
        output[i].thumbnail = ogs_response[i];
    }

    return output;
}

module.exports = {
    getUsername: function(message, interaction = false) {
        if (message.channel.type == 'DM') {
            if (interaction) {
                return message.user.username;
            }
            return message.author.username;
        } 
        return message.member.displayName;
    },

    makeEmbed: function(sauceNAO_element, pageNumber, emb_user) {
        const result_data = sauceNAO_element.raw.data;
        const emb_similarity = sauceNAO_element.similarity;
        let emb_preview, emb_index_saucenao, emb_link, emb_artist, emb_name,
            emb_episode, statusCode, emb_character, emb_company, emb_game,
            emb_description, emb_color, emb_embbed_tittle, emb_footer;

        if ('in_discord' in result_data) {
            emb_preview = sauceNAO_element.raw.discord_image;
        } else if ('thumbnail' in sauceNAO_element) {
            emb_preview = sauceNAO_element.thumbnail;
        }

        if (emb_similarity > 50) {
            emb_index_saucenao = sauceNAO_element.raw.header.index_name.split('-')[0];

            
            // Test if URL is still working
            statusCode = getUrlStatusCode(result_data.ext_urls[0]);
            if (statusCode != 404) {
                emb_link = result_data.ext_urls[0];
            }
            // Check Pixiv
            if ('pixiv_id' in result_data) {
                emb_artist = result_data.member_name;
            }
            // Check Nijie
            else if ('nijie_id' in result_data) {
                emb_name = result_data.title;
                emb_artist = result_data.member_name;
            }

            // Check for other sources
            else if ('source' in result_data) {
                if ('part' in result_data) {
                    emb_name = result_data.source;
                    emb_episode = result_data.part;
                } else if (result_data.source.search('twitter.com') != -1) {
                    emb_artist = result_data.creator;
                }
                if ('material' in result_data) {
                    emb_name = result_data.material;
                }
                if ("source" in result_data) {
                    emb_link = result_data.source;
                }
                // else {
                //     emb_link = '**Link del Twitt original caído**';
                // }
            }

            // Check for Sankaku/Gelbooru/Konachan
            else if ('sankaku_id' in result_data ||
                'gelbooru_id' in result_data ||
                'konachan_id' in result_data) {

                if ('creator' in result_data) {
                    if (!result_data.creator) {
                        if (result_data.material) {
                            emb_name = result_data.material.split(',')[0];
                        }
                    }
                }
                if (result_data.characters) {
                    emb_character = result_data.characters;
                }
                if ('material' in result_data) {
                    if (result_data.material == 'original') {
                        if ('characters' in result_data) {
                            if (result_data.characters) {
                                emb_character = result_data.characters;
                            }
                        }
                    } else if (result_data.material) {
                        emb_name = result_data.material;
                    }
                }
                if (result_data.creator) {
                    emb_artist = result_data.creator;
                }
            }

            if ('getchu_id' in result_data) {
                emb_company = result_data.company;
                emb_game = result_data.title;
            }

            // Fill unfilled data
            if (!emb_name) {
                try {
                    if ('title_english' in result_data) {
                        emb_name = result_data['title_english'];
                    } else {
                        emb_name = result_data['title'];
                    }
                } catch (e) {
                    // ignore error
                }
            }
            if (!emb_artist) {
                try {
                    if (result_data.creator instanceof Array) {
                        for (const artist of result_data.creator) {
                            emb_artist += artist + ', ';
                        }
                        emb_artist = emb_artist.slice(0, -2);
                    } else {
                        emb_artist = result_data['creator'];
                    }
                } catch (e) {
                    // Ignore error
                }
            }

            if (!emb_character) {
                try {
                    emb_character = result_data['characters'];
                } catch (e) {
                    // Ignore error
                }
            }
            if (!emb_link) {
                try {
                    if ('mal_id' in result_data) {
                        emb_link = 'https://myanimelist.net/anime/' + result_data['mal_id'];
                    } else if (result_data.ext_urls instanceof Array) {
                        emb_link = result_data.ext_urls[0];
                    } else {
                        emb_link = result_data.ext_urls;
                    }
                } catch (e) {
                    // Ignore error
                }
            }

            if (!emb_link) {
                try {
                    if (result_data.ext_urls instanceof Array) {
                        emb_link = result_data.ext_urls[0];
                    } else {
                        emb_link = result_data.ext_urls;
                    }
                } catch (e) {
                    // Ignore error
                }
            }
            if (!emb_name) {
                try {
                    emb_name = result_data.eng_name;
                } catch (e) {
                    // Ignore error
                }
            }

            if (!emb_episode && 'episode' in result_data) {
                emb_episode = result_data.episode;
            }
        } // END of "if (similarity_of_result > 50)"

        if (emb_similarity > 89) {
            emb_color = 1425173; // A nice green
            emb_embbed_tittle = 'Nombre encontrado!';
        } else if (emb_similarity > 65) {
            emb_color = 16776960; // An insecure yellow
            emb_embbed_tittle = 'Nombre quizás encontrado!';
        } else {
            emb_color = 15597568; // A worrying red
            emb_embbed_tittle = 'Nombre probablemente encontrado!';
        }

        // eslint-disable-next-line prefer-const
        emb_footer = 'Porcentaje de seguridad: ' + emb_similarity + '% | Pedido por: ' + emb_user + ' | Page ' + (pageNumber + 1);

        // We should already have all the data at this point, so we create the message
        if (emb_name || emb_artist || emb_link) {
            emb_description = '';
            if (emb_name) {
                emb_description += '**Nombre: ** ' + emb_name + '\n';
            }
            if (emb_episode) {
                emb_description += '**Episodio: ** ' + emb_episode + '\n';
            }
            if (emb_character) {
                emb_description += '**Personaje: ** ' + emb_character + '\n';
            }
            if (emb_artist) {
                emb_description += '**Artista: ** ' + emb_artist + '\n';
            }
            if (emb_company) {
                emb_description += '**Compañía: ** ' + emb_company + '\n';
            }
            if (emb_game) {
                emb_description += '**Juego: ** ' + emb_game + '\n';
            }
            if (emb_link) {
                emb_description += '**Link: ** ' + emb_link + '\n';
            }

            emb_description += '**Encontrado en: **' + emb_index_saucenao + '\n';

            const embedWithResults = new MessageEmbed()
                .setDescription(emb_description)
                .setTitle(emb_embbed_tittle)
                .setColor(emb_color)
                .setFooter(emb_footer);
            if (emb_preview) {
                embedWithResults.setImage(emb_preview);
            }
            return embedWithResults;
        } else {

            // In case we couldn't gather enough information from the RAW data, use the API data
            emb_description = '';
            if (sauceNAO_element.authorName) {
                emb_description += '**Artista: ** ' + sauceNAO_element.authorName + '\n';
            }
            if (sauceNAO_element.url && getUrlStatusCode(sauceNAO_element.url) != 404) {
                emb_description += '**Link: ** ' + sauceNAO_element.url + '\n';
            }
            if (sauceNAO_element.site) {
                emb_description += '**Página: ** ' + sauceNAO_element.site + '\n';
            }
            if (sauceNAO_element.authorUrl && getUrlStatusCode(sauceNAO_element.authorUrl) != 404) {
                emb_description += '**Link del artista: ** ' + sauceNAO_element.authorUrl + '\n';
            }
            const embedWithResults = new MessageEmbed()
                .setDescription(emb_description)
                .setTitle(emb_embbed_tittle)
                .setColor(emb_color)
                .setFooter(emb_footer);
            if (emb_preview) {
                embedWithResults.setImage(emb_preview);
            }
            return embedWithResults;
        }
    },
    extractURLs: function(text) {
        const urlRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
        return text.match(urlRegex);
    },
};

function getUrlStatusCode(url) {

    try {
        // We first try with the HTTPS library
        https.get(url, (resp) => {
            return resp.statusCode;
        }).on('error', (err) => {
            console.log('HTTP Error: ' + err.message);
            return 404;
        });
    } catch (e) {
        // And then with the HTTP library, in case the link is a HTTP
        try {
            http.get(url, (resp) => {
                return resp.statusCode;
            }).on('error', (err) => {
                console.log('HTTP Error: ' + err.message);
                return 404;
            });
        } catch (error) {
            console.log(error);
            return 404;
        }
    }
}

module.exports.saveToDiscord = saveToDiscord;
module.exports.sauceToDiscord = sauceToDiscord;
module.exports.getBlurredNSFWLink = getBlurredNSFWLink;