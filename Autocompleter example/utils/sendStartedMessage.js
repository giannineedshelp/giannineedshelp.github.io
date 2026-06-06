const { ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const webhookSend = require('./webhookSend');
const  { status_channel_id } = require('../config.json');

async function sendStartedMessage(client) {
    const container = new ContainerBuilder()
        .setAccentColor(0x09FF00)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`\n# Started the bot at <t:${Math.floor(Date.now() / 1000)}:T>\nLogged in as **${client.user.tag}**!`)
        );

    await webhookSend(container);

    try {
        const channel = await client.channels.fetch(status_channel_id);
        await channel.setName('BOT IS UP 🟢');
    } catch (e) {
        console.error('Failed to update status channel:', e?.message || e);
    }
}

module.exports = sendStartedMessage;