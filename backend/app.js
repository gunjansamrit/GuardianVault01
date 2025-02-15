const express = require('express');
const app = express();
const dotenv=require('dotenv');
dotenv.config();
const db = require('./dbConnections');
const cors = require('cors');
// const { Kafka } = require("kafkajs");




const userRouter = require('./routes/userRouter');
const requestorRouter = require('./routes/requestorUser');
const adminRouter = require('./routes/admin');
const port = process.env.PORT;

app.use(express.json());
app.use('/individual', userRouter);
app.use('/requestor', requestorRouter);
app.use('/admin', adminRouter);





app.listen(port, () => {console.log(`Server started on port ${port}!`)});
