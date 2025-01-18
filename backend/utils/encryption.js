const CryptoJS = require('crypto-js');

function encrypt(data, key) {
    const iv = CryptoJS.enc.Utf8.parse('0000000000000000'); 
    const cipherText = CryptoJS.AES.encrypt(data, CryptoJS.enc.Utf8.parse(key), { iv: iv }).toString();
    
    return cipherText;
}


function decrypt(cipherText, key) {
    const iv = CryptoJS.enc.Utf8.parse('0000000000000000'); // 16-byte IV
   

    // Convert base64 string to WordArray before decrypting
    const bytes = CryptoJS.AES.decrypt(cipherText, CryptoJS.enc.Utf8.parse(key), { iv: iv });
    
    // Convert the decrypted bytes to a UTF-8 string
    const originalData = bytes.toString(CryptoJS.enc.Utf8);

    

    if (!originalData) {
        console.error('Decryption failed: Empty result');
        return null;
    }

    return originalData;
}


module.exports = { encrypt, decrypt };
