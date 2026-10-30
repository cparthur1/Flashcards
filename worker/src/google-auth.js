// SPDX-License-Identifier: GPL-2.0-only
/**
 * google-auth.js - Cloudflare Worker helper for Google Firebase Authentication & Admin Token Minting
 * Implemented using Web Cryptography API (crypto.subtle) without external dependencies.
 */

// Cached Google public keys for verifying client Firebase ID Tokens
let cachedPublicKeys = null;
let keysExpiry = 0;

// Cached Google OAuth2 Admin access token
let cachedAdminToken = null;
let adminTokenExpiry = 0;

function base64UrlEncode(strOrBuffer) {
  let base64;
  if (typeof strOrBuffer === 'string') {
    base64 = btoa(strOrBuffer);
  } else {
    const bytes = new Uint8Array(strOrBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

/**
 * Fetch and cache Google Firebase Auth public x509 certs
 */
async function getGooglePublicKeys() {
  const now = Date.now();
  if (cachedPublicKeys && now < keysExpiry) {
    return cachedPublicKeys;
  }

  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!res.ok) {
    throw new Error('Falha ao obter chaves públicas do Firebase');
  }

  // Check Cache-Control max-age
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
  keysExpiry = now + maxAge * 1000;

  cachedPublicKeys = await res.json();
  return cachedPublicKeys;
}

/**
 * Convert PEM certificate to CryptoKey
 */
async function importCertToKey(certPem) {
  const cleanPem = certPem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s+/g, '');
  const derBuffer = Uint8Array.from(atob(cleanPem), c => c.charCodeAt(0));

  // In Web Crypto, importing x509 cert directly or SPKI:
  // Using subtle crypto with x509 certificate import or public key parsing
  return await crypto.subtle.importKey(
    'spki',
    extractSpkiFromCert(derBuffer),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['verify']
  );
}

/**
 * Extract SubjectPublicKeyInfo from X.509 certificate DER
 */
function extractSpkiFromCert(certDer) {
  // A simplistic ASN.1 parser to extract the subjectPublicKeyInfo field
  // X.509: SEQUENCE { TBSCertificate SEQUENCE { ... subjectPublicKeyInfo SEQUENCE { ... } ... } ... }
  // We locate the algorithm identifier for rsaEncryption (1.2.840.113549.1.1.1)
  const rsaOid = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
  for (let i = 0; i < certDer.length - rsaOid.length; i++) {
    let match = true;
    for (let j = 0; j < rsaOid.length; j++) {
      if (certDer[i + j] !== rsaOid[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      // Step back to the start of the SEQUENCE containing the AlgorithmIdentifier
      // Look back for tag 0x30
      let seqStart = i - 1;
      while (seqStart > 0 && certDer[seqStart] !== 0x30) {
        seqStart--;
      }
      if (seqStart >= 0) {
        // Return from seqStart to the end of the public key
        // Determine length of SPKI sequence
        let lenByte = certDer[seqStart + 1];
        let offset = 2;
        let totalLen = 0;
        if (lenByte < 0x80) {
          totalLen = lenByte + 2;
        } else {
          const numLenBytes = lenByte & 0x7f;
          totalLen = 0;
          for (let k = 0; k < numLenBytes; k++) {
            totalLen = (totalLen << 8) | certDer[seqStart + 2 + k];
          }
          totalLen += 2 + numLenBytes;
        }
        return certDer.slice(seqStart, seqStart + totalLen).buffer;
      }
    }
  }
  throw new Error('Não foi possível extrair a chave pública do certificado');
}

/**
 * Verify a Firebase ID Token
 * @param {string} token
 * @param {string} projectId
 * @returns {Promise<object>} Decoded payload
 */
export async function verifyFirebaseIdToken(token, projectId) {
  if (!token) throw new Error('Token ausente');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Formato JWT inválido');

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64));
  const payload = JSON.parse(base64UrlDecode(payloadB64));

  // Check timing
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expirado');
  }
  if (payload.aud !== projectId) {
    throw new Error('Audience do token inválida');
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Emissor (iss) do token inválido');
  }

  const publicKeys = await getGooglePublicKeys();
  const certPem = publicKeys[header.kid];
  if (!certPem) {
    throw new Error('Chave pública do Firebase não encontrada para o kid fornecido');
  }

  const cryptoKey = await importCertToKey(certPem);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = Uint8Array.from(base64UrlDecode(signatureB64), c => c.charCodeAt(0));

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    data
  );

  if (!valid) {
    throw new Error('Assinatura do token inválida');
  }

  return payload;
}

/**
 * Convert PEM private key (PKCS#8) to CryptoKey
 */
async function importPrivateKey(pem) {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binaryDer = Uint8Array.from(atob(cleanPem), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
}

/**
 * Mint Google OAuth2 access token for Service Account
 * @param {object} serviceAccountConfig
 * @returns {Promise<string>} Bearer access token
 */
export async function getGoogleAdminAccessToken(serviceAccountConfig) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAdminToken && now < adminTokenExpiry) {
    return cachedAdminToken;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountConfig.client_email,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKey = await importPrivateKey(serviceAccountConfig.private_key);
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signedJwt = `${unsignedToken}.${base64UrlEncode(signatureBuffer)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt
    })
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Falha ao obter token OAuth2 do Google: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  cachedAdminToken = tokenData.access_token;
  adminTokenExpiry = now + (tokenData.expires_in || 3600) - 120; // 2 min buffer
  return cachedAdminToken;
}

/**
 * Assign Pro custom claim to a Firebase User
 */
export async function setFirebaseUserProClaim(serviceAccountConfig, uid, isPro = true) {
  const accessToken = await getGoogleAdminAccessToken(serviceAccountConfig);
  const projectId = serviceAccountConfig.project_id;

  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts/${uid}:setCustomUserClaims`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      customAttributes: JSON.stringify({ pro: isPro })
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao definir claim Pro no Firebase Auth: ${err}`);
  }

  return true;
}

/**
 * Permanently delete a Firebase Auth User
 */
export async function deleteFirebaseUser(serviceAccountConfig, uid) {
  const accessToken = await getGoogleAdminAccessToken(serviceAccountConfig);
  const projectId = serviceAccountConfig.project_id;

  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ localId: uid })
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Erro ao excluir usuário no Firebase Auth: ${err}`);
  }

  return true;
}
