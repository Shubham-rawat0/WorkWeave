import crypto from "crypto"

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey():Buffer{
  const key=process.env.ENCRYPTION_KEY
  if (!key){
    throw new Error("No encryption key in env")
  }
  return Buffer.from(key,"hex")
}

//credentials encryption
function encrypt(secret:string):string{
  const key=getKey()
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher=crypto.createCipheriv(ALGORITHM,key,iv)
  let encrypted= cipher.update(secret,"utf-8")

  encrypted=Buffer.concat([encrypted,cipher.final()])
  const tag=cipher.getAuthTag()
  const packed=Buffer.concat([iv,tag,encrypted])
  return packed.toString("base64")
}

function decrypt(plainText:string):string{
  const key=getKey()
  const packed=Buffer.from(plainText,"base64")
  const iv=packed.subarray(0,IV_LENGTH)
  const tag=packed.subarray(IV_LENGTH,IV_LENGTH+TAG_LENGTH)
  const encrypted = packed.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher=crypto.createDecipheriv(ALGORITHM,key,iv)
  decipher.setAuthTag(tag)
  let decrypted=decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

export function encryptJson(data: unknown): string {
  const json = JSON.stringify(data);

  if (json === undefined) {
    throw new Error("Value cannot be serialized to JSON");
  }

  return encrypt(json);
}

export function decryptJson<T = unknown>(ciphertext: string): T {
  return JSON.parse(decrypt(ciphertext)) as T;
}