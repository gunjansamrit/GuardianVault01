const express = require('express');
const app = express();
const dotenv=require('dotenv');
dotenv.config();
const db = require('./dbConnections');
const cors = require('cors');

const userRouter = require('./routes/userRouter');
const requestorRouter = require('./routes/requestorUser');



const port = process.env.PORT;

app.use(express.json());

app.use('/', userRouter);
app.use('/requestor', requestorRouter);

// app.use(errlogger);

app.listen(port, () => {console.log(`Server started on port ${port}!`)});
