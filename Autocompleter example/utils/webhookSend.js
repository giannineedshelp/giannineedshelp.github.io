require('dotenv').config();
const { MessageFlags } = require('discord.js');
const fs = require('fs');

async function webhookSend(container, files=[]) {
    const form = new FormData();

    form.append(
        'payload_json',
        JSON.stringify({
            flags: MessageFlags.IsComponentsV2,
            components: [container]
        })
    );

    for (const [index, file] of files.entries()) {
        const blob = await fs.openAsBlob(file.attachment);

        form.append(
            `files[${index}]`,
            blob,
            file.name
        );
    }

    const res = await fetch(
        process.env.STARTUP_WEBHOOK_URL + '?with_components=true',
        {
            method: 'POST',
            body: form
        }
    );

    if (!res.ok) {
        console.error(await res.text());
    }
}

module.exports = webhookSend;