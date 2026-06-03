const { randomBytes } = require('crypto');

function nanoid(size = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars[randomBytes(1)[0] % chars.length];
  }
  return result;
}

module.exports = { nanoid };
