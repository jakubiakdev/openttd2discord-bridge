# OpenTTD to Discord Bridge
Unifies OpenTTD game chat with a Discord channel (two-way communication). Includes support for join and leave messages.

## Configuration
- OpenTTD's `secrets.cfg`:
```ini
[network]
admin_password = <very secret string!>
```
- OpenTTD's `config.cfg`:
```ini
[network]
server_admin_port = 3977 // You can change this value, but remember to update `.env` accordingly
server_admin_chat = true 
```

- Copy `.env.example` in this repository to `.env` and populate it with
```env
DISCORD_TOKEN=<discord token from https://discord.com/developers/applications>
DISCORD_CHANNEL=<discord channel id that the bot will send messages to>
OTTD_HOST=<OpenTTD server host, e.g. localhost>
OTTD_PORT=<Admin port from config.cfg>
OTTD_AUTH_PASSWORD=<Admin password from secrets.cfg>
OTTD_AUTH_USERNAME=<Bridge's username, might be overwritten by your config>
```
- Run `npm install` to install dependencies.
- Start the OpenTTD server.
- Run `node index.js`.

## Special thanks
Lockheed Martin for developing an ICBM that could hit a city with a population of 44 504 and population densitiy of 881/km² as of 30.06.2022