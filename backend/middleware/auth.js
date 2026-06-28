const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-secret";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === "production",
};

const toB64Url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const fromB64Url = (str) =>
  Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const signJwt = (payload) => {
  const header = toB64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toB64Url(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 15 * 60 })
  );
  const sig = toB64Url(
    crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
};

const verifyJwt = (token) => {
  try {
    const [h, b, s] = token.split(".");
    const expected = toB64Url(
      crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest()
    );
    if (expected !== s) return null;
    const payload = JSON.parse(fromB64Url(b).toString("utf8"));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  const [salt, hash] = String(stored).split(":");
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
};

const generateRefreshToken = () => crypto.randomBytes(32).toString("hex");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const payload = verifyJwt(token);
  if (!payload || !payload.userId) return res.status(401).json({ error: "Invalid token" });
  req.userId = payload.userId;
  next();
};

module.exports = {
  signJwt, verifyJwt, hashPassword, verifyPassword, authMiddleware,
  generateRefreshToken, hashToken, REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTS,
};
