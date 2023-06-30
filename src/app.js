import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dayjs from 'dayjs';

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

// endpoints
app.post('/participants', async (req, res) => {

    // joi validation
    const participantSchema = joi.object({
        name: joi.string().required()
    });
    const validation = participantSchema.validate(req.body, { abortEarly: false });
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    // db operations
    try {
        // check for username duplicate
        const participant = await db.collection('participants').findOne({ name: req.body.name });
        if (participant) return res.status(409).send('Nome já existe.');
        // add user to participants collection
        await db.collection('participants').insertOne({
            name: req.body.name,
            lastStatus: dayjs().valueOf()
        });
        // add login message to messages collection
        await db.collection('messages').insertOne({
            from: req.body.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        });
        // status
        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }

})

app.get('/participants', async (req, res) => {

    try {
        const participantsArray = await db.collection('participants').find().toArray();
        res.status(200).send(participantsArray.map(({ name }) => { return name }));
    } catch (err) {
        res.status(500).send(err.message);
    }

})

// listen
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));