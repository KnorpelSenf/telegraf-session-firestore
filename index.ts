import type { CollectionReference } from '@google-cloud/firestore'
import type { ContextMessageUpdate, Middleware } from 'telegraf'

export interface Options<C> {
    property?: string;
    getSessionKey?: (ctx: C) => string | undefined;
    lazy?: boolean | Promise<boolean> | ((ctx: C) => Promise<boolean>);
}

export default function <C extends ContextMessageUpdate>(collection: CollectionReference, opts?: Options<C>): Middleware<C> {
    const completeOpts = Object.assign({
        property: 'session',
        getSessionKey: (ctx: C) => ctx.from && ctx.chat && `${ctx.from.id}-${ctx.chat.id}`,
        lazy: () => false
    }, opts)

    const options: {
        property: string, getSessionKey:
        (ctx: C) => string | undefined,
        lazy: ((ctx: C) => Promise<boolean>)
    } = {
        property: completeOpts.property,
        getSessionKey: completeOpts.getSessionKey,
        lazy: async ctx => typeof completeOpts.lazy === 'function'
            ? completeOpts.lazy(ctx)
            : completeOpts.lazy
    }

    async function getSession(key: string) {
        const snapshot = await collection.doc(key).get()
        // Assume we can cast document to session data
        return snapshot.data() as C | undefined
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
        // session has type
        // - C if session data was found in the db
        // - {} if on session data was found in the db
        // - undefined if the loading operation is still deferred
        let session: C | {} | undefined = undefined;
        const immediate = !await options.lazy(ctx)
        if (immediate) {
            session = await getSession(key) || {}
        }
        Object.defineProperty(ctx, options.property, {
            get: function () {
                if (immediate) {
                    return session
                } else {
                    return new Promise(async resolve => {
                        if (session === undefined)
                            session = await getSession(key) || {}
                        resolve(session)
                    })
                }
            },
            set: function (newValue) { session = Object.assign({}, newValue) }
        })
        await next?.()
        return saveSession(key, session)
    }
}
