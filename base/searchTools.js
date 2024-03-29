const { MessageEmbed, MessageAttachment } = require('discord.js');
const https = require('https');
const http = require('http');
const fetch = require('node-fetch');
const ogs = require('open-graph-scraper');
const sharp = require('sharp');
const axios = require('axios');
const globals = require('./Globals');

// Regex that extracts the "Danbooru" in "Index #9:Danbooru"
const getIndexName = /^[I,i]ndex #\d*:[ ]*(.*)/;
const getURLDomain = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/;

// Downloads a file and returns it as a buffer
async function down_to_up(url) {
    const response = await fetch(url);
    return await response.buffer();
}

// Receives a list of external URLs pointing to images, uploads them to Discord
// and returns a list of URLs for them 
async function saveToDiscord(file_list) {
    const getFileName = new RegExp(/[^/\\=&?]+\.(jpg|png|gif|jpeg)/);
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
                    continue;
                }

                tmp_result = new MessageAttachment().setFile(tmp_result, 'Discord_baka.jpg');
                tmp_result = await globals.logChannel.send({ content: "Discord is a little whiny baby that can't detect an image file, so we need to explicitly give him this piece of Buffer", files: [tmp_result] });  

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

    makeEmbed: function(sauceNAO_element, pageNumber, searched_image, author_name, author_image) {
        const result_data = sauceNAO_element.raw.data;
        const emb_similarity = sauceNAO_element.similarity;
        const fieldDataList = [];
        let emb_preview, emb_index_saucenao, emb_link, emb_artist, emb_name,
            emb_episode, emb_character, emb_company, emb_game,
            emb_color, emb_embbed_tittle, emb_footer;

        if ('in_discord' in result_data) {
            emb_preview = sauceNAO_element.raw.discord_image;
        } else if ('thumbnail' in sauceNAO_element) {
            emb_preview = sauceNAO_element.thumbnail;
        }

        if (emb_similarity > 50) {
            emb_index_saucenao = sauceNAO_element.raw.header.index_name.split('-')[0];

            
            // Test if URL is still working
            // Pass result_data.ext_urls[0] or sauceNAO_element to getUrlStatusCode. Skip if both are undefined
            if ("ext_urls" in result_data) {
                // statusCode = getUrlStatusCode(result_data.ext_urls[0]);
                emb_link = result_data.ext_urls[0];
            } else if ("url" in sauceNAO_element) {
                // statusCode = getUrlStatusCode(sauceNAO_element.url);
                emb_link = sauceNAO_element.url;
            }

            // TODO: Status codes aren't working at the moment, and are spitting undefineds :/
            // if (statusCode >= 200 && statusCode < 300) {
            //     emb_link = result_data.ext_urls[0];
            // }
            // Check Pixiv
            if ('pixiv_id' in result_data) {
                emb_artist = result_data.member_name || "";
            }
            // Check Nijie
            else if ('nijie_id' in result_data) {
                emb_name = result_data.title;
                emb_artist = result_data.member_name || "";
            }

            // Check for other sources
            else if ('source' in result_data) {
                if ('part' in result_data) {
                    emb_name = result_data.source;
                    emb_episode = result_data.part;
                } else if (result_data.source.search('twitter.com') != -1) {
                    emb_artist = result_data.creator || "";
                }
                if ('material' in result_data) {
                    emb_name = result_data.material;
                }
                if ("source" in result_data && !emb_link) {
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
                    emb_artist = result_data.creator || "";
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
                            if (artist) {
                                emb_artist += artist + ', ';
                            }
                        }
                        emb_artist = emb_artist.slice(0, -2);
                    } else {
                        emb_artist = result_data['creator'] || "";
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
            emb_embbed_tittle = 'Nombre probablemente no encontrado (┬┬﹏┬┬)';
        }

        // eslint-disable-next-line prefer-const
        emb_footer = 'Porcentaje de seguridad: ' + emb_similarity + '% | Page ' + (pageNumber + 1);

        // We should already have all the data at this point, so we create the message
        if (emb_name || emb_artist || emb_link) {
            //emb_description = '';
            if (emb_name) {
                // emb_description += '**Nombre: ** ' + emb_name + '\n';
                fieldDataList.push({ 
                    name: "Nombre:",
                    value: emb_name,
                    inline: false,
                });
            }
            if (emb_episode) {
                // emb_description += '**Episodio: ** ' + emb_episode + '\n';
                fieldDataList.push({ 
                    name: "Episodio:",
                    value: emb_episode,
                    inline: true,
                });
            }
            if (emb_character) {
                // emb_description += '**Personaje: ** ' + emb_character + '\n';
                fieldDataList.push({ 
                    name: "Personaje:",
                    value: emb_character,
                    inline: false,
                });
            }
            if (emb_artist) {
                // emb_description += '**Artista: ** ' + emb_artist + '\n';
                fieldDataList.push({ 
                    name: "Artista:",
                    value: emb_artist,
                    inline: true,
                });
            }
            if (emb_company) {
                // emb_description += '**Compañía: ** ' + emb_company + '\n';
                fieldDataList.push({ 
                    name: "Compañía:",
                    value: emb_company,
                    inline: true,
                });
            }
            if (emb_game) {
                // emb_description += '**Juego: ** ' + emb_game + '\n';
                fieldDataList.push({ 
                    name: "Juego:",
                    value: emb_game,
                    inline: true,
                });
            }
            if (emb_link) {
                // emb_description += '**Link: ** ' + emb_link + '\n';
                // Extract the Website's name from the Index name
                let indexNameExtracted = getIndexName.exec(emb_index_saucenao);
                //  and if it wasnt found, show the Index name
                indexNameExtracted = (indexNameExtracted) ? indexNameExtracted[1] : emb_index_saucenao;

                // If emb_link is a URL, we can extract the domain name and save it in emb_domain
                // eslint-disable-next-line no-useless-escape
                const regex = /(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/gim;
                let emb_domain = regex.exec(emb_link);
                if (emb_domain) {
                    emb_domain = emb_domain[1];
                } else {
                    emb_domain = indexNameExtracted;
                }

                fieldDataList.push({ 
                    name: "Link:",
                    value: "[" + emb_domain + "](" + emb_link + ")",
                    inline: true,
                });
            }

            const embedWithResults = new MessageEmbed()
                .setTitle(emb_embbed_tittle)
                .setAuthor(author_name, author_image)
                .setFields(fieldDataList)
                //.setDescription(emb_description)
                .setColor(emb_color)
                .setThumbnail(searched_image)
                .setFooter(emb_footer);
            if (emb_preview) {
                embedWithResults.setImage(emb_preview);
            }
            return embedWithResults;
        } else {

            // In case we couldn't gather enough information from the RAW data, use the API data
            //emb_description = '';
            if (sauceNAO_element.authorName) {
                // emb_description += '**Artista: ** ' + sauceNAO_element.authorName + '\n';
                fieldDataList.push({ 
                    name: "Artista:",
                    value: sauceNAO_element.authorName,
                    inline: true,
                });
            }
            if (sauceNAO_element.authorUrl && getUrlStatusCode(sauceNAO_element.authorUrl) != 404) {
                // emb_description += '**Link del artista: ** ' + sauceNAO_element.authorUrl + '\n';

                // Extract the Website's name from the URL
                let domainNameExtracted = getURLDomain.exec(sauceNAO_element.authorUrl);
                domainNameExtracted = (domainNameExtracted) ? domainNameExtracted[1] : sauceNAO_element.authorUrl;
                fieldDataList.push({ 
                    name: "Link del artista:",
                    value: "[" + domainNameExtracted + "](" + sauceNAO_element.authorUrl + ")",
                    inline: true,
                });
            }
            if (sauceNAO_element.site) {
                // emb_description += '**Página: ** ' + sauceNAO_element.site + '\n';
                fieldDataList.push({ 
                    name: "Página:",
                    value: sauceNAO_element.site,
                    inline: true,
                });
            }
            if (sauceNAO_element.url && getUrlStatusCode(sauceNAO_element.url) != 404) {
                // emb_description += '**Link: ** ' + sauceNAO_element.url + '\n';

                // Extract the Website's name from the URL
                let domainNameExtracted = getURLDomain.exec(sauceNAO_element.url);
                domainNameExtracted = (domainNameExtracted) ? domainNameExtracted[1] : sauceNAO_element.url;
                fieldDataList.push({ 
                    name: "Link de la imágen:",
                    value: "[" + domainNameExtracted + "](" + sauceNAO_element.url + ")",
                    inline: true,
                });
            }
            const embedWithResults = new MessageEmbed()
                .setTitle(emb_embbed_tittle)
                .setAuthor(author_name, author_image)
                //.setDescription(emb_description)
                .setFields(fieldDataList)
                .setColor(emb_color)
                .setThumbnail(searched_image)
                .setFooter(emb_footer);
            if (emb_preview) {
                embedWithResults.setImage(emb_preview);
            }
            return embedWithResults;
        }
    },
    extractURLs: function(text) {
        // Extracts the url's from text using regex
        const urlRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
        const match = text.match(urlRegex);
        // From this match, just keep the url, ignoring the query string
        if (match) {
            return match.map(url => url.split('?')[0]);
        } else {
            return [];
        }
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