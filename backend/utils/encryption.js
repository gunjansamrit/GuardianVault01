const CryptoJS = require('crypto-js');


function encrypt(data, key) {
    const cipherText = CryptoJS.AES.encrypt(data, key).toString();
    return cipherText;
}


function decrypt(cipherText, key) {
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const originalData = bytes.toString(CryptoJS.enc.Utf8);
    return originalData;
}

module.exports = { encrypt, decrypt };
