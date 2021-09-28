const Command = require("../../base/Command.js");
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');

module.exports = class Time extends Command {
  constructor(client) {
    super(client, {
      name: "time",
      description: "Te devuelve una fecha en formato discord",
      usage: "time",
      guildOnly: false,
    });
  }

  async run(message, args, level) { // eslint-disable-line no-unused-vars
    // Get the UNIX time in seconds
    const approximateToMinute = 15;
    const coeff = 1000 * 60 * approximateToMinute;
    let selectedTime = Date.now();

    selectedTime = new Date(Math.ceil(selectedTime / coeff) * coeff).getTime() / 1000;

    const embedWithResults = new MessageEmbed()
      .setTitle("Time formatting generator!")
      .setDescription(` Crea fechas sin tener que preocuparte de zonas horarias!\n 
                        Usa los botónes para determinar la fecha del evento:\n\n
                        <t:` + selectedTime + `>`);

    // Create the buttons used on the Embedd file
    const homeButtons = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setLabel('FECHA')
          .setCustomId('date')
          .setStyle('PRIMARY'))
      .addComponents(
        new MessageButton()
          .setLabel('HORA')
          .setCustomId('hour')
          .setStyle('PRIMARY'))
      .addComponents(
        new MessageButton()
          .setLabel('CONTINUAR')
          .setCustomId('generate')
          .setStyle('SUCCESS'))
      .addComponents(
        new MessageButton()
          .setLabel('OLVÍDALO...')
          .setCustomId('delete')
          .setStyle('DANGER'));

    const hourButtons = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setLabel('-1 HORA')
          .setCustomId('minus1h')
          .setStyle('PRIMARY'))
      .addComponents(
        new MessageButton()
          .setLabel('-15 MINUTOS')
          .setCustomId('minus15m')
          .setStyle('PRIMARY'))
      .addComponents(
        new MessageButton()
          .setLabel('CONTINUAR')
          .setCustomId('goHome')
          .setStyle('SUCCESS'))
      .addComponents(
        new MessageButton()
          .setLabel('+15 MINUTOS')
          .setCustomId('plus15m')
          .setStyle('PRIMARY'))
      .addComponents(
        new MessageButton()
          .setLabel('+1 HORA')
          .setCustomId('plus1h')
          .setStyle('PRIMARY'));

    const dateButtons = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setLabel('-1 MES')
          .setCustomId('minus1month')
          .setStyle('PRIMARY'))
      .addComponents(
        new MessageButton()
          .setLabel('-1 DÍA')
          .setCustomId('minus1d')
          .setStyle('PRIMARY'))
      .addComponents(
        new MessageButton()
          .setLabel('CONTINUAR')
          .setCustomId('goHome')
          .setStyle('SUCCESS'))
      .addComponents(
        new MessageButton()
          .setLabel('+1 DÍA')
          .setCustomId('plus1d')
          .setStyle('PRIMARY'))
      .addComponents(
        new MessageButton()
          .setLabel('+1 MES')
          .setCustomId('plus1month')
          .setStyle('PRIMARY'));

    let currentButtons = [homeButtons];

    let timeMessage = await message.channel.send({ embeds: [embedWithResults], components: currentButtons });

    const collector = await timeMessage.createMessageComponentCollector({ componentType: 'BUTTON', time: 300000 });

    collector.on('collect', async (i) => {
      let changeAmount;
      switch (i.customId) {
        // Button change functions
        case 'hour':
          currentButtons = [hourButtons];
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults], components: currentButtons });
          break;
        case 'date':
          currentButtons = [dateButtons];
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults], components: currentButtons });
          break;
        case 'goHome':
          currentButtons = [homeButtons];
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults], components: currentButtons });
          break;

        // Time change functions
        case 'plus1h':
          changeAmount = 1 * 60 * 60;
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults.setDescription(changeEmbedTime(changeAmount))], components: currentButtons });
          break;
        case 'minus1h':
          changeAmount = -1 * 60 * 60;
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults.setDescription(changeEmbedTime(changeAmount))], components: currentButtons });
          break;
        case 'plus15m':
          changeAmount = 15 * 60;
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults.setDescription(changeEmbedTime(changeAmount))], components: currentButtons });
          break;
        case 'minus15m':
          changeAmount = -15 * 60;
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults.setDescription(changeEmbedTime(changeAmount))], components: currentButtons });
          break;
        case 'plus1d':
          changeAmount = 1 * 60 * 60 * 24;
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults.setDescription(changeEmbedTime(changeAmount))], components: currentButtons });
          break;
        case 'minus1d':
          changeAmount = -1 * 60 * 60 * 24;
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults.setDescription(changeEmbedTime(changeAmount))], components: currentButtons });
          break;
        case 'plus1month':
          changeAmount = 30 * 60 * 60 * 24;
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults.setDescription(changeEmbedTime(changeAmount))], components: currentButtons });
          break;
        case 'minus1month':
          changeAmount = -30 * 60 * 60 * 24;
          timeMessage = await timeMessage.edit({ embeds: [embedWithResults.setDescription(changeEmbedTime(changeAmount))], components: currentButtons });
          break;

        case 'generate':
          timeMessage = await timeMessage.edit({ embeds: [generateTimeFormatEmbed(selectedTime)], components:[] });
          break;

        case 'delete':
          await timeMessage.delete();
          break;
      }
      i.deferUpdate();
    });

    // Receives a Unix timestamp and returns an Embedd with all Discord time formats
    function generateTimeFormatEmbed(timestamp) {
      return new MessageEmbed()
        .setTitle("Formatos generados:")
        .setDescription(`Aquí se muestran distintos estilos de la fecha generada, 
                          junto con el código que lo generó:`)
        .addFields({ name: '<t:' + timestamp + ':t>', value: '`<t:' + timestamp + ':t>`', inline: true },
          { name: '<t:' + timestamp + ':T>', value: '`<t:' + timestamp + ':T>`', inline: true },
          { name: '<t:' + timestamp + ':d>', value: '`<t:' + timestamp + ':d>`', inline: true },
          { name: '<t:' + timestamp + ':D>', value: '`<t:' + timestamp + ':D>`', inline: true },
          { name: '<t:' + timestamp + ':f*>', value: '`<t:' + timestamp + ':f*>`', inline: true },
          { name: '<t:' + timestamp + ':F>', value: '`<t:' + timestamp + ':F>`', inline: true },
          { name: '<t:' + timestamp + ':R>', value: '`<t:' + timestamp + ':R>`', inline: true },
        );
    }

    // Receives as parameter how many seconds you want to add/substract
    function changeEmbedTime(seconds) {
      selectedTime += seconds;
      return ` Crea fechas sin tener que preocuparte de zonas horarias!\n 
                        Usa los botónes para determinar la fecha del evento:\n\n
                        <t:` + (selectedTime) + `>`;
    }
  }


};