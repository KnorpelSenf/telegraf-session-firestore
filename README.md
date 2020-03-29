# telegraf-session-firestore

Google Firestore based session middleware for telegraf.js. Heavily inspired by https://github.com/telegraf/telegraf-session-firebase/

## Installation

```bash
npm install --save telegraf-session-firestore
```

## Example

```js
const Telegraf = require('telegraf')
const firestoreSession = require('telegraf-session-firestore')
const { Firestore } = require('@google-cloud/firestore')

const db = new Firestore({
    projectId: 'YOUR_PROJECT_ID',
    keyFilename: 'firestore-keyfile.json',
});

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.use(firestoreSession(db.collection('sessions')))
bot.on('text', (ctx, next) => {
  ctx.session.counter = ctx.session.counter || 0
  ctx.session.counter++
  return next()
})
bot.hears('/stats', ({ reply, session, from }) => reply(`${session.counter} messages from ${from.username}`))
bot.startPolling()```
