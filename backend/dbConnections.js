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


// MongoDB connection (production)
// (async () => {
//   try {
//       await mongoose.connect(DB_URL, {
//           useNewUrlParser: true,
//           useUnifiedTopology: true,
//       });
//       console.log('Connected to db!');
//   } catch (error) {
//       console.error('Database connection error:', error); // Use console.error for better logging
//   }})();