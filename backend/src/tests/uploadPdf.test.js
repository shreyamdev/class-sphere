const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const uploadPdf = require("../middleware/uploadPdf");

const withUploadServer = async (callback) => {
  const app = express();
  app.post("/upload", uploadPdf, (req, res) => {
    return res.status(200).json({
      success: true,
      originalName: req.file?.originalname,
    });
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}/upload`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

test("rejects a non-PDF file even when MIME type and extension claim PDF", async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append("file", new Blob(["this is not a pdf"], { type: "application/pdf" }), "fake.pdf");

    const response = await fetch(url, { method: "POST", body: form });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.message, "The uploaded file is not a valid PDF.");
  });
});

test("accepts a PDF signature and sanitizes the submitted filename", async () => {
  await withUploadServer(async (url) => {
    const form = new FormData();
    form.append("file", new Blob(["%PDF-1.7\nexample"], { type: "application/pdf" }), "folder\\notes.pdf");

    const response = await fetch(url, { method: "POST", body: form });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.originalName, "notes.pdf");
  });
});
