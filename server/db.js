import mongoose from "mongoose";
export async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bahceni";
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return uri;
}
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
  },
  { timestamps: true },
);
export const User = mongoose.model("User", userSchema);
export const Product = mongoose.model(
  "Product",
  new mongoose.Schema(
    {
      name: String,
      category: String,
      price: Number,
      stock: Number,
      image: String,
      description: String,
      color: String,
    },
    { timestamps: true },
  ),
);
export const Order = mongoose.model(
  "Order",
  new mongoose.Schema(
    {
      user: mongoose.Schema.Types.ObjectId,
      items: Array,
      total: Number,
      address: String,
      status: { type: String, default: "pending" },
      paymentMode: String,
      paymentToken: String,
    },
    { timestamps: true },
  ),
);
export const Design = mongoose.model(
  "Design",
  new mongoose.Schema(
    {
      user: mongoose.Schema.Types.ObjectId,
      name: String,
      productId: String,
      x: Number,
      y: Number,
      scale: Number,
      rotation: Number,
    },
    { timestamps: true },
  ),
);
