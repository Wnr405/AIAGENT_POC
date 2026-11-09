import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../../../shared/kernel/errors';
import {
  allowedMimeTypes,
  assertMagicMatches,
  assertSize,
  declaredKind,
  detectKind,
  extensionOf,
} from './file-type-policy';
import { MediaItem } from './media-item.entity';
import { assertSafeSvg } from './svg-safety';

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const GIF87 = text('GIF87a...');
const GIF89 = text('GIF89a...');
const PDF = text('%PDF-1.7');

describe('file type policy (FR-MEDIA-01/03) — critical path', () => {
  it('derives extensions', () => {
    expect([extensionOf('a.B.PNG'), extensionOf('noext')]).toEqual(['png', '']);
  });

  it.each([
    ['photo.jpg', 'image/jpeg', 'jpeg'],
    ['photo.JPEG', 'image/jpeg; charset=binary', 'jpeg'],
    ['a.png', 'image/png', 'png'],
    ['a.webp', 'image/webp', 'webp'],
    ['a.gif', 'image/gif', 'gif'],
    ['a.svg', 'image/svg+xml', 'svg'],
    ['a.pdf', 'application/pdf', 'pdf'],
  ])('accepts %s as %s', (name: string, mime: string, kind: string) => {
    expect(declaredKind(name, mime)).toBe(kind);
  });

  it('rejects types outside the allow-list and mismatched extensions', () => {
    expect(() => declaredKind('a.exe', 'application/x-msdownload')).toThrow('Unsupported file type');
    expect(() => declaredKind('a.png', 'image/jpeg')).toThrow('extension does not match');
    expect(() => declaredKind('a', '')).toThrow(ValidationError);
    expect(allowedMimeTypes()).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'application/pdf',
    ]);
  });

  it('detects real types from magic bytes', () => {
    expect([PNG, JPEG, WEBP, GIF87, GIF89, PDF].map(detectKind)).toEqual(['png', 'jpeg', 'webp', 'gif', 'gif', 'pdf']);
    expect(detectKind(text('﻿<?xml version="1.0"?><!-- c --><!DOCTYPE svg><svg xmlns="x"></svg>'))).toBe('svg');
    expect(detectKind(text('<svg>'))).toBe('svg');
    expect(detectKind(text('<html><svg>'))).toBeNull();
    expect(detectKind(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20))).toBeNull(); // RIFF/AVI
    expect(detectKind(bytes())).toBeNull();
  });

  it('rejects content whose magic bytes disagree with the declared type', () => {
    expect(() => assertMagicMatches('png', JPEG)).toThrow('does not match its declared type');
    expect(() => assertMagicMatches('png', PNG)).not.toThrow();
  });

  it('enforces size limits (FR-MEDIA-02)', () => {
    expect(() => assertSize(0, 10)).toThrow('empty');
    expect(() => assertSize(1.5, 10)).toThrow('empty');
    expect(() => assertSize(11, 10 * 1048576 - 1)).not.toThrow();
    expect(() => assertSize(20 * 1048576 + 1, 20 * 1048576)).toThrow('exceeds the 20 MB limit');
  });
});

describe('SVG safety (SEC-05) — critical path', () => {
  it('accepts a plain SVG', () => {
    expect(() =>
      assertSafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" fill="#000"/></svg>'),
    ).not.toThrow();
  });
  it.each([
    ['<svg><script>alert(1)</script></svg>', 'script element'],
    ['<svg><foreignObject><div/></foreignObject></svg>', 'foreignObject element'],
    ['<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>', 'XML entity declaration'],
    ['<svg onload="alert(1)"/>', 'event handler attribute'],
    ['<svg><a href="javascript:alert(1)"/></svg>', 'javascript: URL'],
    ['<svg><image href="data:text/html,x"/></svg>', 'HTML data URL'],
    ['<svg><image xlink:href="https://evil/x.png"/></svg>', 'external reference'],
    ['<svg><use href="//evil/x"/></svg>', 'external reference'],
    ['<svg><iframe/></svg>', 'embedded content'],
    ['<svg><style>@import "x.css";</style></svg>', 'external stylesheet reference'],
    ['<svg><rect style="fill:url(https://evil/x)"/></svg>', 'external stylesheet reference'],
  ])('rejects %s', (svg: string, reason: string) => {
    expect(() => assertSafeSvg(svg)).toThrow(reason);
  });
});

describe('MediaItem', () => {
  const actor = { userId: 'u1', role: 'author' as const, ip: '1.1.1.1' };
  const T = new Date('2026-05-01T00:00:00Z');
  const register = (kind: 'png' | 'svg' | 'pdf' = 'png', alt: string | null = ' Alt ') =>
    MediaItem.register(
      {
        id: 'm1',
        storageKey: 'uploads/u1/m1.png',
        filename: 'a.png',
        mimeType: 'image/png',
        kind,
        sizeBytes: 10,
        width: null,
        height: null,
        altText: alt,
        caption: null,
        uploadedBy: 'u1',
        createdAt: T,
      },
      actor,
    );

  it('registers with trimmed metadata and raises media.upload', () => {
    const m = register();
    expect([m.id, m.kind, m.storageKey, m.uploadedBy, m.isDeleted, m.toProps().altText]).toEqual([
      'm1',
      'png',
      'uploads/u1/m1.png',
      'u1',
      false,
      'Alt',
    ]);
    expect(m.pullDomainEvents()[0]).toMatchObject({
      type: 'media.upload',
      target: { type: 'media', id: 'm1' },
      summary: { sizeBytes: 10 },
    });
  });

  it('validates alt text and caption length', () => {
    expect(() => register('png', 'a'.repeat(501))).toThrow('altText must be at most 500');
    expect(() => register().updateMetadata({ caption: 'c'.repeat(1001) }, T, actor)).toThrow('caption');
  });

  it('only raster images need variants', () => {
    expect([register('png').needsVariants(), register('svg').needsVariants(), register('pdf').needsVariants()]).toEqual(
      [true, false, false],
    );
  });

  it('updates metadata, attaches variants and lists all keys', () => {
    const m = register();
    m.updateMetadata({ altText: 'New', caption: ' Cap ' }, T, actor);
    m.updateMetadata({}, T, actor);
    m.attachVariants({ width: 2000, height: 1000 }, { thumbnail: { key: 'k_t', width: 320, height: 160 } });
    expect(m.toProps()).toMatchObject({ altText: 'New', caption: 'Cap', width: 2000, height: 1000 });
    expect(m.allKeys()).toEqual(['uploads/u1/m1.png', 'k_t']);
  });

  it('soft delete is final', () => {
    const m = register();
    m.softDelete(T, actor, true);
    expect(m.isDeleted).toBe(true);
    expect(m.pullDomainEvents().at(-1)).toMatchObject({ type: 'media.delete', summary: { forced: true } });
    expect(() => m.softDelete(T, actor, false)).toThrow(NotFoundError);
    expect(() => m.updateMetadata({ altText: 'x' }, T, actor)).toThrow(NotFoundError);
    expect(MediaItem.rehydrate(m.toProps()).isDeleted).toBe(true);
  });
});
