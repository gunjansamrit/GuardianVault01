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



const verifyJwtToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    // Verify the token
    const decoded = verifyToken(token);  // This will throw an error if the token is invalid
    req.user = decoded;  // Attach the decoded information to the request object (e.g., userId, role)
    next();  // Continue to the next middleware or route handler
  } catch (error) {
    return res.status(400).json({ message: "Invalid token." });
  }
};




module.exports={generateToken,verifyToken,verifyJwtToken}


