import type { CollectionReference } from '@google-cloud/firestore'
import type { Context } from 'telegraf'

export interface Options {
    property: string;
    getSessionKey: (ctx: Context) => string;
}

export default (collection: CollectionReference, opts?: Options) => {
    const options = Object.assign({
        property: 'session',
        getSessionKey: (ctx: Context) => ctx.from && ctx.chat && `${ctx.from.id}-${ctx.chat.id}`
    }, opts)

    async function getSession(key: string) {
        const snapshot = await collection.doc(key).get()
        return snapshot.exists && snapshot.data()
    }

    function saveSession(key: string, session: any) {
        if (!session || Object.keys(session).length === 0) {
            return collection.doc(key).delete()
        }
        return collection.doc(key).set(session)
    }

    return async (ctx: Context, next: (() => any)) => {
        const key = options.getSessionKey(ctx)
        if (key === undefined) {
            return next()
        }
        let session = await getSession(key) || {}
        Object.defineProperty(ctx, options.property, {
            get: function () { return session },
            set: function (newValue) { session = Object.assign({}, newValue) }
        })
        await next()
        return saveSession(key, session)
    }
}
