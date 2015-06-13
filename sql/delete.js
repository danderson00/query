var core = require('../core'),
    _ = require('underscore');

module.exports = function (table, id, version, tableMetadata, logger, callback) {
    var parameters = [],
        item = { id: id, __version: version },
        tableName = formatTableName('dbo', table),
        deleteStmt = _.sprintf("DELETE FROM %s WHERE [id] = ?", tableName),
        sqlEventName = 'DELETE',
        forOperation = 'delete',
        errorPrefix = 'Delete',
        self = this;
    parameters.push(id);

    if (tableMetadata.supportsSoftDelete) {
        deleteStmt = _.sprintf("UPDATE TOP (1) %s SET [__deleted] = 1 WHERE [id] = ? AND [__deleted] = 0", tableName);
        sqlEventName = 'UPDATE';
        forOperation = 'update';
        errorPrefix = 'Soft delete';
    }

    if (version) {
        deleteStmt += " AND [__version] = ? ";

        if (!self._trySetVersionParameter(version, parameters, callback)) {
            return;
        }
    }

    return deleteStmt;
};

// Performs the following validations on the specified identifier:
// - first char is alphabetic or an underscore
// - all other characters are alphanumeric or underscore
// - the identifier is LTE 128 in length
//
// When used with proper sql parameterization techniques, this
// mitigates SQL INJECTION attacks.
function isValidIdentifier(identifier) {
    if (!identifier || !core.isString(identifier) || identifier.length > 128) {
        return false;
    }

    for (var i = 0; i < identifier.length; i++) {
        var char = identifier[i];
        if (i === 0) {
            if (!(core.isLetter(char) || (char == '_'))) {
                return false;
            }
        }
        else {
            if (!(core.isLetter(char) || core.isDigit(char) || (char == '_'))) {
                return false;
            }
        }
    }

    return true;
}

function validateIdentifier(identifier) {
    if (!isValidIdentifier(identifier)) {
        throw new Error(_.sprintf("%s is not a valid identifier. Identifiers must be under 128 characters in length, start with a letter or underscore, and can contain only alpha-numeric and underscore characters.", identifier));
    }
}

// SECURITY - sql generation relies on these format functions to
// validate identifiers to mitigate sql injection attacks
// in the dynamic sql we generate
function formatTableName(schemaName, tableName) {
    validateIdentifier(schemaName);
    validateIdentifier(tableName);
    return _.sprintf('[%s].[%s]', schemaName, tableName);
}
