# telegraf-session-firestore

Google Firestore based session middleware for telegraf.js. Loosely based on [the firebase equivalent](https://github.com/telegraf/telegraf-session-firebase/) but written in TypeScript.

## Installation

```bash
npm install telegraf-session-firestore --save
```

## Introduction

This middleware supports two modi, *strict* and *lazy*.
In strict mode, everything works the way you would expect from a middleware.
For every request, a Cloud Firestore collection is queried and the session data is provided in a property on the context object.
The session data can be modified arbitrarily and will be written back to the database afterwards.

**Example for strict mode:**

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
bot.on('photo', (ctx, next) => {
  const session = ctx.session;
  session.counter = session.counter || 0
  session.counter++
  return next()
})
bot.hears('/stats', ({ reply, session, from }) =>
  reply(`already got ${session.counter} pics from ${from.username}!`))
bot.startPolling()
```

However, on firestore, you are billed per operation.
If your bot does not need the session data for most of the messages it processes, this would cause a lot of superfluous reads and writes.
Imagine your bot is in a group chat where it only counts photos but otherwise ignores all messages.
Then it would not makes sense to retrieve the session data for every request and write it back.
The solution: lazy mode.

**Example for lazy mode:**

```js
const Telegraf = require('telegraf')
const firestoreSession = require('telegraf-session-firestore')
const { Firestore } = require('@google-cloud/firestore')

const db = new Firestore({
    projectId: 'YOUR_PROJECT_ID',
    keyFilename: 'firestore-keyfile.json',
});

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.use(firestoreSession(db.collection('sessions'), { lazy: true }))
bot.on('photo', async (ctx, next) => {
  const session = await ctx.session;
  session.counter = session.counter || 0
  session.counter++
  return next()
})
bot.hears('/stats', async ({ reply, session, from }) =>
  reply(`already got ${(await session).counter} pics from ${from.username}`))
bot.startPolling()
```

By passing `lazy: true` to the options, the session data is wrapped inside a promise.
This promise is lazily created upon accessing `ctx.session`.
Otherwise, no communication is performed.
Note that the data is queried at most once, no matter how often you access the promise.
As a result, you only need a fraction of database communication (so you are billed less so you have more money so you can buy ~~me~~ yourself a coffee so you can stay up later at night so you have time to go out so you can tell more people about your bot, eventually increasing the number of database requests again).
Yay.

It is in fact possible to use lazy mode on a per request basis, for instance you could use lazy mode only for groups.
Simply pass:

```js
bot.use(firestoreSession(db.collection('sessions'), {
  lazy: ctx => ctx.chat.type !== 'private'
}))
```

## API

### Options

* `lazy`: flag for lazy mode
* `property`: context property name (default: `session`)
* `getSessionKey`: session key resolver function

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

To destroy a session simply set it to `undefined` (or another nullish value).

```js
bot.on('text', ctx => {
  ctx.session = undefined
})
```
