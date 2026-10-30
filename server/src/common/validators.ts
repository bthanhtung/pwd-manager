import { Matches, MaxLength } from 'class-validator';
import { applyDecorators } from '@nestjs/common';

/** Symmetric ciphertext produced by the web client: "1.<iv b64url>.<ciphertext b64url>". */
export const CIPHER_RE = /^1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;
/** Sealed box (ECIES) produced by the web client: "e1.<ephemeral pub>.<iv>.<ciphertext>". */
export const SEALED_RE = /^e1\.[A-Za-z0-9_-]{80,}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;
export const B64URL_RE = /^[A-Za-z0-9_-]+$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const IsCipher = (max = 200_000) => applyDecorators(Matches(CIPHER_RE, { message: 'must be client-side ciphertext' }), MaxLength(max));
export const IsSealed = () => applyDecorators(Matches(SEALED_RE, { message: 'must be a sealed key' }), MaxLength(2000));
export const IsUuid = () => Matches(UUID_RE, { message: 'must be a UUID' });
