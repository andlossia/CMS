const mongoose = require('mongoose');

function isEmpty(value) {
    return (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' && Object.keys(value).length === 0)
    );
}

function applyToJSON(schema) {
    schema.set('toJSON', {
        transform(doc, ret) {
            const transformed = { 
                _id: ret._id ? ret._id.toString() : undefined
             };

            const processObject = (value) => {
                if (value instanceof mongoose.Types.ObjectId) {
                    return value.toString();
                } else if (Array.isArray(value)) {
                    return value.map(item => processObject(item));
                } else if (value && typeof value === 'object') {
                    return Object.keys(value).reduce((acc, nestedKey) => {
                        acc[nestedKey] = processObject(value[nestedKey]);
                        return acc;
                    }, {});
                }
                return value;
            };

            const sortedData = {
                objectIds: [],
                strings: [],
                numbers: [],
                decimals: [],
                dates: [],
                booleans: [],
                arrays: [],
                objects: [],
                buffers: [],
                maps: [],
                mixed: [],
                timestamps: []
            };

            Object.keys(ret).forEach((key) => {
                if (['__v', '_id'].includes(key)) return;  

                const value = ret[key];
                if (isEmpty(value)) return; 

                const type = typeof value;

                if (value instanceof mongoose.Types.ObjectId) {
                    sortedData.objectIds.push({ key, value: processObject(value) });
                } else if (type === 'string') {
                    sortedData.strings.push({ key, value });
                } else if (type === 'number') {
                    sortedData.numbers.push({ key, value });
                } else if (value instanceof mongoose.Types.Decimal128) {
                    sortedData.decimals.push({ key, value: value.toString() });
                } else if (value instanceof Date) {
                    sortedData.dates.push({ key, value });
                } else if (type === 'boolean') {
                    sortedData.booleans.push({ key, value });
                } else if (Array.isArray(value)) {
                    sortedData.arrays.push({ key, value: processObject(value) });
                } else if (Buffer.isBuffer(value)) {
                    sortedData.buffers.push({ key, value: value.toString('base64') });
                } else if (value instanceof Map) {
                    sortedData.maps.push({ key, value: Object.fromEntries(value) }); 
                } else if (value && value.constructor.name === 'Mixed') {
                    sortedData.mixed.push({ key, value });
                } else if (type === 'object') {
                    sortedData.objects.push({ key, value: processObject(value) });
                }
            });

            if (ret.createdAt) sortedData.timestamps.push({ key: 'createdAt', value: ret.createdAt });
            if (ret.updatedAt) sortedData.timestamps.push({ key: 'updatedAt', value: ret.updatedAt });

            Object.assign(transformed, [
                ...sortedData.objectIds,
                ...sortedData.strings,
                ...sortedData.numbers,
                ...sortedData.decimals,
                ...sortedData.dates,
                ...sortedData.booleans,
                ...sortedData.arrays,
                ...sortedData.objects,
                ...sortedData.buffers,
                ...sortedData.maps,
                ...sortedData.mixed,
                ...sortedData.timestamps
            ].reduce((acc, { key, value }) => {
                acc[key] = value;
                return acc;
            }, {}));

            return transformed;
        }
    });
}

module.exports = applyToJSON;