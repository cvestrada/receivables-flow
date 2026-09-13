import canonicalize from 'canonicalize';
import { createPrivateKey, sign } from 'node:crypto';

/**
 * Signing a request with an authorization key, the way Privy checks it.
 *
 * A resource with an owner cannot be changed on the strength of the app secret alone: the owner
 * has to sign the exact request, and Privy re-derives what that signature should be from the
 * method, the url, the body and the app id. Canonical JSON is what makes the two derivations
 * agree — two encodings of the same object would otherwise produce two different signatures.
 *
 * This existed nowhere for a while, and the fund's own allocation put the private key itself in
 * the signature header. Privy answered "no valid authorization signatures were provided", which
 * is the politest possible way to say that.
 */

/** The shape Privy hashes. `version` is theirs, and it is not the API version. */
interface SignedPayload {
  version: 1;
  method: 'POST' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  headers: { 'privy-app-id': string };
}

/**
 * Sign one request with a P-256 authorization key.
 *
 * @param appId - The Privy app the request is for; part of what is signed
 * @param url - The full request url, including the host
 * @param body - The exact body that will be sent
 * @param key - The authorization key, with or without its `wallet-auth:` label
 * @returns The signature, base64, for the `privy-authorization-signature` header
 */
export function authorizationSignature({
  appId,
  url,
  body,
  key,
  method = 'POST',
}: {
  appId: string;
  url: string;
  body: unknown;
  key: string;
  /** The verb being signed. Privy hashes it, so a PATCH signed as a POST is refused. */
  method?: 'POST' | 'PATCH' | 'DELETE';
}): string {
  const payload: SignedPayload = {
    version: 1,
    method,
    url,
    body,
    headers: { 'privy-app-id': appId },
  };

  /*
   * The dashboard shows the key with a `wallet-auth:` label in front of it. The label is not
   * part of the key, and PEM is the only shape node's crypto will accept it in.
   */
  const pem = createPrivateKey({
    key: `-----BEGIN PRIVATE KEY-----\n${key.replace('wallet-auth:', '')}\n-----END PRIVATE KEY-----`,
    format: 'pem',
  });

  return sign('sha256', Buffer.from(canonicalize(payload) as string), pem).toString('base64');
}
