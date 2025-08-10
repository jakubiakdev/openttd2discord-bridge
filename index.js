var ottd = require("node-openttd-admin"),
    ottdConnection = new ottd.connection();

const { loadEnvFile } = require('node:process');
loadEnvFile();

const { Client, Events, GatewayIntentBits } = require('discord.js');
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages] });

ottdConnection.connect(process.env.OTTD_HOST, process.env.OTTD_PORT);

ottdConnection.on('connect', function () {
    ottdConnection.authenticate(process.env.OTTD_AUTH_USERNAME, process.env.OTTD_AUTH_PASSWORD);
});
ottdConnection.on('welcome', function (data) {
    ottdConnection.send_rcon("say \"Bridge connected\"");
    console.log(JSON.stringify(data, null, 2));
    ottdConnection.send_update_frequency(ottd.enums.UpdateTypes.CLIENT_INFO, ottd.enums.UpdateFrequencies.AUTOMATIC);
    ottdConnection.send_update_frequency(ottd.enums.UpdateTypes.COMPANY_INFO, ottd.enums.UpdateFrequencies.AUTOMATIC);
    ottdConnection.send_update_frequency(ottd.enums.UpdateTypes.CHAT, ottd.enums.UpdateFrequencies.AUTOMATIC);
    ottdConnection.send_update_frequency(ottd.enums.UpdateTypes.CONSOLE, ottd.enums.UpdateFrequencies.AUTOMATIC);
});

const pendingClientInfo = {};

ottdConnection.on("chat", (data) => {
    console.log("Message: " + JSON.stringify(data, null, 2));

    const clientId = data.id;
    const clientInfoPromise = new Promise((resolve) => {
        pendingClientInfo[clientId] = resolve;
    });
    ottdConnection.send_poll(ottd.enums.UpdateTypes.CLIENT_INFO, clientId);

    clientInfoPromise.then((clientInfo) => {
        console.log("Chat message: " + clientInfo.name + ": " + data.message);
        if (discordClient.isReady()) {
            discordClient.channels.cache.get(process.env.DISCORD_CHANNEL).send(`${clientInfo.name}: ${data.message}`);
        }
    });
});

let lastConsoleMessage = null; // race condition hell
ottdConnection.on("console", (data) => {
    console.log("Console message: " + JSON.stringify(data, null, 2));
    if (data.origin == "console") {
        lastConsoleMessage = data.output;
    }
});

ottdConnection.on("clientjoin", async (data) => {
    console.log("Client joined: " + JSON.stringify(data, null, 2));
    if (discordClient.isReady()) {
        discordClient.channels.cache.get(process.env.DISCORD_CHANNEL).send(lastConsoleMessage);
    }
});

ottdConnection.on('clientquit', function (data) {
    console.log("Client quit: " + JSON.stringify(data, null, 2));
    if (discordClient.isReady()) {
        discordClient.channels.cache.get(process.env.DISCORD_CHANNEL).send(lastConsoleMessage);
    }
});

ottdConnection.on("clientinfo", (data) => {
    console.log("Client info: " + JSON.stringify(data, null, 2));
    const clientId = data.id;
    // dark magic; it works and I'm not sure why
    if (pendingClientInfo[clientId]) {
        pendingClientInfo[clientId](data);
        delete pendingClientInfo[clientId];
    }

});


discordClient.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    discordClient.channels.cache.get(process.env.DISCORD_CHANNEL).send("OpenTTD bridge ready");
});

discordClient.on(Events.MessageCreate, message => {
    if (message.author.bot) return;
    ottdConnection.send_chat(3, 0, 0, `${message.author.username}: ${message.content}`);
});

discordClient.login(process.env.DISCORD_TOKEN);
