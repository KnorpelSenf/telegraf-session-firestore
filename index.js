module.exports = (collection, opts) => {
    const options = Object.assign({
        property: 'session',
        getSessionKey: (ctx) => ctx.from && ctx.chat && `${ctx.from.id}-${ctx.chat.id}`
    }, opts)

    function getSession(key) {
        return collection.doc(key).get()
            .then((snapshot) => {
                return snapshot.exists && snapshot.data()
            })
    }

    function saveSession(key, session) {
        if (!session || Object.keys(session).length === 0) {
            return collection.doc(key).delete()
        }
        return collection.doc(key).set(session)
    }

    return (ctx, next) => {
        const key = options.getSessionKey(ctx)
        if (!key) {
            return next()
        }
        return getSession(key).then((value) => {
            let session = value || {}
            Object.defineProperty(ctx, options.property, {
                get: function () { return session },
                set: function (newValue) { session = Object.assign({}, newValue) }
            })
            return next().then(() => saveSession(key, session))
        })
    }
}
