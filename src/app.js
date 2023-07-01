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

});

app.get('/participants', async (req, res) => {

    try {
        const participantsArray = await db.collection('participants').find().toArray();
        // res.status(200).send(participantsArray.map(({ name }) => { return name }));
        res.status(200).send(participantsArray);
    } catch (err) {
        res.status(500).send(err.message);
    }

});

app.post('/messages', async (req, res) => {

    const fromUser = req.header('user');
    if (!fromUser) return res.sendStatus(422);

    // joi validation
    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required()
    });
    const validation = messageSchema.validate(req.body, { abortEarly: false });
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    // db operations
    try {
        // check if fromUser exists in db
        const participant = await db.collection('participants').findOne({ name: fromUser });
        if (!participant) return res.sendStatus(422);
        // add message to collection
        await db.collection('messages').insertOne({
            from: fromUser,
            to: req.body.to,
            text: req.body.text,
            type: req.body.type,
            time: dayjs().format('HH:mm:ss')
        });
        // status
        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }

});

app.get('/messages', async (req, res) => {

    // user header
    const fromUser = req.header('user');
    if (!fromUser) return res.sendStatus(422);

    // limit query
    let limit = req.query.limit;
    if (limit == undefined) { limit = Infinity };
    const limitSchema = joi.number().min(1).allow(Infinity).required();
    const limitValidation = limitSchema.validate(limit);
    if (limitValidation.error) {
        const error = limitValidation.error.details.map((detail) => detail.message);
        return res.status(422).send(error);
    } else {
        limit = Number(limit);
    };

    // db operations
    try {
        const messagesArray = await db.collection('messages').find({
            $or: [
                { type: 'message' },
                { to: 'Todos' },
                { type: 'private_message', to: fromUser },
                { type: 'private_message', from: fromUser }
            ]
        }).sort({ $natural: -1 }).limit(limit).toArray();
        res.status(200).send(messagesArray);
    } catch (err) {
        res.status(500).send(err.message);
    }

});

app.post('/status', async (req, res) => {

    // user header
    const fromUser = req.header('user');
    if (!fromUser) return res.sendStatus(404);

    // db operations
    try {
        // attemp to update participant data
        const updateResponse = await db.collection('participants').updateOne(
            {name: fromUser},
            {$set: {'lastStatus': Date.now()}}
        );
        // check if fromUser exists in db based on db response
        if (updateResponse.matchedCount == 0) return res.sendStatus(404);
        // status
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }

});

// listen
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));