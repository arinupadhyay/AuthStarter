
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const helmet = require("helmet");

const app = express();

async function startServer() {
  if (!process.env.MONGO_URI || !process.env.SESSION_SECRET) {
    throw new Error("MONGO_URI and SESSION_SECRET are required");
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.SESSION_SECRET.length < 32
  ) {
    throw new Error("Use a long random session secret in production");
  }

  await mongoose.connect(process.env.MONGO_URI);

  // Enable this only when deployed behind a trusted proxy.
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));

  app.use(
    session({
      name: "sid",
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,

      store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: "sessions",
        ttl: 7 * 24 * 60 * 60
      }),

      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/"
      }
    })
  );

  app.get("/", (req, res) => {
    res.json({
      message: "AuthStarter API is running"
    });
  });

  app.use("/api/auth", require("./routes/auth"));

  // Return a generic error instead of leaking internal details.
  app.use((err, req, res, next) => {
    console.error(err.message);

    if (res.headersSent) {
      return next(err);
    }

    res.status(500).json({
      message: "Something went wrong"
    });
  });

  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Could not start server:", error.message);
  process.exit(1);
});
