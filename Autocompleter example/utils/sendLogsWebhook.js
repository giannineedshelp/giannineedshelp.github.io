const fs = require("fs/promises");
const fsSync = require("fs");
const axios = require("axios");
const FormData = require("form-data");

async function sendLog(filePath, name, embed, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Recreate form + stream every retry
            const form = new FormData();

            form.append(
                "file",
                fsSync.createReadStream(filePath),
                { filename: name }
            );

            form.append(
                "payload_json",
                JSON.stringify({ embeds: [embed] })
            );

            await axios.post(process.env.LOGS_WEBHOOK_URL, form, {
                headers: form.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                timeout: 30000
            });

            await fs.rm(filePath, { force: true });

            console.log(`Sent log ${name}`);
            return true;

        } catch (error) {
            const status = error.response?.status;
            const data = error.response?.data;

            if (status === 429) {
                const retryAfter = (data?.retry_after || 1) * 1000;

                console.warn(
                    `Rate limited while sending ${name}. Retrying in ${retryAfter}ms...`
                );

                await new Promise(resolve => setTimeout(resolve, retryAfter));
                continue;
            }

            console.error(
                `Failed to send log ${name}:`,
                data || error.message
            );

            return false;
        }
    }

    console.error(`Failed to send log ${name} after ${retries} retries.`);
    return false;
}

module.exports = sendLog;