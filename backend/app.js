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

// CORS configuration
// const corsOptions = {
//     origin: 'http://localhost:3000', // Only allow requests from this origin
//     methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
//     allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
//   };
  



//MOBLIE TESTING
const corsOptions = {
    origin: ['http://localhost:3000', 'http://192.168.0.107:3000'], // or 'http://192.168.0.107:3000' if testing from mobile
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // This is key for allowing credentials
};
app.options('*', cors(corsOptions)); // Handle preflight requests for all routes
 



// Apply CORS middleware with the specified options
app.use(cors(corsOptions));

app.use(express.json());
app.use('/individual', userRouter);
app.use('/requestor', requestorRouter);
app.use('/admin', adminRouter);





app.listen(port, () => {console.log(`Server started on port ${port}!`)});
