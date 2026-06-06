const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { logError } = require('../../../../utils/errorLogger.js');
const progressTracker = require('../../../../utils/progressTracker.js');
const formatTime = require('../../../../utils/formatTime');
const getProgressBar = require('../../../../utils/getProgressBar');
const getAIanswer = require('../../../../utils/getAIanswer.js');
const { checkAccount } = require('../../../../database/accounts.js');
const logger = require('../../../../utils/logger.js');
const { colours } = require('../../../../config.json');
const { addToDb, checkAnswer } = require('../../../../database/reader.js');
const getApiKeys = require('../../../../utils/getApiKeys.js');
const { answerQuestionAi } = require('../../../../gemini/sparx_reader/main.js');
const queues = require('../../../../queues/queues.js');
const useApiKeys = require('../../../../utils/useApiKeys.js');

class sparxReaderAutocompleter {
    constructor(requesticator, apikeys, progressUpdater, settings, log) {
        this.requesticator = requesticator;
        this.apikeys = apikeys;
        this.log = log;
        this.progressUpdater = progressUpdater;
        this.settings = settings;
        this.cancelActive = false;
        this.taskIdsLoaded = [];
    }

    async load(taskId) {
        if (!this.taskIdsLoaded.includes(taskId)) {
            const loadObj = {
                "taskId": taskId,
                "action": {
                    "action": {
                        "oneofKind": "load",
                        "load": true
                    }
                },
                "catchUpMode": false
            };

            const fullMessage = await this.requesticator.encodeStuff(loadObj, 'SendTaskActionRequest');

            await this.requesticator.send('https://api.sparx-learning.com/reader/sparx.reading.tasks.v1.Tasks/SendTaskAction', fullMessage);
            this.taskIdsLoaded.push(taskId);
        }
    }

    async answerQuestion(extract, taskId, first, answer, identifier) {

        let url = 'https://api.sparx-learning.com/reader/sparx.reading.tasks.v1.Tasks/SendTaskAction';

        if (first) {
            const questionObj = await this.requesticator.proceedQuestion(taskId);
            if (questionObj.status === 9) {
                // console.log("Finished questions!");
                return;
            }
            identifier = questionObj.questionIdentifier;

            answer = await this.getAnswer(questionObj.questionIdentifier, extract, questionObj);
            if (typeof answer === 'number') return answer;
        }

        let answerObj = {
            "taskId": taskId,
            "action": {
                "action": {
                    "oneofKind": "paperback",
                    "paperback": {
                        "action": {
                            "oneofKind": "answer",
                            "answer": answer
                        },
                        "identifier": identifier
                    }
                }
            },
            "catchUpMode": false,
            "signatureEvent": {
                "signatures": []
            }
        };

        let fullMessage = await this.requesticator.encodeStuff(answerObj, 'SendTaskActionRequest');

        if (this.settings.max) await this.progressUpdater.wait(this.settings, `Waiting to Complete a Question`);
        const questionBuffer = await this.requesticator.send(url, fullMessage);

        if ((questionBuffer.status === 9) || (questionBuffer.headers['grpc-status'] === '16')) {
            return;
        }

        const questionFull = await this.requesticator.decodeStuff(questionBuffer.data, 'SendTaskActionResponse');

        if (questionFull?.task?.state) {
            this.log.logToFile('Task State', JSON.stringify(questionFull.task.state, null, 2));
        }

        if (questionFull?.task?.state?.state?.paperback?.results) {
            await this.handleDbAdd(questionFull.task.state.state.paperback.results);
        }

        if (questionFull?.task?.state?.experience) {
            const returnObj = {
                experience: questionFull.task.state.experience,
                results: questionFull.task.state.results
            };
            return returnObj;
        }

        if (questionFull?.task?.state?.state?.paperback?.currentQuestion) {
            const questionIdentifier = questionFull.task.state.state.paperback.currentQuestion.questionId;
            const questionText = questionFull.task.state.state.paperback.currentQuestion.questionText;
            const questionOptions = questionFull.task.state.state.paperback.currentQuestion.options;

            const questionObj = {
                questionIdentifier: questionIdentifier,
                questionText: questionText,
                questionOptions: questionOptions
            };

            answer = await this.getAnswer(questionObj.questionIdentifier, extract, questionObj);
            if (typeof answer === 'number') return answer;

            return await this.answerQuestion(extract, taskId, false, answer, questionObj.questionIdentifier);
        }

        const questionObj = await this.requesticator.proceedQuestion(taskId);
        if (questionObj.status === 9) {
            await this.requesticator.retryQuestion(taskId);
            return {
                experience: 0,
                results: []
            };
        } else if (questionObj?.experience) {
            return questionObj;
        }

        answer = await this.getAnswer(questionObj.questionIdentifier, extract, questionObj);
        if (typeof answer === 'number') return answer;

        return await this.answerQuestion(extract, taskId, false, answer, questionObj.questionIdentifier);
    }

