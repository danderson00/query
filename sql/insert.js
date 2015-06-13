var core = require('../core'),
    _ = require('underscore');

module.exports = function (table, item, tableMetadata, systemProperties, logger, callback) {
    var parameters = [],
        hasStringId = tableMetadata.hasStringId,
        binaryColumns = tableMetadata.binaryColumns,
        tableName = formatTableName('dbo', table),
        self = this,
        invalidIdError = null,
        columnNames = '',
        valueParams = '';

    _.each(item, function (value, prop) {
        if (!invalidIdError) {
            // validate the property
            try {
                _validateProperty(prop, value);
            }
            catch (error) {
                invalidIdError = error;
            }

            if (prop === 'id' && value) {
                if (!hasStringId) {
                    //invalidIdError = new core.MobileServiceError("intIdValueNotAllowedOnInsert", core.ErrorCodes.BadInput);
                }
                else if (!core.isValidStringId(value)) {
                    invalidIdError = new core.MobileServiceError("The value specified for property 'id' is invalid. An id must not contain any control characters or the characters \",+,?,\\,`.", core.ErrorCodes.BadInput);
                    return;
                }
            }

            // ignore the property if it is a default id
            if (prop !== 'id' || value) {
                // get the column names and values
                if (columnNames.length > 0) {
                    columnNames += ', ';
                }
                columnNames += '[' + prop + ']';

                if (valueParams.length > 0) {
                    valueParams += ', ';
                }
                valueParams += '?';

                // Check for binary data that needs to be
                // converted into a buffer instance
                if (_.contains(binaryColumns, prop.toLowerCase()) &&
                        core.isString(value)) {
                    value = new Buffer(value, 'base64');
                }

                parameters.push(value);
            }
        }
    });


    if (invalidIdError) {
        //callback(invalidIdError);
        throw invalidIdError;
        return;
    }

    // to select the inserted row's id we need to use OUTPUT clause and for a table with triggers OUTPUT INTO is required so we need a temp table
    var insertStmt = _.sprintf('DECLARE  @temp table(id %s) ', hasStringId ? 'nvarchar(MAX)' : 'bigint');

    // Create the VALUES clause and add the INSERT clause
    var valuesClause;
    if (columnNames.length > 0) {
        valuesClause = _.sprintf(" VALUES (%s) ", valueParams);
        insertStmt += _.sprintf("INSERT INTO %s (%s)", tableName, columnNames);
    }
    else {
        // no values being inserted, so insert defaults
        valuesClause = " DEFAULT VALUES ";
        insertStmt += _.sprintf("INSERT INTO %s ", tableName);
    }

    // Add the OUTPUT clause
    var outputClause = ' OUTPUT INSERTED.id INTO @temp';

    insertStmt += outputClause + valuesClause;

    if (hasStringId) {
        var selectItemProperties = '[appTable].[id] AS [id]';
        if (systemProperties) {
            systemProperties.forEach(function (systemProperty) {
                selectItemProperties += _.sprintf(', [appTable].[__%1$s] AS [__%1$s]', systemProperty);
            });
        }
        // select the system properties and generated ids for the rows from data added to temp table using output clause
        insertStmt += _.sprintf('SELECT %s FROM %s AS appTable INNER JOIN @temp AS temp ON [appTable].[id] = [temp].[id] ', selectItemProperties, tableName);
    }
    else {
        insertStmt += 'SELECT id from @temp';
    }

    return insertStmt;
}

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

// property name must be a valid identifier
function _validateProperty(propertyName, value) {
    validateIdentifier(propertyName);

    // if there is a system property, make sure it is cased correctly
    var systemColumnName = _.find(core.supportedSystemColumns, function (c) { return c.toLowerCase() === propertyName; });
    if (systemColumnName && propertyName !== systemColumnName) {
        throw new core.MobileServiceError(_.sprintf("If a value for the property '%s' is specified, the property name must be cased correctly.", systemColumn), core.ErrorCodes.BadInput);
    }

    // the value must be of a supported type
    core.validatePropertyType(propertyName, value);
}
