const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype !== "application/pdf" ||
      !file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      return cb(new Error("Only PDF files are allowed."));
    }

    cb(null, true);
  },
});

const uploadPdf = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const status =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? 413
          : 400;

      return res.status(status).json({
        success: false,
        message: err.message,
      });
    }

    if (!req.file) return next();

    // MIME type and extension can be spoofed. Check the actual PDF signature
    // before any controller stores the file or forwards it to another service.
    if (!req.file.buffer || req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return res.status(400).json({
        success: false,
        message: "The uploaded file is not a valid PDF.",
      });
    }

    // Strip path/control characters from the client-provided filename before
    // it is saved in MongoDB or used in a download Content-Disposition header.
    const safeName = String(req.file.originalname || "document.pdf")
      .split(/[\\/]/)
      .pop()
      .replace(/[\u0000-\u001f\u007f\r\n]/g, "_")
      .slice(0, 180);
    req.file.originalname = safeName || "document.pdf";

    return next();
  });
};

module.exports = uploadPdf;
