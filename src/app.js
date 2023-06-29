import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

// app initialization
const app = express();

// configs
app.use(express.json());
app.use(cors());
dotenv.config();

// db connection
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message));

// listen
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));