    async handleDbAdd(results) {
        for (const result of results) {
            if (result.correct) {
                await addToDb(result.questionId, result.answer, []);
            } else {
                await addToDb(result.questionId, null, [result.answer]);
            }
        }
    }

    async getAnswer(id, extract, questionObj) {
        const result = await checkAnswer(id, questionObj);
        const apikeys = await getApiKeys(this.apikeys);
        if (typeof(result) === "string") {
            return result;
        } else {

            const aiArgs = Array.isArray(result)
                ? [extract, questionObj.questionText, questionObj.questionOptions, result]
                : [extract, questionObj.questionText, questionObj.questionOptions];

            this.log.logToFile('AI Args', ...aiArgs);
            this.log.logToFile('Question Options', questionObj.questionOptions);

            const answer = await useApiKeys(apikeys, answerQuestionAi, aiArgs); 
            this.log.logToFile('Answer returned', answer);
            return answer;
        }
    }

  async maintainActive() {
    await this.requesticator.sendUserActive('/task');

    setInterval(() => {
      if (this.cancelActive) return;
      this.requesticator.sendUserActive('/task');
    }, 12_000);
  }
}

async function autocomplete(userSession) {
    let bookUid = userSession.selectedHomework;
    let bookName = userSession.bookNames[bookUid];

    const log = new logger(userSession.interaction.user.id, 'sparx_reader');
    userSession.requesticator.log = log;
    log.logToFile('Logging Start');
    log.logToFile(`**Settings**\n ${[
        ["bookUid", bookUid],
        ["userSession.srp", userSession.settings.srp],
        ["userSession.wpm", userSession.settings.wpm],
        ["bookName", bookName],
        ["mode", userSession.mode]
    ].map(([name, value]) => `${name}: ${value}`).join("\n")}`);
    // await interaction.deferUpdate();

    const userApiKeys = (await checkAccount(userSession.interaction.user.id)).apikeys;
    const queue = queues.get('sparx_reader');
    let readUntilFinish = userSession.mode === 'Read Until Book Completed';
    // let readUntilGold = userSession.mode === 'Read Until Gold Reader Acquired';
    let pointsAcquired = 0;
    let timesO = 0;
    let finishedBook = false;
    let correctQuestions = 0;
    let totalQuestions = 0;
    let finishedAllBooks = false;

    const sectionsProgress = [[{
        name: `- Progress (${userSession.settings.srp} SRP)`,
        value: getProgressBar(0, 1),
        percentage: 0
    }]];

    const getTimeField = function () {
        return `**Time Spent:** ${formatTime((process.hrtime(this.taskTimer))[0])}\n**Sparx Reader Points Accumulated:** ${pointsAcquired}\n**Accuracy:** ${isNaN(Math.round(correctQuestions / totalQuestions * 100)) ? 100 : Math.round(correctQuestions / totalQuestions * 100)}%\n**Reading:** ${bookName}`;
    };
    const getSettingsField = function () {
        return `**Sparx Reader Points Target:** ${userSession.settings.srp}\n**Words Per Minute:** ${userSession.settings.wpm}\n**Question Time:** ${userSession.settings.min}-${userSession.settings.max}`;
    };

    const sparxReaderExecuter = new sparxReaderAutocompleter(userSession.requesticator, userApiKeys, null, userSession.settings, log);
    sparxReaderExecuter.maintainActive();
    const progressUpdater = new progressTracker(userSession.interaction, getTimeField, getSettingsField, sparxReaderExecuter, 'Sparx Reader', 'sparx_reader', null, userSession);
    sparxReaderExecuter.progressUpdater = progressUpdater;
    if (await progressUpdater.start(sectionsProgress)) return;

    const shouldStop = async () => !((pointsAcquired < userSession.settings.srp || readUntilFinish) && timesO < 10 && !progressUpdater.cancelled && (await queue.stillUsing(userSession.interaction.user.id)));

    try {
        while (!(await shouldStop())) {
            log.logToFile(`Points Accumulated: ${pointsAcquired}\nQuestions Correct: ${correctQuestions}/${totalQuestions}`);
            const taskId = await userSession.requesticator.getBookTask(bookUid);
            if (taskId.message === "Task Finished") {
                finishedBook = true;
                log.logToFile(`Book finished!`);
                if (readUntilFinish) {
                    break;
                }

                let homeworkBooks = await userSession.requesticator.getHomeworks();

                if (!homeworkBooks.length) {
                    bookUid = await userSession.requesticator.getNewBook();
                    if (!bookUid) {
                        finishedAllBooks = true;
                        break;
                    };
                    await userSession.requesticator.getBookTask(bookUid);
                    homeworkBooks = await userSession.requesticator.getHomeworks();
                }
                bookUid = homeworkBooks[0].bookId;
                bookName = homeworkBooks[0].title;
                log.logToFile(`New Book UID: ${bookUid}\nNew Bookname: ${bookName}`);

                continue;
            }
            await sparxReaderExecuter.load(taskId);

            const bookTextObj = await userSession.requesticator.getBookText(bookUid, taskId);
            const bookText = bookTextObj.paragraph;
            const wordCount = bookTextObj.wordCount;
            if (userSession.settings.wpm) {
                const totalTime = (wordCount / userSession.settings.wpm) * 60;
                await progressUpdater.wait(totalTime, `"Reading" at ${userSession.settings.wpm} Words Per Minute`, shouldStop);
            }

            if (await shouldStop()) {
                break;
            }
            log.logToFile(`About to get AI Answer`);
            const results = await getAIanswer(
                () => sparxReaderExecuter.answerQuestion(bookText, taskId, true),
                queue,
                userSession.interaction,
                progressUpdater,
                60000,
                3000,
                () => progressUpdater.cancelled,
                Infinity
            );

            const experienceGained = results?.experience ?? 0;

            pointsAcquired += experienceGained;

            if (results?.results) {
                for (const result of results.results) {
                    correctQuestions += result.score;
                    totalQuestions += result.total;
                }
            }

            timesO += 1;
            if (experienceGained !== 0) {
                log.logToFile('Got questions right!');
                await progressUpdater.updateProgressBar(0, pointsAcquired, userSession.settings.srp);
                await progressUpdater.updateEmbed(`Completing Questions...`);
                timesO = 0;
            } else {
                log.logToFile('Got questions wrong!');
                await progressUpdater.updateEmbed(`Retrying Question...`);
            }

            if (await shouldStop()) {
                break;
            }
        }
    } catch (err) {
        log.logToFile("Error caught");
        log.logToFile(err);
        logError(err, userSession.interaction.user.id, 'Sparx Reader', log.filepath);
    } finally {
        sparxReaderExecuter.cancelActive = true;
        let finalMessage = 'Encountered an error causing the autocompleter to fail';
        if (finishedAllBooks) {
            finalMessage = 'No more books to read';
        }
        else if (progressUpdater.cancelled) {
            finalMessage = 'Cancelled';
        }
        else if (pointsAcquired >= userSession.settings.srp && !readUntilFinish) {
            finalMessage = `SRP target of ${userSession.settings.srp} has been achieved`;
        }
        else if (finishedBook && readUntilFinish) {
            finalMessage = 'The book has been Finished';
        }
        log.logToFile(`Final Message: ${finalMessage}`);
        await log.send(userSession.interaction.user);

        await progressUpdater.updateEmbed(finalMessage);
        await progressUpdater.end();
    }

    return (process.hrtime(progressUpdater.taskTimer))[0];
}

module.exports = autocomplete;