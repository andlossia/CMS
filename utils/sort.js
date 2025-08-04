const buildSort = (sort, defaultOrder = 'asc', validSortableFields = []) => {
  if (!sort) return {};

  const defaultSortOrder = defaultOrder.toLowerCase() === 'desc' ? -1 : 1;

  return sort.split(',').reduce((acc, field) => {
    const cleanField = field.replace(/^-/, '');
    const order = field.startsWith('-') ? -1 : defaultSortOrder;

    if (validSortableFields.length === 0 || validSortableFields.includes(cleanField)) {
      acc[cleanField] = order;
    }

    return acc;
  }, {});
};

module.exports = { buildSort };
