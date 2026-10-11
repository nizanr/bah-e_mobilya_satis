import { connectDB } from "./db.js";
import { createApp, seed } from "./app.js";
import express from "express";
const uri = await connectDB();
await seed();
const app = createApp(uri);
if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  app.get("/{*path}", (req, res) =>
    res.sendFile(process.cwd() + "/dist/index.html"),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(process.env.PORT || 3000, "0.0.0.0", (error) => {
  if (error) throw error;
  console.log("Bahçeni Tasarla hazır, port " + (process.env.PORT || 3000));
});
