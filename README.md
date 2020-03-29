# telegraf-session-firestore

Google Firestore based session middleware for telegraf.js. Heavily inspired by https://github.com/telegraf/telegraf-session-firebase/

## Installation

```bash
npm install telegraf-session-firestore --save
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
bot.startPolling()
```

## API

### Options

* `property`: context property name (default: `session`)
* `getSessionKey`: session key resolver function (default: `(ctx) => any`)

Default implementation of `getSessionKey`:

```js
function getSessionKey(ctx) {
  if (!ctx.from || !ctx.chat) {
    return
  }
  return `${ctx.from.id}-${ctx.chat.id}`
}
```

### Destroying a session

To destroy a session simply set it to `null`.

```js
bot.on('text', (ctx) => {
  ctx.session = null
})

```
