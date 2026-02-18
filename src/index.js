import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config("./.env");

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`app listening on port http://localhost:${PORT}`);
    });
  })

  .catch((error) => {
    console.log("Mongodb connection error", error);
  });
