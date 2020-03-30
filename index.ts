import type { CollectionReference } from '@google-cloud/firestore'
import type { ContextMessageUpdate, Middleware } from 'telegraf'

export interface Options<C> {
    property?: string;
    getSessionKey?: (ctx: C) => string | undefined;
}

export default function <C extends ContextMessageUpdate>(collection: CollectionReference, opts?: Options<C>): Middleware<C> {
    const options = Object.assign({
        property: 'session',
        getSessionKey: (ctx: C) => ctx.from && ctx.chat && `${ctx.from.id}-${ctx.chat.id}`
    }, opts)

    async function getSession(key: string) {
        const snapshot = await collection.doc(key).get()
        return snapshot.data()
    }

    function saveSession(key: string, session: any) {
        if (!session || Object.keys(session).length === 0) {
            return collection.doc(key).delete()
        }
        return collection.doc(key).set(session)
    }

    return async (ctx, next) => {
        const key = options.getSessionKey(ctx)
        if (key === undefined) {
            return next?.()
        }
        let session = await getSession(key) || {}
        Object.defineProperty(ctx, options.property, {
            get: function () { return session },
            set: function (newValue) { session = Object.assign({}, newValue) }
        })
        await next?.()
        return saveSession(key, session)
    }
}
