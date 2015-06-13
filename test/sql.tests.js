var update = require('../sql/update'),
    insert = require('../sql/insert'),
    del = require('../sql/delete'),
    expect = require('chai').expect

describe('sql', function () {
    it('update returns a query', function () {
        var query = update({
            table: 'test',
            item: { id: 1, text: 'test' },
            id: 1,
            schema: 'dbo'
        }, {})

        console.log(query);
        expect(query).to.not.be.empty;
    })

    it('insert returns a query', function () {
        var query = insert('test', { id: 1, text: 'test' }, {})

        console.log(query);
        expect(query).to.not.be.empty;
    })

    it('delete returns a query', function () {
        var query = del('test', 1, undefined, {})

        console.log(query);
        expect(query).to.not.be.empty;
    })
})
