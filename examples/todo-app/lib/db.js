function insert(record) {
  return Object.assign({}, record, { inserted: true });
}

module.exports = { insert };
