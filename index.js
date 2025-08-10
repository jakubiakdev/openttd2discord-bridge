var ottd = require("node-openttd-admin"),
    ottdConnection = new ottd.connection();

const { loadEnvFile } = require('node:process');
loadEnvFile();

const { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
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

let raceConditionHell = { econ: undefined, stats: undefined, info: undefined };
let raceCodnitionAskedForIt = false

function trySendingCompanyInfo() {
    if (raceConditionHell.econ && raceConditionHell.info && raceConditionHell.stats) {
        if (discordClient.isReady() && raceCodnitionAskedForIt) {
            let embed = new EmbedBuilder()
                .setTimestamp()
                .setFooter({ text: "OpenTTD" })
                .setFields(
                    { name: "Company Info", value: raceConditionHell.info, inline: true },
                    { name: "Company Stats", value: raceConditionHell.stats, inline: true },
                    { name: "Company Economy", value: raceConditionHell.econ, inline: true }
                )
            discordClient.channels.cache.get(process.env.DISCORD_CHANNEL).send({ embeds: [embed] });
        }
        raceConditionHell = { econ: undefined, stats: undefined, info: undefined } // reset after sending
        raceCodnitionAskedForIt = false
    }
}

ottdConnection.on('companyeconomy', function (data) {
    console.log("Company economy: " + JSON.stringify(data, null, 2));
    raceConditionHell.econ = `
- **Money**: ${data.money}
- **Loan**: ${data.loan}
- **Income**: ${data.income}
- **Cargo**: ${data.cargo}
- **Last quarter**:
  - **Value**: ${data.lastquarter.value}
  - **Perofrmance**: ${data.lastquarter.performance}
  - **Cargo**: ${data.lastquarter.cargo}
- **Previous quarter**:
  - **Value**: ${data.prevquarter.value}
  - **Performance**: ${data.prevquarter.performance}
  - **Cargo**: ${data.prevquarter.cargo}
    `

    trySendingCompanyInfo();
});
ottdConnection.on('companyinfo', function (data) {
    console.log("Company info: " + JSON.stringify(data, null, 2));
    const colourNames = [
            "Dark Blue", "Pale Green", "Pink", "Yellow", "Red", "Light Blue", "Green", "Dark Green",
            "Blue", "Cream", "Mauve", "Purple", "Orange", "Brown", "Grey", "White", "Black"
    ];
    raceConditionHell.info = `
- **Name**: ${data.name} 
- **ID**: #${data.id}
- **Manager**: ${data.manager}
- **Onwed by ai**: ${data.ai ? "Yes" : "No"}
- **Founded**: ${data.startyear}
- **Color**: ${colourNames[data.colour]}
- **Protected**: ${data.protected ? "Yes" : "No"}
    `

    trySendingCompanyInfo();
});
ottdConnection.on('companystats', function (data) {
    console.log("Company stats: " + JSON.stringify(data, null, 2));
    raceConditionHell.stats = `
- **Vechicles**: (${data.vehicles.trains + data.vehicles.lorries + data.vehicles.busses + data.vehicles.planes + data.vehicles.ships})
  - **Trains**: ${data.vehicles.trains}
  - **Lorries**: ${data.vehicles.lorries}
  - **Buses**: ${data.vehicles.busses}
  - **Planes**: ${data.vehicles.planes}
  - **Ships**: ${data.vehicles.ships}
- **Stations**: (${data.stations.trains + data.stations.lorries + data.stations.busses + data.stations.planes + data.stations.ships})
  - **Trains**: ${data.stations.trains}
  - **Lorries**: ${data.stations.lorries}
  - **Buses**: ${data.stations.busses}
  - **Airports**: ${data.stations.planes}
  - **Docks**: ${data.stations.ships} 
    `

    trySendingCompanyInfo();
});



discordClient.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    discordClient.channels.cache.get(process.env.DISCORD_CHANNEL).send("OpenTTD bridge ready");
});

discordClient.on(Events.MessageCreate, message => {
    if (message.channel.id != process.env.DISCORD_CHANNEL) return;
    if (message.author.bot) return;
    if (message.content.startsWith(process.env.DISCORD_CMD_STATS)) {

        let arguments = message.content.split(" ")
        console.log(arguments)
        console.log(arguments[1])
        if (arguments[1] == undefined) {
            discordClient.channels.cache.get(process.env.DISCORD_CHANNEL).send(`Correct usage: \`${process.env.DISCORD_CMD_STATS} <company_id>\``);
            return
        }
        console.log(arguments)
        raceCodnitionAskedForIt = true;
        ottdConnection.send_poll(ottd.enums.UpdateTypes.COMPANY_INFO, arguments[1]);
        ottdConnection.send_poll(ottd.enums.UpdateTypes.COMPANY_ECONOMY, arguments[1]);
        ottdConnection.send_poll(ottd.enums.UpdateTypes.COMPANY_STATS, arguments[1]);
    }
    ottdConnection.send_chat(3, 0, 0, `${message.author.username}: ${message.content}`);
});

discordClient.login(process.env.DISCORD_TOKEN);
