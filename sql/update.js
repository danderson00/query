var core = require('../core'),
    _ = require('underscore');

module.exports = function (options, tableMetadata, systemProperties) {
    var table = options.table,
        item = options.item,
        logger = options.logger,
        id = options.id,
        schema = options.schema;

    var tableName = formatTableName(schema, table),
                     setStatements = '',
                     selectItemProperties = '',
                     versionValue = '',
                     hasStringId = tableMetadata.hasStringId,
                     updateStmt = '',
                     binaryColumns = tableMetadata.binaryColumns,
                     parameters = [];

    for (var prop in item) {
        var value = item[prop];

        if (hasStringId && prop.toLowerCase() === '__version') {
            if (selectItemProperties.length > 0) {
                selectItemProperties += ', ';
            }
            selectItemProperties += _.sprintf('[%1$s] AS [%1$s]', prop);
            versionValue = value;
            continue;
        }

        if (prop.toLowerCase() == 'id') {
            // we skip this property, since the id pk cannot
            // be updated
            continue;
        }

        try {
            _validateProperty(prop, value);
        }
        catch (error) {
            //callback(error);
            return;
        }

        if (setStatements.length > 0) {
            setStatements += ', ';
        }
        setStatements += '[' + prop + '] = ?';

        // Check for binary data that needs to be
        // converted into a buffer instance
        if (_.contains(binaryColumns, prop.toLowerCase()) &&
            core.isString(value)) {
            value = new Buffer(value, 'base64');
        }

        parameters.push(value);
    }

    if (setStatements.length > 0) {
        updateStmt = _.sprintf("UPDATE %s SET %s WHERE [id] = ? ", tableName, setStatements);
    }
    else {
        updateStmt = _.sprintf("UPDATE %s SET [id] = ? WHERE [id] = ? ", tableName, setStatements);
        parameters.push(id);
    }
    parameters.push(id);

    if (versionValue) {
        updateStmt += "AND [__version] = ? ";
        if (!this._trySetVersionParameter(versionValue, parameters, callback))
        {
            return;
        }
    }

    // filter out deleted rows unless we want to undelete the item
    var isUndelete = item.__deleted === false;
    if (tableMetadata.supportsSoftDelete && !isUndelete) {
        updateStmt += "AND [__deleted] = 0 ";
    }

    updateStmt += '; SELECT @@rowcount as __rowcount';

    // Add the SELECT clause if the id is a string
    if (hasStringId) {
        if (systemProperties) {
            _.each(systemProperties, function (systemProperty) {
                if (!versionValue || systemProperty !== 'version') {
                    if (selectItemProperties.length > 0) {
                        selectItemProperties += ', ';
                    }
                    selectItemProperties += _.sprintf('[__%1$s] AS [__%1$s]', systemProperty);
                }
            });
        }
        if (selectItemProperties.length > 0) {
            updateStmt += _.sprintf("; SELECT %s FROM %s WHERE [id] = ?", selectItemProperties, tableName);
            parameters.push(id);
        }
    }

    return updateStmt;
    //callback(null, updateStmt, parameters, versionValue);
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
