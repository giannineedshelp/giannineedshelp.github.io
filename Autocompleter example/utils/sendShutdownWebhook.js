const { ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const webhookSend = require('./webhookSend');

async function sendShutdownWebhook(reason, pingAll) {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF0000)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`\n# Bot stopped/crashed at <t:${Math.floor(Date.now() / 1000)}:T>\n> Message: ${reason}${pingAll ? '\n@everyone' : ''}`)
        );

    await webhookSend(container);
}

module.exports = sendShutdownWebhook;