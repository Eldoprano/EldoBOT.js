const { MessageEmbed } = require('discord.js');
const https = require('https');
const http = require('http');

// Receives a sauceNAO result element and output's an embedded page for it
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

        if ('thumbnail' in sauceNAO_element.raw.header) {
            emb_preview = sauceNAO_element.raw.header.thumbnail;
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
    },
    extractURLs: function(text) {
        const urlRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
        return text.match(urlRegex);
    },
};