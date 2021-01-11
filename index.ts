import type { CollectionReference } from '@google-cloud/firestore'
import type { Context, Middleware } from 'telegraf'

interface Options<C> {
    getSessionKey: (ctx: C) => string | undefined
    lazy:
        | boolean
        | Promise<boolean>
        | ((ctx: C) => boolean)
        | ((ctx: C) => Promise<boolean>)
}

function middleware<C extends Context>(
    collection: CollectionReference,
    opts?: Partial<Options<C>>
): Middleware<C> {
    const DEFAULT_OPTIONS: Options<C> = {
        getSessionKey: (ctx: C) =>
            ctx.from && ctx.chat && `${ctx.from.id}-${ctx.chat.id}`,
        lazy: () => false,
    }
    const completeOpts: Options<C> = { ...DEFAULT_OPTIONS, ...opts }

    const options = {
        getSessionKey: completeOpts.getSessionKey,
        lazy: async (ctx: C) =>
            typeof completeOpts.lazy === 'function'
                ? completeOpts.lazy(ctx)
                : completeOpts.lazy,
    }

    async function getSession(key: string) {
        const snapshot = await collection.doc(key).get()
        // Assume we can cast document to session data
        return snapshot.data() as C | undefined
    }

    function saveSession(key: string, session: C | {} | undefined) {
        if (session == null || Object.keys(session).length === 0) {
            return collection.doc(key).delete()
        }
        return collection.doc(key).set(session)
    }

    return async (ctx, next) => {
        const key = options.getSessionKey(ctx)
        if (key === undefined) {
            return next?.()
        }
        // determine if we should wrap the session data into a promise
        const immediate = !(await options.lazy(ctx))

        let session: C | {} | undefined
        let sessionP: Promise<C | {}> | undefined

        if (immediate) session = (await getSession(key)) || {}

        Object.defineProperty(ctx, 'session', {
            get() {
                // returns either session or sessionP, depending on laziness
                if (immediate) {
                    return session
                } else {
                    if (sessionP === undefined)
                        // eslint-disable-next-line no-async-promise-executor
                        sessionP = new Promise(async resolve => {
                            if (session === undefined)
                                session = (await getSession(key)) || {}
                            resolve(session)
                        })
                    return sessionP
                }
            },
            set(newValue) {
                session = Object.assign({}, newValue)
            },
        })

        const n = await next?.()

        if (immediate) return saveSession(key, session)
        else if (sessionP !== undefined) return saveSession(key, await sessionP)
        else return n
    }
}

export = middleware
