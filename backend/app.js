const express = require('express');
const app = express();
const dotenv=require('dotenv');
dotenv.config();
const db = require('./dbConnections');
const cors = require('cors');

const userRouter = require('./routes/userRouter');



const port = process.env.PORT;

app.use(express.json());

app.use('/', userRouter);
// app.use('/admin', adminRouter);
// app.use('/company', companyRouter);
// app.use(errlogger);

app.listen(port, () => {console.log(`Server started on port ${port}!`)});
