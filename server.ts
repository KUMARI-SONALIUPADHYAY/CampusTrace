import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connect
mongoose.connect(process.env.MONGO_URI!)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("DB error:", err));

// Item schema
const ItemSchema = new mongoose.Schema({
  type: String,          // lost | found
  title: String,
  category: String,
  description: String,
  location: String,
  date: String,
  status: { type: String, default: "Unclaimed" },
  createdAt: { type: Date, default: Date.now }
});

const Item = mongoose.model("Item", ItemSchema);

// Routes
app.get("/", (req, res) => res.send("CampusTrace API running"));

app.post("/api/items", async (req, res) => {
  const item = await Item.create(req.body);
  res.json(item);
});

app.get("/api/items", async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.json(items);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
