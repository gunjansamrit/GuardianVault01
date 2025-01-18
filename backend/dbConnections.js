// Using Node.js `require()`
const mongoose = require('mongoose');
const DB_URL=process.env.DB_URL;

  (async()=>{
   
    try{
        await mongoose.connect(DB_URL)
          console.log('Connected to db!');

    }catch(error){
        console.log(error);
    }


  })()