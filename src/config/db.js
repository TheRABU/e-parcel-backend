import mongoose from "mongoose";

export const connectDatabase = async () => {
  try {
    const result = await mongoose.connect(`${process.env.DB_URI}`);
    console.log("DB CONNECTION Successful sir!");
  } catch (error) {
    console.log("error at connecting database", error.message);
    process.exit(1);
  }
};
