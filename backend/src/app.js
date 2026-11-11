const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { isAllowedOrigin } = require("./config/allowedOrigins");
const verifyRequestOrigin = require("./middleware/verifyRequestOrigin");
const app = express();
app.set("trust proxy", 1);

const authRoutes = require("./routes/authRoutes");
const googleAuthRoutes = require("./routes/googleAuthRoutes");
const classroomRoutes = require("./routes/classroomRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const studyMaterialRoutes = require("./routes/studyMaterialRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const mlPredictionRoutes = require("./routes/mlPredictionRoutes");
const aiRoutes = require("./routes/aiRoutes");
const doubtRoutes = require("./routes/doubtRoutes");
const quizRoutes = require("./routes/quizRoutes");

app.use(helmet());

app.use(
  cors({
    origin: function (origin, callback) {
      // Requests from Postman/server-to-server clients may not send Origin.
      if (!origin) return callback(null, true);
      return callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Check Origin on browser write requests because auth now uses cookies.
app.use(verifyRequestOrigin);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "OK",
      service: "ClassSphere API",
    },
  });
});

app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/auth/google", googleAuthRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api", assignmentRoutes);
app.use("/api", studyMaterialRoutes);
app.use("/api", announcementRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/analytics", mlPredictionRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/discussions", doubtRoutes);
app.use("/api/quizzes", quizRoutes);


module.exports = app;
