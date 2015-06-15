// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// ----------------------------------------------------------------------------
//
// This class captures the metadata about a table in user database.

var core = require('../core');

module.exports = {
    fromColumns: function (columns) {
        // the default table metadata
        var metadata = new TableMetadata();

        // iterate over the columns
        columns.forEach(function (column) {
            metadata.addColumn(column);
        });

        if (metadata.idType !== 'string') {
            metadata.systemProperties = [];
            metadata.supportsConflict = false;
            metadata.supportsSoftDelete = false;
        }

        return metadata;
    }

    function addColumn(column) {
        // check if the column is id
        if (column.name === 'id') {
            metadata.idType = getTableIdType(column.type);
        }

        // check if the column is a system property
        if (core.isSystemColumnName(column.name)) {
            addSystemColumn(column);
        }

        // check if the column is a binary data type
        if (column.type === 'binary' || column.type == 'timestamp') {
            metadata.binaryColumns.push(column.name);
        }
    }

    function addSystemColumn(column) {
        var name = column.name.substring(2);
        var property = core.getSystemProperty(name);

        if (property && property.type === column.type) {
            metadata.systemProperties.push(property.name);

            if (property.name == 'version') {
                metadata.supportsConflict = true;
            }
            else if (property.name == 'deleted') {
                metadata.supportsSoftDelete = true;
            }
        }
    }

    function getTableIdType(type) {
        if (type.indexOf('int') >= 0) {
            return 'number';
        }
        else if (type.indexOf('char') >= 0) {
            return 'string';
        }
        return 'unknown';
    }
};

function TableMetadata () {
    this.idType = 'unknown';
    this.supportsConflict = false;
    this.supportsSoftDelete = false;
    this.systemProperties = [];
    this.binaryColumns = [];

    Object.defineProperty(this, 'hasStringId', {
        get: function () { return this.idType === 'string'; }
    });
}

TableMetadata.prototype.hasBinaryColumn = function (name) {
    return this.binaryColumns.indexOf(name.toLowerCase()) > -1;
};
