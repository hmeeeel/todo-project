const jwt = require('jsonwebtoken');


const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '2h';

//подписывает объект {sub, role, sessionId} на 2 часа
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

//ловится в middlewares/auth.js подпись неверна или срок истёк 
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
