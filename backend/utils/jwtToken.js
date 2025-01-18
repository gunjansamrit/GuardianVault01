const {sign,verify}=require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;




const generateToken=(data,option={expiresIn:'15m'})=>
{
    const token=sign(data,SECRET_KEY,option);

  
    return token;


}

const verifyToken= (token)=>
{
    return verify(token,SECRET_KEY)
}

module.exports={generateToken,verifyToken}


