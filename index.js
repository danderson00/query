var app = require('express')(),
    core = require('./core'),
    Query = require('query.js').Query

require('./storage/sqlformatter')

app.get('/:table', function (req, res, next) {
    var query = fromRequest(req)
    query.where({ p1: 'test' })

    var formatter = new SqlFormatter('schema', {})
    formatter.format(Query.Providers.OData.toOData(query))
    res.send(JSON.stringify({
        sql: formatter.sql,
        parameters: formatter.parameters
    }))
})

app.use(function (err, req, res, next) {
    res.send(err.constructor === String
        ? err
        : JSON.stringify({
            message: err.message,
            stack: err.stack
        })
    )
})

app.listen(3000)


function fromRequest(req) {
    return Query.Providers.OData.fromOData(
        req.path.substring(req.path.lastIndexOf('/') + 1),
        req.query.$filter,
        req.query.$orderby,
        parseInt(req.query.$skip),
        parseInt(req.query.$top),
        req.query.$select,
        req.query.$inlinecount === 'allpages')
}
