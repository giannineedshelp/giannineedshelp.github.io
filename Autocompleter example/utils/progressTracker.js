const { EmbedBuilder, ComponentType, MessageFlags, SeparatorBuilder, TextDisplayBuilder, SeparatorSpacingSize, ContainerBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const getProgressBar = require('./getProgressBar');
const { name, colours, emojis } = require('../config.json');
const disableComponents = require('./disableComponents.js');

class progressTracker {
    constructor(interaction, getTimeField, getSettingsField, Executer, title, colour, dueIn, userSession) {
        this.interaction = interaction;
        this.user = interaction.user;
        this.targetMessage;
        this.totalSeconds = 0;
        this.taskTimer = process.hrtime();
        this.container = null;
        this.sectionsProgress;
        this.currentPage = 1;
        this.cancelled = false;
        this.Executer = Executer;
        this.title = title;
        this.colour = colour;
        this.dueIn = dueIn;
        this.userSession = userSession;
        this.getTimeField = getTimeField.bind(this);
        this.getSettingsField = getSettingsField.bind(this);
        this.lastSettingField = this.getTimeField();
    }

    async end() {
        await this.targetMessage.edit({
            components: [disableComponents(this.container)]
        });
    }

    async wait(time, message, cancelFlag = async () => false) {
        // Resolve wait time in seconds
        const waitSeconds =
            typeof time === "number"
                ? time
                : Math.floor(Math.random() * (time.max - time.min + 1)) + time.min;

        if (waitSeconds <= 0) return;

        const waitMs = waitSeconds * 1000;
        const endTimestamp = Math.floor(Date.now() / 1000 + waitSeconds);

        await this.updateEmbed(`${message} <t:${endTimestamp}:R>`);

        const interval = 3000;
        const start = Date.now();

        while (true) {
            if (await cancelFlag()) break;

            const elapsed = Date.now() - start;
            const remaining = waitMs - elapsed;

            if (remaining <= 0) break;

            await new Promise(res => setTimeout(res, Math.min(interval, remaining)));
        }
    }

    async updateEmbed(description) {
        this.generateEmbed(description);
        await this.targetMessage.edit({
            components: [this.container]
        });
    }

    generateEmbed(status) {
        let sectionMessage = '';
        for (const section of this.sectionsProgress[this.currentPage-1]) {
            sectionMessage += `**${section.name} • \`${Math.floor(section.percentage)}%\`**${section.value}\n`;
        }
        const maxPages = this.sectionsProgress.length;
        const seperator = new SeparatorBuilder({
            spacing: SeparatorSpacingSize.Small
        });

        if (this.Executer) this.Executer.settings = this.userSession.settings;

        const cancel = new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setEmoji(emojis.x)
            .setStyle(ButtonStyle.Danger);

        const settingsBtn = new ButtonBuilder()
            .setCustomId('settings')
            .setLabel('Settings')
            .setEmoji(emojis.settings)
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
            .addComponents(cancel, settingsBtn);

        const container = new ContainerBuilder()
            .setAccentColor(colours[this.colour])
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${this.title} Autocompleter\n${this.dueIn ? `**Due** <t:${this.dueIn}:F>\n` : '' }**Status:** ${status ? status : this.lastStatus}${maxPages > 1 ? `\n**Page:** ${this.currentPage}/${maxPages}` : ''}\n\n${this.getSettingsField()}`)
            )
            .addSeparatorComponents(
                seperator
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(sectionMessage)
            )
            .addSeparatorComponents(
                seperator
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(this.getTimeField())
            )
            .addSeparatorComponents(
                seperator
            )
            .addActionRowComponents(
                row,
            );

        if (status) {
            this.lastStatus = status;
        }
        this.container = container;
    }

    async updateProgressBar(index, newProg, progMax=1) {
        const progressBar = getProgressBar(newProg, progMax);
        const percentage = newProg / progMax * 100;
        const adjustedIndex = Math.floor(index / 5);
        this.currentPage = adjustedIndex + 1;
        this.sectionsProgress[adjustedIndex][index % 5].value = progressBar;
        this.sectionsProgress[adjustedIndex][index % 5].percentage = percentage;

        await this.updateEmbed();
    }

    async start(sectionsProgress) {
        this.sectionsProgress = sectionsProgress;
        this.generateEmbed('Starting Autocompleter...');
        try {

            this.targetMessage = await this.user.send({
                components: [this.container],
                flags: MessageFlags.IsComponentsV2
            });

            const collector = this.targetMessage.createMessageComponentCollector({
                componentType: ComponentType.Button
            });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'cancel') {
                    await interaction.deferUpdate();
                    this.cancelled = true;

                    await this.updateEmbed('Cancelling...');
                } else if (interaction.customId === 'settings') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const { settingsDisplayer } = require('../generic/settingsDisplayer.js');
                    await settingsDisplayer(interaction, this.colour);                 
                }
            });

        } catch {
            const noDMenabled = new EmbedBuilder()
                .setTitle('Cannot Direct Message')
                .setDescription('The autocompleter is unable to direct message you the progress tracker because your discord settings prevent this. You have been kicked out of the queue and the autocompleter has cancelled your task.')
                .addFields({
                    name: 'How do I fix this issue?',
                    value: `Please go to \`Settings -> Content & Social -> Social Permissions -> '${name}' -> Direct Messages ✅\``
                })
                .setColor(colours.light_red);

            await this.interaction.followUp({
                embeds: [noDMenabled],
                flags: MessageFlags.Ephemeral
            });
            return true;
        }
    }
}

module.exports = progressTracker;